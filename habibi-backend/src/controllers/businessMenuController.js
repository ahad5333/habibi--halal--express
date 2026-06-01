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
    const { name, description, category, price, price_tier_2, price_tier_3, is_active } = req.body;

    let image_url = req.body.image_url || "";
    if (req.file) {
      image_url = `/uploads/menus/${req.file.filename}`;
    }

    const result = await pool.query(
      `
      INSERT INTO business_menus (name, description, category, price, price_tier_2, price_tier_3, image_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [name, description, category, price, price_tier_2 || null, price_tier_3 || null, image_url, is_active !== undefined ? is_active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateBusinessMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, price_tier_2, price_tier_3, is_active } = req.body;

    const currentItem = await pool.query("SELECT image_url FROM business_menus WHERE id = $1", [id]);
    if (currentItem.rows.length === 0) {
      return res.status(404).json({ message: "Business menu item not found" });
    }

    let image_url = req.body.image_url || currentItem.rows[0].image_url;
    if (req.file) {
      image_url = `/uploads/menus/${req.file.filename}`;
    }

    const result = await pool.query(
      `
      UPDATE business_menus
      SET name=$1, description=$2, category=$3, price=$4, price_tier_2=$5, price_tier_3=$6, image_url=$7, is_active=$8
      WHERE id=$9
      RETURNING *
      `,
      [name, description, category, price, price_tier_2 || null, price_tier_3 || null, image_url, is_active !== undefined ? is_active : true, id]
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

module.exports = {
  getBusinessMenus,
  getBusinessMenuById,
  createBusinessMenu,
  updateBusinessMenu,
  deleteBusinessMenu
};
