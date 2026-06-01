const express = require("express");
const router = express.Router();
const { handleDoorDashWebhook, handleUberWebhook, handleOrderIngest } = require("../controllers/webhookController");

const verifyWebhookSecret = (req, res, next) => {
  if (!process.env.WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Webhook secret not configured' });
  }
  const secret = req.headers['x-webhook-secret'];
  if (secret === process.env.WEBHOOK_SECRET) return next();
  return res.status(401).json({ message: 'Invalid webhook secret' });
};

router.post("/doordash", verifyWebhookSecret, handleDoorDashWebhook);
router.post("/uber", verifyWebhookSecret, handleUberWebhook);
router.post("/ingest", verifyWebhookSecret, handleOrderIngest);

module.exports = router;
