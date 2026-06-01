const safeError = require('../utils/safeError');
const pool = require('../config/db');

function dateRange(req) {
  const { start, end } = req.query;
  const s = start ? new Date(start) : new Date('2020-01-01');
  const e = end   ? new Date(end)   : new Date();
  // extend end to end of day
  e.setHours(23, 59, 59, 999);
  return { s, e };
}

// Summary report — totals for date range
exports.getRevenueReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::int                         AS total_orders,
        COALESCE(SUM(sub_total),0)::numeric   AS subtotal,
        COALESCE(SUM(tax),0)::numeric         AS tax_collected,
        COALESCE(SUM(service_fee),0)::numeric AS service_fees,
        COALESCE(SUM(delivery_fee),0)::numeric AS delivery_fees,
        COALESCE(SUM(tip),0)::numeric         AS tips,
        COALESCE(SUM(discount),0)::numeric    AS discounts,
        COALESCE(SUM(total),0)::numeric       AS gross_revenue,
        COALESCE(SUM(total) FILTER (WHERE order_status IN ('delivered','completed')),0)::numeric AS net_revenue
       FROM guest_orders
       WHERE placed_at BETWEEN $1 AND $2`,
      [s, e]
    );
    res.json({ revenue: result.rows[0], start: s, end: e });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Transaction list
exports.getTransactionReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT order_number, customer_name, customer_email,
              payment_method, delivery_method, sub_total, tax,
              service_fee, delivery_fee, tip, discount, total,
              coupon_code, order_status, placed_at
       FROM guest_orders
       WHERE placed_at BETWEEN $1 AND $2
       ORDER BY placed_at DESC`,
      [s, e]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Revenue by delivery city (proxy for location)
exports.getRevenueByLocation = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(NULLIF(delivery_city,''), 'Unknown') AS location,
        COUNT(*)::int                                  AS orders,
        COALESCE(SUM(total),0)::numeric                AS revenue
       FROM guest_orders
       WHERE placed_at BETWEEN $1 AND $2
       GROUP BY 1 ORDER BY revenue DESC`,
      [s, e]
    );
    res.json({ by_location: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Revenue by item category (parsed from JSONB items column)
exports.getRevenueByCategory = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    // Extract items from JSONB and aggregate by category field
    const result = await pool.query(
      `SELECT
        COALESCE(item->>'category', 'Uncategorised') AS category,
        COUNT(*)::int                                  AS item_count,
        COALESCE(SUM(
          COALESCE((item->>'price')::numeric, (item->>'unit_price')::numeric, 0) *
          COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1)
        ), 0)::numeric AS revenue
       FROM guest_orders,
            jsonb_array_elements(
              CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END
            ) AS item
       WHERE placed_at BETWEEN $1 AND $2
         AND order_status NOT IN ('cancelled')
       GROUP BY 1 ORDER BY revenue DESC`,
      [s, e]
    );
    res.json({ by_category: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Tax report
exports.getTaxReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', placed_at), 'Mon YYYY') AS month,
        COUNT(*)::int                                         AS orders,
        COALESCE(SUM(sub_total),0)::numeric                  AS taxable_sales,
        COALESCE(SUM(tax),0)::numeric                        AS tax_collected,
        ROUND(
          CASE WHEN SUM(sub_total) > 0
            THEN (SUM(tax) / SUM(sub_total)) * 100
            ELSE 0
          END, 2
        )::numeric                                            AS effective_rate_pct
       FROM guest_orders
       WHERE placed_at BETWEEN $1 AND $2
         AND order_status NOT IN ('cancelled')
       GROUP BY DATE_TRUNC('month', placed_at)
       ORDER BY DATE_TRUNC('month', placed_at)`,
      [s, e]
    );
    res.json({ tax_report: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Order report (status breakdown)
exports.getOrderReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const [orders, breakdown] = await Promise.all([
      pool.query(
        `SELECT order_number, customer_name, delivery_method,
                payment_method, total, order_status, placed_at
         FROM guest_orders WHERE placed_at BETWEEN $1 AND $2
         ORDER BY placed_at DESC`,
        [s, e]
      ),
      pool.query(
        `SELECT order_status, COUNT(*)::int AS count,
                COALESCE(SUM(total),0)::numeric AS revenue
         FROM guest_orders WHERE placed_at BETWEEN $1 AND $2
         GROUP BY order_status`,
        [s, e]
      ),
    ]);
    res.json({ orders: orders.rows, by_status: breakdown.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Coupon usage
exports.getCouponUsageReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT coupon_code,
              COUNT(*)::int                          AS uses,
              COALESCE(SUM(discount),0)::numeric     AS total_discount,
              COALESCE(AVG(total),0)::numeric        AS avg_order_value
       FROM guest_orders
       WHERE coupon_code IS NOT NULL AND coupon_code != ''
         AND placed_at BETWEEN $1 AND $2
       GROUP BY coupon_code ORDER BY uses DESC`,
      [s, e]
    );
    res.json({ coupon_usage: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
