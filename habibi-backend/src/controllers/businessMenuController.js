const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getBusinessMenus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM business_menus ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getBusinessMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT * FROM business_menus WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Business menu item not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const createBusinessMenu = async (req, res) => {
  try {
    const { name, description, category, price, price_tier_2, price_tier_3, is_active, min_quantity, unit } = req.body;

    let image_url = req.body.image_url || "";
    if (req.file) {
      image_url = req.file.path?.startsWith('http') ? req.file.path : `/uploads/menus/${req.file.filename}`;
    }

    const result = await pool.query(
      `
      INSERT INTO business_menus (name, description, category, price, price_tier_2, price_tier_3, image_url, is_active, min_quantity, unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [name, description, category, price, price_tier_2 || null, price_tier_3 || null, image_url, is_active !== undefined ? is_active : true,
       parseInt(min_quantity, 10) || 1, unit || 'case']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateBusinessMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, price_tier_2, price_tier_3, is_active, min_quantity, unit } = req.body;

    const currentItem = await pool.query("SELECT image_url FROM business_menus WHERE id = $1", [id]);
    if (currentItem.rows.length === 0) {
      return res.status(404).json({ message: "Business menu item not found" });
    }

    let image_url = req.body.image_url || currentItem.rows[0].image_url;
    if (req.file) {
      image_url = req.file.path?.startsWith('http') ? req.file.path : `/uploads/menus/${req.file.filename}`;
    }

    const result = await pool.query(
      `
      UPDATE business_menus
      SET name=$1, description=$2, category=$3, price=$4, price_tier_2=$5, price_tier_3=$6, image_url=$7, is_active=$8, min_quantity=$9, unit=$10
      WHERE id=$11
      RETURNING *
      `,
      [name, description, category, price, price_tier_2 || null, price_tier_3 || null, image_url, is_active !== undefined ? is_active : true,
       parseInt(min_quantity, 10) || 1, unit || 'case', id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteBusinessMenu = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM business_menus WHERE id=$1", [id]);
    res.json({ message: "Business menu item deleted" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Bulk-create wholesale products from an admin-uploaded spreadsheet (parsed to JSON
// client-side). Each row is inserted independently so one bad row doesn't sink the batch.
const bulkImportBusinessMenus = async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'No products provided.' });
  }
  if (products.length > 1000) {
    return res.status(400).json({ message: 'Max 1000 products per import.' });
  }

  const created = [];
  const skipped = [];

  for (const row of products) {
    const name = String(row.name || '').trim().slice(0, 255);
    const price = parseFloat(row.price);

    if (!name) { skipped.push({ name, reason: 'Missing product name' }); continue; }
    if (!Number.isFinite(price) || price <= 0) { skipped.push({ name, reason: 'Missing or invalid price' }); continue; }

    const description = String(row.description || '').trim().slice(0, 2000);
    const category = String(row.category || 'General').trim().slice(0, 100);
    const priceTier2 = row.price_tier_2 !== undefined && row.price_tier_2 !== '' ? parseFloat(row.price_tier_2) : null;
    const priceTier3 = row.price_tier_3 !== undefined && row.price_tier_3 !== '' ? parseFloat(row.price_tier_3) : null;
    const minQuantity = parseInt(row.min_quantity, 10) || 1;
    const unit = String(row.unit || 'case').trim().slice(0, 50);

    try {
      const result = await pool.query(
        `INSERT INTO business_menus (name, description, category, price, price_tier_2, price_tier_3, min_quantity, unit, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING id, name, price`,
        [name, description || null, category, price,
         Number.isFinite(priceTier2) ? priceTier2 : null,
         Number.isFinite(priceTier3) ? priceTier3 : null,
         minQuantity, unit]
      );
      created.push(result.rows[0]);
    } catch (err) {
      skipped.push({ name, reason: err.message });
    }
  }

  res.json({ created_count: created.length, skipped_count: skipped.length, created, skipped });
};

module.exports = {
  getBusinessMenus,
  getBusinessMenuById,
  createBusinessMenu,
  updateBusinessMenu,
  bulkImportBusinessMenus,
  deleteBusinessMenu
};
