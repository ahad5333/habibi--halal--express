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
  chargeSavedCardEndpoint,
  refundEndpoint,
} = require("../controllers/authNetController");
const {
  getPublicCardConfig,
  chargeCardEndpoint: chargeCardProcessorEndpoint,
} = require("../controllers/cardProcessorController");

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

// ── Card (processor-agnostic — Authorize.net / Square / Clover) ──────────
// Which processor (if any) is currently active, and its non-secret config —
// the frontend uses `provider` in the response to decide which card-form
// component to mount.
router.get("/card/config", getPublicCardConfig);
// Charge using a Square/Clover tokenized source (Authorize.net keeps using
// its own /authnet/charge, posted to directly by AuthNetForm.jsx).
router.post("/card/charge", chargeCardProcessorEndpoint);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post("/refund/:orderNumber", protect, admin, refundOrder);
router.post("/authnet/refund/:orderNumber", protect, admin, refundEndpoint);

// ── Legacy ───────────────────────────────────────────────────────────────────
router.use(protect);
router.post("/verify", verifyPayment);

// Charge a saved card — authenticated (via the blanket protect above) so a
// saved card can only ever be charged by the account that saved it.
router.post("/authnet/charge-saved", chargeSavedCardEndpoint);

module.exports = router;
