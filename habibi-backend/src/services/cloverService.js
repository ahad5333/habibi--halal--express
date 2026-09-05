// Plain fetch() against Clover's Ecommerce API -- same no-SDK shape as
// authNetService.js/squareService.js. Clover's Ecommerce API is modeled
// closely on Stripe's Charges API (amount in cents, source/charge/refund
// field names all match Stripe's conventions), verified against Clover's
// current docs at implementation time rather than assumed.
const API_BASES = {
  production: 'https://scl.clover.com',
  sandbox:    'https://scl-sandbox.dev.clover.com',
};

function headers(privateToken) {
  return {
    'Authorization': `Bearer ${privateToken}`,
    'Content-Type':  'application/json',
  };
}

// Clover wants whole-cent integers, not decimal dollars.
function toCents(amount) {
  return Math.round(parseFloat(amount) * 100);
}

async function chargeCard({ sourceToken, amount, orderNumber, privateToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  // Unlike Square (which already sends its own idempotency_key), Clover's
  // charge call previously had no idempotency protection at all -- a race
  // between two near-simultaneous requests for the same order (double-
  // click, client retry-on-timeout) would genuinely double-charge the
  // card. Clover's Idempotency-Key header (>=13 alphanumeric chars,
  // confirmed via their docs -- same convention as Stripe, which this API
  // is modeled on) makes a retried request with the same key return the
  // original charge instead of creating a new one.
  const idempotencyKey = String(orderNumber).replace(/[^a-zA-Z0-9]/g, '').padEnd(13, '0');

  const res  = await fetch(`${base}/v1/charges`, {
    method:  'POST',
    headers: { ...headers(privateToken), 'Idempotency-Key': idempotencyKey },
    body:    JSON.stringify({
      amount:                toCents(amount),
      currency:              'usd',
      source:                sourceToken,
      external_reference_id: String(orderNumber).slice(0, 12),
    }),
  });
  const data = await res.json();

  if (!res.ok || !data.id || data.status === 'failed') {
    throw new Error(data.message || data.error?.message || 'Payment declined');
  }

  return {
    transactionId: data.id,
    // Clover returns auth_code as a number; normalize to string so callers
    // get the same shape regardless of which processor charged the card.
    authCode:      data.auth_code != null ? String(data.auth_code) : data.id,
  };
}

async function refundPayment({ chargeId, amount, privateToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  // Same reasoning as chargeCard's Idempotency-Key above -- this call had
  // none, so a double-click or retried refund request could refund the same
  // charge twice. Keyed off chargeId (one refund per charge, same as
  // Square's refund-key convention here) rather than orderNumber, since this
  // function isn't passed the order number at all.
  const idempotencyKey = `rf${String(chargeId).replace(/[^a-zA-Z0-9]/g, '')}`.padEnd(13, '0');

  const res  = await fetch(`${base}/v1/refunds`, {
    method:  'POST',
    headers: { ...headers(privateToken), 'Idempotency-Key': idempotencyKey },
    body:    JSON.stringify({
      charge: chargeId,
      amount: toCents(amount),
    }),
  });
  const data = await res.json();

  if (!res.ok || !data.id) {
    throw new Error(data.message || data.error?.message || 'Refund failed');
  }

  return { transactionId: data.id };
}

// ── Card on file: vault a single-use token against a new customer ────────
// Clover's single-pay token (clv_...) from client-side tokenization gets
// exchanged here for a multi-pay token tied to a customer record -- one
// reusable reference, unlike Authorize.net's two-id CIM shape or Square's
// separate customer+card ids. Verify exact response field names against
// current Clover docs before relying on this in production (Phase 4).
async function createCustomerCard({ sourceToken, privateToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const res  = await fetch(`${base}/v1/customers`, {
    method:  'POST',
    headers: headers(privateToken),
    body:    JSON.stringify({ source: sourceToken }),
  });
  const data = await res.json();

  if (!res.ok || !data.id) {
    throw new Error(data.message || data.error?.message || 'Could not save card');
  }

  return { customerId: data.id, cardToken: data.default_source || data.sources?.[0]?.id };
}

async function chargeCustomerCard({ cardToken, amount, orderNumber, privateToken, environment = 'production' }) {
  return chargeCard({ sourceToken: cardToken, amount, orderNumber, privateToken, environment });
}

// Clover's card-on-file removal -- verify exact endpoint shape against
// current docs before relying on this in production (Phase 4); modeled
// here on the same "customer owns a list of sources" pattern as creation.
async function deleteCustomerCard({ customerId, cardToken, privateToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const res  = await fetch(`${base}/v1/customers/${customerId}/sources/${cardToken}`, {
    method: 'DELETE', headers: headers(privateToken),
  });

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error?.message || 'Could not remove saved card');
  }
}

module.exports = {
  chargeCard,
  refundPayment,
  createCustomerCard,
  chargeCustomerCard,
  deleteCustomerCard,
};
