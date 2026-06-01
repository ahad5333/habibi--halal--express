const safeError = require('../utils/safeError');
const pool = require('../config/db');

exports.getStaff = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM staff_members ORDER BY is_active DESC, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, email, phone, role, shift_start, shift_end, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO staff_members (name, email, phone, role, shift_start, shift_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, email || null, phone || null, role || 'kitchen',
       shift_start || null, shift_end || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, shift_start, shift_end, notes, is_active } = req.body;
    const result = await pool.query(
      `UPDATE staff_members
       SET name=$1, email=$2, phone=$3, role=$4,
           shift_start=$5, shift_end=$6, notes=$7, is_active=$8,
           updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, email || null, phone || null, role, shift_start || null,
       shift_end || null, notes || null, is_active !== false, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Staff not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    await pool.query('DELETE FROM staff_members WHERE id=$1', [req.params.id]);
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
