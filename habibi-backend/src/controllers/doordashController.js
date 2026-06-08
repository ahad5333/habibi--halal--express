const crypto = require('crypto');
const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { ddRequest, isConfigured } = require('../utils/doordash');

function verifyDoorDashSignature(rawBody, signature) {
  const secret = process.env.DOORDASH_WEBHOOK_SECRET;
  if (!secret) return true; // not configured — allow but log
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expected)
    );
  } catch { return false; }
}

const RESTAURANT_ADDRESS  = process.env.RESTAURANT_ADDRESS  || '204 E Mosholu Pkwy S, Bronx, NY 10458';
const RESTAURANT_NAME     = process.env.RESTAURANT_NAME     || 'Habibi Halal Express';
const RESTAURANT_PHONE    = process.env.RESTAURANT_PHONE    || '+13477033731';

// ── Create a DoorDash Drive delivery for an existing order ──────────
const createDelivery = async (req, res) => {
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
    const dropoffAddress = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip]
      .filter(Boolean).join(', ');

    const payload = {
      external_delivery_id:    `habibi-${order.order_number}`,
      pickup_address:          RESTAURANT_ADDRESS,
      pickup_business_name:    RESTAURANT_NAME,
      pickup_phone_number:     RESTAURANT_PHONE,
      pickup_instructions:     'Pick up at counter. Tell staff the order number.',
      dropoff_address:         dropoffAddress,
      dropoff_business_name:   order.customer_name || 'Customer',
      dropoff_phone_number:    order.customer_phone || '',
      dropoff_instructions:    order.delivery_instructions || '',
      order_value:             Math.round(parseFloat(order.total || 0) * 100), // cents
    };

    const ddData = await ddRequest('/drive/v2/deliveries', 'POST', payload);

    // Store in doordash_deliveries
    await pool.query(
      `INSERT INTO doordash_deliveries
         (order_id, order_number, doordash_delivery_id, tracking_url, status, fee)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (doordash_delivery_id) DO UPDATE
         SET status = $5, updated_at = NOW()`,
      [
        order.id,
        order.order_number,
        ddData.delivery_id || ddData.external_delivery_id,
        ddData.tracking_url || null,
        ddData.delivery_status || 'created',
        ddData.fee ? ddData.fee / 100 : 0,
      ]
    );

    res.json({ success: true, delivery: ddData });
  } catch (err) {
    console.error('createDelivery error:', err.message);
    res.status(500).json(safeError(err));
  }
};

// ── Get delivery status from DoorDash ───────────────────────────────
const getDelivery = async (req, res) => {
  const { delivery_id } = req.params;
  try {
    const ddData = await ddRequest(`/drive/v2/deliveries/${delivery_id}`);
    res.json(ddData);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Cancel a DoorDash delivery ──────────────────────────────────────
const cancelDelivery = async (req, res) => {
  const { delivery_id } = req.params;
  try {
    await ddRequest(`/drive/v2/deliveries/${delivery_id}/cancel`, 'PUT');
    await pool.query(
      `UPDATE doordash_deliveries SET status='cancelled', updated_at=NOW() WHERE doordash_delivery_id=$1`,
      [delivery_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── List all DoorDash deliveries ────────────────────────────────────
const listDeliveries = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dd.*, go.customer_name, go.delivery_address, go.total AS order_total
       FROM doordash_deliveries dd
       LEFT JOIN guest_orders go ON go.id = dd.order_id
       ORDER BY dd.created_at DESC
       LIMIT 100`
    );
    res.json({ deliveries: result.rows, configured: isConfigured() });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── DoorDash webhook — receives status updates ──────────────────────
const handleWebhook = async (req, res) => {
  const sig = req.headers['x-doordash-signature'] || req.headers['x-dd-signature'] || '';
  const rawBody = req.rawBody || JSON.stringify(req.body);
  if (!verifyDoorDashSignature(rawBody, sig)) {
    console.warn('[DoorDash webhook] Invalid signature — rejected');
    return res.sendStatus(401);
  }

  try {
    const { event_name, delivery_id, external_delivery_id, data } = req.body;

    const ddId = delivery_id || external_delivery_id;
    if (!ddId) return res.sendStatus(200);

    const statusMap = {
      dasher_confirmed:           'dasher_assigned',
      dasher_confirmed_pickup_arrival: 'at_pickup',
      dasher_picked_up:           'picked_up',
      dasher_confirmed_consumer_arrival: 'at_dropoff',
      delivery_delivered:         'delivered',
      delivery_cancelled:         'cancelled',
      delivery_failed:            'failed',
    };

    const status = statusMap[event_name] || event_name;

    await pool.query(
      `UPDATE doordash_deliveries
         SET status=$1,
             dasher_name=$2,
             dasher_phone=$3,
             estimated_dropoff_time=$4,
             updated_at=NOW()
       WHERE doordash_delivery_id=$5`,
      [
        status,
        data?.dasher?.name         || null,
        data?.dasher?.phone_number || null,
        data?.estimated_delivery_time || null,
        ddId,
      ]
    );

    // Emit Socket.IO update to admin
    const io = req.app.get('io');
    if (io) io.emit('doordash_update', { delivery_id: ddId, event_name, status, data });

    res.sendStatus(200);
  } catch (err) {
    console.error('DoorDash webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Get quote (estimate fee before creating delivery) ───────────────
const getQuote = async (req, res) => {
  const { dropoff_address } = req.body;
  try {
    const payload = {
      external_delivery_id: `quote-${Date.now()}`,
      pickup_address:       RESTAURANT_ADDRESS,
      dropoff_address,
      order_value:          1000, // placeholder cents
    };
    const data = await ddRequest('/drive/v2/quotes', 'POST', payload);
    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { createDelivery, getDelivery, cancelDelivery, listDeliveries, handleWebhook, getQuote };

