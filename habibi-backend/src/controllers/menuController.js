const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');

const getMenus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, price, partner_price,
             image_url AS image, category,
             COALESCE(categories, ARRAY[]::TEXT[]) AS categories,
             is_available, choices, addons, dietary_info,
             is_spicy, is_vegetarian, is_gluten_free, is_featured
      FROM menus
      WHERE is_available = TRUE AND is_active = TRUE
      ORDER BY category, sort_order, id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, description, price, partner_price,
              image_url, category,
              COALESCE(categories, ARRAY[]::TEXT[]) AS categories,
              is_available, choices, addons, dietary_info, temperature, notes
       FROM menus WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

function parseJsonField(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

const VALID_CATEGORIES = new Set([
  'Breakfast','Platter','Sandwich','Burgers','Taco','Tacos',
  'Habibi Specials','Extras','Drinks','Family Tray','Build Your Own',
  'Sides','Desserts','Catering','Specials',
]);

const createMenu = async (req, res) => {
  try {
    const { name, description, category, price, partner_price, sort_order, notes,
            is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max,
            categories } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 9999) {
      return res.status(400).json({ error: 'price must be a number between 0 and 9999.' });
    }

    let image_url = req.body.image_url || "";
    if (req.file) {
      image_url = `/uploads/menus/${req.file.filename}`;
    }

    // Parse categories array (from JSON string or already array)
    let parsedCategories = [];
    if (categories) {
      try { parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories; } catch {}
    }
    if (!Array.isArray(parsedCategories)) parsedCategories = [];
    // Primary category is first selected, or passed category field
    const primaryCategory = category || parsedCategories[0] || 'Uncategorized';

    const parsedChoices = parseJsonField(choices);
    const parsedAddons  = parseJsonField(addons);
    const parsedAddonsMax = addons_max ? parseInt(addons_max) : null;

    const result = await pool.query(
      `INSERT INTO menus (name, description, category, categories, price, partner_price, image_url, sort_order, notes,
                          is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, name, description, category, categories, price, partner_price, image_url, sort_order, notes,
                 is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max`,
      [
        name,
        description || null,
        primaryCategory,
        parsedCategories,
        parseFloat(price) || 0,
        parseFloat(partner_price || price) || 0,
        image_url,
        parseInt(sort_order) || 0,
        notes || null,
        is_spicy === 'true' || is_spicy === true,
        is_vegetarian === 'true' || is_vegetarian === true,
        is_gluten_free === 'true' || is_gluten_free === true,
        is_featured === 'true' || is_featured === true,
        parsedChoices ? JSON.stringify(parsedChoices) : null,
        parsedAddons  ? JSON.stringify(parsedAddons)  : null,
        parsedAddonsMax,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'create_menu_item', 'menu_item', String(result.rows[0].id), { name: result.rows[0].name }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, partner_price, sort_order, notes, is_active,
            is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max,
            categories } = req.body;

    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name cannot be empty.' });
    }
    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0 || p > 9999) {
        return res.status(400).json({ error: 'price must be a number between 0 and 9999.' });
      }
    }

    // Fetch current row so PATCH-style updates don't overwrite fields not in the request
    const current = await pool.query(
      `SELECT name, description, category, categories, price, partner_price, image_url, sort_order, notes,
              is_active, is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max
       FROM menus WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return res.status(404).json({ message: "Menu item not found" });
    const cur = current.rows[0];

    let image_url = req.body.image_url || cur.image_url;
    if (req.file) image_url = `/uploads/menus/${req.file.filename}`;

    let parsedCategories = cur.categories || [];
    if (categories !== undefined) {
      try { parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories; } catch {}
      if (!Array.isArray(parsedCategories)) parsedCategories = [];
    }

    // Primary category: explicit category field, else first of categories array, else keep existing
    const newPrimaryCategory = category !== undefined
      ? (category || parsedCategories[0] || cur.category)
      : (parsedCategories[0] || cur.category);

    const parsedChoices = choices !== undefined ? parseJsonField(choices) : parseJsonField(cur.choices);
    const parsedAddons  = addons  !== undefined ? parseJsonField(addons)  : parseJsonField(cur.addons);

    const result = await pool.query(
      `UPDATE menus
       SET name=$1, description=$2, category=$3, categories=$4, price=$5, partner_price=$6,
           image_url=$7, sort_order=$8, notes=$9, is_active=$10,
           is_spicy=$11, is_vegetarian=$12, is_gluten_free=$13, is_featured=$14,
           choices=$15, addons=$16, addons_max=$17
       WHERE id=$18
       RETURNING id, name, description, category, categories, price, partner_price, image_url, sort_order, notes,
                 is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, is_featured, choices, addons, addons_max`,
      [
        name       !== undefined ? name.trim()                              : cur.name,
        description !== undefined ? (description || null)                  : cur.description,
        newPrimaryCategory,
        parsedCategories,
        price      !== undefined ? parseFloat(price)                       : parseFloat(cur.price),
        partner_price !== undefined ? parseFloat(partner_price || price)   : parseFloat(cur.partner_price),
        image_url,
        sort_order !== undefined ? parseInt(sort_order) : parseInt(cur.sort_order || 0),
        notes      !== undefined ? (notes || null)                         : cur.notes,
        is_active  !== undefined ? (is_active !== false && is_active !== 'false') : cur.is_active,
        is_spicy     !== undefined ? (is_spicy === 'true'     || is_spicy === true)     : cur.is_spicy,
        is_vegetarian !== undefined ? (is_vegetarian === 'true' || is_vegetarian === true) : cur.is_vegetarian,
        is_gluten_free !== undefined ? (is_gluten_free === 'true' || is_gluten_free === true) : cur.is_gluten_free,
        is_featured !== undefined ? (is_featured === 'true'   || is_featured === true)   : cur.is_featured,
        parsedChoices ? JSON.stringify(parsedChoices) : null,
        parsedAddons  ? JSON.stringify(parsedAddons)  : null,
        addons_max !== undefined ? (addons_max || null) : cur.addons_max,
        id,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'update_menu_item', 'menu_item', String(id), { name: result.rows[0]?.name }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM menus WHERE id = $1", [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_menu_item', 'menu_item', String(id), {}, req.ip);
    res.json({ message: "Menu item deleted" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = { getMenus, createMenu, getMenuById, updateMenu, deleteMenu };
