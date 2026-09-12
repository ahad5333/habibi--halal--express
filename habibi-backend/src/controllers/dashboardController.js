// ── The dashboard's "today" view ─────────────────────────────────────────────
// One request, because the panel's first screen shouldn't fan out to five
// endpoints before it can show anything.
//
// Everything here is New York wall-clock. The older getDashboardStats compared
// placed_at against CURRENT_DATE, which is the server's UTC date — so between
// 8pm and midnight New York time, "today" there silently means tomorrow.
const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { MANAGER_ROLE } = require('../middleware/managerMiddleware');

// An order sitting in one of these states longer than this many minutes is
// worth someone's attention. Kept here rather than in the UI so the panel and
// anything else that reads this agree on what "late" means.
const STUCK_AFTER = {
  pending:          10,
  accepted:         20,
  preparing:        25,
  cooking:          25,
  ready:            15,
  out_for_delivery: 50,
};

const DONE = ['delivered', 'completed', 'cancelled', 'refunded'];
const MANUAL_PAY = ['zelle', 'cashapp'];

const getToday = async (req, res) => {
  try {
    const [active, awaiting, stock, dishes, onShift, totals] = await Promise.all([
      // Orders still in flight, oldest first.
      pool.query(`
        SELECT order_number, customer_name, order_status, delivery_method, total,
               placed_at, payment_method, payment_status,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - placed_at)) / 60)::int AS minutes
          FROM guest_orders
         WHERE deleted_at IS NULL
           AND order_status <> ALL($1)
         ORDER BY placed_at ASC
         LIMIT 60
      `, [DONE]),

      // Zelle / Cash App orders nobody has confirmed the money for yet. These
      // never reach the kitchen, so they are the easiest orders to lose.
      pool.query(`
        SELECT order_number, customer_name, customer_phone, payment_method, total,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - placed_at)) / 60)::int AS minutes
          FROM guest_orders
         WHERE deleted_at IS NULL
           AND order_status <> ALL($1)
           AND LOWER(payment_method) = ANY($2)
           AND LOWER(COALESCE(payment_status, 'unpaid')) <> 'paid'
         ORDER BY placed_at ASC
         LIMIT 20
      `, [DONE, MANUAL_PAY]),

      // Ingredients out or nearly out.
      pool.query(`
        SELECT name, unit,
               current_stock::float        AS stock,
               low_stock_threshold::float  AS threshold
          FROM inventory_items
         WHERE current_stock <= GREATEST(low_stock_threshold, 0)
         ORDER BY (current_stock <= 0) DESC, current_stock ASC
         LIMIT 25
      `),

      // Dishes switched off on the menu.
      pool.query(`
        SELECT name FROM menus
         WHERE is_active IS NOT FALSE AND is_available = FALSE
         ORDER BY name LIMIT 25
      `),

      // Who is clocked in right now.
      pool.query(`
        SELECT s.name, s.role, c.clock_in,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - c.clock_in)) / 60)::int AS minutes
          FROM time_clock c
          JOIN staff_members s ON s.id = c.staff_id
         WHERE c.clock_out IS NULL
         ORDER BY c.clock_in ASC
      `),

      // Today in New York, not in UTC.
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE order_status <> ALL($1))::int                       AS placed,
          COUNT(*) FILTER (WHERE order_status IN ('delivered','completed'))::int     AS completed,
          COUNT(*) FILTER (WHERE order_status = 'cancelled')::int                    AS cancelled,
          COALESCE(SUM(total) FILTER (WHERE order_status IN ('delivered','completed')), 0) AS revenue
          FROM guest_orders
         WHERE deleted_at IS NULL
           AND (placed_at AT TIME ZONE 'America/New_York')::date
             = (NOW() AT TIME ZONE 'America/New_York')::date
      `, [DONE]),
    ]);

    const byStatus = {};
    for (const o of active.rows) byStatus[o.order_status] = (byStatus[o.order_status] || 0) + 1;

    const orders = active.rows.map(o => ({
      ...o,
      stuck: o.minutes >= (STUCK_AFTER[o.order_status] ?? Infinity),
    }));

    const t = totals.rows[0] || {};
    const today = {
      placed:    t.placed    || 0,
      completed: t.completed || 0,
      cancelled: t.cancelled || 0,
      revenue:   parseFloat(t.revenue || 0).toFixed(2),
    };
    // Managers run the shift, not the books.
    if (req.user?.role === MANAGER_ROLE) delete today.revenue;

    res.json({
      today,
      active: {
        total: orders.length,
        stuck: orders.filter(o => o.stuck).length,
        by_status: byStatus,
        orders,
      },
      awaiting_payment: awaiting.rows,
      stock: {
        out:  stock.rows.filter(r => r.stock <= 0),
        low:  stock.rows.filter(r => r.stock > 0),
        unavailable_dishes: dishes.rows.map(d => d.name),
      },
      on_shift: onShift.rows,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getToday, STUCK_AFTER };
