const express   = require('express');
const router    = express.Router();
const pool      = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const safeError = require('../utils/safeError');

// Derive user ID from referral code (HAB00042 → 42)
function codeToUserId(code) {
  const match = /^HAB(\d{5})$/i.exec((code || '').trim().toUpperCase());
  if (!match) return null;
  return parseInt(match[1], 10);
}

function userIdToCode(id) {
  return `HAB${String(id).padStart(5, '0')}`;
}

// GET /api/referrals/me — authenticated user's referral code + stats + history
router.get('/me', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const code   = userIdToCode(userId);

    const statsRes = await pool.query(
      `SELECT
         COUNT(*)                              AS total_invited,
         COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
         COALESCE(SUM(points_awarded), 0)     AS total_points
       FROM referrals WHERE referrer_id = $1`,
      [userId]
    );

    const historyRes = await pool.query(
      `SELECT r.referee_email, r.status, r.points_awarded, r.created_at, r.completed_at,
              u.name AS referee_name
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referee_user_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [userId]
    );

    // Check if this user was themselves referred (has an applied referral)
    const myReferralRes = await pool.query(
      `SELECT r.referral_code, u.name AS referrer_name
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referrer_id
       WHERE r.referee_user_id = $1
       LIMIT 1`,
      [userId]
    );

    const s = statsRes.rows[0];
    res.json({
      code,
      stats: {
        total_invited:   parseInt(s.total_invited),
        total_completed: parseInt(s.total_completed),
        total_points:    parseInt(s.total_points),
      },
      referrals:    historyRes.rows,
      my_referral:  myReferralRes.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// POST /api/referrals/apply — authenticated user applies someone else's referral code
router.post('/apply', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required.' });

    const referrerId = codeToUserId(code);
    if (!referrerId) return res.status(400).json({ error: 'Invalid referral code format.' });

    const userId = req.user.id;
    if (referrerId === userId) {
      return res.status(400).json({ error: "You can't use your own referral code." });
    }

    // Check referrer exists
    const refRes = await pool.query('SELECT id, name FROM users WHERE id = $1', [referrerId]);
    if (refRes.rows.length === 0) {
      return res.status(404).json({ error: 'Referral code not found.' });
    }

    // Check this user hasn't already applied a code
    const already = await pool.query(
      'SELECT id FROM referrals WHERE referee_user_id = $1 LIMIT 1',
      [userId]
    );
    if (already.rows.length > 0) {
      return res.status(409).json({ error: 'You have already applied a referral code.' });
    }

    // Check referrer hasn't already referred this user
    const dup = await pool.query(
      'SELECT id FROM referrals WHERE referrer_id = $1 AND referee_user_id = $2 LIMIT 1',
      [referrerId, userId]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'You have already been referred by this person.' });
    }

    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email   = userRes.rows[0]?.email;

    await pool.query(
      `INSERT INTO referrals (referrer_id, referee_email, referee_user_id, status, referral_code)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [referrerId, email, userId, code.toUpperCase()]
    );

    res.json({ ok: true, referrer_name: refRes.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;
