const pool = require('../config/db');

const ensureTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS saved_custom_orders (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(60) NOT NULL,
    config     JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`);

// GET /api/saved-customs
const getSavedCustoms = async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT id, name, config, created_at
       FROM saved_custom_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved orders' });
  }
};

// POST /api/saved-customs  { name, config }
const createSavedCustom = async (req, res) => {
  try {
    await ensureTable();
    const { name, config } = req.body;
    if (!name || !config) return res.status(400).json({ error: 'name and config required' });
    if (name.length > 60) return res.status(400).json({ error: 'Name too long (max 60 chars)' });

    // Limit per user to 10 saved orders
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM saved_custom_orders WHERE user_id = $1`, [req.user.id]
    );
    if (parseInt(count) >= 10) return res.status(400).json({ error: 'Max 10 saved orders reached' });

    const result = await pool.query(
      `INSERT INTO saved_custom_orders (user_id, name, config)
       VALUES ($1, $2, $3) RETURNING id, name, config, created_at`,
      [req.user.id, name.trim(), config]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save order' });
  }
};

// DELETE /api/saved-customs/:id
const deleteSavedCustom = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM saved_custom_orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete saved order' });
  }
};

// DELETE /api/admin/saved-customs/:id — admin moderation (no user_id
// restriction; names are customer-supplied free text with no other way
// to remove an inappropriate one).
const deleteSavedCustomAdmin = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM saved_custom_orders WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Saved order not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete saved order' });
  }
};

module.exports = { getSavedCustoms, createSavedCustom, deleteSavedCustom, deleteSavedCustomAdmin };
