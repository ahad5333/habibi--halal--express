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

// ── Menu profitability ─────────────────────────────────────────────────────
// Answers the question the revenue reports can't: which dishes actually MAKE
// money. Revenue per dish already existed; what didn't was any notion of what
// a dish costs to make, so a best-seller at a 20% margin and one at 70% looked
// identical.
//
// Classifies each costed dish with the standard menu-engineering matrix
// (Kasavana & Smith), because a margin % on its own doesn't say what to DO:
//
//   Star       popular, high margin   -> keep, feature prominently
//   Plowhorse  popular, low margin    -> review the cost, or nudge the price
//   Puzzle     unpopular, high margin -> promote it, reposition it
//   Dog        unpopular, low margin  -> rework or remove
//
// Thresholds are the textbook ones, computed from this period's own data:
//   popular     = share of units >= 70% of an even split (0.7 / N)
//   high margin = unit margin >= the weighted-average unit margin
//
// Deliberate limits, surfaced to the admin rather than hidden:
//  - Cost is per base dish. Paid add-ons raise the selling price captured on
//    the order, but their ingredient cost isn't tracked, so an add-on-heavy
//    dish's margin reads slightly high.
//  - BYO bowls and custom wraps aren't menu rows, so they can't carry a cost;
//    they're reported as one bucket, revenue only.
//  - Order-level discounts (coupons, loyalty) aren't allocated to dishes, so
//    these are gross margins at the price the dish actually sold for.
//  - Only completed orders count, the same rule as every other report here.
exports.getMenuProfitability = async (req, res) => {
  const { s, e } = dateRange(req);
  try {
    // Units and revenue per line-item id, from completed orders in range.
    // The id has lived under three different keys over time.
    const soldRes = await pool.query(
      `SELECT
         COALESCE(item->>'menu_item_id', item->>'menuItemId', item->>'id') AS item_key,
         SUM(${ITEM_QTY})::numeric AS units,
         SUM(
           COALESCE(NULLIF(item->>'unit_price','')::numeric, NULLIF(item->>'price','')::numeric, 0)
           * ${ITEM_QTY}
         )::numeric AS revenue
       FROM guest_orders, ${ITEMS_UNNEST}
       WHERE ${DATE_BOUNDS} AND ${COMPLETED}
       GROUP BY 1`,
      [s, e]
    );

    const menuRes = await pool.query(
      `SELECT id, name, category, price, cost_price, is_available
         FROM menus WHERE COALESCE(is_active, TRUE) = TRUE`
    );

    const soldById = new Map();
    const custom = { units: 0, revenue: 0, kinds: new Set() };
    for (const r of soldRes.rows) {
      const key = String(r.item_key || '');
      if (/^\d+$/.test(key)) {
        soldById.set(Number(key), { units: Number(r.units) || 0, revenue: Number(r.revenue) || 0 });
      } else {
        // byo-menu / custom-... : built by the customer, no menu row to cost.
        custom.units += Number(r.units) || 0;
        custom.revenue += Number(r.revenue) || 0;
        custom.kinds.add(key.startsWith('byo') ? 'BYO bowls' : 'custom builds');
      }
    }

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const items = menuRes.rows.map(m => {
      const sold = soldById.get(m.id) || { units: 0, revenue: 0 };
      const cost = m.cost_price === null ? null : Number(m.cost_price);
      // What it really sold for (includes paid add-ons); list price if unsold.
      const avgPrice = sold.units > 0 ? sold.revenue / sold.units : Number(m.price) || 0;
      const unitMargin = cost === null ? null : avgPrice - cost;
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        list_price: round2(m.price),
        is_available: m.is_available,
        units: sold.units,
        revenue: round2(sold.revenue),
        avg_price: round2(avgPrice),
        cost_price: cost === null ? null : round2(cost),
        unit_margin: unitMargin === null ? null : round2(unitMargin),
        margin_pct: unitMargin === null || avgPrice <= 0 ? null : round2((unitMargin / avgPrice) * 100),
        contribution: unitMargin === null ? null : round2(unitMargin * sold.units),
        klass: null,
      };
    });

    // Classify only dishes that both sold and have a cost -- the matrix is
    // meaningless for anything missing either half.
    const classifiable = items.filter(i => i.cost_price !== null && i.units > 0);
    const totalUnits = classifiable.reduce((a, i) => a + i.units, 0);
    const totalContribution = classifiable.reduce((a, i) => a + i.contribution, 0);
    const avgUnitMargin = totalUnits > 0 ? totalContribution / totalUnits : 0;
    const popularityShare = classifiable.length > 0 ? 0.7 / classifiable.length : 0;

    for (const i of classifiable) {
      const popular = totalUnits > 0 && i.units / totalUnits >= popularityShare;
      const highMargin = i.unit_margin >= avgUnitMargin;
      i.klass = popular ? (highMargin ? 'star' : 'plowhorse') : (highMargin ? 'puzzle' : 'dog');
    }

    const costedRevenue = classifiable.reduce((a, i) => a + i.revenue, 0);
    const itemRevenue = items.reduce((a, i) => a + i.revenue, 0) + custom.revenue;

    // Sold but uncosted, biggest revenue first: the order in which filling
    // in a cost changes the picture most.
    const needsCost = items
      .filter(i => i.cost_price === null && i.units > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const counts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
    classifiable.forEach(i => { counts[i.klass]++; });

    res.json({
      range: { start: s, end: e },
      summary: {
        item_revenue: round2(itemRevenue),
        costed_revenue: round2(costedRevenue),
        // How much of the money this report can actually explain. Low
        // coverage means the margins below describe a small slice of sales.
        cost_coverage_pct: itemRevenue > 0 ? round2((costedRevenue / itemRevenue) * 100) : 0,
        total_contribution: round2(totalContribution),
        blended_margin_pct: costedRevenue > 0 ? round2((totalContribution / costedRevenue) * 100) : null,
        avg_unit_margin: round2(avgUnitMargin),
        dishes_total: items.length,
        dishes_costed: items.filter(i => i.cost_price !== null).length,
        dishes_sold_uncosted: needsCost.length,
        negative_margin: classifiable.filter(i => i.unit_margin < 0).length,
        counts,
      },
      thresholds: {
        popularity_share_pct: round2(popularityShare * 100),
        avg_unit_margin: round2(avgUnitMargin),
      },
      custom_builds: {
        units: custom.units,
        revenue: round2(custom.revenue),
        kinds: [...custom.kinds],
      },
      needs_cost: needsCost.slice(0, 15).map(i => ({ id: i.id, name: i.name, revenue: i.revenue, units: i.units })),
      items: items.sort((a, b) =>
        (b.contribution ?? -Infinity) - (a.contribution ?? -Infinity) || b.revenue - a.revenue),
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// PATCH /api/admin/reports/menu-profitability/:id/cost   { cost_price }
// Set (or clear, with null) one dish's cost from the report itself. Entering
// 251 costs through the item editor one at a time is exactly the friction
// that means nobody ever fills them in.
exports.updateMenuItemCost = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid item id.' });

  const raw = req.body?.cost_price;
  let cost = null;
  if (raw !== null && raw !== undefined && raw !== '') {
    cost = Number(raw);
    if (!Number.isFinite(cost) || cost < 0 || cost > 10000) {
      return res.status(400).json({ message: 'Cost must be a number between 0 and 10,000.' });
    }
    cost = Math.round(cost * 100) / 100;
  }

  try {
    const before = await pool.query('SELECT name, price, cost_price FROM menus WHERE id = $1', [id]);
    if (!before.rows.length) return res.status(404).json({ message: 'Menu item not found.' });

    // The same dish can be listed in more than one section (Beef Burger under
    // both Sandwich and Bergers). It's one burger with one set of ingredients,
    // so its cost belongs to every listing -- otherwise a cost typed on the
    // listing that never sells leaves the one that does uncosted, which is
    // exactly the trap duplicate listings caused. Matching is done here in JS
    // with the same whitespace normalisation the report uses, since some
    // names carry doubled or unusual spaces.
    const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const applyAll = req.body?.apply_to_same_name !== false;
    let ids = [id];
    if (applyAll) {
      const all = await pool.query(`SELECT id, name FROM menus WHERE COALESCE(is_active, TRUE) = TRUE`);
      const target = norm(before.rows[0].name);
      ids = all.rows.filter(r => norm(r.name) === target).map(r => r.id);
      if (!ids.includes(id)) ids.push(id);
    }

    await pool.query('UPDATE menus SET cost_price = $1 WHERE id = ANY($2)', [cost, ids]);

    const { logAudit } = require('./auditController');
    logAudit(pool, req.user?.id, req.user?.name || req.user?.email, 'update_cost_price', 'menu', id,
      { name: before.rows[0].name, from: before.rows[0].cost_price, to: cost, listings: ids }, req.ip).catch(() => {});

    res.json({
      id,
      cost_price: cost,
      updated_ids: ids,
      // Flagged, not refused: selling below cost can be deliberate (a loss
      // leader), but it should never be an unnoticed typo.
      below_cost: cost !== null && cost > Number(before.rows[0].price),
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
