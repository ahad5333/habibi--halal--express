const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { logAudit } = require('./auditController');
const { encryptObject, decryptObject, decrypt } = require('../utils/encrypt');
const { deactivateAllCardProcessors } = require('../services/cardProcessorRegistry');
const { resolveChargeAmount } = require('../utils/resolveChargeAmount');
const squareService = require('../services/squareService');
const cloverService = require('../services/cloverService');
const { chargeCustomerProfile } = require('../services/authNetService');
const { finalizePendingCheckout } = require('./orderController');

// Non-secret fields per provider — safe to send back to the browser as-is.
// Everything else in `credentials` is a real secret and must never leave
// the backend once written (mirrors how transaction_key never round-trips
// back to the admin UI in authNetController.js).
const PUBLIC_FIELDS = {
  square: ['applicationId', 'locationId', 'mcc'],
  clover: ['merchantId', 'publicToken'],
};

// ── Helper — fetch the currently active card processor, of any kind ──────
// Checks authorize_net_accounts and card_processor_accounts for whichever
// single row is active across both tables (deactivateAllCardProcessors
// guarantees there's at most one). Returns decrypted credentials — callers
// get the real values, same contract as authNetController.getActiveAccount().
async function getActiveCardProcessor() {
  const authNet = await pool.query(`SELECT * FROM authorize_net_accounts WHERE is_active = TRUE LIMIT 1`);
  if (authNet.rows[0]) {
    const account = authNet.rows[0];
    if (account.transaction_key) account.transaction_key = decrypt(account.transaction_key);
    return { provider: 'authorize_net', account };
  }

  const other = await pool.query(`SELECT * FROM card_processor_accounts WHERE is_active = TRUE LIMIT 1`);
  if (other.rows[0]) {
    const row = other.rows[0];
    return { provider: row.provider, account: { ...row, credentials: decryptObject(row.credentials || {}) } };
  }

  return null;
}

// ── Helper — fetch credentials for a SPECIFIC provider, active or not ────
// Saved cards must keep working against whichever processor originally
// saved them even after the admin switches the active one (see
// chargeSavedCardEndpoint / paymentMethodController's delete flow) — this
// is the "any account for this provider" lookup that makes that possible,
// as opposed to getActiveCardProcessor()'s "whichever is active" lookup.
async function getCardProcessorAccountByProvider(provider) {
  if (provider === 'authorize_net') {
    const res = await pool.query(`SELECT * FROM authorize_net_accounts ORDER BY is_active DESC, created_at DESC LIMIT 1`);
    const account = res.rows[0];
    if (account?.transaction_key) account.transaction_key = decrypt(account.transaction_key);
    return account || null;
  }
  const res = await pool.query(
    `SELECT * FROM card_processor_accounts WHERE provider = $1 ORDER BY is_active DESC, created_at DESC LIMIT 1`,
    [provider]
  );
  const row = res.rows[0];
  return row ? { ...row, credentials: decryptObject(row.credentials || {}) } : null;
}

