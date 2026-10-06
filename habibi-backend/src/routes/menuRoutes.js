const express = require("express");

const router = express.Router();
const safeError = require('../utils/safeError');
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');

const {
  getMenus,
  createMenu,
  getMenuById,
  deleteMenu,
} = require("../controllers/menuController");
const { getRecommendations } = require("../controllers/aiController");
const pool = require("../config/db");

router.get("/recommendations", getRecommendations);

// Public: per-location menu availability map — { menu_id: 'available'|'sold_out'|'inactive' }
router.get("/location-availability", async (req, res) => {
  try {
    const { location_id } = req.query;
    if (!location_id) return res.json({});
    const { rows } = await pool.query(
      `SELECT menu_id, status FROM menu_location_availability WHERE location_id=$1`,
      [location_id]
    );
    const map = {};
    rows.forEach(r => { map[r.menu_id] = r.status; });
    res.json(map);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

router.get("/", getMenus);

router.post("/", protect, admin, createMenu);

// Public: fetch choice groups + addon groups for a menu item
// Item-specific addons (e.g. "More Meat") come first, then global groups
// unless the item has exclude_global_addons = true
// "Popular with your order" (app cart): dishes most often in the same real
// orders as the given ones, last 90 days, at least 3 shared orders, never the
// given dishes themselves, only dishes still on sale. Counts only.
router.get("/frequently-with", async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(n => parseInt(n, 10)).filter(n => n > 0).slice(0, 30);
  if (!ids.length) return res.json({ menu_ids: [] });
  try {
    const { rows } = await pool.query(
      `WITH lines AS (
         SELECT g.order_number, NULLIF(COALESCE(it->>'menu_item_id', it->>'id'), '') AS mid
           FROM guest_orders g
           CROSS JOIN LATERAL jsonb_array_elements(
             CASE WHEN jsonb_typeof(g.items) = 'array' THEN g.items ELSE '[]'::jsonb END) it
          WHERE g.placed_at >= NOW() - INTERVAL '90 days'
            AND g.order_status NOT IN ('cancelled', 'refunded', 'rejected', 'pending_payment')
       ), hits AS (
         SELECT DISTINCT order_number FROM lines WHERE mid = ANY($1::text[])
       )
       SELECT l.mid::int AS menu_id, COUNT(DISTINCT l.order_number)::int AS n
         FROM lines l JOIN hits h ON h.order_number = l.order_number
         JOIN menus m ON m.id::text = l.mid
        WHERE l.mid ~ '^[0-9]+$' AND NOT (l.mid = ANY($1::text[]))
          AND COALESCE(m.is_available, true) AND COALESCE(m.is_active, true)
        GROUP BY l.mid HAVING COUNT(DISTINCT l.order_number) >= 3
        ORDER BY n DESC LIMIT 6`,
      [ids.map(String)]
    );
    res.json({ menu_ids: rows.map(r => r.menu_id) });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// "Popular" options for one dish, from real orders only (app dish popup).
// Per choice group, the most-picked option of the last 90 days -- shown only
// when it was picked at least POPULAR_MIN times AND more than any other option
// in its group, so a handful of orders never crowns a winner. Public: counts
// only, nothing about who ordered. Cached per dish for 10 minutes.
const POPULAR_MIN = 5;
const popularCache = new Map();
router.get("/:id/popular-options", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!(id > 0)) return res.status(400).json({ message: "Invalid menu id." });
  const hit = popularCache.get(id);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return res.json(hit.body);
  try {
    const { rows } = await pool.query(
      `SELECT ch.key AS group_id, ch.value AS option_id, COUNT(*)::int AS n
         FROM guest_orders g
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(g.items) = 'array' THEN g.items ELSE '[]'::jsonb END) it
         CROSS JOIN LATERAL jsonb_each_text(
           CASE WHEN jsonb_typeof(it->'selectedChoices') = 'object' THEN it->'selectedChoices' ELSE '{}'::jsonb END) ch
        WHERE g.placed_at >= NOW() - INTERVAL '90 days'
          AND g.order_status NOT IN ('cancelled', 'refunded', 'rejected', 'pending_payment')
          AND COALESCE(it->>'menu_item_id', it->>'id') = $1::text
        GROUP BY 1, 2`,
      [String(id)]
    );
    const byGroup = {};
    for (const r of rows) (byGroup[r.group_id] = byGroup[r.group_id] || []).push(r);
    const popular = [];
    for (const list of Object.values(byGroup)) {
      list.sort((a, b) => b.n - a.n);
      const [top, next] = list;
      if (top.n >= POPULAR_MIN && (!next || top.n > next.n)) popular.push(String(top.option_id));
    }
    const body = { option_ids: popular };
    popularCache.set(id, { at: Date.now(), body });
    res.json(body);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

router.get("/:id/modifiers", async (req, res) => {
  try {
    const param = req.params.id;
    const isNumeric = /^\d+$/.test(param);
    const whereClause = isNumeric ? 'id = $1' : 'slug = $1';
    const whereValue  = isNumeric ? parseInt(param, 10) : param;
    const { rows } = await pool.query(
      `SELECT choices, addons, exclude_global_addons FROM menus WHERE ${whereClause}`,
      [whereValue]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });

    let addonGroups = rows[0].addons || [];

    if (!rows[0].exclude_global_addons) {
      try {
        const globalRes = await pool.query(
          'SELECT id, name, options, sort_order FROM global_addon_groups WHERE is_active = TRUE ORDER BY sort_order'
        );
        const globalGroups = globalRes.rows.map(g => ({
          id: 9000 + g.id,
          title: g.name,
          max_selections: null,
          options: g.options || [],
        }));
        addonGroups = [...addonGroups, ...globalGroups];
      } catch (_) {}
    }

    res.json({
      choice_groups: rows[0].choices || [],
      addon_groups:  addonGroups,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

router.get("/:id", getMenuById);

router.delete("/:id", protect, admin, deleteMenu);

module.exports = router;