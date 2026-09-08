// Delivery pricing resolver.
//
// Implements the owner's rule (confirmed 2026-09-08), replacing the hardcoded
// distance bands in googleMaps.feeFromMiles() that used to price every order:
//
//   1. Own driver  — only when this location has self_delivery_enabled AND the
//                    address falls inside its radius. The price comes from
//                    CPanel: a fixed charge, or a percentage of the food
//                    subtotal with a minimum. No markup is added.
//   2. Courier     — otherwise ask the delivery partner for a live quote and
//                    add 20% ("if partner wants $10, we charge the customer
//                    $12"). No cap, no floor.
//   3. Neither     — no price is invented. Delivery simply isn't offered for
//                    that address and the customer keeps pickup, which is
//                    always available.
//
// Deliberate choice in (3): when the courier can't be reached we do NOT fall
// back to a made-up band price. The owner's rule is that the customer is
// charged what the partner actually charges, and guessing it would silently
// undercharge on exactly the long deliveries where the gap is largest.

const crypto = require('crypto');
const pool = require('../config/db');
const uber = require('./uberDirect');
const { geocodeAddress } = require('./googleMaps');

// Owner's markup, overridable without a deploy if the arrangement changes.
const MARKUP_PCT = parseFloat(process.env.DELIVERY_PARTNER_MARKUP_PCT ?? '20');

