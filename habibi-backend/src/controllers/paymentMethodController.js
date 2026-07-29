const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { getActiveAccount } = require('./authNetController');
const { createCustomerProfileFromTransaction, deleteCustomerPaymentProfile } = require('../services/authNetService');

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

// Vault a card by referencing a transaction that already succeeded (see
// authNetService.createCustomerProfileFromTransaction for why -- opaque
// tokens are single-use, so this can't happen from the same tokenization
// as the charge itself). brand/last4/expiry come from the frontend, which
// already has them locally for its own card-brand badge -- we never see or
// store the actual card number, only Authorize.net's profile ids.
const saveFromTransaction = async (req, res) => {
  const { transactionId, brand, last4, expiry } = req.body;
  if (!transactionId) return res.status(400).json({ message: 'transactionId required' });

  try {
    const countRes = await pool.query("SELECT COUNT(*) FROM payment_methods WHERE user_id=$1", [req.user.id]);
    if (parseInt(countRes.rows[0].count, 10) >= MAX_SAVED_CARDS) {
      return res.status(400).json({ message: `You can save up to ${MAX_SAVED_CARDS} cards. Remove one first.` });
    }

    const account = await getActiveAccount();
    if (!account) return res.status(503).json({ message: 'Payment processor not configured.' });

    const { customerProfileId, customerPaymentProfileId } = await createCustomerProfileFromTransaction({
      transactionId,
      apiLoginId:     account.api_login_id,
      transactionKey: account.transaction_key,
      environment:    account.environment,
    });

    // First saved card defaults to "default" automatically -- nothing to
    // pick between yet.
    const isFirst = parseInt(countRes.rows[0].count, 10) === 0;

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, type, last_four, expiry, authnet_customer_profile_id, authnet_payment_profile_id, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, type AS brand, last_four AS last4, expiry, is_default, created_at`,
      [req.user.id, brand || null, last4 || null, expiry || null, customerProfileId, customerPaymentProfileId, isFirst]
    );

    res.status(201).json(result.rows[0]);
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

// Delete payment method — removes it from Authorize.net's vault first, not
// just our own row, so a deleted card can't still be charged there.
const deletePaymentMethod = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query(
      "SELECT authnet_customer_profile_id, authnet_payment_profile_id FROM payment_methods WHERE id=$1 AND user_id=$2",
      [id, req.user.id]
    );
    if (!existing.rows.length) return res.json({ message: "Payment method removed" });

    const { authnet_customer_profile_id: customerProfileId, authnet_payment_profile_id: customerPaymentProfileId } = existing.rows[0];
    if (customerProfileId && customerPaymentProfileId) {
      const account = await getActiveAccount();
      if (account) {
        await deleteCustomerPaymentProfile({
          customerProfileId,
          customerPaymentProfileId,
          apiLoginId:     account.api_login_id,
          transactionKey: account.transaction_key,
          environment:    account.environment,
        }).catch(err => console.error('[SavedCard] Authorize.net delete failed, removing local row anyway:', err.message));
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
