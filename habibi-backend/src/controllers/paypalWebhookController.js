// PayPal webhook receiver — POST /api/payments/paypal/webhook
//
// NOT what makes PayPal payments safe. That's paypalCapture, which captures
// synchronously at checkout and refuses any capture whose reference_id or
// amount doesn't match the order. This exists for the gaps that path can't see:
//
//   1. PAYMENT.CAPTURE.COMPLETED with no order on our side. PayPal took the
//      money but the server died (or the request dropped) between PayPal
//      answering COMPLETED and finalizePendingCheckout writing the order. The
//      customer was charged and the kitchen never heard about it. Rare, and the
//      worst failure a checkout can have.
//   2. Refunds, reversals and disputes raised in PayPal's own dashboard, which
//      our database otherwise never learns about.
//
// Because this handler can turn a pending checkout into a PAID ORDER, a forged
// request is a direct route to free food. So nothing here acts on an event
// until PayPal itself has confirmed the signature, and even then the capture
// is re-read from PayPal's API rather than trusted from the event body.

const pool = require('../config/db');
const fcmService = require('../services/fcmService');
const { finalizePendingCheckout } = require('./orderController');

const TIMEOUT_MS = 10_000;

function paypalBase() {
  return process.env.PAYPAL_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

// PayPal tokens last hours; fetching one per webhook would double the outbound
// calls every delivery makes. Cached, refreshed a few minutes before expiry.
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60_000) return cachedToken;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials not configured');
  const r = await fetchJson(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.data.access_token) throw new Error(`PayPal auth failed (${r.status})`);
  cachedToken = r.data.access_token;
  tokenExpiresAt = Date.now() + (Number(r.data.expires_in) || 3000) * 1000;
  return cachedToken;
}

// ── Signature verification ──────────────────────────────────────────────────
// Asks PayPal whether it really sent this. The event is spliced into the
// request as the RAW bytes received, not a re-serialised copy: PayPal signs a
// CRC of the exact body, and JSON.stringify of a parsed object is not
// guaranteed to reproduce it byte-for-byte.
//
// Splicing raw text into JSON is only safe because the caller has already
// JSON.parse'd it as a single object -- JSON.parse rejects trailing content,
// so the raw text is exactly one balanced JSON value and cannot break out of
// the "webhook_event" slot to inject, say, a different webhook_id.
async function verifySignature(headers, rawBody, webhookId, token) {
  const h = (k) => headers[k];
  const required = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
                    'paypal-transmission-sig', 'paypal-transmission-time'];
  if (required.some(k => !h(k))) return { ok: false, reason: 'missing PayPal signature headers' };

  const body =
    `{"auth_algo":${JSON.stringify(h('paypal-auth-algo'))},` +
    `"cert_url":${JSON.stringify(h('paypal-cert-url'))},` +
    `"transmission_id":${JSON.stringify(h('paypal-transmission-id'))},` +
    `"transmission_sig":${JSON.stringify(h('paypal-transmission-sig'))},` +
    `"transmission_time":${JSON.stringify(h('paypal-transmission-time'))},` +
    `"webhook_id":${JSON.stringify(webhookId)},` +
    `"webhook_event":${rawBody}}`;

  const r = await fetchJson(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
  });
  const status = r.data.verification_status;
  return status === 'SUCCESS'
    ? { ok: true }
    : { ok: false, reason: `verification_status=${status || 'none'} (HTTP ${r.status})` };
}

// ── Alerts ──────────────────────────────────────────────────────────────────
function alertAdmins(title, body) {
  console.error(`[PayPal webhook] ALERT: ${title} — ${body}`);
  fcmService.sendPushToAdmins(title, body, { type: 'paypal_alert', url: '/orders' })
    .catch(err => console.error('[PayPal webhook] admin push failed:', err.message));
}

// ── Handlers ────────────────────────────────────────────────────────────────
// Each returns { outcome, detail, orderNumber } for the audit row.

