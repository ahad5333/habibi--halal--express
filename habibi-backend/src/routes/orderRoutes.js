const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const protect = require("../middleware/authMiddleware");
const { admin, optionalAuth } = require("../middleware/authMiddleware");
const { handleValidation, rules, body } = require('../middleware/validate');
const {
  createGuestOrder,
  getAdminOrders,
  updateGuestOrderStatus,
  deleteGuestOrder,
  clearCompletedOrders,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/orderController");

/* ── Guest order — optionalAuth so logged-in users get their user_id stored ── */
router.post("/guest",
  optionalAuth,
  body('customer_name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Name too long.'),
  body('customer_email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.').normalizeEmail(),
  body('customer_phone').optional({ checkFalsy: true }).isLength({ max: 20 }).withMessage('Phone too long.'),
  body('delivery_method').notEmpty().withMessage('Delivery method is required.').isIn(['delivery','pickup','dine_in']).withMessage('Invalid delivery method.'),
  body('delivery_address').optional({ checkFalsy: true }).isLength({ max: 300 }).withMessage('Address too long.'),
  body('delivery_instructions').optional({ checkFalsy: true }).isLength({ max: 500 }).withMessage('Instructions too long.'),
  body('payment_method').notEmpty().withMessage('Payment method is required.'),
  rules.positiveFloat('sub_total',    'Subtotal'),
  rules.positiveFloat('delivery_fee', 'Delivery fee'),
  rules.positiveFloat('tip',          'Tip'),
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item.'),
  handleValidation,
  createGuestOrder
);

/* ── Public: queue position for a specific order ── */
router.get("/queue/:orderNumber", async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const mine = await pool.query(
      `SELECT placed_at, order_status FROM guest_orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (mine.rows.length === 0) return res.status(404).json({ message: "Order not found" });

    const { placed_at, order_status } = mine.rows[0];
    const activeStatuses = ['pending', 'accepted', 'preparing'];

    if (!activeStatuses.includes(order_status)) {
      return res.json({ position: null, status: order_status });
    }

    // Count orders placed before this one that are still in queue
    const result = await pool.query(
      `SELECT COUNT(*)::int AS ahead
       FROM guest_orders
       WHERE order_status = ANY($1)
         AND placed_at < $2
         AND order_number != $3`,
      [activeStatuses, placed_at, orderNumber]
    );

    res.json({ position: result.rows[0].ahead, status: order_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Public order tracking (no auth) — PII redacted ── */
router.get("/track/:orderNumber", async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const result = await pool.query(
      `SELECT order_number, customer_name,
              delivery_method, delivery_city,
              payment_method, sub_total, tax, service_fee,
              delivery_fee, tip, discount, total,
              order_status, items, placed_at, expected_time,
              table_number
       FROM guest_orders
       WHERE order_number = $1`,
      [orderNumber]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const o = result.rows[0];
    let items = [];
    try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (_) {}
    res.json({ ...o, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Public: chat history for an order ── */
router.get("/chat/:orderNumber", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, sender, text, created_at AS timestamp
       FROM chat_messages
       WHERE order_number = $1
       ORDER BY created_at ASC
       LIMIT 200`,
      [req.params.orderNumber]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Admin-only routes ── */
router.get("/admin", protect, admin, getAdminOrders);
router.put("/admin/:id/status", protect, admin, updateGuestOrderStatus);
router.delete("/admin/completed", protect, admin, clearCompletedOrders);
router.delete("/admin/:id", protect, admin, deleteGuestOrder);

/* ── Auth-protected routes ── */
router.use(protect);

router.post("/:orderNumber/redeem-points", async (req, res) => {
  try {
    const { points } = req.body;
    const pts = parseInt(points) || 0;
    if (pts <= 0 || pts % 500 !== 0) {
      return res.status(400).json({ error: 'Points must be a multiple of 500' });
    }
    const userRes = await pool.query(
      'SELECT loyalty_points FROM users WHERE id=$1', [req.user.id]
    );
    const current = userRes.rows[0]?.loyalty_points || 0;
    if (current < pts) {
      return res.status(400).json({ error: 'Insufficient points' });
    }
    await pool.query(
      'UPDATE users SET loyalty_points = loyalty_points - $1 WHERE id=$2',
      [pts, req.user.id]
    );
    res.json({ ok: true, remaining: current - pts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);

module.exports = router;
