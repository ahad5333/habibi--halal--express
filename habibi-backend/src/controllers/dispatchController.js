const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const safeError = require('../utils/safeError');
const pool      = require('../config/db');
const { getDistance } = require('../utils/googleMaps');
const { getFeeForDistance } = require('../utils/deliveryFee');
const { sendSMS } = require('../services/smsService');
const { sendPushNotification } = require('../services/fcmService');

// Generate HMAC token for a driver — used in SMS links and X-Driver-Token header
function driverToken(driver_id) {
  const salt = process.env.DRIVER_SECRET_SALT || 'habibi-driver-default';
  return crypto.createHmac('sha256', salt).update(String(driver_id)).digest('hex');
}

// ── Admin: list active delivery assignments ─────────────────────────
const getAssignments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT da.*,
             sm.name  AS driver_full_name,
             sm.phone AS driver_phone_number,
             go.payment_method,
             go.total AS order_total
      FROM delivery_assignments da
      LEFT JOIN staff_members sm ON sm.id = da.driver_id
      LEFT JOIN guest_orders  go ON go.order_number = da.order_number
      ORDER BY da.assigned_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: assign an order to a driver ─────────────────────────────
const assignDriver = async (req, res) => {
  const { order_id, order_number, driver_id, delivery_address, customer_name, customer_phone } = req.body;
  try {
    const driverResult = await pool.query(
      `SELECT id, name, phone FROM staff_members WHERE id=$1 AND role='delivery' AND is_active=TRUE`,
      [driver_id]
    );
    if (!driverResult.rows.length) return res.status(400).json({ message: 'Driver not found or unavailable' });
    const driver = driverResult.rows[0];

    // Fetch tip amount from the order to show the driver
    let tip_amount = null;
    if (order_number) {
      const tipRow = await pool.query(
        `SELECT tip FROM guest_orders WHERE order_number=$1 LIMIT 1`,
        [order_number]
      );
      if (tipRow.rows.length) tip_amount = tipRow.rows[0].tip;
    }

    const result = await pool.query(
      `INSERT INTO delivery_assignments
         (order_id, order_number, driver_id, driver_name, status,
          delivery_address, customer_name, customer_phone, tip_amount)
       VALUES ($1,$2,$3,$4,'assigned',$5,$6,$7,$8)
       RETURNING *`,
      [order_id, order_number, driver_id, driver.name, delivery_address, customer_name, customer_phone, tip_amount]
    );
    const assignment = result.rows[0];

    const base  = process.env.FRONTEND_URL || 'https://habibihe.com';
    const token = driverToken(driver_id);

    // Notify driver via Socket.IO — targeted to their private room
    const io = req.app.get('io');
    if (io) io.to(`driver_${driver_id}`).emit('assignment_created', assignment);

    // Notify driver via SMS with auth token embedded in URL
    if (driver.phone) {
      const driverUrl = `${base}/driver?id=${driver_id}&token=${token}`;
      const msg = `New delivery assigned: Order ${order_number} for ${customer_name || 'customer'}. ` +
                  `Drop-off: ${delivery_address}. ` +
                  `Open your app: ${driverUrl}`;
      sendSMS(driver.phone, msg).catch(err =>
        console.error('[Dispatch] Driver SMS failed:', err.message)
      );
    }

    // Notify customer that a driver has been assigned
    if (customer_phone) {
      const trackUrl = `${base}/order-tracking?order=${order_number}`;
      const msg = `Great news! A driver has been assigned to your Habibi order ${order_number}. ` +
                  `Track your delivery live: ${trackUrl}`;
      sendSMS(customer_phone, msg).catch(err =>
        console.error('[Dispatch] Customer SMS failed:', err.message)
      );
    }

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: accept or reject an assignment ──────────────────────────
const respondToAssignment = async (req, res) => {
  const { id } = req.params;
  const { response, reason } = req.body;
  if (!['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({ message: 'response must be accepted or rejected' });
  }
  try {
    if (response === 'rejected') {
      await pool.query(
        `UPDATE delivery_assignments
           SET status='cancelled', rejection_reason=$1, rejected_at=NOW()
         WHERE id=$2`,
        [reason || null, id]
      );
      // Notify admin via Socket.IO so they can reassign
      const io = req.app.get('io');
      if (io) io.to('admins').emit('assignment_rejected', { id: parseInt(id), reason });
    } else {
      await pool.query(
        `UPDATE delivery_assignments SET accepted_at=NOW() WHERE id=$1`,
        [id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: get my current assignment ──────────────────────────────
const getDriverAssignment = async (req, res) => {
  const { driver_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT da.*, go.payment_method, go.total AS order_total,
              go.items, go.delivery_instructions
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.driver_id=$1 AND da.status IN ('assigned','en_route')
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      [driver_id]
    );
    const row = result.rows[0] || null;
    if (row) {
      try { row.items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []); } catch (_) { row.items = []; }
    }
    res.json(row);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: update GPS location ─────────────────────────────────────
const updateDriverGPS = async (req, res) => {
  const { assignment_id } = req.params;
  const { lat, lng, driver_id } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });

  try {
    // Append to GPS trail and update current position
    await pool.query(
      `UPDATE delivery_assignments
         SET current_lat=$1,
             current_lng=$2,
             last_location_update=NOW(),
             status='en_route',
             gps_trail = COALESCE(gps_trail, '[]'::jsonb) || jsonb_build_object('lat',$1::text,'lng',$2::text,'ts',NOW()::text)
       WHERE id=$3`,
      [lat, lng, assignment_id]
    );

    const io = req.app.get('io');
    if (io) {
      const asgn = await pool.query(
        `SELECT da.order_number, go.delivery_address, go.delivery_city
           FROM delivery_assignments da
           LEFT JOIN guest_orders go ON go.order_number = da.order_number
          WHERE da.id=$1`,
        [assignment_id]
      );
      const orderNumber   = asgn.rows[0]?.order_number;
      const deliveryAddr  = [asgn.rows[0]?.delivery_address, asgn.rows[0]?.delivery_city].filter(Boolean).join(', ');
      const payload = {
        assignment_id: parseInt(assignment_id),
        driver_id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: new Date().toISOString(),
      };
      if (orderNumber) {
        io.to(`order_${orderNumber}`).emit('driver_location_update', payload);

        // Nearby detection — geocode delivery address and check if within 500m
        if (deliveryAddr) {
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(deliveryAddr)}`,
              { headers: { 'User-Agent': 'HabibiHalalExpress/1.0', 'Accept-Language': 'en' } }
            );
            const geoData = await geoRes.json();
            if (geoData[0]) {
              const destLat = parseFloat(geoData[0].lat);
              const destLng = parseFloat(geoData[0].lon);
              const dLat = (parseFloat(lat) - destLat) * Math.PI / 180;
              const dLng = (parseFloat(lng) - destLng) * Math.PI / 180;
              const a = Math.sin(dLat/2)**2 + Math.cos(destLat*Math.PI/180)*Math.cos(parseFloat(lat)*Math.PI/180)*Math.sin(dLng/2)**2;
              const distMeters = 6371000 * 2 * Math.asin(Math.sqrt(a));
              if (distMeters < 500) {
                io.to(`order_${orderNumber}`).emit('driver_nearby', {
                  order_number: orderNumber,
                  distance_meters: Math.round(distMeters),
                });
              }
            }
          } catch (_) {}
        }
      }
      io.to('admins').emit('driver_location_update', payload);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: broadcast a new order to all on-duty drivers ────────────
const broadcastOrderToDrivers = async (req, res) => {
  const { order_number } = req.params;
  try {
    const orderRes = await pool.query(
      `SELECT order_number, customer_name, delivery_address, delivery_city, total, tip, items
         FROM guest_orders WHERE order_number=$1`,
      [order_number]
    );
    if (!orderRes.rows.length) return res.status(404).json({ message: 'Order not found' });

    const order = orderRes.rows[0];
    let itemCount = 0;
    try { itemCount = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []).length; } catch (_) {}

    const deliveryAddr = [order.delivery_address, order.delivery_city].filter(Boolean).join(', ');
    const payload = {
      order_number: order.order_number,
      customer_name: order.customer_name,
      delivery_address: deliveryAddr,
      total: parseFloat(order.total || 0),
      tip: parseFloat(order.tip || 0),
      item_count: itemCount,
      broadcast_at: new Date().toISOString(),
    };

    const io = req.app.get('io');
    if (io) {
      io.to('drivers_online').emit('new_order_broadcast', payload);
    }

    // Also send Firebase push to drivers who have the app closed/backgrounded
    const tokenRes = await pool.query(
      `SELECT driver_fcm_token FROM staff_members
       WHERE role='delivery' AND is_active=TRUE AND driver_fcm_token IS NOT NULL`
    );
    for (const { driver_fcm_token } of tokenRes.rows) {
      sendPushNotification(
        driver_fcm_token,
        '🔔 New Delivery Order',
        `#${order.order_number} — ${deliveryAddr || 'Tap to view'}`,
        { url: '/driver', type: 'new_order', tag: 'new-order' }
      ).catch(() => {});
    }

    res.json({ ok: true, broadcast_to: 'drivers_online', push_sent: tokenRes.rowCount });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: claim a broadcast order (first-accept-wins) ────────────
const claimOrder = async (req, res) => {
  const { order_number, driver_id, driver_name } = req.body;
  if (!order_number || !driver_id) return res.status(400).json({ message: 'order_number and driver_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock: check if already claimed by another driver
    const existing = await client.query(
      `SELECT id, driver_id FROM delivery_assignments
        WHERE order_number=$1 AND status NOT IN ('cancelled')
        FOR UPDATE`,
      [order_number]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      const takenBy = existing.rows[0].driver_id;
      if (String(takenBy) === String(driver_id)) {
        // Same driver double-tapped — return their existing assignment
        return res.json({ claimed: true, yours: true, assignment_id: existing.rows[0].id });
      }
      return res.status(409).json({ claimed: false, message: 'Order already taken by another driver.' });
    }

    // Fetch order details for the assignment record
    const orderRes = await client.query(
      `SELECT id, customer_name, customer_phone, delivery_address, delivery_city, tip
         FROM guest_orders WHERE order_number=$1`,
      [order_number]
    );
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }
    const o = orderRes.rows[0];
    const deliveryAddress = [o.delivery_address, o.delivery_city].filter(Boolean).join(', ');

    // Fetch driver details
    const driverRes = await client.query(
      `SELECT name, phone FROM staff_members WHERE id=$1`,
      [driver_id]
    );
    const dName = driverRes.rows[0]?.name || driver_name || 'Driver';

    const result = await client.query(
      `INSERT INTO delivery_assignments
         (order_id, order_number, driver_id, driver_name, status,
          delivery_address, customer_name, customer_phone, tip_amount)
       VALUES ($1,$2,$3,$4,'assigned',$5,$6,$7,$8)
       RETURNING id`,
      [o.id, order_number, driver_id, dName, deliveryAddress, o.customer_name, o.customer_phone, o.tip || 0]
    );
    await client.query('COMMIT');

    const assignment_id = result.rows[0].id;

    // Notify all other drivers this order is gone
    const io = req.app.get('io');
    if (io) {
      io.to('drivers_online').emit('order_claimed', { order_number, driver_id: parseInt(driver_id) });
      io.to('admins').emit('assignment_created', { order_number, driver_id: parseInt(driver_id), driver_name: dName });
    }

    res.json({ claimed: true, yours: true, assignment_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json(safeError(err));
  } finally {
    client.release();
  }
};

// ── Driver/Admin: update assignment status ──────────────────────────
const updateAssignmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const allowed = ['assigned', 'en_route', 'picked_up', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  try {
    const extra = status === 'delivered' ? `, delivered_at=NOW()` : '';
    const noteSet = note ? `, delivery_note=$2` : '';
    const params = note ? [status, note, id] : [status, id];
    const idPos  = note ? '$3' : '$2';
    await pool.query(
      `UPDATE delivery_assignments SET status=$1${extra}${noteSet}, assigned_at=assigned_at WHERE id=${idPos}`,
      params
    );

    // When driver picks up → mirror to guest_orders as out_for_delivery
    if (status === 'picked_up') {
      const asgn = await pool.query(
        `SELECT order_number FROM delivery_assignments WHERE id=$1`, [id]
      );
      if (asgn.rows[0]?.order_number) {
        await pool.query(
          `UPDATE guest_orders SET order_status='out_for_delivery' WHERE order_number=$1`,
          [asgn.rows[0].order_number]
        );
        const io = req.app.get('io');
        if (io) {
          io.to(`order_${asgn.rows[0].order_number}`).emit('order_status_updated', {
            order_number: asgn.rows[0].order_number,
            status: 'out_for_delivery',
          });
          io.to('admins').emit('order_status_updated', {
            order_number: asgn.rows[0].order_number,
            status: 'out_for_delivery',
          });
        }
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('assignment_status_update', { id: parseInt(id), status });

    // Notify customer when driver starts moving
    if (status === 'en_route' || status === 'picked_up') {
      const row = await pool.query(
        `SELECT customer_phone, order_number FROM delivery_assignments WHERE id=$1`,
        [id]
      );
      if (row.rows.length && row.rows[0].customer_phone) {
        const base     = process.env.FRONTEND_URL || 'https://habibihe.com';
        const trackUrl = `${base}/order-tracking?order=${row.rows[0].order_number}`;
        sendSMS(
          row.rows[0].customer_phone,
          `Your Habibi driver has picked up your order and is on the way! Track live: ${trackUrl}`
        ).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: upload proof of delivery photo ──────────────────────────
const uploadProof = async (req, res) => {
  const { assignment_id } = req.params;
  const { driver_id, note } = req.body;

  if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

  try {
    const photoUrl = `/uploads/proofs/${req.file.filename}`;
    await pool.query(
      `UPDATE delivery_assignments
         SET proof_photo_url=$1, proof_note=$2
       WHERE id=$3`,
      [photoUrl, note || null, assignment_id]
    );
    res.json({ success: true, proof_photo_url: photoUrl });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: toggle on_duty status ───────────────────────────────────
const setDriverDuty = async (req, res) => {
  const { driver_id } = req.params;
  const { on_duty } = req.body;
  if (typeof on_duty !== 'boolean') return res.status(400).json({ message: 'on_duty must be boolean' });
  try {
    await pool.query(
      `UPDATE staff_members SET is_on_duty=$1 WHERE id=$2 AND role='delivery'`,
      [on_duty, driver_id]
    );
    const io = req.app.get('io');
    if (io) io.to('admins').emit('driver_duty_change', { driver_id: parseInt(driver_id), on_duty });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: list available delivery drivers ──────────────────────────
const getDeliveryDrivers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sm.id, sm.name, sm.phone, sm.is_on_duty,
              COUNT(da.id) FILTER (WHERE da.status IN ('assigned','en_route')) AS active_assignments
       FROM staff_members sm
       LEFT JOIN delivery_assignments da ON da.driver_id = sm.id
       WHERE sm.role='delivery' AND sm.is_active=TRUE
       GROUP BY sm.id, sm.name, sm.phone, sm.is_on_duty
       ORDER BY sm.is_on_duty DESC NULLS LAST, sm.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Public: get active assignment for an order (customer tracking) ──
const getAssignmentForOrder = async (req, res) => {
  const { order_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT da.id, da.status, da.current_lat, da.current_lng,
              da.last_location_update, da.assigned_at, da.delivered_at,
              da.driver_name, da.proof_photo_url,
              sm.phone AS driver_phone,
              sm.name  AS driver_full_name
       FROM delivery_assignments da
       LEFT JOIN staff_members sm ON sm.id = da.driver_id
       WHERE da.order_number=$1 AND da.status IN ('assigned','en_route','delivered')
       ORDER BY da.assigned_at DESC LIMIT 1`,
      [order_number]
    );
    const row = result.rows[0];
    if (!row) { res.json(null); return; }
    // Public, unauthenticated route (customer tracking page needs it with no login) —
    // redact the driver's phone the same way /api/orders/track/:orderNumber does.
    // Anyone who knows/guesses an order number could otherwise pull a driver's real
    // number and live GPS off this endpoint with zero auth.
    const rawPhone = row.driver_phone || '';
    res.json({
      ...row,
      driver_name:  row.driver_full_name || row.driver_name || null,
      driver_phone: rawPhone.length > 4 ? `***-***-${rawPhone.slice(-4)}` : null,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Calculate delivery fee via Google Maps Distance Matrix ──────────
const calculateDeliveryFee = async (req, res) => {
  const { customer_address, location_id } = req.body;
  if (!customer_address) return res.status(400).json({ message: 'customer_address required' });

  try {
    let origin = process.env.RESTAURANT_ADDRESS || '204 E Mosholu Pkwy S, Bronx, NY 10458';
    if (location_id) {
      const locResult = await pool.query(
        `SELECT address FROM locations WHERE id=$1`, [location_id]
      );
      if (locResult.rows.length && locResult.rows[0].address) {
        origin = locResult.rows[0].address;
      }
    }

    const dist = await getDistance(origin, customer_address);
    if (!dist) return res.json({ fee: null, message: 'Could not calculate distance' });

    const fee = await getFeeForDistance(dist.miles, location_id || null);
    res.json({
      distance_miles: dist.miles,
      distance_text:  dist.text,
      duration:       dist.duration,
      fee,
      out_of_range: fee === null,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: daily COD cash report ────────────────────────────────────
const getCashReport = async (req, res) => {
  // date param: YYYY-MM-DD, defaults to today (server TZ)
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    // Individual COD deliveries collected on that date
    const deliveries = await pool.query(
      `SELECT da.id, da.order_number, da.driver_id, da.driver_name,
              da.status, da.cash_collected_at, da.cash_collected_by,
              da.delivered_at, go.total AS order_total, go.payment_method
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE go.payment_method = 'cash'
         AND DATE(da.assigned_at AT TIME ZONE 'America/New_York') = $1
       ORDER BY da.assigned_at ASC`,
      [date]
    );

    // Hand-ins recorded on that date
    const handins = await pool.query(
      `SELECT * FROM driver_cash_handins
       WHERE DATE(created_at AT TIME ZONE 'America/New_York') = $1
       ORDER BY created_at ASC`,
      [date]
    );

    // Roll up per-driver
    const byDriver = {};
    for (const row of deliveries.rows) {
      const key = row.driver_id || row.driver_name || 'Unknown';
      if (!byDriver[key]) {
        byDriver[key] = {
          driver_id:       row.driver_id,
          driver_name:     row.driver_name || 'Unknown',
          orders:          [],
          total_collected: 0,
          confirmed_count: 0,
          total_handed_in: 0,
          handins:         [],
        };
      }
      const amt = parseFloat(row.order_total || 0);
      byDriver[key].orders.push(row);
      if (row.cash_collected_at) {
        byDriver[key].total_collected += amt;
        byDriver[key].confirmed_count += 1;
      }
    }

    for (const h of handins.rows) {
      const key = h.driver_id || h.driver_name || 'Unknown';
      if (byDriver[key]) {
        byDriver[key].total_handed_in += parseFloat(h.amount || 0);
        byDriver[key].handins.push(h);
      }
    }

    for (const d of Object.values(byDriver)) {
      d.outstanding = Math.max(0, d.total_collected - d.total_handed_in);
    }

    res.json({
      date,
      drivers:   Object.values(byDriver),
      deliveries: deliveries.rows,
      handins:   handins.rows,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: record cash hand-in from driver ──────────────────────────
const recordCashHandin = async (req, res) => {
  const { driver_id, driver_name, amount, order_count, notes } = req.body;
  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ message: 'amount is required' });
  }
  // Use the logged-in admin's identity — never trust the client for this
  const confirmedBy = req.user?.name || req.user?.email || 'Manager';
  try {
    const result = await pool.query(
      `INSERT INTO driver_cash_handins
         (driver_id, driver_name, amount, order_count, confirmed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [driver_id || null, driver_name || null, parseFloat(amount),
       order_count || 0, confirmedBy, notes || null]
    );
    const io = req.app.get('io');
    if (io) io.to('admins').emit('cash_handed_in', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: get my cash summary for today ───────────────────────────
const getDriverCashSummary = async (req, res) => {
  const { driver_id } = req.params;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE da.status = 'delivered')                                       AS deliveries_count,
         COALESCE(SUM(da.tip_amount) FILTER (WHERE da.status = 'delivered'), 0)                AS total_tips,
         COALESCE(SUM(go.total)
           FILTER (WHERE da.status = 'delivered'
                     AND go.payment_method = 'cash'
                     AND da.cash_collected_at IS NOT NULL), 0)                                  AS total_cod,
         COUNT(*) FILTER (WHERE da.status = 'delivered'
                            AND go.payment_method = 'cash'
                            AND da.cash_collected_at IS NOT NULL)                               AS cod_orders_count
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.driver_id = $1
         AND DATE(da.assigned_at AT TIME ZONE 'America/New_York') = $2`,
      [driver_id, today]
    );
    const row = result.rows[0] || {};
    res.json({
      date:             today,
      deliveries_count: parseInt(row.deliveries_count || 0),
      total_tips:       parseFloat(row.total_tips || 0),
      total_cod:        parseFloat(row.total_cod || 0),
      cod_orders_count: parseInt(row.cod_orders_count || 0),
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: today's delivery history ────────────────────────────────
const getDriverHistory = async (req, res) => {
  const { driver_id } = req.params;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    const result = await pool.query(
      `SELECT da.id, da.order_number, da.tip_amount, da.delivery_address,
              da.customer_name, da.assigned_at, da.delivered_at,
              go.total AS order_total, go.payment_method
         FROM delivery_assignments da
         LEFT JOIN guest_orders go ON go.order_number = da.order_number
        WHERE da.driver_id = $1
          AND da.status = 'delivered'
          AND DATE(da.assigned_at AT TIME ZONE 'America/New_York') = $2
        ORDER BY da.delivered_at DESC
        LIMIT 50`,
      [driver_id, today]
    );
    res.json(result.rows.map(r => ({
      id:             r.id,
      order_number:   r.order_number,
      tip_amount:     parseFloat(r.tip_amount || 0),
      delivery_address: r.delivery_address,
      customer_name:  r.customer_name,
      order_total:    parseFloat(r.order_total || 0),
      payment_method: r.payment_method,
      delivered_at:   r.delivered_at,
      assigned_at:    r.assigned_at,
    })));
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: confirm cash collected for COD order ────────────────────
const collectCash = async (req, res) => {
  const { id } = req.params;
  const { driver_id, driver_name } = req.body;
  try {
    const asgn = await pool.query(
      `SELECT da.*, go.payment_method, go.total AS order_total
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.id = $1 AND da.driver_id = $2`,
      [id, driver_id]
    );
    if (!asgn.rows.length) return res.status(404).json({ message: 'Assignment not found or not yours' });
    const assignment = asgn.rows[0];
    if (assignment.payment_method !== 'cash') {
      return res.status(400).json({ message: 'Not a COD order' });
    }
    if (assignment.cash_collected_at) {
      return res.status(409).json({ message: 'Cash already recorded for this order', amount_collected: assignment.order_total });
    }

    const collectedBy = driver_name || assignment.driver_name || `Driver #${driver_id}`;

    const updated = await pool.query(
      `UPDATE delivery_assignments
         SET status='delivered', delivered_at=NOW(),
             cash_collected_at=NOW(), cash_collected_by=$1
       WHERE id=$2 AND cash_collected_at IS NULL
       RETURNING id`,
      [collectedBy, id]
    );
    if (!updated.rows.length) {
      return res.status(409).json({ message: 'Cash already recorded for this order', amount_collected: assignment.order_total });
    }

    if (assignment.order_number) {
      await pool.query(
        `UPDATE guest_orders
           SET order_status='delivered', payment_status='paid', updated_at=NOW()
         WHERE order_number=$1`,
        [assignment.order_number]
      );
    }

    const io = req.app.get('io');
    if (io) io.to('admins').emit('cash_collected', {
      assignment_id: parseInt(id),
      order_number:  assignment.order_number,
      amount:        assignment.order_total,
      driver:        collectedBy,
    });

    res.json({ success: true, amount_collected: assignment.order_total });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: record failed COD delivery (customer not home) ──────────
const codDeliveryFailed = async (req, res) => {
  const { id } = req.params;
  const { driver_id } = req.body;
  try {
    const asgn = await pool.query(
      `SELECT da.*, go.payment_method, go.total AS order_total
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.id = $1 AND da.driver_id = $2`,
      [id, driver_id]
    );
    if (!asgn.rows.length) return res.status(404).json({ message: 'Assignment not found or not yours' });
    const assignment = asgn.rows[0];
    if (assignment.payment_method !== 'cash') {
      return res.status(400).json({ message: 'Not a COD order' });
    }

    await pool.query(
      `UPDATE delivery_assignments
         SET status='cancelled',
             delivery_note='COD failed — customer not home, order returned to store'
       WHERE id=$1`,
      [id]
    );

    const io = req.app.get('io');
    if (io) io.to('admins').emit('cod_delivery_failed', {
      assignment_id: parseInt(id),
      order_number:  assignment.order_number,
      amount:        assignment.order_total,
      driver_id:     assignment.driver_id,
      driver_name:   assignment.driver_name,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

/* ── Driver PIN authentication ──────────────────────────────────── */
const bcrypt = require('bcrypt');

const driverLogin = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ message: 'Phone and PIN are required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });

    const cleaned = String(phone).replace(/\D/g, '');
    const result = await pool.query(
      `SELECT id, name, phone, is_active, driver_pin_hash, driver_pin_attempts, driver_pin_lockout_until
       FROM staff_members WHERE (phone=$1 OR phone=$2) AND role='delivery' AND is_active=TRUE`,
      [cleaned, `+1${cleaned.slice(-10)}`]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'No active driver account found for this number.' });
    }
    const driver = result.rows[0];

    if (!driver.driver_pin_hash) {
      return res.status(403).json({ message: 'PIN not set up yet. Ask your admin to send you a setup link.', needsSetup: true });
    }

    if (driver.driver_pin_lockout_until && new Date(driver.driver_pin_lockout_until) > new Date()) {
      const mins = Math.ceil((new Date(driver.driver_pin_lockout_until) - Date.now()) / 60000);
      return res.status(429).json({ message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
    }

    const valid = await bcrypt.compare(String(pin), driver.driver_pin_hash);
    if (!valid) {
      const attempts = (driver.driver_pin_attempts || 0) + 1;
      const lockout  = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        'UPDATE staff_members SET driver_pin_attempts=$1, driver_pin_lockout_until=$2 WHERE id=$3',
        [attempts, lockout, driver.id]
      );
      const remaining = Math.max(0, 5 - attempts);
      return res.status(401).json({ message: `Incorrect PIN.${remaining > 0 ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : ' Account locked for 15 minutes.'}` });
    }

    await pool.query('UPDATE staff_members SET driver_pin_attempts=0, driver_pin_lockout_until=NULL WHERE id=$1', [driver.id]);
    const token = driverToken(driver.id);
    res.json({ driver_id: driver.id, token, name: driver.name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const driverSetPin = async (req, res) => {
  try {
    const { driver_id, pin, confirm_pin } = req.body;
    if (!driver_id || !pin) return res.status(400).json({ message: 'Driver ID and PIN are required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    if (pin !== confirm_pin) return res.status(400).json({ message: 'PINs do not match.' });

    const hash = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      'UPDATE staff_members SET driver_pin_hash=$1, driver_pin_attempts=0, driver_pin_lockout_until=NULL WHERE id=$2 AND role=\'delivery\' AND is_active=TRUE RETURNING id, name',
      [hash, driver_id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Driver not found.' });
    res.json({ ok: true, name: result.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const adminResetDriverPin = async (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    const hash = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      `UPDATE staff_members SET driver_pin_hash=$1, driver_pin_attempts=0, driver_pin_lockout_until=NULL
       WHERE id=$2 AND role='delivery' RETURNING id, name`,
      [hash, id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Driver not found.' });
    res.json({ ok: true, name: result.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const driverSendSetupSms = async (req, res) => {
  try {
    const { driver_id } = req.body;
    const result = await pool.query(
      'SELECT id, name, phone FROM staff_members WHERE id=$1 AND role=\'delivery\' AND is_active=TRUE',
      [driver_id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Driver not found.' });
    const driver = result.rows[0];
    if (!driver.phone) return res.status(400).json({ message: 'Driver has no phone number on file.' });

    const token = driverToken(driver.id);
    const base  = process.env.FRONTEND_URL || 'https://habibihe.com';
    const url   = `${base}/driver/set-pin?id=${driver.id}&token=${token}`;
    await sendSMS(driver.phone, `Hi ${driver.name}! Set up your Habibi driver PIN to log in anytime: ${url}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver ↔ Dispatch Chat ──────────────────────────────────────────

// GET history for a single driver (driver or admin)
const getDriverChat = async (req, res) => {
  const { driver_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, driver_id, driver_name, message, direction, sent_by, read_at, sent_at
       FROM driver_messages WHERE driver_id=$1 ORDER BY sent_at ASC LIMIT 200`,
      [driver_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// POST — driver sends a message to dispatch
const sendDriverChat = async (req, res) => {
  const { driver_id } = req.params;
  const { message, driver_name } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message required' });
  try {
    const result = await pool.query(
      `INSERT INTO driver_messages (driver_id, driver_name, message, direction)
       VALUES ($1, $2, $3, 'inbound') RETURNING *`,
      [driver_id, driver_name || 'Driver', message.trim()]
    );
    const row = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to('admins').emit('driver_chat_message', row);
    res.json(row);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// POST — admin/dispatch replies to driver
const sendDispatchChat = async (req, res) => {
  const { driver_id } = req.params;
  const { message } = req.body;
  const sentBy = req.user?.name || req.user?.email || 'Dispatch';
  if (!message?.trim()) return res.status(400).json({ message: 'Message required' });
  try {
    const result = await pool.query(
      `INSERT INTO driver_messages (driver_id, message, direction, sent_by)
       VALUES ($1, $2, 'outbound', $3) RETURNING *`,
      [driver_id, message.trim(), sentBy]
    );
    const row = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to(`driver_${driver_id}`).emit('dispatch_chat_reply', row);
    res.json(row);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// GET — admin gets all driver thread summaries with unread counts
const getChatThreads = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        dm.driver_id,
        MAX(dm.driver_name) AS driver_name,
        COUNT(*) FILTER (WHERE dm.direction='inbound' AND dm.read_at IS NULL) AS unread_count,
        MAX(dm.sent_at) AS last_sent,
        (SELECT message   FROM driver_messages WHERE driver_id=dm.driver_id ORDER BY sent_at DESC LIMIT 1) AS last_message,
        (SELECT direction FROM driver_messages WHERE driver_id=dm.driver_id ORDER BY sent_at DESC LIMIT 1) AS last_direction
      FROM driver_messages dm
      GROUP BY dm.driver_id
      ORDER BY last_sent DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// PATCH — mark all inbound messages for a driver as read
const markChatRead = async (req, res) => {
  const { driver_id } = req.params;
  try {
    await pool.query(
      `UPDATE driver_messages SET read_at=NOW() WHERE driver_id=$1 AND direction='inbound' AND read_at IS NULL`,
      [driver_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json(safeError(err)); }
};

// ── Driver: own stats (7-day + 30-day + streak) ─────────────────────
const getDriverStats = async (req, res) => {
  const { driver_id } = req.params;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    const [week, month, streakRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE da.status = 'delivered')                             AS deliveries,
          COUNT(*) FILTER (WHERE da.status IN ('delivered','cancelled'))               AS total_dispatched,
          COALESCE(SUM(da.tip_amount) FILTER (WHERE da.status = 'delivered'), 0)      AS total_tips,
          ROUND(EXTRACT(EPOCH FROM
            AVG(da.delivered_at - COALESCE(da.accepted_at, da.assigned_at))
          ) / 60)                                                                      AS avg_mins
        FROM delivery_assignments da
        WHERE da.driver_id = $1
          AND da.assigned_at >= NOW() - INTERVAL '7 days'`,
        [driver_id]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE da.status = 'delivered')                             AS deliveries,
          COALESCE(SUM(da.tip_amount) FILTER (WHERE da.status = 'delivered'), 0)      AS total_tips,
          ROUND(EXTRACT(EPOCH FROM
            AVG(da.delivered_at - COALESCE(da.accepted_at, da.assigned_at))
          ) / 60)                                                                      AS avg_mins
        FROM delivery_assignments da
        WHERE da.driver_id = $1
          AND da.assigned_at >= NOW() - INTERVAL '30 days'`,
        [driver_id]),
      pool.query(`
        SELECT DATE(da.assigned_at AT TIME ZONE 'America/New_York') AS day
        FROM delivery_assignments da
        WHERE da.driver_id = $1
          AND da.status = 'delivered'
          AND da.assigned_at >= NOW() - INTERVAL '60 days'
        GROUP BY day
        ORDER BY day DESC`,
        [driver_id]),
    ]);

    // Count consecutive days ending today
    let streak = 0;
    const days = streakRes.rows.map(r => {
      const d = new Date(r.day);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    });
    let checkDay = today;
    for (const day of days) {
      if (day === checkDay) {
        streak++;
        const d = new Date(checkDay + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        checkDay = d.toISOString().slice(0, 10);
      } else break;
    }

    const w = week.rows[0] || {};
    const m = month.rows[0] || {};
    const acceptRate = parseInt(w.total_dispatched || 0) > 0
      ? Math.round(100 * parseInt(w.deliveries || 0) / parseInt(w.total_dispatched))
      : 100;

    res.json({
      week: {
        deliveries:      parseInt(w.deliveries || 0),
        tips:            parseFloat(w.total_tips || 0),
        avg_mins:        parseFloat(w.avg_mins || 0) || null,
        acceptance_rate: acceptRate,
      },
      month: {
        deliveries: parseInt(m.deliveries || 0),
        tips:       parseFloat(m.total_tips || 0),
        avg_mins:   parseFloat(m.avg_mins || 0) || null,
      },
      streak,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: per-driver performance stats ─────────────────────────────
const getDriverPerformance = async (req, res) => {
  // Optional ?days=7|30|90|all (default 30)
  const days = parseInt(req.query.days) || 30;
  const since = days === 0
    ? `'1970-01-01'::timestamptz`
    : `NOW() - INTERVAL '${days} days'`;

  try {
    const result = await pool.query(`
      SELECT
        sm.id,
        sm.name,
        sm.is_on_duty,
        COUNT(da.id) FILTER (WHERE da.status = 'delivered')
          AS deliveries,
        COUNT(da.id) FILTER (WHERE da.status = 'cancelled' AND da.rejected_at IS NOT NULL)
          AS rejections,
        COUNT(da.id) FILTER (WHERE da.status IN ('delivered','cancelled'))
          AS total_dispatched,
        ROUND(
          100.0 * COUNT(da.id) FILTER (WHERE da.status = 'delivered') /
          NULLIF(COUNT(da.id) FILTER (WHERE da.status IN ('delivered','cancelled')), 0),
          1
        ) AS acceptance_rate,
        COALESCE(
          SUM(da.tip_amount) FILTER (WHERE da.status = 'delivered'),
          0
        ) AS total_tips,
        ROUND(
          EXTRACT(EPOCH FROM
            AVG(da.delivered_at - COALESCE(da.accepted_at, da.assigned_at))
          ) / 60
        ) AS avg_delivery_mins
      FROM staff_members sm
      LEFT JOIN delivery_assignments da
        ON da.driver_id = sm.id
        AND da.assigned_at >= ${since}
      WHERE sm.role = 'delivery'
      GROUP BY sm.id, sm.name, sm.is_on_duty
      ORDER BY deliveries DESC NULLS LAST, sm.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver: save FCM push token for background notifications ────────
const saveDriverFcmToken = async (req, res) => {
  const { driver_id, fcm_token } = req.body;
  if (!driver_id || !fcm_token) return res.status(400).json({ message: 'driver_id and fcm_token required' });

  // Verify HMAC token matches this driver
  const provided = req.headers['x-driver-token'] || '';
  const expected = driverToken(driver_id);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      return res.status(403).json({ message: 'Invalid driver token' });
    }
  } catch (_) {
    return res.status(403).json({ message: 'Invalid driver token' });
  }

  try {
    await pool.query(
      `UPDATE staff_members SET driver_fcm_token=$1 WHERE id=$2`,
      [fcm_token, driver_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  getAssignments,
  assignDriver,
  broadcastOrderToDrivers,
  claimOrder,
  respondToAssignment,
  getDriverAssignment,
  getAssignmentForOrder,
  updateDriverGPS,
  updateAssignmentStatus,
  uploadProof,
  setDriverDuty,
  getDeliveryDrivers,
  calculateDeliveryFee,
  collectCash,
  codDeliveryFailed,
  getCashReport,
  recordCashHandin,
  getDriverCashSummary,
  getDriverHistory,
  getDriverStats,
  driverLogin,
  driverSetPin,
  adminResetDriverPin,
  driverSendSetupSms,
  saveDriverFcmToken,
  getDriverChat,
  sendDriverChat,
  sendDispatchChat,
  getChatThreads,
  markChatRead,
  getDriverPerformance,
};