async function onCaptureCompleted(req, event, token) {
  const captureId = event.resource?.id;
  const ppOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (!captureId || !ppOrderId) return { outcome: 'ignored', detail: 'capture event without ids' };

  // Re-read from PayPal instead of trusting the event body: this is where
  // our order number (reference_id) and the authoritative amount live.
  const r = await fetchJson(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(ppOrderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`could not read PayPal order ${ppOrderId} (HTTP ${r.status})`);

  const unit = r.data.purchase_units?.[0] || {};
  const orderNumber = unit.reference_id;
  const capture = (unit.payments?.captures || []).find(c => c.id === captureId);
  const amount = parseFloat(capture?.amount?.value);
  const currency = capture?.amount?.currency_code;

  if (!capture || capture.status !== 'COMPLETED') {
    return { outcome: 'ignored', detail: `capture status ${capture?.status || 'not found'}`, orderNumber };
  }
  if (!orderNumber || orderNumber === 'habibi-order') {
    alertAdmins('💸 PayPal payment with no order',
      `PayPal captured $${amount} (capture ${captureId}) that can't be matched to any order. Check PayPal and refund or create the order.`);
    return { outcome: 'alert_unmatched', detail: `capture ${captureId} has no reference_id`, orderNumber };
  }
  if (currency !== 'USD') {
    alertAdmins('⚠️ PayPal payment in wrong currency', `Order #${orderNumber}: captured ${amount} ${currency}.`);
    return { outcome: 'alert_currency', detail: `${amount} ${currency}`, orderNumber };
  }

  // Already recorded? The normal case — the browser's own capture call got
  // here first and finalized the order.
  const existing = await pool.query(
    `SELECT total, payment_status, payment_intent_id FROM guest_orders WHERE order_number = $1`,
    [orderNumber]
  );
  if (existing.rows.length) {
    const o = existing.rows[0];
    if (o.payment_status === 'paid') {
      if (o.payment_intent_id && o.payment_intent_id !== captureId) {
        // Paid once already, by a DIFFERENT capture. That's a customer
        // charged twice for one order.
        alertAdmins('⚠️ Possible double PayPal charge',
          `Order #${orderNumber} was already paid (${o.payment_intent_id}) and PayPal captured again (${captureId}). Refund one in PayPal.`);
        return { outcome: 'alert_double_charge', detail: `${o.payment_intent_id} vs ${captureId}`, orderNumber };
      }
      return { outcome: 'already_recorded', detail: captureId, orderNumber };
    }
    if (!(Math.abs(amount - parseFloat(o.total)) < 0.01)) {
      alertAdmins('⚠️ PayPal amount mismatch',
        `Order #${orderNumber}: PayPal captured $${amount}, order total is $${o.total}. Not marked paid.`);
      return { outcome: 'alert_amount_mismatch', detail: `${amount} vs ${o.total}`, orderNumber };
    }
  } else {
    const pending = await pool.query(
      `SELECT total FROM pending_checkouts WHERE order_number = $1`, [orderNumber]
    );
    if (!pending.rows.length) {
      // Money taken, and neither an order nor a staged checkout exists.
      alertAdmins('💸 PayPal paid, order missing',
        `PayPal captured $${amount} for #${orderNumber} (capture ${captureId}) but no order exists. The customer was charged — create the order or refund it.`);
      return { outcome: 'alert_order_missing', detail: captureId, orderNumber };
    }
    if (!(Math.abs(amount - parseFloat(pending.rows[0].total)) < 0.01)) {
      alertAdmins('⚠️ PayPal amount mismatch',
        `Checkout #${orderNumber}: PayPal captured $${amount}, expected $${pending.rows[0].total}. Order not created.`);
      return { outcome: 'alert_amount_mismatch', detail: `${amount} vs ${pending.rows[0].total}`, orderNumber };
    }
  }

  // The recovery path. finalizePendingCheckout claims the staged checkout with
  // DELETE...RETURNING, so if the browser's capture call is racing us, exactly
  // one of us creates the order and the other falls through harmlessly.
  await finalizePendingCheckout(req, orderNumber, { transactionId: captureId, processor: 'paypal' });

  const check = await pool.query(
    `SELECT payment_status FROM guest_orders WHERE order_number = $1`, [orderNumber]
  );
  if (check.rows[0]?.payment_status !== 'paid') {
    alertAdmins('💸 PayPal paid, order not recorded',
      `PayPal captured $${amount} for #${orderNumber} but the order could not be finalized. Check it now.`);
    return { outcome: 'alert_finalize_failed', detail: captureId, orderNumber };
  }

  console.warn(`[PayPal webhook] RECOVERED order #${orderNumber} from capture ${captureId} — checkout never finalized it`);
  alertAdmins('✅ PayPal order recovered',
    `Order #${orderNumber} ($${amount}) was paid in PayPal but never reached the kitchen. It has now been created.`);
  return { outcome: 'recovered', detail: captureId, orderNumber };
}

// Refunded (resource = refund) or reversed (resource = capture) in PayPal.
async function onCaptureReturned(event) {
  const type = event.event_type;
  let captureId;
  if (type === 'PAYMENT.CAPTURE.REFUNDED') {
    // A refund resource points back at its capture through the "up" link.
    const up = (event.resource?.links || []).find(l => l.rel === 'up')?.href || '';
    captureId = (up.match(/\/captures\/([^/?]+)/) || [])[1];
  } else {
    captureId = event.resource?.id;
  }
  const amount = parseFloat(event.resource?.amount?.value) || 0;
  if (!captureId) return { outcome: 'ignored', detail: 'no capture id on refund/reversal' };

  const o = await pool.query(
    `SELECT order_number, total FROM guest_orders WHERE payment_intent_id = $1`, [captureId]
  );
  if (!o.rows.length) {
    return { outcome: 'ignored', detail: `no order for capture ${captureId}` };
  }
  const { order_number: orderNumber, total } = o.rows[0];
  const full = amount >= parseFloat(total) - 0.01;

  if (full) {
    // Same statuses the admin panel's own refund path writes.
    await pool.query(
      `UPDATE guest_orders SET order_status = 'refunded', payment_status = 'refunded', updated_at = NOW()
        WHERE order_number = $1`,
      [orderNumber]
    );
  }
  const verb = type === 'PAYMENT.CAPTURE.REVERSED' ? 'reversed' : 'refunded';
  alertAdmins(`↩️ PayPal ${verb}`,
    `Order #${orderNumber}: $${amount} ${verb} in PayPal${full ? ' — order marked refunded' : ` (partial — order total $${total}, status unchanged)`}.`);
  return { outcome: full ? `${verb}_full` : `${verb}_partial`, detail: `$${amount} of $${total}`, orderNumber };
}

async function onDispute(event) {
  const tx = event.resource?.disputed_transactions?.[0];
  const captureId = tx?.seller_transaction_id;
  const reason = event.resource?.reason || 'unspecified';
  let orderNumber = null;
  if (captureId) {
    const o = await pool.query(`SELECT order_number FROM guest_orders WHERE payment_intent_id = $1`, [captureId]);
    orderNumber = o.rows[0]?.order_number || null;
  }
  alertAdmins('⚖️ PayPal dispute opened',
    `${orderNumber ? `Order #${orderNumber}` : `Capture ${captureId || 'unknown'}`} — reason: ${reason}. Respond in PayPal's Resolution Center.`);
  return { outcome: 'dispute_opened', detail: reason, orderNumber };
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function paypalWebhook(req, res) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // Can't verify, so can't act. 503 rather than 200 so PayPal retries
    // (for up to ~3 days) and nothing is lost while setup finishes.
    console.warn('[PayPal webhook] received but PAYPAL_WEBHOOK_ID is not set — asking PayPal to retry');
    return res.status(503).json({ message: 'Webhook not configured yet' });
  }

  const raw = req.rawBody;
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  if (!event || typeof event !== 'object' || Array.isArray(event) || !event.id || !event.event_type) {
    return res.status(400).json({ message: 'Not a PayPal webhook event' });
  }
  // Cheap rejection before any outbound call: anything without PayPal's
  // signature headers can't possibly verify, so don't spend two API calls
  // on it.
  if (!req.headers['paypal-transmission-sig'] || !req.headers['paypal-transmission-id']) {
    return res.status(400).json({ message: 'Missing PayPal signature headers' });
  }

  let token;
  try {
    token = await getAccessToken();
    const v = await verifySignature(req.headers, raw, webhookId, token);
    if (!v.ok) {
      console.error(`[PayPal webhook] REJECTED ${event.event_type} ${event.id}: ${v.reason}`);
      return res.status(400).json({ message: 'Signature verification failed' });
    }
  } catch (err) {
    // Couldn't reach PayPal to verify — not the sender's fault. Retry later.
    console.error('[PayPal webhook] verification unavailable:', err.message);
    return res.status(503).json({ message: 'Verification temporarily unavailable' });
  }

  // Idempotency: PayPal retries, and can deliver the same event twice. Claim
  // the event id first; a duplicate gets a 200 and nothing else happens.
  const claim = await pool.query(
    `INSERT INTO paypal_webhook_events (event_id, event_type, resource_id)
     VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [event.id, event.event_type, event.resource?.id || null]
  );
  if (!claim.rows.length) return res.status(200).json({ received: true, duplicate: true });

  try {
    let result;
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        result = await onCaptureCompleted(req, event, token); break;
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED':
        result = await onCaptureReturned(event); break;
      case 'CUSTOMER.DISPUTE.CREATED':
        result = await onDispute(event); break;
      default:
        result = { outcome: 'ignored', detail: 'event type not handled' };
    }
    await pool.query(
      `UPDATE paypal_webhook_events SET outcome = $1, detail = $2, order_number = $3 WHERE event_id = $4`,
      [result.outcome, String(result.detail || '').slice(0, 500), result.orderNumber || null, event.id]
    );
    return res.status(200).json({ received: true, outcome: result.outcome });
  } catch (err) {
    // Release the claim so PayPal's retry can process it properly.
    await pool.query(`DELETE FROM paypal_webhook_events WHERE event_id = $1`, [event.id]).catch(() => {});
    console.error(`[PayPal webhook] processing ${event.event_type} ${event.id} failed:`, err.message);
    return res.status(500).json({ message: 'Processing failed, will retry' });
  }
}

module.exports = { paypalWebhook };
