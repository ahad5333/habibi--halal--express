const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin } = require("../middleware/authMiddleware");
const {
  getFinanceSummary,
  processPayment
} = require("../controllers/financeController");

router.get("/summary",      protect, admin, getFinanceSummary);
router.post("/pay",         protect, admin, processPayment);
router.get("/transactions", protect, admin, async (req, res) => {
  const pool = require('../config/db');
  const safeError = require('../utils/safeError');
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, payment_method,
              sub_total, delivery_fee, tip, total, placed_at, order_status
       FROM guest_orders
       ORDER BY placed_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    res.json({ transactions: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;
