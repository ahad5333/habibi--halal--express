// Phone sign-in (customer app): text a 6-digit code, then sign in -- or create
// the account -- once it is right. One flow for new and returning customers,
// like Uber Eats / DoorDash; no password to remember.
//
// Rules that matter:
//  - Codes live in phone_login_codes, never on a user row, so no account
//    exists until the number is proven (unverified rows are purged nightly).
//  - Only numbers proven by a code (users.phone_verified) can sign in. A number
//    typed into a profile could be a typo or someone else's.
//  - Customers only. Panel/business/partner roles keep password + email MFA.
//  - Same reply whether or not the number has an account (no enumeration).
//  - Text messages cost money and attract SMS-pumping fraud: 60 s between
//    codes, 5 per number per day, a site-wide hourly brake, plus IP limiters.
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const safeError = require('../utils/safeError');
const { sendSMS } = require('../services/smsService');

const CODE_TTL_MIN = 10;
const RESEND_SECONDS = 60;
const MAX_SENDS_PER_DAY = 5;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR_ALL = 200;
const APP_SESSION = '30d';

// US numbers only: 10 digits (or 11 starting with 1); area codes never start with 0 or 1.
function phone10(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 && !/^[01]/.test(d) ? d : null;
}

const PHONE10_SQL = `right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10)`;

function appToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: APP_SESSION }
  );
}

// Sign-up tickets get their own key so one can never pass as a session token.
const ticketSecret = () => `${process.env.JWT_SECRET}:phone-signup-ticket`;

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone_number || null });

