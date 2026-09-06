const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');
const staffAuth = require('../middleware/staffMiddleware');
const safeError = require('../utils/safeError');

// Add verification audit columns if not present
pool.query(`
  ALTER TABLE guest_orders
    ADD COLUMN IF NOT EXISTS payment_verified_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_verified_by  VARCHAR(100)
`).catch(() => {});

// Kitchen tablets authenticate with X-Kitchen-Token header (one shared screen).
// A personal staff PIN session (X-Staff-Id + X-Staff-Token, kitchen/manager/
// cashier/server roles) is tried first as an alternative -- lets individual
// staff use the exact same queue/bump endpoints without needing the shared
// token or full admin access. See staffMiddleware.js for why that check
// re-verifies role+active from the DB on every request rather than just the
// HMAC, unlike the driver app's equivalent.
// If KITCHEN_TOKEN env var is set, that header value is checked.
// If KITCHEN_TOKEN is not set: dev allows all through; production falls back to admin JWT.
function kitchenAuth(req, res, next) {
  if (req.headers['x-staff-id'] && req.headers['x-staff-token']) {
    return staffAuth(req, res, next);
  }
  const token = process.env.KITCHEN_TOKEN;
  if (token) {
    if (req.headers['x-kitchen-token'] === token) return next();
    return res.status(401).json({ message: 'Kitchen token required' });
  }
  if (process.env.NODE_ENV === 'production') {
    return protect(req, res, () => admin(req, res, next));
  }
  next();
}

// Order-history view is manager-tier-only among staff sessions (the one
// deliberate permission gap between "manager" and kitchen/cashier/server --
// everyone else in the staff-queue tier gets the identical view otherwise).
// Full admin can also see it; the shared KITCHEN_TOKEN screen cannot, since
// it has no notion of "who" is looking at it.
function managerOrAdmin(req, res, next) {
  if (req.headers['x-staff-id'] && req.headers['x-staff-token']) {
    return staffAuth(req, res, () => {
      if (req.staffRole !== 'manager') return res.status(403).json({ message: 'Manager access required.' });
      next();
    });
  }
  return protect(req, res, () => admin(req, res, next));
}

