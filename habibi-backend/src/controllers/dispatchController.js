const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const safeError = require('../utils/safeError');
const pool      = require('../config/db');
const { getDistance } = require('../utils/googleMaps');
const { getFeeForDistance } = require('../utils/deliveryFee');
const { sendSMS } = require('../services/smsService');

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
      `SELECT da.*, go.payment_method, go.total AS order_total
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.driver_id=$1 AND da.status IN ('assigned','en_route')
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      [driver_id]
    );
    res.json(result.rows[0] || null);
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
      // Fetch order_number so we can emit only to the tracking room for that order
      const asgn = await pool.query(
        `SELECT order_number FROM delivery_assignments WHERE id=$1`,
        [assignment_id]
      );
      const orderNumber = asgn.rows[0]?.order_number;
      const payload = {
        assignment_id: parseInt(assignment_id),
        driver_id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: new Date().toISOString(),
      };
      if (orderNumber) {
        io.to(`order_${orderNumber}`).emit('driver_location_update', payload);
      }
      io.to('admins').emit('driver_location_update', payload);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Driver/Admin: update assignment status ──────────────────────────
const updateAssignmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const allowed = ['assigned', 'en_route', 'delivered', 'cancelled'];
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

    const io = req.app.get('io');
    if (io) io.emit('assignment_status_update', { id: parseInt(id), status });

    // Notify customer when driver starts moving
    if (status === 'en_route') {
      const row = await pool.query(
        `SELECT customer_phone, order_number FROM delivery_assignments WHERE id=$1`,
        [id]
      );
      if (row.rows.length && row.rows[0].customer_phone) {
        const base     = process.env.FRONTEND_URL || 'https://habibihe.com';
        const trackUrl = `${base}/order-tracking?order=${row.rows[0].order_number}`;
        sendSMS(
          row.rows[0].customer_phone,
          `Your Habibi driver is on the way! Track live: ${trackUrl}`
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
    res.json({
      ...row,
      driver_name:  row.driver_full_name || row.driver_name || null,
      driver_phone: row.driver_phone || null,
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
       WHERE go.payment_method = 'cod'
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
  const { driver_id, driver_name, amount, order_count, confirmed_by, notes } = req.body;
  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ message: 'amount is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO driver_cash_handins
         (driver_id, driver_name, amount, order_count, confirmed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [driver_id || null, driver_name || null, parseFloat(amount),
       order_count || 0, confirmed_by || null, notes || null]
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
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await pool.query(
      `SELECT da.id, da.order_number, da.cash_collected_at, go.total AS order_total
       FROM delivery_assignments da
       LEFT JOIN guest_orders go ON go.order_number = da.order_number
       WHERE da.driver_id = $1
         AND go.payment_method = 'cod'
         AND DATE(da.assigned_at AT TIME ZONE 'America/New_York') = $2
         AND da.cash_collected_at IS NOT NULL`,
      [driver_id, today]
    );
    const total = result.rows.reduce((s, r) => s + parseFloat(r.order_total || 0), 0);
    res.json({ orders: result.rows, total_collected: total, date: today });
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
       WHERE da.id = $1`,
      [id]
    );
    if (!asgn.rows.length) return res.status(404).json({ message: 'Assignment not found' });
    const assignment = asgn.rows[0];
    if (assignment.payment_method !== 'cod') {
      return res.status(400).json({ message: 'Not a COD order' });
    }

    const collectedBy = driver_name || assignment.driver_name || `Driver #${driver_id}`;

    await pool.query(
      `UPDATE delivery_assignments
         SET status='delivered', delivered_at=NOW(),
             cash_collected_at=NOW(), cash_collected_by=$1
       WHERE id=$2`,
      [collectedBy, id]
    );

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

module.exports = {
  getAssignments,
  assignDriver,
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
  getCashReport,
  recordCashHandin,
  getDriverCashSummary,
};