// ── Public: which processor (if any) is live, and its non-secret config ──
const getPublicCardConfig = async (req, res) => {
  try {
    const active = await getActiveCardProcessor();
    if (!active) {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }
    if (active.provider === 'authorize_net') {
      return res.json({
        provider:    'authorize_net',
        apiLoginId:  active.account.api_login_id,
        clientKey:   active.account.client_key,
        environment: active.account.environment,
      });
    }
    const fields = PUBLIC_FIELDS[active.provider] || [];
    const config = { provider: active.provider, environment: active.account.environment };
    for (const f of fields) config[f] = active.account.credentials[f];
    res.json(config);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Public: charge card using a Square/Clover tokenized source ───────────
// Authorize.net keeps using its own dedicated /authnet/charge endpoint
// (AuthNetForm.jsx posts there directly) -- this one is for whichever of
// the two newer processors is currently active.
const chargeCardEndpoint = async (req, res) => {
  const { sourceId, amount: clientAmount, orderNumber, customerName, customerPhone, reason, note } = req.body;
  if (!sourceId) {
    return res.status(400).json({ error: 'Invalid payment token.' });
  }

  try {
    // Charge amount comes from the order's own server-side total when an
    // orderNumber is given — never trust a client-supplied amount for a real order.
    const { amount } = await resolveChargeAmount(orderNumber, clientAmount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const active = await getActiveCardProcessor();
    if (!active || active.provider === 'authorize_net') {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }

    let result;
    if (active.provider === 'square') {
      result = await squareService.chargeCard({
        sourceId,
        amount,
        orderNumber,
        accessToken: active.account.credentials.accessToken,
        locationId:  active.account.credentials.locationId,
        environment: active.account.environment,
      });
    } else if (active.provider === 'clover') {
      result = await cloverService.chargeCard({
        sourceToken:  sourceId,
        amount,
        orderNumber,
        privateToken: active.account.credentials.privateToken,
        environment:  active.account.environment,
      });
    } else {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }

    if (orderNumber) {
      // Materializes the pending_checkouts row staged by the frontend's
      // "prepare" step into a real, paid guest_orders row (or, if none
      // exists, falls back to a plain UPDATE). See finalizePendingCheckout.
      await finalizePendingCheckout(req, orderNumber, { transactionId: result.transactionId, processor: active.provider });
    }

    // Durable record of the charge itself — independent of whether it's
    // tied to a real order, same pattern as authNetController's chargeCardEndpoint.
    await pool.query(
      `INSERT INTO quick_payments (order_number, amount, reason, note, customer_name, customer_phone, transaction_id, payment_processor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderNumber || null, parseFloat(amount), reason || null, note || null, customerName || null, customerPhone || null, result.transactionId, active.provider]
    ).catch(err => console.error('[QuickPay] Failed to log payment record:', err.message));

    res.json({ success: true, transactionId: result.transactionId, authCode: result.authCode });
  } catch (err) {
    res.status(err.statusCode || 402).json({ error: err.message || 'Payment failed.' });
  }
};

// ── Authenticated: charge a previously-saved card, any processor ─────────
// A saved card always charges through the processor that originally saved
// it (payment_methods.processor), not whatever's currently active in the
// admin panel -- otherwise switching processors would silently break every
// saved card from the old one.
const chargeSavedCardEndpoint = async (req, res) => {
  const { paymentMethodId, amount: clientAmount, orderNumber } = req.body;
  if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required.' });

  try {
    // Scoped to req.user.id -- a saved card can only ever be charged by the
    // account that saved it, never by id alone.
    const cardRes = await pool.query(
      `SELECT processor, authnet_customer_profile_id, authnet_payment_profile_id, processor_customer_ref, processor_card_ref
         FROM payment_methods WHERE id=$1 AND user_id=$2`,
      [paymentMethodId, req.user.id]
    );
    if (!cardRes.rows.length) return res.status(404).json({ error: 'Saved card not found.' });
    const card = cardRes.rows[0];
    const provider = card.processor || 'authorize_net';

    const { amount } = await resolveChargeAmount(orderNumber, clientAmount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const account = await getCardProcessorAccountByProvider(provider);
    if (!account) {
      return res.status(503).json({ error: "This saved card's payment processor is no longer available — please add a new card." });
    }

    let result;
    if (provider === 'authorize_net') {
      result = await chargeCustomerProfile({
        customerProfileId:        card.authnet_customer_profile_id,
        customerPaymentProfileId: card.authnet_payment_profile_id,
        amount, orderNumber,
        apiLoginId:     account.api_login_id,
        transactionKey: account.transaction_key,
        environment:    account.environment,
      });
    } else if (provider === 'square') {
      result = await squareService.chargeCustomerCard({
        customerId: card.processor_customer_ref,
        cardId:     card.processor_card_ref,
        amount, orderNumber,
        accessToken: account.credentials.accessToken,
        locationId:  account.credentials.locationId,
        environment: account.environment,
      });
    } else if (provider === 'clover') {
      result = await cloverService.chargeCustomerCard({
        cardToken: card.processor_card_ref,
        amount, orderNumber,
        privateToken: account.credentials.privateToken,
        environment:  account.environment,
      });
    } else {
      return res.status(400).json({ error: 'Unknown payment processor.' });
    }

    if (orderNumber) {
      await finalizePendingCheckout(req, orderNumber, { transactionId: result.transactionId, processor: provider });
    }

    await pool.query(
      `INSERT INTO quick_payments (order_number, amount, reason, transaction_id, payment_processor)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderNumber || null, parseFloat(amount), 'saved_card', result.transactionId, provider]
    ).catch(err => console.error('[QuickPay] Failed to log payment record:', err.message));

    res.json({ success: true, transactionId: result.transactionId, authCode: result.authCode });
  } catch (err) {
    res.status(err.statusCode || 402).json({ error: err.message || 'Payment failed.' });
  }
};

// ── Admin CRUD for Square / Clover merchant accounts ──────────────────────
const listAccounts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, provider, nickname, environment, is_active, created_at, credentials
         FROM card_processor_accounts
        ORDER BY is_active DESC, created_at ASC`
    );
    // Only ever return the non-secret slice of credentials, per provider.
    const rows = result.rows.map(r => {
      const fields = PUBLIC_FIELDS[r.provider] || [];
      const decrypted = decryptObject(r.credentials || {});
      const publicCreds = {};
      for (const f of fields) publicCreds[f] = decrypted[f];
      return { ...r, credentials: publicCreds };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const createAccount = async (req, res) => {
  const { provider, nickname, environment, credentials } = req.body;
  if (!provider || !['square', 'clover'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be "square" or "clover".' });
  }
  if (!nickname || !credentials || typeof credentials !== 'object') {
    return res.status(400).json({ error: 'nickname and credentials are required.' });
  }
  const secretField = provider === 'square' ? 'accessToken' : 'privateToken';
  if (!credentials[secretField]) {
    return res.status(400).json({ error: `${secretField} is required.` });
  }
  try {
    // Auto-activate the very first card-processor account of ANY kind
    // (Square, Clover, or pre-existing Authorize.net) so card payments
    // don't silently stay pointed at nothing once real credentials exist.
    const existingAuthNet = await pool.query(`SELECT 1 FROM authorize_net_accounts LIMIT 1`);
    const existingOther   = await pool.query(`SELECT 1 FROM card_processor_accounts LIMIT 1`);
    const isFirst = existingAuthNet.rows.length === 0 && existingOther.rows.length === 0;

    const client = await pool.connect();
    let id;
    try {
      await client.query('BEGIN');
      if (isFirst) await deactivateAllCardProcessors(client);
      const result = await client.query(
        `INSERT INTO card_processor_accounts (provider, nickname, environment, credentials, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [provider, nickname, environment || 'production', JSON.stringify(encryptObject(credentials)), isFirst]
      );
      id = result.rows[0].id;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Never log credential values — only which fields were present.
    logAudit(pool, req.user?.id, req.user?.name, 'create_card_processor_account', 'card_processor_account', String(id),
      { nickname, provider, environment: environment || 'production', auto_activated: isFirst }, req.ip);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { nickname, environment, credentials } = req.body;
  try {
    const existing = await pool.query(`SELECT provider, credentials FROM card_processor_accounts WHERE id=$1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Account not found.' });
    const { provider, credentials: existingCreds } = existing.rows[0];

    // "Leave blank to keep existing" — same UX/semantics as Authorize.net's
    // transaction_key, reimplemented as a shallow-merge since this is JSONB
    // rather than a flat column (SQL's COALESCE(NULLIF(...)) doesn't apply
    // the same way inside a JSON blob).
    const decryptedExisting = decryptObject(existingCreds || {});
    const merged = { ...decryptedExisting };
    if (credentials && typeof credentials === 'object') {
      for (const [k, v] of Object.entries(credentials)) {
        if (v) merged[k] = v; // blank/undefined submitted value keeps the existing one
      }
    }

    await pool.query(
      `UPDATE card_processor_accounts
          SET nickname    = COALESCE($1, nickname),
              environment = COALESCE($2, environment),
              credentials = $3
        WHERE id = $4`,
      [nickname, environment, JSON.stringify(encryptObject(merged)), id]
    );
    // Never log credential values — record only that something changed.
    logAudit(pool, req.user?.id, req.user?.name, 'update_card_processor_account', 'card_processor_account', String(id),
      { nickname, provider, environment, credentials_changed: !!(credentials && Object.values(credentials).some(Boolean)) }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    // Same server-side enforcement as Authorize.net's delete — the admin UI
    // hides the button for the active account, but don't rely on that alone.
    const account = await pool.query(`SELECT is_active FROM card_processor_accounts WHERE id = $1`, [id]);
    if (!account.rows.length) return res.status(404).json({ error: 'Account not found.' });
    if (account.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot delete the active account — set another account active first.' });
    }
    await pool.query(`DELETE FROM card_processor_accounts WHERE id = $1`, [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_card_processor_account', 'card_processor_account', String(id), {}, req.ip);
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
    await deactivateAllCardProcessors(client);
    const result = await client.query(`UPDATE card_processor_accounts SET is_active = TRUE WHERE id = $1`, [id]);
    // Without this check, a stale/invalid id deactivates every processor
    // (the step above) then matches nothing here -- committing a state with
    // NO active card processor while still reporting success.
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found.' });
    }
    await client.query('COMMIT');
    logAudit(pool, req.user?.id, req.user?.name, 'activate_card_processor_account', 'card_processor_account', String(id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json(safeError(err));
  } finally {
    client.release();
  }
};

module.exports = {
  getActiveCardProcessor,
  getCardProcessorAccountByProvider,
  getPublicCardConfig,
  chargeCardEndpoint,
  chargeSavedCardEndpoint,
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  setActiveAccount,
};
