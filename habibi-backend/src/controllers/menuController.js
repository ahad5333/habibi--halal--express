const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');

const getMenus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, price, partner_price,
             image_url AS image, category, is_available,
             choices, addons, dietary_info,
             is_spicy, is_vegetarian, is_gluten_free
      FROM menus
      WHERE is_available IS NOT FALSE AND is_active IS NOT FALSE
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
              image_url, category, is_available,
              choices, addons, dietary_info, temperature, notes
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

const createMenu = async (req, res) => {
  try {
    const { name, description, category, price, partner_price, sort_order, notes,
            is_spicy, is_vegetarian, is_gluten_free, choices, addons } = req.body;

    let image_url = req.body.image_url || "";
    if (req.file) {
      image_url = `/uploads/menus/${req.file.filename}`;
    }

    const parsedChoices = parseJsonField(choices);
    const parsedAddons  = parseJsonField(addons);

    const result = await pool.query(
      `INSERT INTO menus (name, description, category, price, partner_price, image_url, sort_order, notes,
                          is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, choices, addons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, $9, $10, $11, $12, $13)
       RETURNING id, name, description, category, price, partner_price, image_url, sort_order, notes,
                 is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, choices, addons`,
      [
        name,
        description || null,
        category || 'Uncategorized',
        parseFloat(price) || 0,
        parseFloat(partner_price || price) || 0,
        image_url,
        parseInt(sort_order) || 0,
        notes || null,
        is_spicy === 'true' || is_spicy === true,
        is_vegetarian === 'true' || is_vegetarian === true,
        is_gluten_free === 'true' || is_gluten_free === true,
        parsedChoices ? JSON.stringify(parsedChoices) : null,
        parsedAddons  ? JSON.stringify(parsedAddons)  : null,
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
            is_spicy, is_vegetarian, is_gluten_free, choices, addons } = req.body;

    const current = await pool.query("SELECT image_url FROM menus WHERE id = $1", [id]);
    if (current.rows.length === 0) return res.status(404).json({ message: "Menu item not found" });

    let image_url = req.body.image_url || current.rows[0].image_url;
    if (req.file) {
      image_url = `/uploads/menus/${req.file.filename}`;
    }

    const parsedChoices = parseJsonField(choices);
    const parsedAddons  = parseJsonField(addons);

    const result = await pool.query(
      `UPDATE menus
       SET name=$1, description=$2, category=$3, price=$4, partner_price=$5,
           image_url=$6, sort_order=$7, notes=$8, is_active=$9,
           is_spicy=$10, is_vegetarian=$11, is_gluten_free=$12,
           choices=$13, addons=$14
       WHERE id=$15
       RETURNING id, name, description, category, price, partner_price, image_url, sort_order, notes,
                 is_available, is_active, is_spicy, is_vegetarian, is_gluten_free, choices, addons`,
      [
        name,
        description || null,
        category || 'Uncategorized',
        parseFloat(price) || 0,
        parseFloat(partner_price || price) || 0,
        image_url,
        parseInt(sort_order) || 0,
        notes || null,
        is_active !== false,
        is_spicy === 'true' || is_spicy === true,
        is_vegetarian === 'true' || is_vegetarian === true,
        is_gluten_free === 'true' || is_gluten_free === true,
        parsedChoices ? JSON.stringify(parsedChoices) : null,
        parsedAddons  ? JSON.stringify(parsedAddons)  : null,
        id,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'update_menu_item', 'menu_item', String(id), { name }, req.ip);
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
