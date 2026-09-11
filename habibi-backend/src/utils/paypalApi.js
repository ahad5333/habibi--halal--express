// PayPal REST helpers for server-side money movement that isn't part of the
// checkout flow -- currently refunds.
//
// Exists because the admin Refund button had no PayPal path at all: a PayPal
// or Google Pay order fell into the "record-keeping only" branch, got marked
// refunded, and the admin was told "Refund processed successfully" while the
// customer's money never moved. Harmless in sandbox; a real problem once
// PayPal went live.

const TIMEOUT_MS = 15_000;

function base() {
  return process.env.PAYPAL_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function isConfigured() {
  const id = process.env.PAYPAL_CLIENT_ID;
  return !!(id && process.env.PAYPAL_CLIENT_SECRET && id !== 'REPLACE_ME');
}

async function call(path, { method = 'GET', headers = {}, body } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}${path}`, { method, headers, body, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

let cachedToken = null;
let tokenExpiresAt = 0;
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60_000) return cachedToken;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await call('/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
    body: 'grant_type=client_credentials',
  });
  if (!r.data.access_token) throw new Error(`PayPal authentication failed (HTTP ${r.status})`);
  cachedToken = r.data.access_token;
  tokenExpiresAt = Date.now() + (Number(r.data.expires_in) || 3000) * 1000;
  return cachedToken;
}

// Human-readable reason from a PayPal error body.
function reason(data, status) {
  const d = data?.details?.[0];
  return (d && (d.description || d.issue)) || data?.message || data?.name || `HTTP ${status}`;
}

// payment_intent_id normally holds the CAPTURE id. An older fallback in
// paypalCapture stored the PayPal ORDER id when no capture id came back, so
// if the capture lookup 404s, resolve the order to its capture.
async function resolveCaptureId(id, token) {
  const r = await call(`/v2/checkout/orders/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.data?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
}

/**
 * Refund a captured PayPal payment (PayPal or Google Pay via PayPal).
 *
 * @param {string} captureId    guest_orders.payment_intent_id
 * @param {number} amount       dollars; refunds exactly this much
 * @param {string} orderNumber  used for the idempotency key
 * @returns {{ refundId: string, status: string }}  status COMPLETED or PENDING
 *
 * The PayPal-Request-Id makes a repeated call for the same order and amount
 * (a double-click, a retried request) return the SAME refund instead of
 * refunding twice. A different amount is a different refund.
 */
async function refundCapture({ captureId, amount, orderNumber }) {
  const token = await getAccessToken();
  const value = Number(amount).toFixed(2);
  const attempt = (id) => call(`/v2/payments/captures/${encodeURIComponent(id)}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `habibi-refund-${orderNumber}-${Math.round(Number(amount) * 100)}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ amount: { value, currency_code: 'USD' } }),
  });

  let r = await attempt(captureId);
  if (r.status === 404) {
    const resolved = await resolveCaptureId(captureId, token);
    if (resolved && resolved !== captureId) r = await attempt(resolved);
  }
  if (!r.ok) throw new Error(reason(r.data, r.status));
  return { refundId: r.data.id, status: r.data.status };
}

module.exports = { isConfigured, refundCapture };
