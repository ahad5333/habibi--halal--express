const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  createSubscription,
  getMySubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} = require("../controllers/subscriptionController");

router.get("/", protect, getMySubscriptions);
router.post("/", protect, createSubscription);
router.post("/:id/pause", protect, pauseSubscription);
router.post("/:id/resume", protect, resumeSubscription);
router.post("/:id/cancel", protect, cancelSubscription);

module.exports = router;
