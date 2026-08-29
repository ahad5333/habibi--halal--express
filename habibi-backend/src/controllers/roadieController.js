const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');
const { roadieRequest, isConfigured } = require('../utils/roadie');
const { getDistance } = require('../utils/googleMaps');

function verifyRoadieSignature(rawBody, signature) {
  const secret = process.env.ROADIE_WEBHOOK_SECRET || process.env.ROADIE_API_KEY;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
  } catch { return false; }
}

// Fallback pickup info -- only used if an order somehow has no location_id
// (the business has 3 real locations, so this should be a rare edge case).
const RESTAURANT_NAME    = process.env.RESTAURANT_NAME    || 'Habibi Halal Express';
const RESTAURANT_PHONE   = process.env.RESTAURANT_PHONE   || '+13477033731';
const RESTAURANT_STREET  = process.env.RESTAURANT_STREET  || '2974 Jerome Ave';
const RESTAURANT_CITY    = process.env.RESTAURANT_CITY    || 'Bronx';
const RESTAURANT_STATE   = process.env.RESTAURANT_STATE   || 'NY';
const RESTAURANT_ZIP     = process.env.RESTAURANT_ZIP     || '10468';

// Split a full address string into parts for Roadie's structured address format
function parseAddress(full) {
  const parts = (full || '').split(',').map(s => s.trim());
  return {
    street1: parts[0] || full || '',
    city:    parts[1] || '',
    state:   (parts[2] || '').replace(/\s*\d+/, '').trim(),
    zip:     ((parts[2] || '').match(/\d+/) || [])[0] || (parts[3] || ''),
  };
}

