const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin } = require("../middleware/authMiddleware");
const {
  squareCharge,
  squareWebhook,
  refundOrder,
  getOfflinePaymentInfo,
  paypalCreateOrder,
  paypalCapture,
  verifyPayment,
} = require("../controllers/paymentController");
const {
  getPublicConfig,
  chargeCardEndpoint,
  refundEndpoint,
} = require("../controllers/authNetController");

// ── Public ──────────────────────────────────────────────────────────────────

// Square card charge (nonce from Square Web Payments SDK)
router.post("/square/charge", squareCharge);

// Zelle / CashApp payment info
router.get("/offline-info", getOfflinePaymentInfo);

// PayPal: create order → returns orderID + approvalUrl (for mobile WebView)
router.post("/paypal/create-order", paypalCreateOrder);

// PayPal server-side order capture
router.post("/paypal/capture", paypalCapture);

// ── Webhooks ─────────────────────────────────────────────────────────────────
router.post("/webhook/square", squareWebhook);

// ── Authorize.net ─────────────────────────────────────────────────────────
// Public config — apiLoginId + clientKey for Accept.js (no secret key exposed)
router.get("/authnet/config", getPublicConfig);
// Charge card using Accept.js opaqueData token
router.post("/authnet/charge", chargeCardEndpoint);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post("/refund/:orderNumber", protect, admin, refundOrder);
router.post("/authnet/refund/:orderNumber", protect, admin, refundEndpoint);

// ── Legacy ───────────────────────────────────────────────────────────────────
router.use(protect);
router.post("/verify", verifyPayment);

module.exports = router;
