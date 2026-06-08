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
  getInvoice,
} = require('../controllers/partnerPortalController');

// All partner portal routes require auth + partner status
router.use(protect);
router.use(partnerOnly);

router.get('/profile',          getProfile);
router.get('/catalog',          getCatalog);
router.post('/orders',          placeOrder);
router.get('/orders',           getOrders);
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

// Business App — cancel order (only if status = 'created')
router.patch('/orders/:id/cancel', async (req, res) => {
  try {
    const pool = require('../config/db');
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE partner_orders SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
       WHERE id=$2 AND partner_user_id=$3 AND status='created' RETURNING id`,
      [reason || '', req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Order cannot be cancelled (not in Created status or not found).' });
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

// Business App — pay now (mark order as paid)
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const pool = require('../config/db');
    const { payment_method } = req.body;
    await pool.query(
      `UPDATE partner_orders SET payment_status='paid', payment_method=$1, updated_at=NOW()
       WHERE id=$2 AND partner_user_id=$3`,
      [payment_method, req.params.id, req.user.id]
    );
    res.json({ message: 'Payment recorded.' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;

