// Crash fast if JWT_SECRET is missing — never run without it
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Set it before starting the server.');
  process.exit(1);
}

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const rateLimit    = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const pool         = require("./config/db");
const app = express();

// Security headers
app.use(helmet({
  // Allow cross-origin reads so our React apps and mobile app can call the API
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // Clickjacking: deny all framing (also enforced by CSP frame-ancestors below)
  frameguard: { action: 'deny' },

  // Only send the origin (no path/query) as Referer on cross-origin requests
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Content-Security-Policy — this is a JSON API so scripts are never served;
  // keep rules tight to block any injected markup if an error page leaks HTML.
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'none'"],
      objectSrc:       ["'none'"],
      baseUri:         ["'self'"],
      frameAncestors:  ["'none'"],
      // Allow images/fonts used in emailed HTML (opened in mail clients, not here,
      // but belt-and-suspenders in case any route ever renders HTML)
      imgSrc:          ["'self'", 'data:', 'https:'],
      upgradeInsecureRequests: [],
    },
  },

  // Strict-Transport-Security — 1 year, include subdomains, allow preload
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },

  // Prevent MIME-type sniffing
  noSniff: true,

  // Block IE's legacy X-XSS-Protection reflection attack
  xssFilter: false, // Disabled — modern browsers ignore it; CSP is the right layer
}));