// â”€â”€ Public: get table info by slug (QR scan landing page) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/tables/by-slug/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, table_name, qr_slug FROM dine_in_tables WHERE qr_slug = $1 AND is_active = TRUE`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Table not found or inactive' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// â”€â”€ Kitchen display: active dine-in orders (protected by KITCHEN_TOKEN if set) â”€
router.get('/kitchen', kitchenAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_number, customer_name, table_number, items,
              sub_total, total, order_status, payment_method, placed_at, updated_at,
              delivery_instructions AS special_instructions
       FROM guest_orders
       WHERE delivery_method = 'dine_in'
         AND order_status NOT IN ('delivered', 'cancelled')
       ORDER BY placed_at ASC`
    );
    const orders = result.rows.map(o => {
      let items = [];
      try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (_) {}
      return { ...o, items };
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Kitchen all-orders view (all delivery_methods, excludes delivered/cancelled) ─
router.get('/kitchen-all', kitchenAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_number, customer_name, table_number, delivery_method, items,
              sub_total, total, order_status, payment_method, placed_at, updated_at,
              delivery_instructions AS special_instructions, payment_verified_at, payment_verified_by
       FROM guest_orders
       WHERE order_status NOT IN ('delivered', 'cancelled', 'refunded')
       ORDER BY placed_at ASC`
    );
    const orders = result.rows.map(o => {
      let items = [];
      try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (_) {}
      return { ...o, items };
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Kitchen bump: advance order status ────────────────────────────────────────
const KITCHEN_STATUS_FLOW = {
  pending_verification: 'confirmed',
  pending:    'preparing',
  confirmed:  'preparing',
  preparing:  'ready',
  ready:      'delivered',
};
router.patch('/kitchen/orders/:id/status', kitchenAuth, async (req, res) => {
  try {
    const { status } = req.body;
    // Validate that the requested status is a valid forward transition
    const current = await pool.query('SELECT order_status FROM guest_orders WHERE id=$1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Order not found.' });
    const currentStatus = current.rows[0].order_status;
    const allowed = KITCHEN_STATUS_FLOW[currentStatus];
    if (!status || status !== allowed) {
      return res.status(400).json({ message: `Cannot transition from '${currentStatus}' to '${status}'. Expected: '${allowed}'.` });
    }
    if (currentStatus === 'pending_verification') {
      await pool.query(
        `UPDATE guest_orders
           SET order_status=$1, updated_at=NOW(),
               payment_verified_at=NOW(), payment_verified_by='Kitchen Staff'
         WHERE id=$2`,
        [status, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE guest_orders SET order_status=$1, updated_at=NOW() WHERE id=$2`,
        [status, req.params.id]
      );
    }

    // Who made this change -- staff session, full admin, or the shared
    // kitchen-screen token (no personal identity at all). Recorded so an
    // anonymous shared-screen bump is visible as such, not indistinguishable
    // from a personal one.
    let changedByType = 'shared_kitchen_screen', changedById = null, changedByName = null, changedByRole = null;
    if (req.staffId) {
      changedByType = 'staff'; changedById = req.staffId; changedByName = req.staffName; changedByRole = req.staffRole;
    } else if (req.user) {
      changedByType = 'admin'; changedById = req.user.id; changedByRole = req.user.role;
    }
    await pool.query(
      `INSERT INTO order_status_log
         (order_id, order_number, from_status, to_status, changed_by_type, changed_by_id, changed_by_name, changed_by_role)
       VALUES ($1, (SELECT order_number FROM guest_orders WHERE id=$1), $2, $3, $4, $5, $6, $7)`,
      [req.params.id, currentStatus, status, changedByType, changedById, changedByName, changedByRole]
    ).catch(err => console.error('[order_status_log] insert failed:', err.message));

    // Previously notified no one on update -- an admin/staff viewer only ever
    // found out on their next poll. Cheap to emit now that another real
    // consumer (the staff queue view, and the existing merchant app) can
    // benefit from it, same event name already used for order tracking elsewhere.
    const io = req.app.get('io');
    if (io) io.to('admins').emit('order_status_updated', { id: Number(req.params.id), order_status: status });

    res.json({ id: Number(req.params.id), order_status: status });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Manager/admin: status-change history for one order ────────────────────────
router.get('/kitchen/orders/:id/history', managerOrAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT from_status, to_status, changed_by_type, changed_by_name, changed_by_role, changed_at
       FROM order_status_log WHERE order_id=$1 ORDER BY changed_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Admin: list all tables ────────────────────────────────────────────────────
router.get('/tables', protect, admin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM dine_in_tables ORDER BY table_name ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// â”€â”€ Admin: create table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/tables', protect, admin, async (req, res) => {
  try {
    const { table_name } = req.body;
    if (!table_name?.trim()) return res.status(400).json({ message: 'table_name is required' });
    const base = table_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = `${base}-${Date.now().toString(36)}`;
    const result = await pool.query(
      `INSERT INTO dine_in_tables (table_name, qr_slug) VALUES ($1, $2) RETURNING *`,
      [table_name.trim(), slug]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// â”€â”€ Admin: rename / toggle active â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/tables/:id', protect, admin, async (req, res) => {
  try {
    const { table_name, is_active } = req.body;
    const result = await pool.query(
      `UPDATE dine_in_tables
       SET table_name = COALESCE($1, table_name),
           is_active  = COALESCE($2, is_active)
       WHERE id = $3 RETURNING *`,
      [table_name || null, is_active != null ? is_active : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Table not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// â”€â”€ Admin: delete table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/tables/:id', protect, admin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM dine_in_tables WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Public: kitchen load for dine-in QR landing (shows wait time to customers) ─
router.get('/kitchen-load', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS active_count
       FROM guest_orders
       WHERE delivery_method = 'dine_in'
         AND order_status IN ('pending', 'accepted', 'preparing')
         AND placed_at > NOW() - INTERVAL '45 minutes'`
    );
    const count = parseInt(result.rows[0].active_count, 10);

    let status, time, percentage;
    if (count <= 2) {
      status = 'Light Kitchen Load'; time = '8–12 Mins'; percentage = 0.2;
    } else if (count <= 5) {
      status = 'Normal Load';        time = '10–15 Mins'; percentage = 0.45;
    } else if (count <= 9) {
      status = 'Busy Kitchen';       time = '15–20 Mins'; percentage = 0.75;
    } else {
      status = 'Very Busy Kitchen';  time = '20–30 Mins'; percentage = 0.95;
    }

    res.json({ status, time, percentage, active_orders: count });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;

