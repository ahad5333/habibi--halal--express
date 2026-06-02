const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");
const app = express();

// Security headers — allow cross-origin reads so our React apps can call the API
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },        // Clickjacking protection
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// HTTP request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiters — active in ALL environments (dev gets a higher ceiling for convenience)
const isDev = process.env.NODE_ENV !== 'production';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  message: { error: "Too many attempts, try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
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
const userRoutes = require("./routes/userRoutes")
const menuRoutes = require("./routes/menuRoutes")
const authRoutes = require("./routes/authRoutes")
const cartRoutes = require("./routes/cartRoutes")
const orderRoutes = require("./routes/orderRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const deliveryRoutes = require("./routes/deliveryRoutes")
const adminRoutes = require("./routes/adminRoutes")
const reservationRoutes = require("./routes/reservationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const locationRoutes = require("./routes/locationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const financeRoutes = require("./routes/financeRoutes");
const paymentMethodRoutes = require("./routes/paymentMethodRoutes");
const urgentRequestRoutes = require("./routes/urgentRequestRoutes");
const contactRoutes = require("./routes/contactRoutes");
const logisticsRoutes = require("./routes/logisticsRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const partnerPortalRoutes = require("./routes/partnerPortalRoutes");
const doordashRoutes = require("./routes/doordashRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const seoRoutes = require("./routes/seoRoutes");
const dineInRoutes = require("./routes/dineInRoutes");
const offersRoutes = require("./routes/offersRoutes");
const roadieRoutes = require("./routes/roadieRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const careersRoutes = require("./routes/careersRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const favoritesRoutes = require("./routes/favoritesRoutes");
const { getPaymentSettings, getCheckoutSettings } = require("./controllers/settingsController");

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
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

app.use(express.json({ limit: '50kb' }))
app.use(express.static("public"))
app.use("/uploads", express.static("public/uploads"))
app.use("/api/users/me/notifications", notificationsRoutes)  // must be before /api/users
app.use("/api/users", userRoutes)
app.use("/api/menus", menuRoutes)
app.use("/api/auth", authLimiter, authRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderLimiter, orderRoutes);
app.use("/api/payments", payLimiter, paymentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/urgent-requests", urgentRequestRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/logistics", logisticsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/partner", partnerPortalRoutes);
app.use("/api/doordash", doordashRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/dine-in", dineInRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/roadie", roadieRoutes);
app.use("/api/careers", careersRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/settings/payments", getPaymentSettings);
app.get("/api/settings/checkout", getCheckoutSettings);
app.use("/", seoRoutes);

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", uptime: Math.floor(process.uptime()) + "s" });
  } catch (e) {
    res.status(503).json({ status: "error", db: "unreachable", message: e.message });
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
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

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

module.exports = app;

