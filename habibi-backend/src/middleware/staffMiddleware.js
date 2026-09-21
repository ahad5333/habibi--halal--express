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

// Checks a staff id + token and re-reads the account's role and active status.
// Returns the staff row, or null for anything that must be refused. Shared by
// the REST middleware below and the socket's join_kitchen, so the two can never
// disagree about who is signed in.
async function verifyStaff(staffId, token) {
  // A non-numeric id used to reach the query and fail as a 500; it is simply
  // not a staff member.
  if (!/^\d+$/.test(String(staffId ?? '')) || typeof token !== 'string' || !token) return null;

  // session_epoch has to be fetched before the HMAC can be verified (it's
  // mixed into the signed payload -- see staffAuthController.js's
  // staffToken()), so this single query does both the epoch lookup and the
  // role/active re-check together.
  const result = await pool.query(
    'SELECT id, name, role, is_active, session_epoch FROM staff_members WHERE id=$1',
    [staffId]
  );
  if (!result.rows.length) return null;
  const staff = result.rows[0];

  const salt = getDriverSecretSalt();
  const expected = crypto.createHmac('sha256', salt).update(`${staffId}:${staff.session_epoch}`).digest('hex');
  // Compare byte lengths, not string lengths: a token with multi-byte
  // characters could match in .length and still make timingSafeEqual throw.
  const given = Buffer.from(token), want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;

  if (!staff.is_active || !ALLOWED_ROLES.has(staff.role)) return null;
  return staff;
}

async function staffAuth(req, res, next) {
  try {
    const staffId = req.headers['x-staff-id'] || req.body?.staff_id || req.query?.staff_id;
    const token = req.headers['x-staff-token'] || '';
    const staff = await verifyStaff(staffId, token);
    if (!staff) {
      return res.status(401).json({ message: 'Staff authentication required' });
    }

    req.staffId = staff.id;
    req.staffRole = staff.role;
    req.staffName = staff.name;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Authentication error' });
  }
}

module.exports = staffAuth;
module.exports.ALLOWED_ROLES = ALLOWED_ROLES;
module.exports.verifyStaff = verifyStaff;
