const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin } = require("../middleware/authMiddleware");
const {
  createPaymentIntent,
  squareCharge,
  stripeWebhook,
  squareWebhook,
  refundOrder,
  getOfflinePaymentInfo,
  paypalCreateOrder,
  paypalCapture,
  verifyPayment,
} = require("../controllers/paymentController");

// ── Public ──────────────────────────────────────────────────────────────────

// Create Stripe PaymentIntent — called before order is placed
router.post("/create-intent", createPaymentIntent);

// Square card charge (nonce from Square Web Payments SDK)
router.post("/square/charge", squareCharge);

// Zelle / CashApp payment info
router.get("/offline-info", getOfflinePaymentInfo);

// PayPal: create order → returns orderID + approvalUrl (for mobile WebView)
router.post("/paypal/create-order", paypalCreateOrder);

// PayPal server-side order capture
router.post("/paypal/capture", paypalCapture);

// ── Webhooks (raw body, no JSON middleware) ──────────────────────────────────
// Note: app.js mounts /api/payments — these are /api/payments/webhook/*
// The stripe webhook needs req.rawBody; handled in app.js via rawBody middleware

router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

router.post("/webhook/square", squareWebhook);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post("/refund/:orderNumber", protect, admin, refundOrder);

// ── Legacy ───────────────────────────────────────────────────────────────────
router.use(protect);
router.post("/initiate", require("../controllers/paymentController").createPaymentIntent);
router.post("/verify", verifyPayment);

module.exports = router;
