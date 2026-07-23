const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { logAudit } = require('./auditController');

const CATEGORIES = ['base', 'cheese', 'veg', 'protein', 'sauce', 'bowl_base', 'bowl_topping', 'bowl_protein', 'bowl_sauce'];

function groupByCategory(rows) {
  const grouped = { base: [], cheese: [], veg: [], protein: [], sauce: [], bowl_base: [], bowl_topping: [], bowl_protein: [], bowl_sauce: [] };
  for (const r of rows) {
    if (grouped[r.category]) grouped[r.category].push(r);
  }
  return grouped;
}

// Public: active ingredients only, grouped by category — used by the
// customer-facing BYO builder and Menu page preview.
const getPublicByoIngredients = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, option_key, category, label, price, image_url, emoji, qty_type,
              family, note, rim_image_url, img_by_qty, sort_order
       FROM byo_ingredients
       WHERE is_active = TRUE
       ORDER BY category, sort_order, id`
    );
    res.json(groupByCategory(rows));
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: everything, including inactive
const getAdminByoIngredients = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM byo_ingredients ORDER BY category, sort_order, id`
    );
    res.json(groupByCategory(rows));
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const createByoIngredient = async (req, res) => {
  try {
    const { option_key, category, label, price, emoji, qty_type, family, note,
            sort_order, is_active } = req.body;

    if (!option_key || !category || !label) {
      return res.status(400).json({ error: 'option_key, category, and label are required.' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'price must be a non-negative number.' });
    }

    let image_url = req.body.image_url || null;
    let rim_image_url = req.body.rim_image_url || null;
    if (req.files?.image?.[0]) {
      const f = req.files.image[0];
      image_url = f.path?.startsWith('http') ? f.path : `/uploads/menus/${f.filename}`;
    }
    if (req.files?.rim_image?.[0]) {
      const f = req.files.rim_image[0];
      rim_image_url = f.path?.startsWith('http') ? f.path : `/uploads/menus/${f.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO byo_ingredients
         (option_key, category, label, price, image_url, emoji, qty_type, family, note, rim_image_url, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        option_key.trim(), category, label.trim(), parsedPrice, image_url,
        emoji || null, qty_type || null, family || null, note || null, rim_image_url,
        parseInt(sort_order) || 0, is_active === 'false' ? false : true,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'create_byo_ingredient', 'byo_ingredient', String(result.rows[0].id), { option_key, category, label }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: `option_key "${req.body.option_key}" already exists.` });
    res.status(500).json(safeError(error));
  }
};

const updateByoIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, price, emoji, qty_type, family, note, sort_order, is_active } = req.body;

    const current = await pool.query(`SELECT * FROM byo_ingredients WHERE id = $1`, [id]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Ingredient not found' });
    const cur = current.rows[0];

    let image_url = cur.image_url;
    let rim_image_url = cur.rim_image_url;
    if (req.files?.image?.[0]) {
      const f = req.files.image[0];
      image_url = f.path?.startsWith('http') ? f.path : `/uploads/menus/${f.filename}`;
    }
    if (req.files?.rim_image?.[0]) {
      const f = req.files.rim_image[0];
      rim_image_url = f.path?.startsWith('http') ? f.path : `/uploads/menus/${f.filename}`;
    }

    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0) return res.status(400).json({ error: 'price must be a non-negative number.' });
    }

    const result = await pool.query(
      `UPDATE byo_ingredients SET
         label = $1, price = $2, image_url = $3, emoji = $4, qty_type = $5,
         family = $6, note = $7, rim_image_url = $8, sort_order = $9, is_active = $10,
         updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        label !== undefined ? label.trim() : cur.label,
        price !== undefined ? parseFloat(price) : cur.price,
        image_url,
        emoji !== undefined ? (emoji || null) : cur.emoji,
        qty_type !== undefined ? (qty_type || null) : cur.qty_type,
        family !== undefined ? (family || null) : cur.family,
        note !== undefined ? (note || null) : cur.note,
        rim_image_url,
        sort_order !== undefined ? parseInt(sort_order) : cur.sort_order,
        is_active !== undefined ? (is_active === 'false' || is_active === false ? false : true) : cur.is_active,
        id,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'update_byo_ingredient', 'byo_ingredient', String(id), { label }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteByoIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM byo_ingredients WHERE id = $1`, [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_byo_ingredient', 'byo_ingredient', String(id), {}, req.ip);
    res.json({ message: 'Ingredient deleted' });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getPublicByoIngredients,
  getAdminByoIngredients,
  createByoIngredient,
  updateByoIngredient,
  deleteByoIngredient,
};
