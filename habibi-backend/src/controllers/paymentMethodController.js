const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { getActiveAccount } = require('./authNetController');
const { createCustomerProfileFromTransaction, deleteCustomerPaymentProfile } = require('../services/authNetService');
const { getActiveCardProcessor, getCardProcessorAccountByProvider } = require('./cardProcessorController');
const squareService = require('../services/squareService');
const cloverService = require('../services/cloverService');

const MAX_SAVED_CARDS = 5;

// Get saved payment methods
const getPaymentMethods = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, type AS brand, last_four AS last4, expiry, is_default, created_at FROM payment_methods WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Vault a card, any processor. brand/last4/expiry come from the frontend,
// which already has them locally for its own card-brand badge -- we never
// see or store the actual card number, only each processor's own
// reference ids.
//
// Authorize.net vaults by referencing a transaction that already succeeded
// (opaque tokens are single-use, so this can't happen from the same
// tokenization as the charge itself -- see authNetService.
// createCustomerProfileFromTransaction). Square/Clover's tokens are also
// single-use, so for those the frontend tokenizes a SECOND time right
// after a successful charge (the card element is still mounted) and sends
// that fresh token here as sourceToken, rather than trying to reuse the
// one that already paid for the order.
const saveFromTransaction = async (req, res) => {
  const { provider = 'authorize_net', transactionId, sourceToken, brand, last4, expiry } = req.body;
  if (provider === 'authorize_net' && !transactionId) return res.status(400).json({ message: 'transactionId required' });
  if (provider !== 'authorize_net' && !sourceToken) return res.status(400).json({ message: 'sourceToken required' });

  try {
    const countRes = await pool.query("SELECT COUNT(*) FROM payment_methods WHERE user_id=$1", [req.user.id]);
    if (parseInt(countRes.rows[0].count, 10) >= MAX_SAVED_CARDS) {
      return res.status(400).json({ message: `You can save up to ${MAX_SAVED_CARDS} cards. Remove one first.` });
    }
    // First saved card defaults to "default" automatically -- nothing to
    // pick between yet.
    const isFirst = parseInt(countRes.rows[0].count, 10) === 0;

    let authnetCustomerProfileId = null;
    let authnetPaymentProfileId  = null;
    let processorCustomerRef     = null;
    let processorCardRef         = null;

    if (provider === 'authorize_net') {
      const account = await getActiveAccount();
      if (!account) return res.status(503).json({ message: 'Payment processor not configured.' });
      const vaulted = await createCustomerProfileFromTransaction({
        transactionId,
        apiLoginId:     account.api_login_id,
        transactionKey: account.transaction_key,
        environment:    account.environment,
      });
      authnetCustomerProfileId = vaulted.customerProfileId;
      authnetPaymentProfileId  = vaulted.customerPaymentProfileId;
    } else if (provider === 'square') {
      const active = await getActiveCardProcessor();
      if (!active || active.provider !== 'square') return res.status(503).json({ message: 'Payment processor not configured.' });
      const vaulted = await squareService.createCustomerAndCard({
        sourceId:    sourceToken,
        accessToken: active.account.credentials.accessToken,
        environment: active.account.environment,
      });
      processorCustomerRef = vaulted.customerId;
      processorCardRef     = vaulted.cardId;
    } else if (provider === 'clover') {
      const active = await getActiveCardProcessor();
      if (!active || active.provider !== 'clover') return res.status(503).json({ message: 'Payment processor not configured.' });
      const vaulted = await cloverService.createCustomerCard({
        sourceToken,
        privateToken: active.account.credentials.privateToken,
        environment:  active.account.environment,
      });
      processorCustomerRef = vaulted.customerId;
      processorCardRef     = vaulted.cardToken;
    } else {
      return res.status(400).json({ message: 'Unknown payment processor.' });
    }

    const insertResult = await pool.query(
      `INSERT INTO payment_methods
         (user_id, type, last_four, expiry, authnet_customer_profile_id, authnet_payment_profile_id,
          processor, processor_customer_ref, processor_card_ref, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id, type AS brand, last_four AS last4, expiry, is_default, created_at`,
      [req.user.id, brand || null, last4 || null, expiry || null,
       authnetCustomerProfileId, authnetPaymentProfileId,
       provider, processorCustomerRef, processorCardRef, isFirst]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Set default
const setDefaultMethod = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE payment_methods SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
    const result = await pool.query(
      "UPDATE payment_methods SET is_default=TRUE WHERE id=$1 AND user_id=$2 RETURNING id, type AS brand, last_four AS last4, expiry, is_default, created_at",
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Payment method not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Delete payment method — removes it from the processor's vault first, not
// just our own row, so a deleted card can't still be charged there. Looks
// up credentials by the card's OWN saved processor (not whichever is
// currently active), since a card saved under Square must stay deletable
// even after the admin switches to Clover.
const deletePaymentMethod = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query(
      `SELECT processor, authnet_customer_profile_id, authnet_payment_profile_id, processor_customer_ref, processor_card_ref
         FROM payment_methods WHERE id=$1 AND user_id=$2`,
      [id, req.user.id]
    );
    if (!existing.rows.length) return res.json({ message: "Payment method removed" });

    const card = existing.rows[0];
    const provider = card.processor || 'authorize_net';

    if (provider === 'authorize_net' && card.authnet_customer_profile_id && card.authnet_payment_profile_id) {
      const account = await getActiveAccount();
      if (account) {
        await deleteCustomerPaymentProfile({
          customerProfileId:        card.authnet_customer_profile_id,
          customerPaymentProfileId: card.authnet_payment_profile_id,
          apiLoginId:     account.api_login_id,
          transactionKey: account.transaction_key,
          environment:    account.environment,
        }).catch(err => console.error('[SavedCard] Authorize.net delete failed, removing local row anyway:', err.message));
      }
    } else if (provider === 'square' && card.processor_card_ref) {
      const account = await getCardProcessorAccountByProvider('square');
      if (account) {
        await squareService.disableCard({
          cardId:      card.processor_card_ref,
          accessToken: account.credentials.accessToken,
          environment: account.environment,
        }).catch(err => console.error('[SavedCard] Square delete failed, removing local row anyway:', err.message));
      }
    } else if (provider === 'clover' && card.processor_card_ref) {
      const account = await getCardProcessorAccountByProvider('clover');
      if (account) {
        await cloverService.deleteCustomerCard({
          customerId:   card.processor_customer_ref,
          cardToken:    card.processor_card_ref,
          privateToken: account.credentials.privateToken,
          environment:  account.environment,
        }).catch(err => console.error('[SavedCard] Clover delete failed, removing local row anyway:', err.message));
      }
    }

    await pool.query("DELETE FROM payment_methods WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ message: "Payment method removed" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getPaymentMethods,
  saveFromTransaction,
  setDefaultMethod,
  deletePaymentMethod,
};
