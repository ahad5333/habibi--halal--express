const crypto = require('crypto');
const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { logAudit } = require('./auditController');
const emailService = require('../services/emailService');
const squareService = require('../services/squareService');
const cloverService = require('../services/cloverService');
const { chargeCard: authNetChargeCard } = require('../services/authNetService');
const { getActiveCardProcessor } = require('../services/cardProcessorRegistry');

// ── Shared: look up a gift card by code and compute what a redemption
// request against it is really worth, WITHOUT touching balance (callers that
// actually consume it -- only createGuestOrder's transaction, see
// orderController.js -- do that themselves). Same throw-with-.statusCode
// convention as computeCouponDiscount/resolveChargeAmount. Never trusts a
// client-supplied redemption amount beyond the card's real remaining balance.
//
// Pass `client` (an in-transaction pg client) to lock the row with FOR
// UPDATE for a real commit; omit it for a read-only pre-payment quote (same
// "quote, not a commit" distinction createPendingCheckout already draws for
// item-price validation -- the real, TOCTOU-safe check runs once, for real,
// inside createGuestOrder at finalize time).
async function computeGiftCardRedemption({ code, requestedAmount, client }) {
  const amount = parseFloat(requestedAmount) || 0;
  if (!code || typeof code !== 'string' || !code.trim()) {
    const err = new Error('Gift card code is required.'); err.statusCode = 400; throw err;
  }
  if (amount <= 0) {
    const err = new Error('Invalid gift card redemption amount.'); err.statusCode = 400; throw err;
  }

  const db = client || pool;
  const result = await db.query(
    `SELECT * FROM gift_cards WHERE code = $1${client ? ' FOR UPDATE' : ''}`,
    [code.trim().toUpperCase()]
  );
  if (!result.rows.length) {
    const err = new Error('Invalid gift card code.'); err.statusCode = 404; throw err;
  }
  const card = result.rows[0];
  if (card.status !== 'active') {
    const err = new Error('This gift card is no longer active.'); err.statusCode = 400; throw err;
  }
  const balance = parseFloat(card.balance);
  if (balance <= 0) {
    const err = new Error('This gift card has no remaining balance.'); err.statusCode = 400; throw err;
  }

  const redeemAmount = parseFloat(Math.min(amount, balance).toFixed(2));
  return { card, redeemAmount };
}

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = `GC-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const existing = await pool.query(`SELECT 1 FROM gift_cards WHERE code = $1`, [code]);
    if (!existing.rows.length) return code;
  }
  const err = new Error('Could not generate a unique gift card code. Please try again.');
  err.statusCode = 500;
  throw err;
}

// ── Public: read-only balance/status preview, same shape as /api/coupons/validate ──
const checkGiftCard = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ valid: false, message: 'Gift card code is required.' });
    }
    const result = await pool.query(
      `SELECT balance, status FROM gift_cards WHERE code = $1`,
      [String(code).trim().toUpperCase()]
    );
    if (!result.rows.length || result.rows[0].status !== 'active') {
      return res.status(404).json({ valid: false, message: 'Invalid gift card code.' });
    }
    const balance = parseFloat(result.rows[0].balance);
    if (balance <= 0) {
      return res.status(400).json({ valid: false, message: 'This gift card has no remaining balance.' });
    }
    res.json({ valid: true, balance });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Public: buy a gift card via whichever card processor is currently active ──
// Deliberately its own isolated charge path, not threaded through the food-
// order pending_checkouts/finalizePendingCheckout machinery -- a gift card
// purchase has no cart/menu-price-tampering surface to validate the way a
// food order does (the "product" is simply the dollar amount chosen).
const purchaseGiftCard = async (req, res) => {
  const { amount: clientAmount, purchaser_name, purchaser_email, message, sourceId, opaqueData, billingZip } = req.body;
  const amount = parseFloat(clientAmount) || 0;

  if (!purchaser_email || !String(purchaser_email).trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const cfgRes = await pool.query(`SELECT gift_card_min_amount, gift_card_max_amount FROM system_settings WHERE id = 1`);
    const minAmount = parseFloat(cfgRes.rows[0]?.gift_card_min_amount) || 10;
    const maxAmount = parseFloat(cfgRes.rows[0]?.gift_card_max_amount) || 500;
    if (amount < minAmount || amount > maxAmount) {
      return res.status(400).json({ error: `Gift card amount must be between $${minAmount.toFixed(2)} and $${maxAmount.toFixed(2)}.` });
    }

    const active = await getActiveCardProcessor();
    if (!active) {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }

    // A gift card purchase has no real order_number -- generate a unique
    // reference to charge against instead. Square's idempotency_key and
    // Clover's Idempotency-Key header are BOTH derived from whatever
    // "orderNumber" value is passed in (see squareService.js/cloverService.js)
    // -- passing null/undefined here would stringify to the literal "null"
    // on every single purchase, colliding every gift-card charge onto the
    // same idempotency key and silently replaying the first purchase's
    // result back to every subsequent purchaser instead of actually
    // charging their card.
    const chargeRef = `GCPUR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let result;
    if (active.provider === 'square') {
      if (!sourceId) return res.status(400).json({ error: 'Invalid payment token.' });
      result = await squareService.chargeCard({
        sourceId, amount, orderNumber: chargeRef,
        accessToken: active.account.credentials.accessToken,
        locationId:  active.account.credentials.locationId,
        environment: active.account.environment,
      });
    } else if (active.provider === 'clover') {
      if (!sourceId) return res.status(400).json({ error: 'Invalid payment token.' });
      result = await cloverService.chargeCard({
        sourceToken: sourceId, amount, orderNumber: chargeRef,
        privateToken: active.account.credentials.privateToken,
        environment:  active.account.environment,
      });
    } else if (active.provider === 'authorize_net') {
      if (!opaqueData?.dataDescriptor || !opaqueData?.dataValue) {
        return res.status(400).json({ error: 'Invalid payment token.' });
      }
      result = await authNetChargeCard({
        opaqueData, amount, orderNumber: chargeRef, billingZip,
        apiLoginId:     active.account.api_login_id,
        transactionKey: active.account.transaction_key,
        environment:    active.account.environment,
      });
    } else {
      return res.status(503).json({ error: 'Payment processor not configured.' });
    }

    // Card charged for real -- now mint the gift card. If anything below
    // fails, the charge has already succeeded; fall into the same "contact
    // us with this reference" pattern every other charge endpoint in this
    // codebase uses for a post-charge finalize failure (see
    // finalizePendingCheckout in orderController.js).
    const code = await generateUniqueCode();
    const client = await pool.connect();
    let cardId;
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        `INSERT INTO gift_cards (code, initial_value, balance, purchaser_name, purchaser_email, message)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [code, amount, amount, String(purchaser_name || '').slice(0, 150) || null, purchaser_email.trim().slice(0, 150), String(message || '').slice(0, 500) || null]
      );
      cardId = insertRes.rows[0].id;
      await client.query(
        `INSERT INTO gift_card_transactions (gift_card_id, order_number, amount, type) VALUES ($1, NULL, $2, 'purchase')`,
        [cardId, amount]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Your payment (ref ${result.transactionId}) succeeded, but we could not issue your gift card: ${err.message}. Please contact us with this reference and we'll sort it out.`);
    } finally {
      client.release();
    }

    emailService.sendGiftCardEmail(purchaser_email.trim(), { code, amount, purchaserName: purchaser_name, message })
      .catch(err => console.error('[GiftCard] Failed to send email:', err.message));

    res.status(201).json({ success: true, code, amount, transactionId: result.transactionId });
  } catch (err) {
    res.status(err.statusCode || 402).json({ error: err.message || 'Payment failed.' });
  }
};

