const pool = require('../config/db');
const safeError = require('../utils/safeError');

const getGlobalAddonGroups = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, options, sort_order, is_active FROM global_addon_groups ORDER BY sort_order, id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateGlobalAddonGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, options, sort_order, is_active } = req.body;

    const current = await pool.query('SELECT * FROM global_addon_groups WHERE id=$1', [id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Group not found' });
    const cur = current.rows[0];

    const { rows } = await pool.query(
      `UPDATE global_addon_groups
       SET name=$1, options=$2, sort_order=$3, is_active=$4
       WHERE id=$5
       RETURNING *`,
      [
        name !== undefined ? name : cur.name,
        options !== undefined ? JSON.stringify(options) : JSON.stringify(cur.options),
        sort_order !== undefined ? parseInt(sort_order) : cur.sort_order,
        is_active !== undefined ? is_active : cur.is_active,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getGlobalAddonGroups, updateGlobalAddonGroup };