// Sends a code; used by sign-in and by passwordless account deletion.
// Returns null when sent, else { status, message }.
async function sendCode(phone) {
  const busy = await pool.query(
    `SELECT count(*)::int AS n FROM phone_login_codes WHERE last_sent_at > NOW() - interval '1 hour'`
  );
  if (busy.rows[0].n >= MAX_SENDS_PER_HOUR_ALL) {
    console.error('[phone-auth] hourly text brake hit -- possible SMS pumping');
    return { status: 503, message: 'We can’t send codes right now. Please try again in a few minutes.' };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const hash = await bcrypt.hash(code, 10);
  // One statement so two quick taps can't both pass the limits.
  const r = await pool.query(
    `INSERT INTO phone_login_codes (phone, code_hash, expires_at, attempts, last_sent_at, sent_day, sent_count)
     VALUES ($1, $2, NOW() + make_interval(mins => $3), 0, NOW(), CURRENT_DATE, 1)
     ON CONFLICT (phone) DO UPDATE SET
       code_hash    = EXCLUDED.code_hash,
       expires_at   = EXCLUDED.expires_at,
       attempts     = 0,
       last_sent_at = NOW(),
       sent_count   = CASE WHEN phone_login_codes.sent_day = CURRENT_DATE THEN phone_login_codes.sent_count + 1 ELSE 1 END,
       sent_day     = CURRENT_DATE
     WHERE (phone_login_codes.last_sent_at IS NULL OR phone_login_codes.last_sent_at < NOW() - make_interval(secs => $4))
       AND (phone_login_codes.sent_day IS DISTINCT FROM CURRENT_DATE OR phone_login_codes.sent_count < $5)
     RETURNING phone`,
    [phone, hash, CODE_TTL_MIN, RESEND_SECONDS, MAX_SENDS_PER_DAY]
  );
  if (!r.rowCount) {
    const row = (await pool.query(`SELECT last_sent_at FROM phone_login_codes WHERE phone = $1`, [phone])).rows[0];
    const recent = row?.last_sent_at && Date.now() - new Date(row.last_sent_at).getTime() < RESEND_SECONDS * 1000;
    return { status: 429, message: recent
      ? 'We just sent a code. Please wait a minute before asking for another.'
      : 'Too many codes for this number today. Please try again tomorrow or sign in another way.' };
  }

  try {
    await sendSMS(`+1${phone}`, `Your Habibi code is ${code}. It expires in ${CODE_TTL_MIN} minutes. Don't share it with anyone.`);
  } catch (e) {
    console.error('[phone-auth] SMS send failed:', e.message);
    await pool.query(`UPDATE phone_login_codes SET code_hash = NULL WHERE phone = $1`, [phone]);
    return { status: 502, message: 'We couldn’t send the text. Check the number and try again.' };
  }
  return null;
}

// Checks and uses up a code. Returns true only once per code.
async function useCode(phone, code) {
  const r = await pool.query(
    `UPDATE phone_login_codes SET attempts = attempts + 1
      WHERE phone = $1 AND code_hash IS NOT NULL AND expires_at > NOW() AND attempts < $2
      RETURNING code_hash`,
    [phone, MAX_ATTEMPTS]
  );
  if (!r.rowCount) return { ok: false, message: 'That code has expired or had too many tries. Ask for a new one.' };
  const hash = r.rows[0].code_hash;
  if (!(await bcrypt.compare(code, hash))) return { ok: false, message: 'Incorrect code. Please try again.' };
  // Single use: only the request that clears this exact hash wins a race.
  const used = await pool.query(
    `UPDATE phone_login_codes SET code_hash = NULL, attempts = 0 WHERE phone = $1 AND code_hash = $2`,
    [phone, hash]
  );
  return used.rowCount ? { ok: true } : { ok: false, message: 'That code was already used. Ask for a new one.' };
}

/* POST /api/auth/phone/start  { phone } */
const startPhoneLogin = async (req, res) => {
  try {
    const phone = phone10(req.body?.phone);
    if (!phone) return res.status(400).json({ message: 'Enter a 10-digit US mobile number.' });
    const err = await sendCode(phone);
    if (err) return res.status(err.status).json({ message: err.message });
    res.json({ sent: true, phone, expires_in_minutes: CODE_TTL_MIN });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* POST /api/auth/phone/verify  { phone, code }
   -> { token, user }                      returning customer
   -> { new_user: true, signup_ticket }     no account yet: ask for a name */
const verifyPhoneLogin = async (req, res) => {
  try {
    const phone = phone10(req.body?.phone);
    const code = String(req.body?.code || '');
    if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the 6-digit code we texted you.' });

    const check = await useCode(phone, code);
    if (!check.ok) return res.status(400).json({ message: check.message });

    const rows = (await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id, is_active, phone_verified, email_verified, phone_number
         FROM users WHERE phone_number IS NOT NULL AND phone_number <> '' AND ${PHONE10_SQL} = $1`,
      [phone]
    )).rows;

    let user = rows.find(u => u.phone_verified);
    if (!user) {
      // Signed up by phone on the old form but never entered the code: the
      // account's only identifier is this number, so proving it is enough.
      const pending = rows.filter(u => !u.email_verified && /^phone_\d+@habibi\.internal$/.test(u.email || ''));
      if (pending.length === 1 && rows.length === 1) {
        user = pending[0];
        await pool.query(`UPDATE users SET phone_verified = TRUE, email_verified = TRUE, sms_code_hash = NULL WHERE id = $1`, [user.id]);
      } else if (rows.length) {
        // The number is typed on an email account but never confirmed. Don't
        // guess -- it may be a typo -- and don't make a duplicate account.
        return res.status(409).json({
          code: 'PHONE_ON_UNCONFIRMED_ACCOUNT',
          message: 'This number is on an account that signs in with email, Google or Apple. Please sign in that way.',
        });
      }
    }

    if (!user) {
      const signup_ticket = jwt.sign({ phone, purpose: 'phone_signup' }, ticketSecret(), { expiresIn: '15m' });
      return res.json({ new_user: true, signup_ticket });
    }
    if (user.role !== 'customer' || user.is_active === false) {
      return res.status(403).json({ message: 'This number can’t be used to sign in to the app. Please sign in with your email.' });
    }
    res.json({ token: appToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* POST /api/auth/phone/complete  { signup_ticket, name, agree_terms, sms_consent } */
const completePhoneSignup = async (req, res) => {
  try {
    let ticket;
    try { ticket = jwt.verify(String(req.body?.signup_ticket || ''), ticketSecret()); } catch { ticket = null; }
    const phone = ticket?.purpose === 'phone_signup' ? phone10(ticket.phone) : null;
    if (!phone) return res.status(400).json({ message: 'This sign-up has expired. Please start again.' });

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ message: 'Please enter your name.' });
    if (name.length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer.' });
    if (req.body?.agree_terms !== true) {
      return res.status(400).json({ message: 'Please agree to the Terms of Service and Privacy Policy.' });
    }

    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12); // never used: no password sign-in
    try {
      const user = (await pool.query(
        `INSERT INTO users (name, email, password_hash, phone_number, email_verified, phone_verified, receive_sms_updates, password_set)
         VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, FALSE)
         RETURNING id, name, email, role, is_partner, partner_id, phone_number`,
        [name, `phone_${phone}@habibi.internal`, passwordHash, phone, req.body?.sms_consent === true]
      )).rows[0];
      res.status(201).json({ token: appToken(user), user: publicUser(user) });
    } catch (e) {
      // Unique email / verified-phone index: the ticket was already used.
      if (e.code === '23505') return res.status(409).json({ message: 'An account with this number already exists. Please sign in with it.' });
      throw e;
    }
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = { startPhoneLogin, verifyPhoneLogin, completePhoneSignup, phone10, sendCode, useCode, APP_SESSION };
