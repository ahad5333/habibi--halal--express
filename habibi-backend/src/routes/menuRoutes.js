const express = require("express");

const router = express.Router();

const {
  getMenus,
  createMenu,
  getMenuById,
  deleteMenu,
} = require("../controllers/menuController");
const { getRecommendations } = require("../controllers/aiController");
const pool = require("../config/db");

router.get("/recommendations", getRecommendations);
router.get("/", getMenus);

router.post("/", createMenu);

// Public: fetch choice groups (sizes) + addon groups for a menu item
router.get("/:id/modifiers", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [cg, ag] = await Promise.all([
      pool.query(`
        SELECT cg.id, cg.title, cg.preference,
               COALESCE(json_agg(
                 json_build_object('id', co.id, 'title', co.title, 'extra_price', co.extra_price, 'is_default', co.is_default)
                 ORDER BY co.preference
               ) FILTER (WHERE co.id IS NOT NULL), '[]') AS options
        FROM choice_groups cg
        LEFT JOIN choice_options co ON co.choice_group_id = cg.id
        WHERE cg.menu_item_id = $1
        GROUP BY cg.id ORDER BY cg.preference
      `, [id]),
      pool.query(`
        SELECT ag.id, ag.title, ag.preference, ag.max_selections,
               COALESCE(json_agg(
                 json_build_object('id', ao.id, 'title', ao.title, 'price', ao.price)
                 ORDER BY ao.preference
               ) FILTER (WHERE ao.id IS NOT NULL), '[]') AS options
        FROM addon_groups ag
        LEFT JOIN addon_options ao ON ao.addon_group_id = ag.id
        WHERE ag.menu_item_id = $1
        GROUP BY ag.id ORDER BY ag.preference
      `, [id]),
    ]);
    res.json({ choice_groups: cg.rows, addon_groups: ag.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", getMenuById);

router.delete("/:id", deleteMenu);

module.exports = router;