// How long a shown price stays honourable. Uber's own quotes expire in ~5 min;
// this is the window in which the customer can still place the order at the
// price they were shown.
const QUOTE_TTL_MS = 15 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Normalised so the same address typed with different spacing/case still
// matches its own quote at order placement.
function addressHash(address, locationId) {
  const norm = String(address || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(`${locationId || 0}|${norm}`).digest('hex').slice(0, 64);
}

// ── Own-driver price from the location's CPanel settings ────────────────────
function selfDeliveryPrice(loc, subtotal, miles) {
  const mode = String(loc.delivery_pricing_mode || 'fixed').toLowerCase();

  if (mode === 'percent') {
    const pct = parseFloat(loc.delivery_percent) || 0;
    const min = parseFloat(loc.delivery_min_charge) || 0;
    // Percentage of the food subtotal, floored at the configured minimum.
    return round2(Math.max(((parseFloat(subtotal) || 0) * pct) / 100, min));
  }

  // Fixed. delivery_per_mile_fee is a pre-existing column that is 0 on every
  // real row; kept additive so it stays a no-op unless someone sets it.
  const fixed   = parseFloat(loc.delivery_cost) || 0;
  const perMile = parseFloat(loc.delivery_per_mile_fee) || 0;
  return round2(fixed + perMile * (Number(miles) || 0));
}

// ── Live courier quote ──────────────────────────────────────────────────────
// Returns { ok, fee, partnerFee, quoteId, provider } or { ok:false, reason }.
// `reason` distinguishes "the courier refuses this address" (a real, permanent
// out-of-range answer) from "we couldn't reach the courier" (transient), so
// the customer gets an accurate message rather than one standing in for both.
async function partnerQuote({ originAddress, destinationAddress, subtotal, pickupPhone, dropoffPhone }) {
  if (!uber.isConfigured()) return { ok: false, reason: 'not_configured' };

  const [pickup, dropoff] = await Promise.all([
    geocodeAddress(originAddress),
    geocodeAddress(destinationAddress),
  ]);
  if (!pickup || !dropoff) return { ok: false, reason: 'unresolvable' };

  const phone = pickupPhone || process.env.RESTAURANT_PHONE || '+13477033731';

  try {
    const q = await uber.getQuote({
      pickup:  { street: pickup.street,  city: pickup.city,  state: pickup.state,  zip: pickup.zip },
      dropoff: { street: dropoff.street, city: dropoff.city, state: dropoff.state, zip: dropoff.zip },
      pickupLat: pickup.lat,   pickupLng: pickup.lng,
      dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
      pickupPhone: phone,
      dropoffPhone: dropoffPhone || phone,
      orderValueCents: Math.round((parseFloat(subtotal) || 0) * 100),
    });

    const partnerFee = round2((Number(q.fee) || 0) / 100);
    return {
      ok: true,
      provider: 'uber',
      partnerFee,
      fee: round2(partnerFee * (1 + MARKUP_PCT / 100)),
      quoteId: q.id || null,
      durationMinutes: q.duration ?? null,
    };
  } catch (err) {
    // Uber answers a serviceability refusal with a 4xx; anything else (5xx,
    // network, auth) means we simply couldn't ask.
    const transient = !err.status || err.status >= 500 || err.status === 401 || err.status === 403;
    console.error(`[DeliveryPricing] Uber quote ${transient ? 'unavailable' : 'refused'} (${err.status || 'no status'}): ${err.message}`);
    return { ok: false, reason: transient ? 'unavailable' : 'not_serviceable' };
  }
}

/**
 * Resolve what this delivery costs the customer.
 *
 * @returns {{
 *   fee: number|null, source: 'self'|'partner'|null, provider: string|null,
 *   partnerFee: number|null, quoteId: string|null, reason: string|null,
 *   durationMinutes: number|null
 * }}  fee === null means delivery isn't available for this address.
 */
async function resolveDeliveryFee({
  locationId, destinationAddress, originAddress, miles, subtotal,
  pickupPhone, dropoffPhone,
}) {
  let loc = null;
  if (locationId) {
    const r = await pool.query(
      `SELECT self_delivery_enabled, delivery_radius_miles, delivery_cost,
              delivery_per_mile_fee, delivery_pricing_mode, delivery_percent,
              delivery_min_charge
         FROM locations WHERE id = $1`,
      [locationId]
    );
    loc = r.rows[0] || null;
  }

  // 1. Own driver, if this location offers it and the address is in range.
  //    Off by default: a location only qualifies once it's ticked in CPanel.
  if (loc?.self_delivery_enabled) {
    const radius = parseFloat(loc.delivery_radius_miles);
    if (Number.isFinite(radius) && Number.isFinite(Number(miles)) && Number(miles) <= radius) {
      return {
        fee: selfDeliveryPrice(loc, subtotal, miles),
        source: 'self', provider: null, partnerFee: null, quoteId: null,
        reason: null, durationMinutes: null,
      };
    }
  }

  // 2. Courier, at its live price plus the markup.
  const q = await partnerQuote({ originAddress, destinationAddress, subtotal, pickupPhone, dropoffPhone });
  if (q.ok) {
    return {
      fee: q.fee, source: 'partner', provider: q.provider,
      partnerFee: q.partnerFee, quoteId: q.quoteId,
      reason: null, durationMinutes: q.durationMinutes,
    };
  }

  // 3. No delivery available for this address.
  return {
    fee: null, source: null, provider: null, partnerFee: null, quoteId: null,
    reason: q.reason, durationMinutes: null,
  };
}

// ── Quote persistence ───────────────────────────────────────────────────────
// The price the customer was shown is the price the order is placed at, even
// though a courier's live quote moves minute to minute.

async function saveQuote({ locationId, destinationAddress, miles, subtotal, resolved }) {
  const ref = crypto.randomBytes(18).toString('hex');
  await pool.query(
    `INSERT INTO delivery_quotes
       (quote_ref, location_id, address_hash, miles, source, provider,
        partner_quote_id, partner_fee, customer_fee, subtotal, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      ref, locationId || null, addressHash(destinationAddress, locationId),
      Number.isFinite(Number(miles)) ? Number(miles) : null,
      resolved.source, resolved.provider, resolved.quoteId,
      resolved.partnerFee, resolved.fee, parseFloat(subtotal) || 0,
      new Date(Date.now() + QUOTE_TTL_MS),
    ]
  );
  return ref;
}

/**
 * Look up a quote the customer was actually shown. Returns null when the ref
 * is unknown, expired, or was issued for a different address/location — all of
 * which mean the caller must fall back to resolving the fee fresh rather than
 * trusting whatever the client sent.
 */
async function loadQuote(quoteRef, { locationId, destinationAddress } = {}) {
  if (!quoteRef) return null;
  const r = await pool.query(
    `SELECT * FROM delivery_quotes WHERE quote_ref = $1 AND expires_at > NOW()`,
    [String(quoteRef)]
  );
  const row = r.rows[0];
  if (!row) return null;

  if (destinationAddress && row.address_hash !== addressHash(destinationAddress, locationId)) return null;
  if (locationId && row.location_id && Number(row.location_id) !== Number(locationId)) return null;

  return {
    fee: parseFloat(row.customer_fee),
    partnerFee: row.partner_fee == null ? null : parseFloat(row.partner_fee),
    source: row.source,
    provider: row.provider,
    quoteId: row.partner_quote_id,
    miles: row.miles == null ? null : parseFloat(row.miles),
  };
}

async function markQuoteConsumed(quoteRef) {
  if (!quoteRef) return;
  await pool
    .query(`UPDATE delivery_quotes SET consumed_at = NOW() WHERE quote_ref = $1`, [String(quoteRef)])
    .catch(() => {});
}

/**
 * Server-side guard that the client isn't under-reporting the delivery fee.
 *
 * Prefers the quote the customer was actually shown: a courier's price moves
 * minute to minute, so re-quoting here and demanding the answer match would
 * reject honest orders whenever traffic shifted between checkout and submit.
 * Falls back to resolving fresh when no usable quote ref arrives (a non-web
 * API client, or a quote that expired while the customer sat on the page).
 *
 * @returns {{ok: true, fee: number, source: string|null, quoteId: string|null}}
 *        | {ok: false, message: string}
 */
async function validateClientDeliveryFee({
  quoteRef, locationId, destinationAddress, originAddress, miles, subtotal,
  clientFee, freeDeliveryThreshold, couponFreeDelivery = false,
}) {
  const TOLERANCE = 0.10;

  let expected = await loadQuote(quoteRef, { locationId, destinationAddress });

  if (!expected) {
    const resolved = await resolveDeliveryFee({
      locationId, destinationAddress, originAddress, miles, subtotal,
    });
    if (resolved.fee === null) {
      return {
        ok: false,
        message: resolved.reason === 'not_serviceable'
          ? 'We can’t deliver to this address. Please choose pickup.'
          : 'Delivery pricing is temporarily unavailable. Please choose pickup or try again shortly.',
      };
    }
    expected = { fee: resolved.fee, source: resolved.source, quoteId: resolved.quoteId };
  }

  // The same waiver /calculate-fee applied, recomputed here so a tampered
  // client can't claim $0 without qualifying — and so an order that genuinely
  // qualifies isn't rejected for correctly reporting a waived fee.
  let expectedFee = expected.fee;
  if ((parseFloat(subtotal) || 0) >= (parseFloat(freeDeliveryThreshold) || Infinity)) {
    expectedFee = 0;
  }
  // A free_delivery coupon is one of the two zero cases the owner called out
  // ("delivery charge might be zero because of a coupon"). The caller resolves
  // it through computeCouponDiscount, so a made-up code can't reach here.
  if (couponFreeDelivery) expectedFee = 0;

  if ((parseFloat(clientFee) || 0) < expectedFee - TOLERANCE) {
    return { ok: false, message: 'Delivery fee is incorrect. Please refresh and retry.' };
  }

  return { ok: true, fee: expectedFee, source: expected.source || null, quoteId: expected.quoteId || null };
}

module.exports = {
  resolveDeliveryFee, selfDeliveryPrice, partnerQuote,
  saveQuote, loadQuote, markQuoteConsumed, validateClientDeliveryFee,
  addressHash, MARKUP_PCT,
};
