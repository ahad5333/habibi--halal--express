const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// GET /api/users/me/notifications
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, body, read, created_at
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me/notifications/read-all  ← must be BEFORE /:id/read
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE user_notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE user_notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
