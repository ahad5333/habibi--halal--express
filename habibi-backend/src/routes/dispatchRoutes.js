const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const multer    = require('multer');
const crypto    = require('crypto');
const protect   = require('../middleware/authMiddleware');
const admin     = require('../middleware/adminMiddleware');
const { getDriverSecretSalt } = require('../utils/driverSecret');

const isDev = process.env.NODE_ENV !== 'production';
const gpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 60,
  message: { error: 'GPS update rate exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// The two fully public, unauthenticated dispatch routes — /geocode proxies
// to Nominatim with no auth at all, which without a limiter is usable as a
// free amplifying relay against a third party.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 30,
  message: { message: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Multer for proof-of-delivery photos — memory storage, NOT disk. The route
// below has to run multer before the driverOrAdmin auth check (the driver's
// HMAC token is verified against a driver_id field carried in this same
// multipart body, which only multer can parse), so auth can't simply be
// moved ahead of it. Writing straight to a publicly-served disk path here
// would mean an unauthenticated/failed-auth request still plants a file at
// a public URL. Buffering in memory instead means nothing touches disk
// until uploadProof() has verified the caller owns the assignment.
const proofUpload = multer({
  storage: multer.memoryStorage(),
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
  rateDelivery,
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
  deleteCashHandin,
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
// Accepts admin/driver JWT (httpOnly cookie OR Bearer header) OR HMAC token
// in X-Driver-Token header. The cookie check matters: every adminAPI.* call
// from the admin panel (including DeliveryDispatch's "view as driver" link
// into this same set of routes) authenticates via the auth_token cookie,
// never a Bearer header — without it, that link 401'd unconditionally,
// always surfacing "Driver authentication required" no matter how the
// admin was logged in.
// Besides authenticating, this exposes a *trustworthy* identity on the
// request: req.isAdmin (bypasses ownership checks) and req.driverId (the
// actual verified driver — from the JWT subject for JWT auth, or from the
// HMAC-verified id for token auth). Controllers must use these, never a
// raw req.body.driver_id, to scope assignment ownership — a JWT only proves
// "this is some valid driver," it does NOT prove req.body.driver_id is that
// same driver, so trusting the body field there would let any driver claim
// to be any other driver_id and act on their assignments.
function driverOrAdmin(req, res, next) {
  // 1. JWT — httpOnly cookie (admin panel) or Bearer header (driver app)
  const cookieToken = req.cookies?.auth_token;
  const authHeader  = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const jwtToken     = cookieToken || bearerToken;
  if (jwtToken) {
    try {
      const jwt     = require('jsonwebtoken');
      const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'driver' || decoded.role === 'delivery') {
        req.user     = decoded;
        req.isAdmin  = decoded.role === 'admin';
        req.driverId = req.isAdmin ? null : decoded.id;
        return next();
      }
    } catch (_) {}
  }

  // 2. HMAC token from X-Driver-Token header
  const driverToken = req.headers['x-driver-token'] || '';
  const driverId    = req.params.driver_id || req.params.assignment_id
                      ? (req.params.driver_id || req.body?.driver_id || '')
                      : (req.body?.driver_id || req.query?.driver_id || '');
  if (driverId && driverToken) {
    try {
      const salt     = getDriverSecretSalt();
      const expected = crypto.createHmac('sha256', salt).update(String(driverId)).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(driverToken), Buffer.from(expected))) {
        req.isAdmin  = false;
        req.driverId = parseInt(driverId, 10);
        return next();
      }
    } catch (_) {}
  }

  return res.status(401).json({ message: 'Driver authentication required' });
}

// ── Public routes ──────────────────────────────────────────────────
router.post ('/calculate-fee',            publicLimiter, calculateDeliveryFee);
router.get  ('/order/:order_number',      getAssignmentForOrder);
router.patch('/order/:order_number/rate', publicLimiter, rateDelivery);

// Geocode a delivery address via Nominatim (proxy avoids frontend CSP issues)
router.get('/geocode', publicLimiter, async (req, res) => {
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

// Turn-by-turn route via Google Directions (proxy keeps the API key server-side,
// same pattern as calculateDeliveryFee's Distance Matrix use). Public since the
// driver PWA's HMAC/JWT auth doesn't need to gate a read-only routing lookup.
router.get('/directions', publicLimiter, async (req, res) => {
  const { origin, destination } = req.query;
  if (!origin || !destination) return res.status(400).json({ message: 'origin and destination required' });
  try {
    const { getDirections } = require('../utils/googleMaps');
    const result = await getDirections(origin, destination);
    if (!result) return res.status(404).json({ message: 'Could not find a route between these points.' });
    if (result.unavailable) return res.status(503).json({ message: 'Routing service unavailable.' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Directions lookup failed' });
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
router.delete('/cash-handins/:id',       protect, admin, deleteCashHandin);
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
