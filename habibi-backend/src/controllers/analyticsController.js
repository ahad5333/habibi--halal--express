const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getRevenueAnalytics = async (req, res) => {
  try {
    const start = req.query.start || null;
    const end   = req.query.end   || null;

    const dateFilter = start && end
      ? `AND placed_at::date BETWEEN $1 AND $2`
      : start
      ? `AND placed_at::date >= $1`
      : end
      ? `AND placed_at::date <= $1`
      : `AND placed_at >= CURRENT_DATE - INTERVAL '30 days'`;
    const dateParams = start && end ? [start, end] : start ? [start] : end ? [end] : [];

    const [dailyRes, byCatRes] = await Promise.all([
      pool.query(`
        SELECT
          TO_CHAR(placed_at, 'Mon DD') AS date,
          COALESCE(SUM(total), 0)::numeric AS revenue,
          COUNT(*)::int AS order_count
        FROM guest_orders
        WHERE order_status IN ('delivered', 'completed')
          ${dateFilter}
        GROUP BY TO_CHAR(placed_at, 'Mon DD'), DATE_TRUNC('day', placed_at)
        ORDER BY DATE_TRUNC('day', placed_at) ASC
      `, dateParams),
      // Revenue by category extracted from JSONB items
      pool.query(`
        SELECT
          COALESCE(item->>'category', 'Other') AS category,
          COALESCE(SUM(
            COALESCE((item->>'price')::numeric, (item->>'unit_price')::numeric, 0) *
            COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1)
          ), 0)::numeric AS revenue
        FROM guest_orders,
             jsonb_array_elements(
               CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END
             ) AS item
        WHERE order_status IN ('delivered', 'completed')
          ${dateFilter}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 10
      `, dateParams),
    ]);

    // Convert by_category array to { category: revenue } object for Admin Analytics chart
    const by_category = {};
    for (const row of byCatRes.rows) {
      by_category[row.category] = parseFloat(row.revenue);
    }

    res.json({
      daily_revenue: dailyRes.rows,
      by_category,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getCustomerGrowth = async (req, res) => {
  try {
    const start = req.query.start || null;
    const end   = req.query.end   || null;

    // Mirrors getRevenueAnalytics's date-range handling so the "New Customers"
    // stat reflects the same period as the rest of the Analytics page instead
    // of always being "this calendar month" regardless of the selected range.
    const dateFilter = start && end
      ? `AND created_at::date BETWEEN $1 AND $2`
      : start
      ? `AND created_at::date >= $1`
      : end
      ? `AND created_at::date <= $1`
      : `AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    const dateParams = start && end ? [start, end] : start ? [start] : end ? [end] : [];
    const period = start || end ? `${start || '…'} to ${end || '…'}` : 'This month';

    const [newRes, totalRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS new_customers
        FROM users
        WHERE TRUE ${dateFilter}
      `, dateParams),
      pool.query(`SELECT COUNT(*)::int AS total FROM users`),
    ]);
    res.json({
      new_customers: newRes.rows[0]?.new_customers ?? 0,
      total_customers: totalRes.rows[0]?.total ?? 0,
      period,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getRevenueAnalytics,
  getCustomerGrowth
};
