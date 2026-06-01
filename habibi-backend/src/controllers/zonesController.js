const safeError = require('../utils/safeError');
const pool = require('../config/db');

exports.getZones = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT z.*, l.title AS location_name
       FROM delivery_zones z
       LEFT JOIN locations l ON l.id = z.location_id
       ORDER BY z.location_id, z.min_radius_mi`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.createZone = async (req, res) => {
  try {
    const { location_id, name, min_radius_mi, max_radius_mi, delivery_fee, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO delivery_zones (location_id, name, min_radius_mi, max_radius_mi, delivery_fee, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [location_id || null, name, min_radius_mi || 0, max_radius_mi || 5,
       delivery_fee || 0, is_active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { location_id, name, min_radius_mi, max_radius_mi, delivery_fee, is_active } = req.body;
    const result = await pool.query(
      `UPDATE delivery_zones
       SET location_id=$1, name=$2, min_radius_mi=$3, max_radius_mi=$4,
           delivery_fee=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [location_id || null, name, min_radius_mi, max_radius_mi, delivery_fee, is_active !== false, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Zone not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.deleteZone = async (req, res) => {
  try {
    await pool.query('DELETE FROM delivery_zones WHERE id=$1', [req.params.id]);
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
