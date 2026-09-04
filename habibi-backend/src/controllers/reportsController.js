const safeError = require('../utils/safeError');
const pool = require('../config/db');

// Returns raw YYYY-MM-DD strings (with sensible defaults) rather than JS Date
// objects. The old implementation built boundaries with `new Date(...)` +
// `.setHours(23,59,59,999)`, which operates in the Node process's own
// timezone — this server runs in UTC, so the "end of day" boundary landed at
// 7:59:59 PM America/New_York, silently cutting off the last ~4 hours of
// every report's end date (a restaurant's evening rush). Every query below
// now does the timezone conversion explicitly in SQL via AT TIME ZONE
// 'America/New_York', matching the pattern already used elsewhere in this
// codebase, so the boundary is correct regardless of the server's own TZ.
function dateRange(req) {
  const { start, end } = req.query;
  const s = start || '2020-01-01';
  const e = end || new Date().toISOString().slice(0, 10);
  return { s, e };
}

// Inclusive start-of-day / exclusive start-of-next-day in America/New_York,
// expressed as a SQL fragment plus its two params ($1 = start date, $2 = end
// date) — every report's WHERE clause uses this same pair of boundaries.
const DATE_BOUNDS = `placed_at >= ($1::date)::timestamp AT TIME ZONE 'America/New_York'
         AND placed_at <  ($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/New_York'`;

// Every metric below except gross_revenue/total_orders is scoped to orders
// that actually completed — an order that got cancelled never generated real
// tax, fees, tips, or discounts, so counting it inflates every figure. This
// mirrors the same fix applied to the Analytics page, and is what makes
// net_revenue (already correctly delivered-only) reconcile against the
// other line items instead of silently using a different rule than the rest
// of the table.
const COMPLETED = `order_status IN ('delivered','completed')`;

