const pool = require('../config/db');

// GET /api/favorites — returns user's favorited menu items
const getFavorites = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.name, m.description, m.price, m.image_url AS image,
              m.category, m.is_spicy, m.is_vegetarian, m.is_gluten_free
       FROM user_favorites f
       JOIN menus m ON m.id = f.menu_item_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// POST /api/favorites — add { menu_item_id }
const addFavorite = async (req, res) => {
  try {
    const { menu_item_id } = req.body;
    if (!menu_item_id) return res.status(400).json({ error: 'menu_item_id required' });
    await pool.query(
      `INSERT INTO user_favorites (user_id, menu_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, menu_item_id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// DELETE /api/favorites/:menu_item_id — remove
const removeFavorite = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM user_favorites WHERE user_id = $1 AND menu_item_id = $2`,
      [req.user.id, req.params.menu_item_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getFavorites, addFavorite, removeFavorite };