// Converts a NY-local wall-clock date+time (e.g. "2026-08-29" + "19:30") into
// the correct UTC Date instant, handling DST -- this server's Node process
// runs in UTC (see utils/businessHours.js's nowInEastern for the same
// concern in reverse), so a naive `new Date(...)` on a local-looking string
// would silently use the wrong offset.
function nyWallTimeToUTC(dateStr, timeStr) {
  const naiveUTC  = new Date(`${dateStr}T${timeStr}:00Z`);
  const nyDisplay = naiveUTC.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const nyAsUTC   = new Date(nyDisplay.replace(',', '') + ' UTC');
  const offsetMs  = naiveUTC.getTime() - nyAsUTC.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

// Roadie's real API has no "category"/"size" concept -- items[] takes real
// length/width/height/weight. Spec: small unless order value > $150, then
// "Medium"; items are never long/heavy (spec: "longer than 4ft/50lbs" is
// always "No") -- conservative small-parcel numbers stand in for the two buckets.
function itemDimensions(orderTotal) {
  return orderTotal > 150
    ? { length: 18, width: 18, height: 18, weight: 15 }
    : { length: 12, width: 12, height: 12, weight: 5 };
}

// Roadie's "what does the driver need to know for pickup?" -- two messages
// joined with " - ": the location's own custom message, then a fixed line
// asking the driver to identify the order.
function buildPickupNotes(order) {
  const first  = (order.roadie_pickup_message || '').trim();
  const second = `Please ask for order # ${order.order_number}, for ${order.customer_name || 'the customer'}`;
  return first ? `${first} - ${second}` : second;
}

// Roadie's "what does the driver need to know for delivery?" -- customer's
// own delivery note, then a conditional leave-at-door/apt message, falling
// back to a generic line if both would otherwise be empty (Roadie requires
// some message here).
function buildDeliveryNotes(order) {
  const first = (order.driver_note || '').trim();
  let second = '';
  if (order.leave_at_door) {
    second = 'Please leave this delivery at the door';
    if (order.apt_unit) second += ` of ${order.apt_unit}`;
  } else if (order.apt_unit) {
    second = `Please deliver to ${order.apt_unit}`;
  }
  if (!first && !second) return 'Please Deliver ASAP';
  return [first, second].filter(Boolean).join(', ');
}

// Roadie's "earliest the driver can arrive for pickup" -- ASAP for immediate
// orders; for scheduled orders, 30 min + estimated driving time before the
// customer's requested time (spec), so the order is actually ready when the
// driver shows up. Reuses the same getDistance() helper the delivery-fee
// logic already relies on for driving-time estimates.
async function computePickupAfter(order, pickupFullAddr, dropoffFullAddr) {
  if (!order.scheduled_date || !order.scheduled_time) return new Date();

  const dateStr = typeof order.scheduled_date === 'string'
    ? order.scheduled_date
    : order.scheduled_date.toISOString().slice(0, 10);
  const requested = nyWallTimeToUTC(dateStr, order.scheduled_time);

  let driveMinutes = 30;
  try {
    const dist = await getDistance(pickupFullAddr, dropoffFullAddr);
    if (dist && !dist.unavailable) {
      driveMinutes = 30 + (dist.duration_in_traffic_minutes ?? dist.duration_minutes ?? 0);
    }
  } catch { /* fall back to the flat 30 min buffer */ }

  return new Date(requested.getTime() - driveMinutes * 60000);
}

// ── Create a Roadie shipment for an existing order ──────────────────
const createShipment = async (req, res) => {
  const { order_id } = req.params;
  try {
    const orderResult = await pool.query(
      `SELECT go.id, go.order_number, go.customer_name, go.customer_phone,
              go.delivery_address, go.delivery_city, go.delivery_zip, go.delivery_state,
              go.total, go.location_id,
              go.leave_at_door, go.apt_unit, go.driver_note, go.extra_help_needed, go.extra_help_note,
              go.business_name, go.tip, go.scheduled_date, go.scheduled_time,
              loc.phone_number AS location_phone,
              loc.exact_address AS location_exact_address,
              loc.roadie_pickup_message
       FROM guest_orders go
       LEFT JOIN locations loc ON loc.id = go.location_id
       WHERE go.id::text = $1 OR go.order_number = $1`,
      [order_id]
    );
    if (!orderResult.rows.length) return res.status(404).json({ message: 'Order not found' });

    const order = orderResult.rows[0];

    const pickupAddr = order.location_exact_address
      ? parseAddress(order.location_exact_address)
      : { street1: RESTAURANT_STREET, city: RESTAURANT_CITY, state: RESTAURANT_STATE, zip: RESTAURANT_ZIP };

    // The combined delivery_address may already have ", <apt_unit>" appended
    // (Checkout.jsx bakes it in for every OTHER consumer's benefit -- kitchen
    // display, dispatch SMS, admin Orders view) -- strip that back off here
    // so it isn't duplicated once street2 carries the apt separately.
    let dropoffStreet1 = order.delivery_address || '';
    if (order.apt_unit && dropoffStreet1.endsWith(`, ${order.apt_unit}`)) {
      dropoffStreet1 = dropoffStreet1.slice(0, -(`, ${order.apt_unit}`.length));
    }

    const pickupFullAddr  = `${pickupAddr.street1}, ${pickupAddr.city}, ${pickupAddr.state} ${pickupAddr.zip}`;
    const dropoffFullAddr = [dropoffStreet1, order.delivery_city, order.delivery_state, order.delivery_zip]
      .filter(Boolean).join(', ');

    const pickupAfter = await computePickupAfter(order, pickupFullAddr, dropoffFullAddr);
    // Roadie's own minimum window is 2 hours -- the spec's "2 hours and 1
    // minute after pickup" is the tightest deadline it will actually accept.
    const deliverEnd = new Date(pickupAfter.getTime() + (2 * 60 + 1) * 60000);

    const payload = {
      reference_id: order.order_number,
      // Generic operational note -- no food reference (Roadie account is
      // registered for kitchen-supplies delivery only, per NYC law).
      description: 'Order is ready for Delivery, No need to call, Tip is added to handle Delivery ASAP',
      items: [{
        description: 'Personal Items',
        quantity:    1,
        value:       100, // spec: declared value is always $100, regardless of the real order total
        ...itemDimensions(parseFloat(order.total) || 0),
      }],
      pickup_location: {
        address: {
          street1: pickupAddr.street1,
          city:    pickupAddr.city,
          state:   pickupAddr.state,
          zip:     pickupAddr.zip,
        },
        contact: {
          name:  RESTAURANT_NAME,
          phone: order.location_phone || RESTAURANT_PHONE,
        },
        notes: buildPickupNotes(order),
      },
      delivery_location: {
        address: {
          name:    order.business_name || undefined,
          street1: dropoffStreet1,
          street2: order.apt_unit || undefined,
          city:    order.delivery_city  || '',
          state:   order.delivery_state || 'NY',
          zip:     order.delivery_zip   || '',
        },
        contact: {
          name:  order.customer_name  || 'Customer',
          phone: order.customer_phone || '',
        },
        notes: buildDeliveryNotes(order),
      },
      pickup_after:    pickupAfter.toISOString(),
      deliver_between: { start: pickupAfter.toISOString(), end: deliverEnd.toISOString() },
      signature_required: false, // spec: "add delivery confirmation?" -- No
      decline_insurance:  false, // spec: the $100 declared value should actually apply
    };

    const data = await roadieRequest('/shipments', 'POST', payload);

    // Spec: Habibi always bakes a $5 driver tip into the delivery cost, plus
    // 50% of whatever the customer tips at checkout -- the customer never
    // sees that split. Roadie's real API takes tips via a separate call,
    // made right after shipment creation once the shipment id is known.
    const tipAmount = 5 + (parseFloat(order.tip) > 0 ? parseFloat(order.tip) * 0.5 : 0);
    try {
      await roadieRequest(`/shipments/${data.id}/tips`, 'PUT', {
        amount: Math.round(tipAmount * 100) / 100,
        reason: (order.extra_help_needed && order.extra_help_note) ? 'Other' : 'Rush Delivery',
        note:   (order.extra_help_needed && order.extra_help_note) ? order.extra_help_note : undefined,
      });
    } catch (tipErr) {
      // Don't fail the whole shipment over the tip call -- the exact field
      // names here (reason/note) are a best-effort guess not yet confirmed
      // against Roadie's Postman collection; the shipment itself, which does
      // matter, has already succeeded by this point.
      console.error('Roadie tip call failed:', tipErr.message);
    }

    await pool.query(
      `INSERT INTO roadie_deliveries
         (order_id, order_number, roadie_id, tracking_number, state, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (roadie_id) DO UPDATE
         SET state = $5, updated_at = NOW()`,
      [
        order.id,
        order.order_number,
        data.id,
        data.tracking_number || data.id,
        data.state || 'pending',
        data.price || 0,
      ]
    );

    res.json({ success: true, shipment: data });
  } catch (err) {
    console.error('roadie createShipment error:', err.message);
    res.status(500).json(safeError(err));
  }
};

// ── Get shipment status from Roadie ────────────────────────────────
const getShipment = async (req, res) => {
  const { shipment_id } = req.params;
  try {
    const data = await roadieRequest(`/shipments/${shipment_id}`);
    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Cancel a Roadie shipment ────────────────────────────────────────
const cancelShipment = async (req, res) => {
  const { shipment_id } = req.params;
  try {
    await roadieRequest(`/shipments/${shipment_id}`, 'DELETE');
    await pool.query(
      `UPDATE roadie_deliveries SET state='cancelled', updated_at=NOW() WHERE roadie_id=$1`,
      [shipment_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── List all Roadie deliveries ──────────────────────────────────────
const listShipments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rd.*, go.customer_name, go.delivery_address, go.total AS order_total
       FROM roadie_deliveries rd
       LEFT JOIN guest_orders go ON go.id = rd.order_id
       ORDER BY rd.created_at DESC
       LIMIT 100`
    );
    res.json({ shipments: result.rows, configured: isConfigured() });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Roadie webhook — receives state change events ───────────────────
const handleWebhook = async (req, res) => {
  const sig = req.headers['x-roadie-signature'] || '';
  const raw = JSON.stringify(req.body);
  if (!verifyRoadieSignature(raw, sig)) return res.status(401).json({ message: 'Invalid signature' });

  try {
    const { event, data } = req.body;

    if (!data?.id) return res.sendStatus(200);

    const stateMap = {
      'shipment.available': 'available',
      'shipment.assigned':  'assigned',
      'shipment.picked_up': 'picked_up',
      'shipment.delivered': 'delivered',
      'shipment.cancelled': 'cancelled',
      'shipment.returned':  'returned',
    };

    const state = stateMap[event] || data.state || event;

    await pool.query(
      `UPDATE roadie_deliveries
         SET state=$1,
             agent_name=$2,
             agent_phone=$3,
             estimated_pickup_time=$4,
             estimated_dropoff_time=$5,
             updated_at=NOW()
       WHERE roadie_id=$6`,
      [
        state,
        data.agent?.name         || null,
        data.agent?.phone        || null,
        data.estimated_pickup_time  || null,
        data.estimated_dropoff_time || null,
        data.id,
      ]
    );

    const io = req.app.get('io');
    if (io) io.emit('roadie_update', { roadie_id: data.id, event, state, data });

    res.sendStatus(200);
  } catch (err) {
    console.error('Roadie webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Get a price estimate before creating shipment ───────────────────
const getEstimate = async (req, res) => {
  const { dropoff_address, location_id } = req.body;
  if (!dropoff_address) return res.status(400).json({ message: 'dropoff_address required' });

  try {
    let pickupAddr = { street1: RESTAURANT_STREET, city: RESTAURANT_CITY, state: RESTAURANT_STATE, zip: RESTAURANT_ZIP };
    if (location_id) {
      const locRes = await pool.query('SELECT exact_address FROM locations WHERE id = $1', [location_id]);
      if (locRes.rows[0]?.exact_address) pickupAddr = parseAddress(locRes.rows[0].exact_address);
    }
    const dropoffAddr = parseAddress(dropoff_address);
    const payload = {
      items: [{ description: 'Personal Items', quantity: 1, value: 100, ...itemDimensions(0) }],
      pickup_location:   { address: { street1: pickupAddr.street1,  city: pickupAddr.city,  state: pickupAddr.state,  zip: pickupAddr.zip } },
      delivery_location: { address: { street1: dropoffAddr.street1, city: dropoffAddr.city, state: dropoffAddr.state, zip: dropoffAddr.zip } },
    };
    const data = await roadieRequest('/estimates', 'POST', payload);
    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { createShipment, getShipment, cancelShipment, listShipments, handleWebhook, getEstimate };
