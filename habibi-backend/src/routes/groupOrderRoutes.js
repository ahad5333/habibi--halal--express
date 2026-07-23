const express  = require('express');
const router   = express.Router();
const pool     = require('../config/db');
const crypto   = require('crypto');
const safeError = require('../utils/safeError');
const { protect } = require('../middleware/authMiddleware');

function genSessionId() {
  return 'grp_' + crypto.randomBytes(8).toString('hex'); // 8 bytes = 64-bit entropy
}

function genJoinCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function getFullSession(sessionId) {
  const [sessRes, partRes, itemRes] = await Promise.all([
    pool.query(
      'SELECT session_id, join_code, host_name, status, expires_at, created_at FROM group_order_sessions WHERE session_id = $1',
      [sessionId]
    ),
    pool.query(
      'SELECT session_id, participant_id, name, is_host, joined_at FROM group_order_participants WHERE session_id = $1 ORDER BY is_host DESC, joined_at ASC',
      [sessionId]
    ),
    pool.query(
      'SELECT id, session_id, participant_id, menu_item_id, name, price, qty, note, details, added_at FROM group_order_items WHERE session_id = $1 ORDER BY participant_id, added_at ASC',
      [sessionId]
    ),
  ]);
  if (sessRes.rows.length === 0) return null;
  return { ...sessRes.rows[0], participants: partRes.rows, items: itemRes.rows };
}

