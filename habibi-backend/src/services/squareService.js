// Plain fetch() against Square's REST API -- no SDK dependency, matching
// authNetService.js's shape (the square npm package isn't installed, and
// the old dormant paymentController scaffold that required it would have
// crashed if ever actually triggered -- see the payments plan).
const API_BASES = {
  production: 'https://connect.squareup.com/v2',
  sandbox:    'https://connect.squareupsandbox.com/v2',
};
const SQUARE_VERSION = '2025-01-23';

function headers(accessToken) {
  return {
    'Authorization':  `Bearer ${accessToken}`,
    'Content-Type':   'application/json',
    'Square-Version': SQUARE_VERSION,
  };
}

// Square wants whole-cent integers, not decimal dollars.
function toCents(amount) {
  return Math.round(parseFloat(amount) * 100);
}

async function chargeCard({ sourceId, amount, orderNumber, accessToken, locationId, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const res  = await fetch(`${base}/payments`, {
    method:  'POST',
    headers: headers(accessToken),
    body:    JSON.stringify({
      source_id:       sourceId,
      // Square uses this to dedupe retried requests -- reusing the same
      // orderNumber on a retry returns the original result instead of
      // double-charging, the same anti-tamper spirit as resolveChargeAmount.
      idempotency_key: String(orderNumber).slice(0, 45),
      amount_money:    { amount: toCents(amount), currency: 'USD' },
      location_id:     locationId,
    }),
  });
  const data = await res.json();

  if (!res.ok || !data.payment) {
    throw new Error(data.errors?.[0]?.detail || 'Payment declined');
  }

  return {
    transactionId: data.payment.id,
    // Square doesn't expose a separate auth code the way Authorize.net
    // does -- reuse the payment id so callers get a stable, non-empty value.
    authCode:      data.payment.id,
  };
}

async function refundPayment({ paymentId, amount, accessToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const res  = await fetch(`${base}/refunds`, {
    method:  'POST',
    headers: headers(accessToken),
    body:    JSON.stringify({
      idempotency_key: `refund-${paymentId}`.slice(0, 45),
      amount_money:    { amount: toCents(amount), currency: 'USD' },
      payment_id:      paymentId,
    }),
  });
  const data = await res.json();

  if (!res.ok || !data.refund) {
    throw new Error(data.errors?.[0]?.detail || 'Refund failed');
  }

  return { transactionId: data.refund.id };
}

// ── Cards on File: vault a card by tokenizing straight to a customer ──────
// Square's card-on-file needs a customer record first, then a card attached
// to it -- conceptually the same two-id-reference shape as Authorize.net's
// CIM (customerProfileId + paymentProfileId), just named differently.
async function createCustomerAndCard({ sourceId, accessToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const custRes  = await fetch(`${base}/customers`, {
    method: 'POST', headers: headers(accessToken), body: JSON.stringify({}),
  });
  const custData = await custRes.json();
  if (!custRes.ok || !custData.customer) {
    throw new Error(custData.errors?.[0]?.detail || 'Could not save card');
  }
  const customerId = custData.customer.id;

  const cardRes  = await fetch(`${base}/cards`, {
    method:  'POST',
    headers: headers(accessToken),
    body:    JSON.stringify({
      idempotency_key: `card-${customerId}-${Date.now()}`.slice(0, 45),
      source_id:       sourceId,
      card:            { customer_id: customerId },
    }),
  });
  const cardData = await cardRes.json();
  if (!cardRes.ok || !cardData.card) {
    throw new Error(cardData.errors?.[0]?.detail || 'Could not save card');
  }

  return { customerId, cardId: cardData.card.id };
}

async function chargeCustomerCard({ customerId, cardId, amount, orderNumber, accessToken, locationId, environment = 'production' }) {
  return chargeCard({ sourceId: cardId, amount, orderNumber, accessToken, locationId, environment });
}

// Square has no hard delete for cards-on-file, only disable -- unlike
// Authorize.net's real delete. A disabled card can no longer be charged,
// which is what the local "remove saved card" action actually needs.
async function disableCard({ cardId, accessToken, environment = 'production' }) {
  const base = API_BASES[environment] || API_BASES.production;

  const res  = await fetch(`${base}/cards/${cardId}/disable`, {
    method: 'POST', headers: headers(accessToken),
  });
  const data = await res.json();

  if (!res.ok || !data.card) {
    const alreadyGone = res.status === 404;
    if (!alreadyGone) throw new Error(data.errors?.[0]?.detail || 'Could not remove saved card');
  }
}

module.exports = {
  chargeCard,
  refundPayment,
  createCustomerAndCard,
  chargeCustomerCard,
  disableCard,
};
