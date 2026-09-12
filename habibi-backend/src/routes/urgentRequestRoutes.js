const express = require("express");
const router = express.Router();
const { createUrgentRequest, getUrgentRequests, updateUrgentRequestStatus } = require("../controllers/urgentRequestController");
const protect = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { adminOrManager } = require("../middleware/managerMiddleware");
const { handleValidation, body } = require('../middleware/validate');

router.post("/",
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
  body('phone').trim().notEmpty().withMessage('Phone is required.').isLength({ max: 50 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Must be a valid email address.').normalizeEmail(),
  body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }),
  handleValidation,
  createUrgentRequest
);

router.get("/", protect, adminOrManager, getUrgentRequests);
router.patch("/:id/status", protect, adminOrManager, updateUrgentRequestStatus);

module.exports = router;
