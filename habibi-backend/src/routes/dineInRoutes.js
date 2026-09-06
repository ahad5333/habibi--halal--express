const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');
const staffAuth = require('../middleware/staffMiddleware');
const fcmService = require('../services/fcmService');
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

// NOTE ON THIS FILE'S NAME/PREFIX: the client does not offer dine-in service.
// The dine-in QR ordering flow, its table-lookup endpoint, the dine-in-only
// kitchen feed, and the admin table manager have all been removed, and there
// are no dine_in orders in the database. What remains here is the kitchen /
// staff order-queue API (used by both /kitchen and /staff), which simply
// happens to have been built inside this router first. The '/api/dine-in'
// mount path is kept only so the deployed frontends keep working -- it is a
// legacy path name at this point, not a dine-in feature.

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
// 'accepted' is a REAL stage here, not a formality: it is the only trigger for
// driver dispatch anywhere in the app (adminController broadcasts to on-duty
// drivers on 'accepted', and dispatchController's getAvailableOrders -- the
// driver app's missed-broadcast safety net -- filters on order_status =
// 'accepted' AND delivery_method = 'delivery'). The previous flow here went
// pending -> preparing directly, skipping 'accepted' entirely, so a delivery
// order worked through this screen was NEVER offered to any driver, and its
// last step (ready -> delivered) let counter staff mark it delivered while it
// still sat on the counter with no driver ever assigned. Both fixed below.
const KITCHEN_STATUS_FLOW = {
  pending_verification: 'accepted',   // counter verifies payment AND accepts in one step
  pending:    'accepted',
  confirmed:  'accepted',             // legacy rows already sitting in 'confirmed'
  accepted:   'preparing',
  preparing:  'ready',
  cooking:    'ready',                // legacy alias for 'preparing'
  ready:      'delivered',            // PICKUP ONLY -- see deliveryMethod guard below
};

// Stages that belong to the counter vs the kitchen. Used only to decide who
// gets *notified* and what each role sees highlighted -- deliberately NOT
// enforced as a permission, since in a small operation one person covers
// several of these roles and hard-gating would deadlock the queue. Every
// action is attributed in order_status_log either way.
const COUNTER_ROLES = ['manager', 'cashier', 'server'];
const KITCHEN_ROLES = ['kitchen'];

router.patch('/kitchen/orders/:id/status', kitchenAuth, async (req, res) => {
  try {
    const { status } = req.body;
    // Validate that the requested status is a valid forward transition
    const current = await pool.query(
      'SELECT order_status, order_number, delivery_method FROM guest_orders WHERE id=$1',
      [req.params.id]
    );
    if (!current.rows.length) return res.status(404).json({ message: 'Order not found.' });
    const currentStatus  = current.rows[0].order_status;
    const orderNumber    = current.rows[0].order_number;
    const deliveryMethod = current.rows[0].delivery_method;
    const allowed = KITCHEN_STATUS_FLOW[currentStatus];

    // A delivery order's terminal staff stage is 'ready' -- the driver app owns
    // picked_up/delivered, together with GPS tracking and proof-of-delivery.
    // Letting staff mark it delivered from here would close the order before a
    // driver ever touched it.
    if (currentStatus === 'ready' && deliveryMethod === 'delivery') {
      return res.status(400).json({
        message: 'This order is ready for driver pickup. The driver marks it picked up and delivered from the driver app.',
      });
    }

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

    // ── Hand off to the next station / channel ────────────────────────────
    // Fire-and-forget: none of this should be able to fail the bump itself.
    void (async () => {
      try {
        if (status === 'accepted') {
          // Kitchen's turn. Also the moment delivery orders become visible to
          // drivers -- this same broadcast already runs from adminController
          // on 'accepted'; the staff queue simply never reached this status
          // before, which is why orders worked from this screen were never
          // dispatched to anyone.
          fcmService.sendPushToStaff(
            '👨‍🍳 Start Preparing',
            `Order #${orderNumber} was accepted — begin preparing.`,
            { orderNumber, type: 'start_preparing', url: '/staff' },
            KITCHEN_ROLES
          ).catch(() => {});

          if (deliveryMethod === 'delivery') {
            const ord = await pool.query(
              `SELECT order_number, customer_name, delivery_address, delivery_city, total, tip, items
                 FROM guest_orders WHERE id=$1 LIMIT 1`,
              [req.params.id]
            );
            if (ord.rows[0]) {
              const { broadcastOrderToNearestDrivers } = require('../controllers/dispatchController');
              await broadcastOrderToNearestDrivers(io, ord.rows[0]);
            }
          }
        } else if (status === 'ready') {
          if (deliveryMethod === 'delivery') {
            // Tell whoever is actually carrying this order that the food is up.
            const asg = await pool.query(
              `SELECT sm.driver_fcm_token
                 FROM delivery_assignments da
                 JOIN staff_members sm ON sm.id = da.driver_id
                WHERE da.order_number = $1 AND da.status NOT IN ('cancelled','delivered')
                  AND sm.driver_fcm_token IS NOT NULL
                LIMIT 1`,
              [orderNumber]
            );
            if (asg.rows[0]) {
              fcmService.sendPushNotification(
                asg.rows[0].driver_fcm_token,
                '🍜 Order Ready for Pickup',
                `Order #${orderNumber} is ready — collect it from the counter.`,
                { orderNumber, type: 'order_ready', url: '/driver' }
              ).catch(() => {});
            }
          } else {
            // Pickup: the counter hands it to the customer, so that's whose turn it is.
            fcmService.sendPushToStaff(
              '🔔 Ready for Handoff',
              `Order #${orderNumber} is ready for the customer.`,
              { orderNumber, type: 'ready_for_handoff', url: '/staff' },
              COUNTER_ROLES
            ).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[kitchen bump] handoff notification failed:', err.message);
      }
    })();

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

// Removed with the dine-in feature (client doesn't offer dine-in): the table
// CRUD endpoints (/tables), the QR table lookup (/tables/by-slug/:slug), the
// dine-in-only kitchen feed (/kitchen), and the QR landing page's wait-time
// endpoint (/kitchen-load). Their only callers were the dine-in QR page and
// the admin table manager, both of which have been deleted. dine_in_tables
// held zero rows. Recoverable from git history if dine-in is ever revived.


module.exports = router;

