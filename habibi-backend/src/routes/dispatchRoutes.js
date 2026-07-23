const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const multer    = require('multer');
const path      = require('path');
const crypto    = require('crypto');
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

// Multer for proof-of-delivery photos
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads/proofs');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `proof_${req.params.assignment_id}_${Date.now()}${ext}`);
  },
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const {
  getAssignments,
  assignDriver,
  broadcastOrderToDrivers,
  getAvailableOrders,
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
  bulkImportDrivers,
  saveDriverFcmToken,
  getDriverChat,
  sendDriverChat,
  sendDispatchChat,
  getChatThreads,
  markChatRead,
  getDriverPerformance,
} = require('../controllers/dispatchController');

// ── Driver auth middleware ──────────────────────────────────────────
// Accepts admin/driver JWT (Bearer) OR HMAC token in X-Driver-Token header.
function driverOrAdmin(req, res, next) {
  // 1. JWT Bearer token
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const jwt     = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'driver' || decoded.role === 'delivery') {
        req.user = decoded;
        return next();
      }
    } catch (_) {}
  }

  // 2. HMAC token from X-Driver-Token header
  const driverToken = req.headers['x-driver-token'] || '';
  const driverId    = req.params.driver_id || req.params.assignment_id
                      ? (req.params.driver_id || req.body?.driver_id || '')
                      : (req.body?.driver_id || req.query?.driver_id || '');
  const salt        = process.env.DRIVER_SECRET_SALT || 'habibi-driver-default';
  if (driverId && driverToken) {
    try {
      const expected = crypto.createHmac('sha256', salt).update(String(driverId)).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(driverToken), Buffer.from(expected))) {
        return next();
      }
    } catch (_) {}
  }

  return res.status(401).json({ message: 'Driver authentication required' });
}

// ── Public routes ──────────────────────────────────────────────────
router.post('/calculate-fee',       calculateDeliveryFee);
router.get ('/order/:order_number', getAssignmentForOrder);

// Geocode a delivery address via Nominatim (proxy avoids frontend CSP issues)
router.get('/geocode', async (req, res) => {
  const { addr } = req.query;
  if (!addr) return res.status(400).json({ message: 'addr required' });
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
      { headers: { 'User-Agent': 'HabibiHalalExpress/1.0', 'Accept-Language': 'en' } }
    );
    const data = await r.json();
    if (!data[0]) return res.status(404).json({ message: 'Address not found' });
    res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
  } catch (e) {
    res.status(500).json({ message: 'Geocoding failed' });
  }
});

// ── Driver PIN auth — no token needed ─────────────────────────────
router.post('/driver/login',          driverLogin);
router.post('/driver/set-pin',        driverOrAdmin, driverSetPin);
router.patch('/drivers/:id/reset-pin',  protect, admin, adminResetDriverPin);
router.post('/driver/send-setup-sms',  protect, admin, driverSendSetupSms);
router.post('/drivers/bulk-import',    protect, admin, bulkImportDrivers);
router.post('/driver/fcm-token',      saveDriverFcmToken);

// ── Driver-facing routes (HMAC or JWT) ────────────────────────────
router.get   ('/orders/available',                 driverOrAdmin,              getAvailableOrders);
router.post  ('/assignments/claim',                driverOrAdmin,              claimOrder);
router.get   ('/driver/:driver_id',                driverOrAdmin,              getDriverAssignment);
router.patch ('/assignments/:assignment_id/gps',   gpsLimiter, driverOrAdmin,  updateDriverGPS);
router.patch ('/assignments/:id/status',           driverOrAdmin,              updateAssignmentStatus);
router.patch ('/assignments/:id/respond',          driverOrAdmin,              respondToAssignment);
router.patch ('/assignments/:id/collect-cash',     driverOrAdmin,              collectCash);
router.patch ('/assignments/:id/cod-failed',       driverOrAdmin,              codDeliveryFailed);
router.post  ('/assignments/:assignment_id/proof', proofUpload.single('photo'), driverOrAdmin, uploadProof);
router.patch ('/drivers/:driver_id/duty',          driverOrAdmin,              setDriverDuty);
router.get   ('/drivers/:driver_id/cash-summary',  driverOrAdmin,              getDriverCashSummary);
router.get   ('/drivers/:driver_id/history',       driverOrAdmin,              getDriverHistory);
router.get   ('/drivers/:driver_id/stats',         driverOrAdmin,              getDriverStats);

// ── Driver ↔ Dispatch chat ─────────────────────────────────────────
router.get  ('/driver/:driver_id/chat',       driverOrAdmin,        getDriverChat);
router.post ('/driver/:driver_id/chat',       driverOrAdmin,        sendDriverChat);
router.patch('/driver/:driver_id/chat/read',  protect, admin,       markChatRead);
router.post ('/driver/:driver_id/chat/reply', protect, admin,       sendDispatchChat);
router.get  ('/chat/threads',                 protect, admin,       getChatThreads);

// ── Admin-only routes ──────────────────────────────────────────────
router.get ('/assignments',              protect, admin, getAssignments);
router.get ('/drivers',                  protect, admin, getDeliveryDrivers);
router.post('/assign',                   protect, admin, assignDriver);
router.post('/broadcast/:order_number',  protect, admin, broadcastOrderToDrivers);
router.get ('/cash-report',              protect, admin, getCashReport);
router.post('/cash-handins',             protect, admin, recordCashHandin);
router.get ('/driver-performance',       protect, admin, getDriverPerformance);

// Scheduled orders waiting for dispatch
router.get('/scheduled', protect, admin, async (req, res) => {
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
