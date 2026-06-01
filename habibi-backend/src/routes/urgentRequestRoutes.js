const express = require("express");
const router = express.Router();
const { createUrgentRequest, getUrgentRequests } = require("../controllers/urgentRequestController");
const protect = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { handleValidation, rules, body } = require('../middleware/validate');

router.post("/",
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
  rules.email(),
  body('subject').trim().notEmpty().withMessage('Subject is required.').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }),
  handleValidation,
  createUrgentRequest
);

router.get("/", protect, admin, getUrgentRequests);

module.exports = router;