// HTTP request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiters — active in ALL environments (dev gets a higher ceiling for convenience)
// authLimiter (register/login) now lives in authRoutes.js, applied per-route
// instead of blanket across all of /api/auth — see the comment at the
// /api/auth mount below for why.
const isDev = process.env.NODE_ENV !== 'production';
const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  message: { error: "Too many payment requests." },
  standardHeaders: true,
  legacyHeaders: false,
});
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 15,
  message: { error: "Too many orders placed. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});
const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 8,
  message: { error: "Too many coupon attempts. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});
const gpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 60,
  message: { error: "GPS update rate exceeded." },
  standardHeaders: true,
  legacyHeaders: false,
});
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 120,
  message: { error: "Too many admin requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 30,
  message: { error: "Too many requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});
// Referral redemption -- authenticated, but still had no throttle on how
// many codes one account could try per minute.
const referralLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 15,
  message: { error: "Too many requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});
const userRoutes = require("./routes/userRoutes")
const menuRoutes = require("./routes/menuRoutes")
const byoIngredientRoutes = require("./routes/byoIngredientRoutes")
const authRoutes = require("./routes/authRoutes")
const cartRoutes = require("./routes/cartRoutes")
const orderRoutes = require("./routes/orderRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const adminRoutes = require("./routes/adminRoutes")
const reservationRoutes = require("./routes/reservationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const locationRoutes = require("./routes/locationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const financeRoutes = require("./routes/financeRoutes");
const paymentMethodRoutes = require("./routes/paymentMethodRoutes");
const urgentRequestRoutes = require("./routes/urgentRequestRoutes");
const contactRoutes = require("./routes/contactRoutes");
const logisticsRoutes = require("./routes/logisticsRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const partnerPortalRoutes = require("./routes/partnerPortalRoutes");
const doordashRoutes = require("./routes/doordashRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const seoRoutes = require("./routes/seoRoutes");
const dineInRoutes = require("./routes/dineInRoutes");
const offersRoutes   = require("./routes/offersRoutes");
const articleRoutes  = require("./routes/articleRoutes");
const roadieRoutes = require("./routes/roadieRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const careersRoutes = require("./routes/careersRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const favoritesRoutes   = require("./routes/favoritesRoutes");
const savedCustomRoutes = require("./routes/savedCustomRoutes");
const groupOrderRoutes  = require("./routes/groupOrderRoutes");
const referralRoutes   = require("./routes/referralRoutes");
const giftCardRoutes   = require("./routes/giftCardRoutes");
const waitlistRoutes   = require("./routes/waitlistRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const { getPaymentSettings, getCheckoutSettings, getSiteSettings, updateSiteSettings } = require("./controllers/settingsController");
const _protect = require("./middleware/authMiddleware");
const _admin   = require("./middleware/adminMiddleware");

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  console.error('[FATAL] CORS_ORIGINS must be set in production. Refusing to start with wildcard origins.');
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:8081", "http://localhost:8082", "http://localhost:8083", "http://localhost:8084", "http://localhost:8085", "http://localhost:19006"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Force HTTPS in production (trust Nginx proxy)
app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.protocol !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Disable ETags for API routes so LiveBoard always gets fresh order data (no 304 caching)
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '500kb' }))
// Twilio (and any other form-POST webhook) sends application/x-www-form-urlencoded,
// never JSON — without this, req.body was always {} for those requests, so e.g. the
// inbound SMS STOP/HELP/START webhook read req.body.From/.Body as undefined and its
// "if (from)" guard never once fired for a real Twilio request.
app.use(express.urlencoded({ extended: true, limit: '500kb' }))
const staticOpts = { maxAge: '1y', etag: true, lastModified: true }
app.use(express.static("public", staticOpts))
app.use("/uploads", express.static("public/uploads", staticOpts))
app.use("/api/users/me/notifications", notificationsRoutes)  // must be before /api/users
app.use("/api/users", userRoutes)
app.use("/api/menus", menuRoutes)
app.use("/api/byo-ingredients", byoIngredientRoutes)
// authLimiter now applies per-route inside authRoutes.js (only to
// register/login) instead of blanket here — GET /api/auth/me is a routine,
// already-authenticated session check the SPA fires on every page
// navigation, not a guessable-credential endpoint, so it was silently
// eating the same 20-req/15-min budget meant to stop brute-force login
// attempts. Confirmed live: a normal admin session clicking through the
// sidebar exceeded it, got a 429 on /me, and the frontend treated that as
// "not logged in" and bounced to the login screen mid-session.
app.use("/api/auth", authRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderLimiter, orderRoutes);
app.use("/api/payments", payLimiter, paymentRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/coupons", couponLimiter, couponRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/urgent-requests", urgentRequestRoutes);
// Not applied blanket to the whole /api/contact mount -- that would also
// throttle the Twilio SMS webhook mounted here (/sms-optout), which is
// already protected by signature verification (a stronger guarantee than
// IP-based rate limiting) and could see legitimate bursts. Applied
// per-route inside contactRoutes.js instead.
app.use("/api/contact", contactRoutes);
app.use("/api/logistics", logisticsRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/partner", partnerPortalRoutes);
app.use("/api/doordash", doordashRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/dine-in", dineInRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/roadie", roadieRoutes);
app.use("/api/careers", careersRoutes);
app.use("/api/reviews", reviewLimiter, reviewsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/saved-customs", savedCustomRoutes);
app.use("/api/group-orders", groupOrderRoutes);
app.use("/api/referrals",   referralLimiter, referralRoutes);
app.use("/api/gift-cards",  payLimiter, giftCardRoutes);
app.use("/api/waitlist",    waitlistRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/articles",   articleRoutes);
app.get("/api/settings/payments", getPaymentSettings);
app.get("/api/settings/checkout", getCheckoutSettings);
app.get("/api/settings/site", getSiteSettings);
app.patch("/api/settings/site", _protect, _admin, updateSiteSettings);
const { getPublicBusinessHours } = require('./controllers/businessHoursController');
app.get('/api/business-hours', getPublicBusinessHours);
app.use("/", seoRoutes);

app.get("/health", async (req, res) => {
  // Only allow internal/monitoring requests — block public access in production
  const clientIp = req.ip || '';
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  // Require a real, non-empty HEALTH_SECRET to match against — otherwise an
  // unset env var (undefined) would equal a request that simply omits the
  // header (also undefined), silently allowing anyone through.
  const allowedMonitorHeader = !!process.env.HEALTH_SECRET &&
    req.headers['x-monitor-secret'] === process.env.HEALTH_SECRET;
  if (process.env.NODE_ENV === 'production' && !isLocalhost && !allowedMonitorHeader) {
    return res.status(404).json({ message: 'Not found' });
  }
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", uptime: Math.floor(process.uptime()) + "s" });
  } catch (_) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.get("/", (req, res)=>{
    res.json({
        success: true,
        message: "Habibi Backend Running"
    });
});

// ── Sentry error handler (must be after all routes, before other error handlers) ──
const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

// ── Multer / upload error handler ────────────────────────────────────────────
const multer = require("multer");
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ error: 'File too large. Maximum size is 5 MB.' });
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err && err.message === 'Only images are allowed')
    return res.status(415).json({ error: 'Only image files are allowed.' });
  next(err);
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === "production";
  // express-validator 422 errors are already handled in handleValidation middleware
  console.error("[Unhandled Error]", isProd ? err.message : err);
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error." : err.message,
  });
});

// ── Re-engagement push notifications ─────────────────────────────────────────
// Runs daily at 12:00 noon. Finds users who haven't ordered in 5-7 days and
// sends a personalised push nudge. Skips users with no push token.
const cron       = require('node-cron');
const fcmService = require('./services/fcmService');

cron.schedule('0 12 * * *', async () => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT u.id, u.name
        FROM users u
        JOIN guest_orders go ON go.customer_email = u.email
       WHERE go.placed_at >= NOW() - INTERVAL '7 days'
         AND go.placed_at <  NOW() - INTERVAL '5 days'
         AND u.email NOT IN (
               SELECT customer_email FROM guest_orders
                WHERE placed_at > NOW() - INTERVAL '5 days'
             )
         AND EXISTS (
               SELECT 1 FROM user_device_tokens udt WHERE udt.user_id = u.id
             )
    `);

    const messages = [
      { title: "We miss you, {name}! 🍽️",       body: "Your next halal craving is one tap away. Come back for something delicious." },
      { title: "Habibi calling, {name}! 📞",     body: "It's been a few days. Treat yourself to something amazing today." },
      { title: "Hungry, {name}? 🥙",             body: "Your favourite platters and burgers are waiting. Order now!" },
    ];

    for (const user of rows) {
      const msg = messages[user.id % messages.length];
      const firstName = (user.name || 'Habibi').split(' ')[0];
      await fcmService.sendPushToUser(
        user.id,
        msg.title.replace('{name}', firstName),
        msg.body,
        { screen: 'MainTabs', channelId: 'promotions' }
      ).catch(() => {});
    }

    if (rows.length > 0) {
      console.log(`[Cron] Re-engagement: sent nudge to ${rows.length} user(s)`);
    }
  } catch (err) {
    console.error('[Cron] Re-engagement error:', err.message);
  }
});

// ── Order abandonment cleanup — REMOVED ───────────────────────────────────────
// This used to auto-cancel any guest_orders row stuck in 'pending' for over 30
// minutes, on the assumption that 'pending' meant "checkout started but the
// customer closed the browser before paying." That assumption doesn't hold:
// in the current checkout flow (Checkout.jsx), a guest_orders row is only ever
// created AFTER payment succeeds (card/PayPal) or after the customer confirms
// an offline method (cash/Zelle/Cash App) — so 'pending' always means "a real,
// placed order waiting for staff to accept it," which can legitimately sit
// for a while during a rush or overnight. This cron was silently cancelling
// real customer orders — including cash-on-delivery orders — whenever staff
// hadn't clicked Accept within 30 minutes.

// ── Expired revoked-token cleanup ────────────────────────────────────────────
// Runs daily. Removes rows whose token has naturally expired — keeps the table lean.
cron.schedule('0 3 * * *', async () => {
  try {
    const { rowCount } = await pool.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
    if (rowCount > 0) console.log(`[Cron] Purged ${rowCount} expired revoked token(s)`);
  } catch (err) {
    console.error('[Cron] Revoked-token cleanup error:', err.message);
  }
});

// ── Expired group order session cleanup ───────────────────────────────────────
// Runs every hour. Closes open sessions past their expires_at timestamp.
cron.schedule('0 * * * *', async () => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE group_order_sessions
         SET status = 'closed'
       WHERE status = 'open'
         AND expires_at < NOW()
    `);
    if (rowCount > 0) {
      console.log(`[Cron] Expired group sessions closed: ${rowCount}`);
    }
  } catch (err) {
    console.error('[Cron] Group session cleanup error:', err.message);
  }
});

