const safeError = require('../utils/safeError');
const pool = require('../config/db');

// Checks that the authenticated user is an approved partner.
// Falls back to DB query so tokens issued before approval still work.
const partnerOnly = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    // Fast path: JWT already carries the flag
    if (req.user.is_partner) return next();

    // Slow path: token pre-dates approval (or pre-dates partner_id being embedded
    // in the JWT at all) — check DB and backfill both onto req.user for this request
    const result = await pool.query(
      'SELECT is_partner, partner_id FROM users WHERE id=$1',
      [req.user.id]
    );
    if (result.rows[0]?.is_partner) {
      req.user.is_partner = true;
      req.user.partner_id = result.rows[0].partner_id || null;
      return next();
    }

    return res.status(403).json({ message: 'Partner access required. Apply at /wholesale.' });
  } catch (err) {
    return res.status(500).json(safeError(err));
  }
};

module.exports = partnerOnly;

