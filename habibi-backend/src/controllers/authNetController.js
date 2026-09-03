const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { chargeCard, refundTransaction, chargeCustomerProfile } = require('../services/authNetService');
const { logAudit } = require('./auditController');
const { resolveChargeAmount } = require('../utils/resolveChargeAmount');
const { finalizePendingCheckout } = require('./orderController');
const { encrypt, decrypt } = require('../utils/encrypt');
const { deactivateAllCardProcessors } = require('../services/cardProcessorRegistry');

// ── Helper — fetch the currently active account ───────────────────────────
// transaction_key is the live Authorize.net API secret (authorizes real card
// charges) — decrypt here, once, so every caller transparently gets the real
// value. decrypt() safely no-ops on any pre-existing plaintext row.
async function getActiveAccount() {
  const res = await pool.query(
    `SELECT * FROM authorize_net_accounts WHERE is_active = TRUE LIMIT 1`
  );
  const account = res.rows[0];
  if (account?.transaction_key) account.transaction_key = decrypt(account.transaction_key);
  return account || null;
}

// ── Public: return apiLoginId + clientKey for Accept.js (no secret key) ──
const getPublicConfig = async (req, res) => {
  try {
    const account = await getActiveAccount();
    if (!account) {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }
    res.json({
      apiLoginId:  account.api_login_id,
      clientKey:   account.client_key,
      environment: account.environment,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Public: charge card using opaqueData token from Accept.js ─────────────
const chargeCardEndpoint = async (req, res) => {
  const { opaqueData, amount: clientAmount, orderNumber, customerName, customerPhone, billingZip, reason, note } = req.body;
  if (!opaqueData?.dataDescriptor || !opaqueData?.dataValue) {
    return res.status(400).json({ error: 'Invalid payment token.' });
  }

  try {
    // Charge amount comes from the order's own server-side total when an
    // orderNumber is given — never trust a client-supplied amount for a real order.
    const { amount } = await resolveChargeAmount(orderNumber, clientAmount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const account = await getActiveAccount();
    if (!account) {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }

    const result = await chargeCard({
      opaqueData,
      amount,
      orderNumber,
      billingZip,
      apiLoginId:     account.api_login_id,
      transactionKey: account.transaction_key,
      environment:    account.environment,
    });

    // Materializes the pending_checkouts row staged by the frontend's
    // "prepare" step into a real, paid guest_orders row (or, if none
    // exists, falls back to a plain UPDATE). See finalizePendingCheckout.
    if (orderNumber) {
      await finalizePendingCheckout(req, orderNumber, { transactionId: result.transactionId, processor: 'authorize_net' });
    }

    // Durable record of the charge itself — independent of whether it's
    // tied to a real order, so a catering deposit / wholesale invoice /
    // other ad-hoc charge through the Make a Payment page isn't only ever
    // visible in the Authorize.net dashboard.
    await pool.query(
      `INSERT INTO quick_payments (order_number, amount, reason, note, customer_name, customer_phone, transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderNumber || null, parseFloat(amount), reason || null, note || null, customerName || null, customerPhone || null, result.transactionId]
    ).catch(err => console.error('[QuickPay] Failed to log payment record:', err.message));

    res.json({ success: true, transactionId: result.transactionId, authCode: result.authCode });
  } catch (err) {
    res.status(err.statusCode || 402).json({ error: err.message || 'Payment failed.' });
  }
};

// ── Authenticated: charge a previously-saved card, no card data involved ──
const chargeSavedCardEndpoint = async (req, res) => {
  const { paymentMethodId, amount: clientAmount, orderNumber } = req.body;
  if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required.' });

  try {
    // Scoped to req.user.id -- a saved card can only ever be charged by the
    // account that saved it, never by id alone.
    const cardRes = await pool.query(
      `SELECT authnet_customer_profile_id, authnet_payment_profile_id
         FROM payment_methods WHERE id=$1 AND user_id=$2`,
      [paymentMethodId, req.user.id]
    );
    if (!cardRes.rows.length) return res.status(404).json({ error: 'Saved card not found.' });
    const { authnet_customer_profile_id: customerProfileId, authnet_payment_profile_id: customerPaymentProfileId } = cardRes.rows[0];

    // Charge amount comes from the order's own server-side total when an
    // orderNumber is given — never trust a client-supplied amount for a real order.
    const { amount } = await resolveChargeAmount(orderNumber, clientAmount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const account = await getActiveAccount();
    if (!account) return res.status(503).json({ error: 'Payment processor not configured.' });

    const result = await chargeCustomerProfile({
      customerProfileId,
      customerPaymentProfileId,
      amount,
      orderNumber,
      apiLoginId:     account.api_login_id,
      transactionKey: account.transaction_key,
      environment:    account.environment,
    });

    if (orderNumber) {
      await finalizePendingCheckout(req, orderNumber, { transactionId: result.transactionId, processor: 'authorize_net' });
    }

    await pool.query(
      `INSERT INTO quick_payments (order_number, amount, reason, transaction_id)
       VALUES ($1, $2, $3, $4)`,
      [orderNumber || null, parseFloat(amount), 'saved_card', result.transactionId]
    ).catch(err => console.error('[QuickPay] Failed to log payment record:', err.message));

    res.json({ success: true, transactionId: result.transactionId, authCode: result.authCode });
  } catch (err) {
    res.status(err.statusCode || 402).json({ error: err.message || 'Payment failed.' });
  }
};

// ── Admin: refund via Authorize.net ────────────────────────────────────────
const refundEndpoint = async (req, res) => {
  const { orderNumber } = req.params;
  try {
    const orderRes = await pool.query(
      `SELECT payment_intent_id, total FROM guest_orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found.' });

    const { payment_intent_id: transactionId, total } = orderRes.rows[0];
    if (!transactionId) return res.status(400).json({ error: 'No transaction ID on this order.' });

    const account = await getActiveAccount();
    if (!account) return res.status(503).json({ error: 'Payment processor not configured.' });

    await refundTransaction({
      transactionId,
      amount:         total,
      cardLastFour:   '0000',
      apiLoginId:     account.api_login_id,
      transactionKey: account.transaction_key,
      environment:    account.environment,
    });

    await pool.query(
      `UPDATE guest_orders SET payment_status = 'refunded', updated_at = NOW() WHERE order_number = $1`,
      [orderNumber]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Refund failed.' });
  }
};

// ── Admin CRUD for merchant accounts ─────────────────────────────────────
const listAccounts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nickname, api_login_id, client_key, environment, is_active, created_at
         FROM authorize_net_accounts
        ORDER BY is_active DESC, created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const createAccount = async (req, res) => {
  const { nickname, api_login_id, transaction_key, client_key, environment } = req.body;
  if (!nickname || !api_login_id || !transaction_key) {
    return res.status(400).json({ error: 'nickname, api_login_id, and transaction_key are required.' });
  }
  try {
    // Auto-activate the very first account so card payments go live as soon
    // as credentials are entered, instead of silently staying disabled until
    // someone remembers to also click "Set Active".
    const existing = await pool.query(`SELECT 1 FROM authorize_net_accounts LIMIT 1`);
    const isFirst = existing.rows.length === 0;

    const result = await pool.query(
      `INSERT INTO authorize_net_accounts (nickname, api_login_id, transaction_key, client_key, environment, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [nickname, api_login_id, encrypt(transaction_key), client_key || null, environment || 'production', isFirst]
    );
    // Never log transaction_key/client_key — this is a real merchant secret.
    logAudit(pool, req.user?.id, req.user?.name, 'create_payment_account', 'payment_account', String(result.rows[0].id),
      { nickname, environment: environment || 'production', auto_activated: isFirst }, req.ip);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { nickname, api_login_id, transaction_key, client_key, environment } = req.body;
  try {
    // The edit form always blanks transaction_key ("leave blank to keep
    // existing") and submits that blank value unless the admin retypes it —
    // NULLIF turns that blank string into SQL NULL so COALESCE falls back to
    // the existing key instead of overwriting it with ''. Encrypt only when
    // a real new value was actually typed — encrypting '' would produce a
    // non-empty ciphertext and defeat the NULLIF blank-means-keep check.
    const encryptedKey = transaction_key ? encrypt(transaction_key) : '';
    await pool.query(
      `UPDATE authorize_net_accounts
          SET nickname        = COALESCE($1, nickname),
              api_login_id    = COALESCE($2, api_login_id),
              transaction_key = COALESCE(NULLIF($3, ''), transaction_key),
              client_key      = COALESCE($4, client_key),
              environment     = COALESCE($5, environment)
        WHERE id = $6`,
      [nickname, api_login_id, encryptedKey, client_key, environment, id]
    );
    // Never log transaction_key/client_key — record only that it changed, not the value.
    logAudit(pool, req.user?.id, req.user?.name, 'update_payment_account', 'payment_account', String(id),
      { nickname, environment, transaction_key_changed: !!transaction_key }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    // The frontend only shows the Delete button for inactive accounts, but
    // enforce it server-side too — deleting the active account would leave
    // is_active pointing at nothing and silently disable card payments.
    const account = await pool.query(`SELECT is_active FROM authorize_net_accounts WHERE id = $1`, [id]);
    if (!account.rows.length) return res.status(404).json({ error: 'Account not found.' });
    if (account.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot delete the active account — set another account active first.' });
    }
    await pool.query(`DELETE FROM authorize_net_accounts WHERE id = $1`, [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_payment_account', 'payment_account', String(id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const setActiveAccount = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Reactivating Authorize.net must also turn off any active Square/Clover
    // account -- exactly one card processor is active globally, across both
    // tables (see cardProcessorRegistry.js).
    await deactivateAllCardProcessors(client);
    const result = await client.query(`UPDATE authorize_net_accounts SET is_active = TRUE WHERE id = $1`, [id]);
    // Without this check, a stale/invalid id deactivates every account (the
    // first UPDATE) then matches nothing on the second — committing a state
    // with NO active account and card payments silently disabled, while
    // still reporting success.
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found.' });
    }
    await client.query('COMMIT');
    logAudit(pool, req.user?.id, req.user?.name, 'activate_payment_account', 'payment_account', String(id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json(safeError(err));
  } finally {
    client.release();
  }
};

module.exports = {
  getPublicConfig,
  chargeCardEndpoint,
  chargeSavedCardEndpoint,
  refundEndpoint,
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  setActiveAccount,
  getActiveAccount,
};
