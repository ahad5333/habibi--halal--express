const safeError = require('../utils/safeError');
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
    res.status(500).json(safeError(err));
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
    res.status(500).json(safeError(err));
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
    res.status(500).json(safeError(err));
  }
});

// POST /api/users/me/notifications/device-token
// Registers or refreshes the browser FCM push token for this user.
router.post('/device-token', async (req, res) => {
  const { token, device_type = 'web' } = req.body;
  if (!token || typeof token !== 'string' || token.length > 512) {
    return res.status(400).json({ message: 'Invalid token.' });
  }
  try {
    await pool.query(
      `INSERT INTO user_device_tokens (user_id, device_token, device_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (device_token)
       DO UPDATE SET user_id = $1, device_type = $3, updated_at = NOW()`,
      [req.user.id, token, device_type]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// DELETE /api/users/me/notifications/device-token
// Removes the FCM token when the user disables notifications or logs out.
router.delete('/device-token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token required.' });
  try {
    await pool.query(
      `DELETE FROM user_device_tokens WHERE user_id = $1 AND device_token = $2`,
      [req.user.id, token]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;

