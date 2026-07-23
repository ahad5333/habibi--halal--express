const safeError = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const partnerOnly = require('../middleware/partnerMiddleware');
const {
  getProfile,
  getCatalog,
  placeOrder,
  getOrders,
  getOrderById,
  getInvoice,
} = require('../controllers/partnerPortalController');

// All partner portal routes require auth + partner status
router.use(protect);
router.use(partnerOnly);

router.get('/profile',            getProfile);
router.get('/catalog',            getCatalog);
router.post('/orders',            placeOrder);
router.get('/orders',             getOrders);
router.get('/orders/:id',         getOrderById);
router.get('/orders/:id/invoice', getInvoice);

// Business App — order summary stats
router.get('/summary', async (req, res) => {
  try {
    const pool = require('../config/db');
    const email = req.user.email;
    const result = await pool.query(`
      SELECT
        COUNT(*)::int                                                    AS total_orders,
        COALESCE(SUM(total), 0)::numeric                               AS total_spent,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int         AS unpaid_count,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'unpaid'),0)::numeric AS unpaid_total
      FROM partner_orders
      WHERE partner_user_id = $1
    `, [req.user.id]);
    res.json(result.rows[0] || { total_orders: 0, total_spent: 0, unpaid_count: 0, unpaid_total: 0 });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// Business App — add items to existing order (only before it's been confirmed)
router.patch('/orders/:id/items', async (req, res) => {
  try {
    const pool = require('../config/db');
    const { items: newItems } = req.body;
    if (!newItems || !newItems.length) return res.status(400).json({ message: 'No items provided.' });

    const result = await pool.query(
      `SELECT items, sub_total, total FROM partner_orders WHERE id=$1 AND partner_user_id=$2 AND status='pending'`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Order not found or cannot be modified.' });

    const current = typeof result.rows[0].items === 'string'
      ? JSON.parse(result.rows[0].items)
      : (result.rows[0].items || []);

    const merged = [...current];
    for (const ni of newItems) {
      const existing = merged.find(i => i.menu_item_id === ni.menu_item_id);
      if (existing) {
        existing.quantity += ni.quantity;
      } else {
        merged.push({ menu_item_id: ni.menu_item_id, name: ni.name, quantity: ni.quantity, unit_price: ni.unit_price });
      }
    }

    const sub_total = merged.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
    const total = sub_total;

    await pool.query(
      `UPDATE partner_orders SET items=$1, sub_total=$2, total=$3, updated_at=NOW() WHERE id=$4`,
      [JSON.stringify(merged), sub_total, total, req.params.id]
    );

    res.json({ message: 'Items added.', sub_total, total, items: merged });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// Business App — cancel order (only before it's been confirmed)
router.patch('/orders/:id/cancel', async (req, res) => {
  try {
    const pool = require('../config/db');
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE partner_orders SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
       WHERE id=$2 AND partner_user_id=$3 AND status='pending' RETURNING id`,
      [reason || '', req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Order cannot be cancelled (already confirmed or not found).' });
    res.json({ message: 'Order cancelled.' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// Business App — update payment method
router.patch('/orders/:id/payment-method', async (req, res) => {
  try {
    const pool = require('../config/db');
    const { payment_method } = req.body;
    await pool.query(
      `UPDATE partner_orders SET payment_method=$1, updated_at=NOW()
       WHERE id=$2 AND partner_user_id=$3`,
      [payment_method, req.params.id, req.user.id]
    );
    res.json({ message: 'Payment method updated.' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;

