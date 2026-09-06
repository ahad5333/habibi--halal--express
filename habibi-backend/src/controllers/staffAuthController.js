const crypto = require('crypto');
const bcrypt = require('bcrypt');
const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { sendSMS, toE164 } = require('../services/smsService');
const { getDriverSecretSalt } = require('../utils/driverSecret');

// Non-delivery roster roles get their own PIN login here -- delivery (drivers)
// keeps its existing, untouched flow in dispatchController.js. Reuses the same
// staff_members.driver_pin_* columns and the same HMAC-signing salt (it's a
// generic staff_members auth secret in practice, not literally driver-only in
// meaning) -- just scoped to a different set of roles and a separate token
// header (X-Staff-Token, verified with role+active re-checked on every
// request by staffMiddleware.js, unlike driverOrAdmin which only verifies the
// HMAC -- safe there only because driver-only routes are further scoped by
// real assignment ownership; this auth surface has no such secondary check,
// so the role/active re-verification has to live in the token check itself).
const STAFF_ROLES = ['kitchen', 'manager', 'cashier', 'server'];

// epoch is staff_members.session_epoch -- mixed into the signed payload so
// admin's "Sign Out All Devices" action (bump the epoch) invalidates every
// token issued under the old epoch, without a full salt rotation that would
// log out every other staff member too.
function staffToken(staff_id, epoch) {
  const salt = getDriverSecretSalt();
  return crypto.createHmac('sha256', salt).update(`${staff_id}:${epoch}`).digest('hex');
}

const staffLogin = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ message: 'Phone and PIN are required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });

    const normalizedPhone = toE164(String(phone).trim());
    const result = await pool.query(
      `SELECT id, name, phone, role, is_active, driver_pin_hash, driver_pin_attempts, driver_pin_lockout_until, session_epoch
       FROM staff_members WHERE phone=$1 AND role = ANY($2) AND is_active=TRUE`,
      [normalizedPhone, STAFF_ROLES]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'No active staff account found for this number.' });
    }
    const staff = result.rows[0];

    if (!staff.driver_pin_hash) {
      return res.status(403).json({ message: 'PIN not set up yet. Ask your admin to send you a setup link.', needsSetup: true });
    }

    if (staff.driver_pin_lockout_until && new Date(staff.driver_pin_lockout_until) > new Date()) {
      const mins = Math.ceil((new Date(staff.driver_pin_lockout_until) - Date.now()) / 60000);
      return res.status(429).json({ message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
    }

    const valid = await bcrypt.compare(String(pin), staff.driver_pin_hash);
    if (!valid) {
      const attempts = (staff.driver_pin_attempts || 0) + 1;
      const lockout  = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        'UPDATE staff_members SET driver_pin_attempts=$1, driver_pin_lockout_until=$2 WHERE id=$3',
        [attempts, lockout, staff.id]
      );
      const remaining = Math.max(0, 5 - attempts);
      return res.status(401).json({ message: `Incorrect PIN.${remaining > 0 ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : ' Account locked for 15 minutes.'}` });
    }

    await pool.query('UPDATE staff_members SET driver_pin_attempts=0, driver_pin_lockout_until=NULL WHERE id=$1', [staff.id]);
    const token = staffToken(staff.id, staff.session_epoch);
    res.json({ staff_id: staff.id, token, name: staff.name, role: staff.role });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const staffSetPin = async (req, res) => {
  try {
    const { staff_id, pin, confirm_pin } = req.body;
    if (!staff_id || !pin) return res.status(400).json({ message: 'Staff ID and PIN are required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    if (pin !== confirm_pin) return res.status(400).json({ message: 'PINs do not match.' });

    const hash = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      `UPDATE staff_members SET driver_pin_hash=$1, driver_pin_attempts=0, driver_pin_lockout_until=NULL
       WHERE id=$2 AND role = ANY($3) AND is_active=TRUE RETURNING id, name`,
      [hash, staff_id, STAFF_ROLES]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Staff account not found.' });
    res.json({ ok: true, name: result.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin-facing direct PIN reset, mirrors dispatchController.js's
// adminResetDriverPin exactly but scoped to STAFF_ROLES instead of
// 'delivery' -- kept as a separate endpoint rather than widening the
// driver one, so the driver code path stays untouched.
const adminResetStaffPin = async (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required.' });
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    const hash = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      `UPDATE staff_members SET driver_pin_hash=$1, driver_pin_attempts=0, driver_pin_lockout_until=NULL
       WHERE id=$2 AND role = ANY($3) RETURNING id, name`,
      [hash, id, STAFF_ROLES]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Staff member not found.' });
    res.json({ ok: true, name: result.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const sendStaffSetupSms = async (req, res) => {
  try {
    const { staff_id } = req.body;
    const result = await pool.query(
      'SELECT id, name, phone, session_epoch FROM staff_members WHERE id=$1 AND role = ANY($2) AND is_active=TRUE',
      [staff_id, STAFF_ROLES]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Staff account not found.' });
    const staff = result.rows[0];
    if (!staff.phone) return res.status(400).json({ message: 'Staff member has no phone number on file.' });

    const token = staffToken(staff.id, staff.session_epoch);
    const base  = process.env.FRONTEND_URL || 'https://habibihe.com';
    const url   = `${base}/staff/set-pin?id=${staff.id}&token=${token}`;
    await sendSMS(staff.phone, `Hi ${staff.name}! Set up your Habibi staff PIN to log in anytime: ${url}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin-facing: invalidate every currently-issued session token for this
// staff member (lost/stolen phone, offboarding, etc.) without touching their
// PIN or anyone else's session -- see staffToken()'s epoch comment above.
const signOutStaffEverywhere = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE staff_members SET session_epoch = session_epoch + 1
       WHERE id=$1 AND role = ANY($2) RETURNING id, name`,
      [id, STAFF_ROLES]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Staff member not found.' });
    res.json({ ok: true, name: result.rows[0].name });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Saves this session's push token -- staffAuth has already verified the
// caller, so req.staffId is trusted (not read from the body).
const saveStaffFcmToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) return res.status(400).json({ message: 'fcm_token is required.' });
    await pool.query('UPDATE staff_members SET driver_fcm_token=$1 WHERE id=$2', [fcm_token, req.staffId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  STAFF_ROLES, staffToken, staffLogin, staffSetPin, sendStaffSetupSms,
  adminResetStaffPin, signOutStaffEverywhere, saveStaffFcmToken,
};