// ── Stale unverified account cleanup ─────────────────────────────────────────
// Runs nightly at 4 AM. Deletes accounts that were never verified after 7 days.
// These are either fake emails or users who never completed signup — safe to remove.
cron.schedule('0 4 * * *', async () => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM users
      WHERE email_verified = FALSE
        AND created_at < NOW() - INTERVAL '7 days'
        AND provider IS NULL
    `);
    if (rowCount > 0) console.log(`[Cron] Purged ${rowCount} stale unverified account(s)`);
  } catch (err) {
    console.error('[Cron] Unverified account cleanup error:', err.message);
  }
});

// ── Scheduled broadcast dispatch ─────────────────────────────────────────────
// Runs every minute. A broadcast composed with a future "send later" time is
// inserted as status='scheduled' (see broadcastsController.sendBroadcast) and
// picked up here once due, reusing the exact same send logic (executeBroadcast)
// an immediate send uses — so a scheduled campaign never behaves differently
// from clicking "Send Now" would have.
const { executeBroadcast } = require('./controllers/broadcastsController');

cron.schedule('* * * * *', async () => {
  try {
    const due = await pool.query(
      `SELECT * FROM broadcasts WHERE status='scheduled' AND scheduled_at <= NOW()`
    );
    for (const broadcast of due.rows) {
      try {
        const { totalSent } = await executeBroadcast(broadcast);
        await pool.query(
          `UPDATE broadcasts SET status='sent', sent_at=NOW(), sent_count=$1 WHERE id=$2`,
          [totalSent, broadcast.id]
        );
        console.log(`[Cron] Scheduled broadcast #${broadcast.id} sent (${totalSent} recipient(s))`);
      } catch (err) {
        await pool.query(`UPDATE broadcasts SET status='failed' WHERE id=$1`, [broadcast.id]).catch(() => {});
        console.error(`[Cron] Scheduled broadcast #${broadcast.id} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Cron] Scheduled broadcast dispatch error:', err.message);
  }
});

module.exports = app;

