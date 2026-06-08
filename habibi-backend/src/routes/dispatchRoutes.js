const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const protect   = require('../middleware/authMiddleware');
const admin     = require('../middleware/adminMiddleware');

const isDev = process.env.NODE_ENV !== 'production';
const gpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 60,
  message: { error: 'GPS update rate exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const {
  getAssignments,
  assignDriver,
  getDriverAssignment,
  getAssignmentForOrder,
  updateDriverGPS,
  updateAssignmentStatus,
  getDeliveryDrivers,
  calculateDeliveryFee,
} = require('../controllers/dispatchController');

// Driver-facing routes — require either admin JWT or a valid driver_secret token
// Driver secret: sha256(DRIVER_SECRET_SALT + driver_id), passed as X-Driver-Token header
function driverOrAdmin(req, res, next) {
  // Allow if valid admin JWT
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'driver') {
        req.user = decoded;
        return next();
      }
    } catch (_) {}
  }
  // Allow if valid driver token: HMAC(DRIVER_SECRET_SALT, driver_id)
  const driverToken = req.headers['x-driver-token'] || '';
  const driverId    = req.params.driver_id || req.body?.driver_id || '';
  const salt        = process.env.DRIVER_SECRET_SALT;
  if (salt && driverId && driverToken) {
    const crypto   = require('crypto');
    const expected = crypto.createHmac('sha256', salt).update(String(driverId)).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(driverToken), Buffer.from(expected))) {
      return next();
    }
  }
  return res.status(401).json({ message: 'Driver authentication required' });
}

router.get('/driver/:driver_id',                    driverOrAdmin, getDriverAssignment);
router.patch('/assignments/:assignment_id/gps',     gpsLimiter, driverOrAdmin, updateDriverGPS);
router.patch('/assignments/:assignment_id/status',  driverOrAdmin, updateAssignmentStatus);

// Public — checkout fee calculation
router.post('/calculate-fee', calculateDeliveryFee);

// Public — customer order tracking page
router.get('/order/:order_number', getAssignmentForOrder);

// Admin-protected
router.use(protect, admin);
router.get('/assignments',   getAssignments);
router.get('/drivers',       getDeliveryDrivers);
router.post('/assign',       assignDriver);

// Scheduled orders waiting for dispatch
router.get('/scheduled', async (req, res) => {
  const pool = require('../config/db');
  try {
    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone,
              delivery_address, delivery_city, delivery_state, delivery_zip,
              total, expected_time, placed_at
         FROM guest_orders
        WHERE delivery_method = 'delivery'
          AND dispatch_fired  = FALSE
          AND expected_time  IS NOT NULL
          AND expected_time  != ''
          AND expected_time  != 'ASAP'
        ORDER BY placed_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message });
  }
});

module.exports = router;

