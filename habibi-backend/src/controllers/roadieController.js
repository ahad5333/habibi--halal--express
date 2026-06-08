const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');
const { roadieRequest, isConfigured } = require('../utils/roadie');

function verifyRoadieSignature(rawBody, signature) {
  const secret = process.env.ROADIE_WEBHOOK_SECRET || process.env.ROADIE_API_KEY;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
  } catch { return false; }
}

const RESTAURANT_NAME    = process.env.RESTAURANT_NAME    || 'Habibi Halal Express';
const RESTAURANT_PHONE   = process.env.RESTAURANT_PHONE   || '+13477033731';
const RESTAURANT_STREET  = process.env.RESTAURANT_STREET  || '204 E Mosholu Pkwy S';
const RESTAURANT_CITY    = process.env.RESTAURANT_CITY    || 'Bronx';
const RESTAURANT_STATE   = process.env.RESTAURANT_STATE   || 'NY';
const RESTAURANT_ZIP     = process.env.RESTAURANT_ZIP     || '10458';

// Split a full address string into parts for the Roadie structured address format
function parseAddress(full) {
  // Expects "123 Main St, City, State ZIP" or similar
  const parts = full.split(',').map(s => s.trim());
  return {
    street1: parts[0] || full,
    city:    parts[1] || '',
    state:   (parts[2] || '').replace(/\s*\d+/, '').trim(),
    zip:     ((parts[2] || '').match(/\d+/) || [])[0] || (parts[3] || ''),
  };
}

// ── Create a Roadie shipment for an existing order ──────────────────
const createShipment = async (req, res) => {
  const { order_id } = req.params;
  try {
    const orderResult = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone,
              delivery_address, delivery_city, delivery_zip, delivery_state,
              delivery_instructions, total
       FROM guest_orders WHERE id = $1`,
      [order_id]
    );
    if (!orderResult.rows.length) return res.status(404).json({ message: 'Order not found' });

    const order = orderResult.rows[0];

    const dropoffAddr = parseAddress(
      [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip]
        .filter(Boolean).join(', ')
    );

    const payload = {
      description:      'Halal food delivery',
      size:             'small',
      value:            Math.round(parseFloat(order.total || 0) * 100), // cents
      quantity:         1,
      reference_number: `habibi-${order.order_number}`,
      pickup: {
        name:    RESTAURANT_NAME,
        phone:   RESTAURANT_PHONE,
        address: {
          street1: RESTAURANT_STREET,
          city:    RESTAURANT_CITY,
          state:   RESTAURANT_STATE,
          zip:     RESTAURANT_ZIP,
        },
        notes: `Pick up at counter. Order #${order.order_number}.`,
      },
      delivery: {
        name:    order.customer_name || 'Customer',
        phone:   order.customer_phone || '',
        address: dropoffAddr,
        notes:   order.delivery_instructions || '',
      },
    };

    const data = await roadieRequest('/shipments', 'POST', payload);

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
  const { dropoff_address } = req.body;
  if (!dropoff_address) return res.status(400).json({ message: 'dropoff_address required' });

  try {
    const dropoffAddr = parseAddress(dropoff_address);
    const payload = {
      description: 'Food delivery',
      size:        'small',
      value:       1000,
      quantity:    1,
      pickup: {
        address: {
          street1: RESTAURANT_STREET,
          city:    RESTAURANT_CITY,
          state:   RESTAURANT_STATE,
          zip:     RESTAURANT_ZIP,
        },
      },
      delivery: { address: dropoffAddr },
    };
    const data = await roadieRequest('/estimates', 'POST', payload);
    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { createShipment, getShipment, cancelShipment, listShipments, handleWebhook, getEstimate };

