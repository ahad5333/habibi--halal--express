const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getRevenueAnalytics = async (req, res) => {
  try {
    const [dailyRes, byCatRes] = await Promise.all([
      // Daily revenue last 7 days from guest_orders
      pool.query(`
        SELECT
          TO_CHAR(placed_at, 'Mon DD') AS date,
          COALESCE(SUM(total), 0)::numeric AS revenue,
          COUNT(*)::int AS order_count
        FROM guest_orders
        WHERE order_status IN ('delivered', 'completed')
          AND placed_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY TO_CHAR(placed_at, 'Mon DD'), DATE_TRUNC('day', placed_at)
        ORDER BY DATE_TRUNC('day', placed_at) ASC
      `),
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
        GROUP BY 1 ORDER BY revenue DESC LIMIT 10
      `),
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
    // New customers registered this calendar month
    const [monthRes, totalRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS new_customers
        FROM users
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`SELECT COUNT(*)::int AS total FROM users`),
    ]);
    res.json({
      new_customers: monthRes.rows[0]?.new_customers ?? 0,
      total_customers: totalRes.rows[0]?.total ?? 0,
      period: 'This month',
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getRevenueAnalytics,
  getCustomerGrowth
};
