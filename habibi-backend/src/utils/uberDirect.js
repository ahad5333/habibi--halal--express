// Uber Direct (courier delivery) API client.
//
// Same shape as utils/roadie.js and utils/doordash.js: isConfigured() /
// isSimulated() / a low-level request helper, plus the four calls the dispatch
// flow actually needs (quote, create, status, cancel).
//
// Added because DoorDash Drive production approval is delayed, so Uber Direct
// becomes the second provider in the delivery cascade. Where it sits in that
// cascade is deliberately NOT decided here -- this file only knows how to talk
// to Uber. The routing lives in orderController.js.
//
// Auth is OAuth2 client-credentials, unlike Roadie (static key) and DoorDash
// (per-request JWT), so the token is cached until shortly before it expires.

const UBER_AUTH_URL = process.env.UBER_DIRECT_AUTH_URL || 'https://auth.uber.com/oauth/v2/token';
const UBER_BASE     = process.env.UBER_DIRECT_BASE_URL || 'https://api.uber.com/v1';

function customerId()   { return process.env.UBER_DIRECT_CUSTOMER_ID; }
function clientId()     { return process.env.UBER_DIRECT_CLIENT_ID; }
function clientSecret() { return process.env.UBER_DIRECT_CLIENT_SECRET; }

function isConfigured() {
  return !!(
    (customerId() && clientId() && clientSecret()) ||
    customerId() === 'SIMULATED'
  );
}

function isSimulated() {
  return customerId() === 'SIMULATED';
}

// ── OAuth token, cached ──────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Refresh a minute early rather than racing the expiry.
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const form = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'client_credentials',
    scope: 'eats.deliveries',
  });

  const res = await fetch(UBER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Uber Direct auth failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data).slice(0, 200)}`
    );
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in || 2592000) * 1000);
  return cachedToken;
}

// ── Core request ─────────────────────────────────────────────────────────────
async function uberRequest(path, method = 'GET', body = null) {
  if (!isConfigured()) {
    throw new Error(
      'Uber Direct not configured (UBER_DIRECT_CUSTOMER_ID / UBER_DIRECT_CLIENT_ID / UBER_DIRECT_CLIENT_SECRET)'
    );
  }
  if (isSimulated()) return simulate(path, method, body);

  const token = await getAccessToken();
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${UBER_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Uber returns { code, message }; surface both so a serviceability refusal
    // is distinguishable from a credential or payload problem by the caller.
    const err = new Error(data.message || data.code || `Uber Direct API error ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

// Addresses go to Uber as a JSON *string*, which is easy to get wrong.
function formatAddress({ street, street2, city, state, zip, country = 'US' }) {
  return JSON.stringify({
    street_address: [street, street2].filter(Boolean),
    city,
    state,
    zip_code: zip,
    country,
  });
}

// ── The four calls the dispatch flow needs ──────────────────────────────────

// Serviceability + price. Uber refuses with a non-2xx when it can't deliver,
// so callers should treat a throw as "not serviceable" and try the next
// provider rather than failing the order.
async function getQuote({
  pickup, dropoff, pickupLat, pickupLng, dropoffLat, dropoffLng,
  pickupPhone, dropoffPhone, orderValueCents,
}) {
  return uberRequest(`/customers/${customerId()}/delivery_quotes`, 'POST', {
    pickup_address: formatAddress(pickup),
    dropoff_address: formatAddress(dropoff),
    pickup_latitude: pickupLat,
    pickup_longitude: pickupLng,
    dropoff_latitude: dropoffLat,
    dropoff_longitude: dropoffLng,
    pickup_phone_number: pickupPhone,
    dropoff_phone_number: dropoffPhone,
    manifest_total_value: orderValueCents,
  });
}

async function createDelivery({
  quoteId, pickup, dropoff, pickupName, dropoffName,
  pickupPhone, dropoffPhone, pickupNotes, dropoffNotes,
  items, orderValueCents, externalId,
}) {
  return uberRequest(`/customers/${customerId()}/deliveries`, 'POST', {
    quote_id: quoteId,
    pickup_address: formatAddress(pickup),
    pickup_name: pickupName,
    pickup_phone_number: pickupPhone,
    pickup_notes: pickupNotes || undefined,
    dropoff_address: formatAddress(dropoff),
    dropoff_name: dropoffName,
    dropoff_phone_number: dropoffPhone,
    dropoff_notes: dropoffNotes || undefined,
    manifest_items: (items || []).map(i => ({
      name: i.name,
      quantity: i.qty || i.quantity || 1,
      size: 'small',
    })),
    manifest_total_value: orderValueCents,
    external_id: externalId,
  });
}

async function getDelivery(deliveryId) {
  return uberRequest(`/customers/${customerId()}/deliveries/${deliveryId}`, 'GET');
}

async function cancelDelivery(deliveryId) {
  return uberRequest(`/customers/${customerId()}/deliveries/${deliveryId}/cancel`, 'POST', {});
}

// ── Simulation, matching the shapes above ───────────────────────────────────
function simulate(path, method, body) {
  console.log(`[SIMULATION] Uber Direct ${method} ${path}`, body ? JSON.stringify(body).slice(0, 200) : '');
  const id = `UBER_SIM_${Date.now()}`;
  if (path.endsWith('/delivery_quotes')) {
    return {
      id, kind: 'delivery_quote', fee: 899, currency: 'usd',
      duration: 32, pickup_duration: 9,
      expires: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
  }
  if (path.endsWith('/cancel')) return { id, status: 'canceled' };
  return {
    id, status: 'pending', fee: 899, currency: 'usd',
    tracking_url: `https://example.test/track/${id}`,
    courier: null,
    pickup_eta: null, dropoff_eta: null,
  };
}

module.exports = {
  isConfigured, isSimulated, uberRequest, formatAddress,
  getQuote, createDelivery, getDelivery, cancelDelivery,
};
