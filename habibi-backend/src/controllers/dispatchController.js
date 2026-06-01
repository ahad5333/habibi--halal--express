const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { getDistance, feeFromMiles } = require('../utils/googleMaps');

// ── Admin: list active delivery assignments ─────────────────────────
const getAssignments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT da.*,
             sm.name  AS driver_full_name,
             sm.phone AS driver_phone_number
      FROM delivery_assignments da
      LEFT JOIN staff_members sm ON sm.id = da.driver_id
      ORDER BY da.assigned_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: assign an order to a driver ─────────────────────────────
const assignDriver = async (req, res) => {
  const { order_id, order_number, driver_id, delivery_address, customer_name, customer_phone } = req.body;
  try {
    const driverResult = await pool.query(
      `SELECT id, name FROM staff_members WHERE id=$1 AND role='delivery' AND is_active=TRUE`,
      [driver_id]
    );
    if (!driverResult.rows.length) return res.status(400).json({ message: 'Driver not found or unavailable' });
    const driver = driverResult.rows[0];

    const result = await pool.query(
      `INSERT INTO delivery_assignments
         (order_id, order_number, driver_id, driver_name, status, delivery_address, customer_name, customer_phone)
       VALUES ($1,$2,$3,$4,'assigned',$5,$6,$7)
       RETURNING *`,
      [order_id, order_number, driver_id, driver.name, delivery_address, customer_name, customer_phone]
    );

    const io = req.app.get('io');
    if (io) io.emit('assignment_created', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Driver: get my current assignment ──────────────────────────────
const getDriverAssignment = async (req, res) => {
  const { driver_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM delivery_assignments
       WHERE driver_id=$1 AND status IN ('assigned','en_route')
       ORDER BY assigned_at DESC
       LIMIT 1`,
      [driver_id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Driver: update GPS location ─────────────────────────────────────
const updateDriverGPS = async (req, res) => {
  const { assignment_id } = req.params;
  const { lat, lng, driver_id } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });

  try {
    await pool.query(
      `UPDATE delivery_assignments
         SET current_lat=$1, current_lng=$2, last_location_update=NOW(), status='en_route'
       WHERE id=$3`,
      [lat, lng, assignment_id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('driver_location_update', {
        assignment_id: parseInt(assignment_id),
        driver_id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Driver/Admin: update assignment status ──────────────────────────
const updateAssignmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['assigned', 'en_route', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  try {
    const extra = status === 'delivered' ? `, delivered_at=NOW()` : '';
    await pool.query(
      `UPDATE delivery_assignments SET status=$1${extra}, assigned_at=assigned_at WHERE id=$2`,
      [status, id]
    );
    const io = req.app.get('io');
    if (io) io.emit('assignment_status_update', { id: parseInt(id), status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: list available delivery drivers ──────────────────────────
const getDeliveryDrivers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sm.id, sm.name, sm.phone,
              COUNT(da.id) FILTER (WHERE da.status IN ('assigned','en_route')) AS active_assignments
       FROM staff_members sm
       LEFT JOIN delivery_assignments da ON da.driver_id = sm.id
       WHERE sm.role='delivery' AND sm.is_active=TRUE
       GROUP BY sm.id, sm.name, sm.phone
       ORDER BY sm.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Public: get active assignment for an order (used by customer tracking page) ──
const getAssignmentForOrder = async (req, res) => {
  const { order_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT da.id, da.status, da.current_lat, da.current_lng,
              da.last_location_update, da.assigned_at, da.delivered_at,
              da.driver_name, sm.phone AS driver_phone,
              sm.name AS driver_full_name
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
    res.status(500).json({ message: err.message });
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
    if (!dist) {
      return res.json({ fee: null, message: 'Could not calculate distance' });
    }

    const fee = feeFromMiles(dist.miles);
    res.json({
      distance_miles: dist.miles,
      distance_text:  dist.text,
      duration:       dist.duration,
      fee,
      out_of_range:   fee === null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAssignments,
  assignDriver,
  getDriverAssignment,
  getAssignmentForOrder,
  updateDriverGPS,
  updateAssignmentStatus,
  getDeliveryDrivers,
  calculateDeliveryFee,
};