// ── Admin ───────────────────────────────────────────────────────────────────
const listGiftCards = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM gift_cards ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const getGiftCardTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM gift_card_transactions WHERE gift_card_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Customer-service comp -- creates a real card with a real balance, no
// purchase charge attached (type='admin_issue' distinguishes it in the
// transaction ledger from a real paid purchase).
const issueGiftCard = async (req, res) => {
  const { amount, purchaser_name, purchaser_email, message } = req.body;
  const amt = parseFloat(amount) || 0;
  if (amt <= 0) {
    return res.status(400).json({ error: 'A positive amount is required.' });
  }
  try {
    const code = await generateUniqueCode();
    const client = await pool.connect();
    let cardId;
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        `INSERT INTO gift_cards (code, initial_value, balance, purchaser_name, purchaser_email, message)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [code, amt, amt, String(purchaser_name || '').slice(0, 150) || null, String(purchaser_email || '').slice(0, 150) || null, String(message || '').slice(0, 500) || null]
      );
      cardId = insertRes.rows[0].id;
      await client.query(
        `INSERT INTO gift_card_transactions (gift_card_id, order_number, amount, type) VALUES ($1, NULL, $2, 'admin_issue')`,
        [cardId, amt]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logAudit(pool, req.user?.id, req.user?.name, 'issue_gift_card', 'gift_card', String(cardId), { code, amount: amt }, req.ip);

    if (purchaser_email) {
      emailService.sendGiftCardEmail(purchaser_email, { code, amount: amt, purchaserName: purchaser_name, message })
        .catch(err => console.error('[GiftCard] Failed to send email:', err.message));
    }

    res.status(201).json({ success: true, code, id: cardId });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const voidGiftCard = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`UPDATE gift_cards SET status = 'void' WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Gift card not found.' });
    logAudit(pool, req.user?.id, req.user?.name, 'void_gift_card', 'gift_card', String(id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  computeGiftCardRedemption,
  checkGiftCard,
  purchaseGiftCard,
  listGiftCards,
  getGiftCardTransactions,
  issueGiftCard,
  voidGiftCard,
};
