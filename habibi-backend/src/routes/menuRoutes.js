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

// Public: fetch choice groups + addon groups for a menu item (served from menus JSONB)
router.get("/:id/modifiers", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      'SELECT choices, addons FROM menus WHERE id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({
      choice_groups: rows[0].choices || [],
      addon_groups:  rows[0].addons  || [],
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

router.get("/:id", getMenuById);

router.delete("/:id", protect, admin, deleteMenu);

module.exports = router;