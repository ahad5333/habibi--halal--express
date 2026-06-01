const safeError = require('../utils/safeError');
const pool = require('../config/db');

exports.getInventory = async (req, res) => {
  try {
    const items = await pool.query(
      `SELECT * FROM inventory_items ORDER BY category, name`
    );
    res.json(items.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.createItem = async (req, res) => {
  try {
    const { name, category, current_stock, unit, low_stock_threshold, cost_per_unit, supplier, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO inventory_items
         (name, category, current_stock, unit, low_stock_threshold, cost_per_unit, supplier, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, category || 'General', current_stock || 0, unit || 'unit',
       low_stock_threshold || 10, cost_per_unit || 0, supplier || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, current_stock, unit, low_stock_threshold, cost_per_unit, supplier, notes } = req.body;
    const result = await pool.query(
      `UPDATE inventory_items
       SET name=$1, category=$2, current_stock=$3, unit=$4,
           low_stock_threshold=$5, cost_per_unit=$6, supplier=$7, notes=$8,
           updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, category, current_stock, unit, low_stock_threshold, cost_per_unit, supplier || null, notes || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.deleteItem = async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory_items WHERE id=$1', [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.restockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, note } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
    const adminName = req.user?.name || 'Admin';
    await pool.query(
      `INSERT INTO inventory_restock_log (item_id, quantity, note, created_by) VALUES ($1,$2,$3,$4)`,
      [id, quantity, note || null, adminName]
    );
    const result = await pool.query(
      `UPDATE inventory_items
       SET current_stock = current_stock + $1, last_restocked_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [quantity, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.getRestockLog = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, i.name AS item_name, i.unit
       FROM inventory_restock_log l
       JOIN inventory_items i ON i.id = l.item_id
       ORDER BY l.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