// POST /api/group-orders — create a new session (authenticated host)
router.post('/', protect, async (req, res) => {
  try {
    const { host_name = 'Host' } = req.body;
    const session_id = genSessionId();
    const join_code  = genJoinCode();
    const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO group_order_sessions (session_id, join_code, host_name, host_user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session_id, join_code, host_name.slice(0, 100), req.user.id, expires_at]
    );
    res.json({ session_id, join_code, expires_at });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// POST /api/group-orders/join — join by 6-char code (no auth required for guests)
router.post('/join', async (req, res) => {
  try {
    const { join_code, participant_id, name } = req.body;
    if (!join_code || !participant_id || !name) {
      return res.status(400).json({ error: 'join_code, participant_id, and name are required.' });
    }

    const sessRes = await pool.query(
      `SELECT session_id, expires_at FROM group_order_sessions
       WHERE UPPER(join_code) = UPPER($1) AND status = 'open'`,
      [join_code.trim()]
    );
    if (sessRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invite code.' });
    }
    const sess = sessRes.rows[0];
    if (new Date(sess.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Session has expired.' });
    }

    await pool.query(
      `INSERT INTO group_order_participants (session_id, participant_id, name, is_host)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (session_id, participant_id) DO UPDATE SET name = EXCLUDED.name`,
      [sess.session_id, participant_id, name.slice(0, 100)]
    );

    const data = await getFullSession(sess.session_id);
    const io = req.app.get('io');
    if (io) io.to(`group_${sess.session_id}`).emit('group_update', data);

    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// GET /api/group-orders/:sessionId — fetch full session state
router.get('/:sessionId', async (req, res) => {
  try {
    const data = await getFullSession(req.params.sessionId);
    if (!data) return res.status(404).json({ error: 'Session not found.' });
    if (new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Session has expired.' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// POST /api/group-orders/:sessionId/participants — register host as participant (authenticated)
router.post('/:sessionId/participants', protect, async (req, res) => {
  try {
    const { participant_id, name } = req.body;
    if (!participant_id || !name) {
      return res.status(400).json({ error: 'participant_id and name are required.' });
    }

    const sessRes = await pool.query(
      `SELECT status, host_user_id FROM group_order_sessions WHERE session_id = $1`,
      [req.params.sessionId]
    );
    if (sessRes.rows.length === 0) return res.status(404).json({ error: 'Session not found.' });

    const isHost = sessRes.rows[0].host_user_id === req.user.id;

    await pool.query(
      `INSERT INTO group_order_participants (session_id, participant_id, name, is_host)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, participant_id) DO UPDATE SET name = EXCLUDED.name`,
      [req.params.sessionId, participant_id, name.slice(0, 100), isHost]
    );

    const data = await getFullSession(req.params.sessionId);
    const io = req.app.get('io');
    if (io) io.to(`group_${req.params.sessionId}`).emit('group_update', data);

    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// POST /api/group-orders/:sessionId/items — sync cart items for a participant
router.post('/:sessionId/items', async (req, res) => {
  try {
    const { participant_id, items } = req.body;
    if (!participant_id || !Array.isArray(items)) {
      return res.status(400).json({ error: 'participant_id and items[] are required.' });
    }

    const sessRes = await pool.query(
      `SELECT status, expires_at FROM group_order_sessions WHERE session_id = $1`,
      [req.params.sessionId]
    );
    if (sessRes.rows.length === 0 || sessRes.rows[0].status !== 'open') {
      return res.status(404).json({ error: 'Session not found or locked.' });
    }
    if (new Date(sessRes.rows[0].expires_at) < new Date()) {
      return res.status(410).json({ error: 'Session has expired.' });
    }

    // Verify participant belongs to this session before allowing item updates
    const partRes = await pool.query(
      `SELECT participant_id FROM group_order_participants WHERE session_id = $1 AND participant_id = $2`,
      [req.params.sessionId, participant_id]
    );
    if (partRes.rows.length === 0) {
      return res.status(403).json({ error: 'Not a participant in this session.' });
    }

    // Look up real menu prices so a participant can't submit an under-priced
    // item — checkout's own re-validation can't fully catch this for group
    // orders since addon/choice selections aren't carried through to it, so
    // this is the only place that can check against the true base price.
    const menuIds = items
      .slice(0, 50)
      .map(i => parseInt(i.menu_item_id, 10))
      .filter(id => Number.isInteger(id) && id > 0);
    let menuPriceMap = {};
    if (menuIds.length) {
      const menuRows = await pool.query(`SELECT id, price FROM menus WHERE id = ANY($1)`, [menuIds]);
      menuPriceMap = Object.fromEntries(menuRows.rows.map(r => [r.id, parseFloat(r.price)]));
    }
    for (const item of items.slice(0, 50)) {
      const menuId = parseInt(item.menu_item_id, 10);
      if (Number.isInteger(menuId) && menuId > 0 && menuPriceMap[menuId] != null) {
        const submitted = parseFloat(item.price) || 0;
        if (submitted < menuPriceMap[menuId] - 0.02) {
          return res.status(400).json({ error: `"${item.name}" price is lower than expected. Please refresh and re-add it.` });
        }
      }
    }

    await pool.query(
      `DELETE FROM group_order_items WHERE session_id = $1 AND participant_id = $2`,
      [req.params.sessionId, participant_id]
    );

    for (const item of items.slice(0, 50)) {
      await pool.query(
        `INSERT INTO group_order_items (session_id, participant_id, menu_item_id, name, price, qty, note, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.params.sessionId,
          participant_id,
          item.menu_item_id || null,
          String(item.name).slice(0, 200),
          parseFloat(item.price) || 0,
          Math.max(1, parseInt(item.qty) || 1),
          item.note ? String(item.note).slice(0, 500) : null,
          item.details ? JSON.stringify(item.details) : null,
        ]
      );
    }

    const data = await getFullSession(req.params.sessionId);
    const io = req.app.get('io');
    if (io) io.to(`group_${req.params.sessionId}`).emit('group_update', data);

    res.json(data);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// DELETE /api/group-orders/:sessionId — close session (host only)
router.delete('/:sessionId', protect, async (req, res) => {
  try {
    const sessRes = await pool.query(
      `SELECT host_user_id FROM group_order_sessions WHERE session_id = $1`,
      [req.params.sessionId]
    );
    if (sessRes.rows.length === 0) return res.status(404).json({ error: 'Session not found.' });
    if (sessRes.rows[0].host_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can close this session.' });
    }

    await pool.query(
      `UPDATE group_order_sessions SET status = 'closed' WHERE session_id = $1`,
      [req.params.sessionId]
    );
    const io = req.app.get('io');
    if (io) io.to(`group_${req.params.sessionId}`).emit('group_closed', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;
