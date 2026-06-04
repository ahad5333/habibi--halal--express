const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();
const { handleDoorDashWebhook, handleUberWebhook, handleOrderIngest } = require("../controllers/webhookController");

const verifyWebhookSecret = (req, res, next) => {
  const configured = process.env.WEBHOOK_SECRET;
  if (!configured) return res.status(503).json({ message: 'Webhook secret not configured' });

  const provided = req.headers['x-webhook-secret'];
  if (!provided) return res.status(401).json({ message: 'Missing webhook secret' });

  // Use timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(configured);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }
  } catch {
    return res.status(401).json({ message: 'Invalid webhook secret' });
  }

  next();
};

router.post("/doordash", verifyWebhookSecret, handleDoorDashWebhook);
router.post("/uber", verifyWebhookSecret, handleUberWebhook);
router.post("/ingest", verifyWebhookSecret, handleOrderIngest);

module.exports = router;
