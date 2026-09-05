const crypto = require('crypto');
const pool = require('../config/db');
const { getDriverSecretSalt } = require('../utils/driverSecret');

// Non-delivery staff roles (kitchen/manager/cashier/server) authenticate with
// an HMAC token, same shape as the driver app's X-Driver-Token. Deliberately
// does NOT reuse dispatchRoutes.js's driverOrAdmin -- that middleware only
// verifies the HMAC matches the id, trusting that driver-only routes are
// further scoped by real assignment ownership elsewhere. The kitchen-queue
// routes this guards have no such secondary scoping (they're role-gated, not
// per-owner-scoped), so the role/active check has to live here, re-queried
// on every request -- a staff account deactivated mid-session stops working
// immediately, not just at next login.
const ALLOWED_ROLES = new Set(['kitchen', 'manager', 'cashier', 'server']);

async function staffAuth(req, res, next) {
  try {
    const staffId = req.headers['x-staff-id'] || req.body?.staff_id || req.query?.staff_id;
    const token = req.headers['x-staff-token'] || '';
    if (!staffId || !token) {
      return res.status(401).json({ message: 'Staff authentication required' });
    }

    const salt = getDriverSecretSalt();
    const expected = crypto.createHmac('sha256', salt).update(String(staffId)).digest('hex');
    if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(401).json({ message: 'Staff authentication required' });
    }

    const result = await pool.query(
      'SELECT id, name, role FROM staff_members WHERE id=$1 AND is_active=TRUE',
      [staffId]
    );
    if (!result.rows.length || !ALLOWED_ROLES.has(result.rows[0].role)) {
      return res.status(401).json({ message: 'Staff authentication required' });
    }

    req.staffId = result.rows[0].id;
    req.staffRole = result.rows[0].role;
    req.staffName = result.rows[0].name;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Authentication error' });
  }
}

module.exports = staffAuth;
module.exports.ALLOWED_ROLES = ALLOWED_ROLES;
