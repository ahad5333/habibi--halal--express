const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin } = require("../middleware/authMiddleware");
const { calculateRoutingTier } = require("../controllers/logisticsController");

router.post("/calculate-tier", protect, admin, calculateRoutingTier);

module.exports = router;