// Summary report — totals for date range
exports.getRevenueReport = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::int                                                       AS total_orders,
        COALESCE(SUM(sub_total)    FILTER (WHERE ${COMPLETED}),0)::numeric  AS subtotal,
        COALESCE(SUM(tax)          FILTER (WHERE ${COMPLETED}),0)::numeric  AS tax_collected,
        COALESCE(SUM(service_fee)  FILTER (WHERE ${COMPLETED}),0)::numeric  AS service_fees,
        COALESCE(SUM(delivery_fee) FILTER (WHERE ${COMPLETED}),0)::numeric  AS delivery_fees,
        COALESCE(SUM(tip)          FILTER (WHERE ${COMPLETED}),0)::numeric  AS tips,
        COALESCE(SUM(discount)     FILTER (WHERE ${COMPLETED}),0)::numeric  AS discounts,
        COALESCE(SUM(total),0)::numeric                                    AS gross_revenue,
        COALESCE(SUM(total) FILTER (WHERE ${COMPLETED}),0)::numeric        AS net_revenue,
        COUNT(*)              FILTER (WHERE order_status = 'cancelled')::int      AS cancelled_orders,
        COALESCE(SUM(total)   FILTER (WHERE order_status = 'cancelled'),0)::numeric AS cancelled_amount
       FROM guest_orders
       WHERE ${DATE_BOUNDS}`,
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
       WHERE ${DATE_BOUNDS}
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
       WHERE ${DATE_BOUNDS}
         AND ${COMPLETED}
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
       WHERE ${DATE_BOUNDS}
         AND ${COMPLETED}
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
       WHERE ${DATE_BOUNDS}
         AND ${COMPLETED}
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
         FROM guest_orders WHERE ${DATE_BOUNDS}
         ORDER BY placed_at DESC`,
        [s, e]
      ),
      pool.query(
        `SELECT order_status, COUNT(*)::int AS count,
                COALESCE(SUM(total),0)::numeric AS revenue
         FROM guest_orders WHERE ${DATE_BOUNDS}
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
         AND ${DATE_BOUNDS}
         AND ${COMPLETED}
       GROUP BY coupon_code ORDER BY uses DESC`,
      [s, e]
    );
    res.json({ coupon_usage: result.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Shared JSONB-items unnest guard -- same defensive pattern already used by
// getRevenueByCategory above (a non-array items value, e.g. null, would
// otherwise error jsonb_array_elements instead of just contributing zero rows).
const ITEMS_UNNEST = `jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END) AS item`;
const ITEM_QTY = `COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1)`;

// Trending items -- quantity sold this window vs. the equal-length window
// immediately before it, so admins can see real week-over-week movement
// instead of just a raw popularity count. pct_change is NULL (not 0 or a
// bogus Infinity%) when there's no prior-period data to compare against --
// the frontend renders that as "new" rather than a fabricated percentage.
exports.getTrendingItems = async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
  try {
    const result = await pool.query(
      `WITH recent AS (
         SELECT COALESCE(item->>'name','Unknown') AS name,
                COALESCE(item->>'category','Uncategorised') AS category,
                SUM(${ITEM_QTY}) AS qty
         FROM guest_orders, ${ITEMS_UNNEST}
         WHERE ${COMPLETED} AND placed_at >= NOW() - ($1 || ' days')::interval
         GROUP BY 1, 2
       ),
       previous AS (
         SELECT COALESCE(item->>'name','Unknown') AS name,
                SUM(${ITEM_QTY}) AS qty
         FROM guest_orders, ${ITEMS_UNNEST}
         WHERE ${COMPLETED}
           AND placed_at >= NOW() - ($1 || ' days')::interval * 2
           AND placed_at <  NOW() - ($1 || ' days')::interval
         GROUP BY 1
       )
       SELECT recent.name, recent.category,
              recent.qty::numeric AS qty_recent,
              COALESCE(previous.qty, 0)::numeric AS qty_previous,
              CASE WHEN COALESCE(previous.qty, 0) = 0 THEN NULL
                   ELSE ROUND(((recent.qty - previous.qty) / previous.qty::numeric) * 100, 1)
              END AS pct_change
       FROM recent LEFT JOIN previous ON previous.name = recent.name
       ORDER BY recent.qty DESC
       LIMIT 20`,
      [String(days)]
    );
    res.json({ trending: result.rows, window_days: days });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Peak hours -- order counts by day-of-week x hour-of-day (America/New_York,
// matching every other report's TZ-correctness convention above) over a
// rolling window. Sparse (dow, hour, count) rows; the frontend builds the
// 7x24 grid and shades cells relative to the max count it receives.
exports.getPeakHours = async (req, res) => {
  const days = Math.min(180, Math.max(7, parseInt(req.query.days) || 90));
  try {
    const result = await pool.query(
      `SELECT EXTRACT(DOW  FROM placed_at AT TIME ZONE 'America/New_York')::int AS dow,
              EXTRACT(HOUR FROM placed_at AT TIME ZONE 'America/New_York')::int AS hour,
              COUNT(*)::int AS order_count
       FROM guest_orders
       WHERE ${COMPLETED} AND placed_at >= NOW() - ($1 || ' days')::interval
       GROUP BY 1, 2`,
      [String(days)]
    );
    res.json({ peak_hours: result.rows, window_days: days });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Prep-ahead forecast -- for a given day-of-week (defaults to today,
// America/New_York), the average quantity of each item sold per 2-hour
// block, per ACTUAL OCCURRENCE of that weekday in the lookback window --
// not per occurrence the item happened to sell on. An item sold on only 3 of
// the last 8 Fridays should show ~3/8 of its per-sale average, not the full
// per-sale average, so `occurrences` is counted separately from `sales` and
// used as the fixed denominator for every item. sample_occurrences is
// returned alongside every row so the UI can caveat a low-data estimate
// (e.g. a newly-opened location with only 2 Fridays of history) instead of
// presenting it with false confidence.
exports.getPrepForecast = async (req, res) => {
  const weeks = Math.min(16, Math.max(2, parseInt(req.query.weeks) || 8));
  let dow = parseInt(req.query.dow);
  try {
    if (isNaN(dow) || dow < 0 || dow > 6) {
      const todayRes = await pool.query(`SELECT EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/New_York')::int AS dow`);
      dow = todayRes.rows[0].dow;
    }
    const result = await pool.query(
      `WITH occurrences AS (
         SELECT COUNT(DISTINCT DATE(placed_at AT TIME ZONE 'America/New_York')) AS n
         FROM guest_orders
         WHERE EXTRACT(DOW FROM placed_at AT TIME ZONE 'America/New_York') = $1
           AND placed_at >= NOW() - ($2 || ' weeks')::interval
       ),
       sales AS (
         SELECT COALESCE(item->>'name','Unknown') AS name,
                COALESCE(item->>'category','Uncategorised') AS category,
                (FLOOR(EXTRACT(HOUR FROM placed_at AT TIME ZONE 'America/New_York') / 2) * 2)::int AS hour_block,
                SUM(${ITEM_QTY}) AS total_qty
         FROM guest_orders, ${ITEMS_UNNEST}
         WHERE ${COMPLETED}
           AND EXTRACT(DOW FROM placed_at AT TIME ZONE 'America/New_York') = $1
           AND placed_at >= NOW() - ($2 || ' weeks')::interval
         GROUP BY 1, 2, 3
       )
       SELECT sales.name, sales.category, sales.hour_block,
              ROUND(sales.total_qty / GREATEST(1, occurrences.n), 1) AS avg_qty,
              occurrences.n AS sample_occurrences
       FROM sales, occurrences
       ORDER BY hour_block, avg_qty DESC`,
      [dow, String(weeks)]
    );
    res.json({ forecast: result.rows, dow, weeks });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
