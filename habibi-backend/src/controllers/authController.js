const safeError = require('../utils/safeError');
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailService = require("../services/emailService");
const { sendAdminOTP } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');
const { ALLOWED_ROLES: PRIVILEGED_ROLES } = require('../middleware/adminMiddleware');

function setAuthCookie(res, token, maxAgeMs) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: maxAgeMs,
  });
}

const registerUser = async (req, res) => {
  try {
    const { name, password, dob, first_name, last_name, sms_consent } = req.body;
    let { email, phone } = req.body;
    // receive_sms_updates defaults to TRUE at the DB level, so an explicit
    // opt-in check is required here — otherwise unchecking the "I consent to
    // SMS" box at signup silently has no effect and the account stays
    // opted-in to broadcast texts regardless of what the user chose.
    const smsConsentValue = sms_consent === true || sms_consent === 'true';

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required.' });
    }
    if (name.length > 100) {
      return res.status(400).json({ message: 'Name too long.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one number.' });
    }

    // If user typed a phone number into the email field, move it to phone
    const emailVal = email ? String(email).trim() : '';
    const looksLikePhone = emailVal && /^\+?[\d\s\-(). ]{7,20}$/.test(emailVal) && !emailVal.includes('@');
    if (looksLikePhone) {
      phone = phone || emailVal;
      email = '';
    }

    const isPhoneSignup = !email || !String(email).trim();

    if (isPhoneSignup) {
      // Phone-only path: require phone, generate a placeholder email
      if (!phone || !String(phone).trim()) {
        return res.status(400).json({ message: 'Either email or phone number is required.' });
      }
      const cleaned = String(phone).replace(/\D/g, '');
      if (cleaned.length < 7 || cleaned.length > 15) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }
      // Check phone not already in use
      const phoneExists = await pool.query(
        'SELECT id FROM users WHERE phone_number=$1 OR phone_number=$2',
        [String(phone).trim(), cleaned]
      );
      if (phoneExists.rows.length > 0) {
        return res.status(400).json({ message: 'An account with those details already exists.' });
      }
      email = `phone_${cleaned}@habibi.internal`;
    } else {
      email = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email address.' });
      }
      const existingUser = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'An account with those details already exists.' });
      }
      // Also check phone not already used by another account
      if (phone && String(phone).trim()) {
        const cleanedPhone = String(phone).trim().replace(/\D/g, '');
        const phoneExists = await pool.query(
          'SELECT id FROM users WHERE phone_number=$1 OR phone_number=$2',
          [String(phone).trim(), cleanedPhone]
        );
        if (phoneExists.rows.length > 0) {
          return res.status(400).json({ message: 'An account with this phone number is already registered.' });
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const dobValue = dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
    const phoneValue = phone ? String(phone).trim().slice(0, 20) : null;
    const frontendUrl = process.env.FRONTEND_URL || 'https://habibihe.com';

    if (!isPhoneSignup) {
      // Email signup — create unverified account, send verification link
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await pool.query(
        `INSERT INTO users(name, email, password_hash, phone_number, date_of_birth, email_verified, verification_token, verification_token_expires, receive_sms_updates)
         VALUES($1,$2,$3,$4,$5,FALSE,$6,$7,$8)`,
        [name, email, hashedPassword, phoneValue, dobValue, verificationToken, verificationExpires, smsConsentValue]
      );

      const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
      emailService.sendEmailVerification(email, name, verifyUrl).catch(err => {
        console.error('Failed to send verification email:', err.message);
      });

      return res.status(201).json({ requiresVerification: true });
    } else {
      // Phone signup — create account, send 6-digit OTP via Twilio
      const otp = String(crypto.randomInt(100000, 1000000));
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      const otpHash = await bcrypt.hash(otp, 10);

      await pool.query(
        `INSERT INTO users(name, email, password_hash, phone_number, date_of_birth, email_verified, sms_code_hash, sms_code_expires, sms_code_attempts, receive_sms_updates)
         VALUES($1,$2,$3,$4,$5,FALSE,$6,$7,0,$8)`,
        [name, email, hashedPassword, phoneValue, dobValue, otpHash, otpExpires, smsConsentValue]
      );

      sendSMS(phoneValue, `Your Habibi verification code is: ${otp}. It expires in 10 minutes. Do not share it.`).catch(err => {
        console.error('Failed to send signup OTP SMS:', err.message);
      });

      return res.status(201).json({ requiresPhoneVerification: true, phone: phoneValue });
    }
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Accept login by email or phone number
    const identifier = (email || '').trim();
    const isPhone = /^\+?[\d\s\-().]{7,20}$/.test(identifier) && !identifier.includes('@');

    const result = await pool.query(
      isPhone
        ? "SELECT * FROM users WHERE phone_number=$1 OR phone_number=$2"
        : "SELECT * FROM users WHERE email=$1",
      isPhone
        ? [identifier, identifier.replace(/\D/g, '')]
        : [identifier]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Brute-force lockout check
    if (user.login_lockout_until && new Date(user.login_lockout_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.login_lockout_until) - new Date()) / 60000
      );
      return res.status(429).json({
        message: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const newAttempts = (user.login_attempts || 0) + 1;
      const LOCK_AFTER  = 10;
      const LOCK_MINS   = 15;
      if (newAttempts >= LOCK_AFTER) {
        const lockUntil = new Date(Date.now() + LOCK_MINS * 60 * 1000);
        await pool.query(
          `UPDATE users SET login_attempts=$1, login_lockout_until=$2 WHERE id=$3`,
          [newAttempts, lockUntil, user.id]
        );
        return res.status(429).json({
          message: `Too many failed attempts. Account locked for ${LOCK_MINS} minutes.`,
        });
      }
      await pool.query(
        `UPDATE users SET login_attempts=$1 WHERE id=$2`,
        [newAttempts, user.id]
      );
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Successful login — reset lockout state
    await pool.query(
      `UPDATE users SET login_attempts=0, login_lockout_until=NULL WHERE id=$1`,
      [user.id]
    );

    // Block login for unverified email accounts.
    // Phone accounts (email ends in @habibi.internal) use SMS OTP verification instead.
    if (!user.email_verified && !user.email.endsWith('@habibi.internal')) {
      return res.status(403).json({
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
      });
    }

    // Admin MFA — always enforced regardless of SMTP config, for every
    // privileged role (not just the literal string 'admin' -- 'superadmin'
    // is an equally-or-more privileged role recognized by adminMiddleware.js
    // and was previously falling through to a normal password-only login).
    // If email is not configured the OTP is also printed to server stdout
    // so admins can retrieve it from `pm2 logs` until SendGrid is live.
    if (PRIVILEGED_ROLES.has(user.role)) {
      if (
        user.admin_otp_attempts >= 5 &&
        user.admin_otp_expires &&
        new Date(user.admin_otp_expires) > new Date()
      ) {
        return res.status(429).json({
          message: 'Too many failed MFA attempts. Please wait a few minutes and try again.',
        });
      }
      const otp        = String(crypto.randomInt(100000, 1000000));
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      const otpHash    = await bcrypt.hash(otp, 12);
      await pool.query(
        `UPDATE users SET admin_otp_hash=$1, admin_otp_expires=$2, admin_otp_attempts=0 WHERE id=$3`,
        [otpHash, otpExpires, user.id]
      );
      const smtpConfigured = !!(
        process.env.SENDGRID_API_KEY ||
        (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      );
      // ADMIN_MFA_EMAIL env var lets us redirect OTP to a real inbox temporarily
      // (useful when admin@habibihe.com has no mailbox yet)
      const otpRecipient = process.env.ADMIN_MFA_EMAIL || user.email;
      if (smtpConfigured) {
        sendAdminOTP(otpRecipient, otp).catch(err => console.error('Admin OTP email failed:', err.message));
      } else {
        if (process.env.NODE_ENV === 'production') {
          // Never log OTPs in production — misconfigured email is a fatal condition
          console.error('[ADMIN MFA] FATAL: Email not configured in production. Admin login blocked until SENDGRID_API_KEY or SMTP vars are set.');
          return res.status(503).json({ message: 'Admin login is temporarily unavailable. Contact the system administrator.' });
        }
        console.warn(`[ADMIN MFA] Email not configured. OTP for ${user.email}: ${otp} (expires in 10 min)`);
      }
      // email = DB email used by verify step; sent_to = where the code actually went
      return res.json({ mfa_required: true, email: user.email, sent_to: otpRecipient });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_partner: !!user.is_partner,
        partner_id: user.partner_id || null,
        jti: crypto.randomUUID(),
      },
      process.env.JWT_SECRET,
      { expiresIn: user.role === 'admin' ? '24h' : '1d' }
    );

    // Fetch partner application info if applicable
    let partnerInfo = null;
    if (user.is_partner && user.partner_id) {
      try {
        const pRes = await pool.query(
          'SELECT business_name, price_tier, status FROM partner_applications WHERE id=$1',
          [user.partner_id]
        );
        partnerInfo = pRes.rows[0] || null;
      } catch (_) {}
    }

    // Birthday reward: issue a coupon if today is the user's birthday and reward not yet given this year
    let birthdayCoupon = null;
    if (user.date_of_birth) {
      try {
        const now = new Date();
        const dob = new Date(user.date_of_birth);
        const isBirthday = (dob.getUTCMonth() === now.getMonth()) && (dob.getUTCDate() === now.getDate());
        const currentYear = now.getFullYear();

        if (isBirthday && user.birthday_rewarded_year !== currentYear) {
          const code = `BDAY-${user.id}-${currentYear}`;
          // Coupon valid for 7 days; 30% off (free delivery + 30%) as birthday perk
          const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const expStr = expiryDate.toISOString().slice(0, 10);

          // Upsert so duplicate logins on same birthday are safe
          await pool.query(
            `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expiry_date, customer_email, title, description, is_active)
             VALUES ($1, 'percentage', 30, 0, 1, $2, $3, $4, $5, TRUE)
             ON CONFLICT (code) DO NOTHING`,
            [code, expStr, user.email,
             `Happy Birthday, ${(user.name || '').split(' ')[0] || 'Friend'}!`,
             '30% off your birthday order. Valid for 7 days. Single use only.']
          );

          await pool.query(
            `UPDATE users SET birthday_rewarded_year = $1 WHERE id = $2`,
            [currentYear, user.id]
          );

          birthdayCoupon = {
            code,
            discount_type: 'percentage',
            discount_value: 30,
            expiry_date: expStr,
          };
        }
      } catch (_) {}
    }

    setAuthCookie(res, token, 24 * 60 * 60 * 1000); // 1d
    res.json({
      token,
      user: {
        id: user.id,
        name: user.username || user.name || user.email.split('@')[0],
        email: user.email,
        role: user.role,
        is_partner: !!user.is_partner,
        partner_id: user.partner_id || null,
        business_name: partnerInfo?.business_name || null,
        price_tier: partnerInfo?.price_tier || null,
      },
      birthday_coupon: birthdayCoupon,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── Admin MFA verify ────────────────────────────────────────────────── */
const verifyAdminMfa = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });
    if (!/^\d{6}$/.test(String(otp))) return res.status(400).json({ message: 'OTP must be 6 digits.' });

    const result = await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id,
              admin_otp_hash, admin_otp_expires, admin_otp_attempts
       FROM users WHERE email=$1 AND role = ANY($2)`,
      [email, [...PRIVILEGED_ROLES]]
    );

    // Both "not an admin account" and "no pending MFA session" return the
    // identical generic message -- a differing message here let anyone
    // enumerate real admin email addresses with no password, by submitting
    // arbitrary email/OTP pairs and watching which response came back.
    const GENERIC_INVALID = { message: 'Invalid request.' };
    if (result.rows.length === 0) return res.status(400).json(GENERIC_INVALID);
    const user = result.rows[0];

    if (!user.admin_otp_hash || !user.admin_otp_expires) {
      return res.status(400).json(GENERIC_INVALID);
    }
    if (new Date(user.admin_otp_expires) < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please log in again.' });
    }
    if ((user.admin_otp_attempts || 0) >= 5) {
      return res.status(429).json({ message: 'Too many failed attempts. Please log in again.' });
    }

    const valid = await bcrypt.compare(String(otp), user.admin_otp_hash);
    if (!valid) {
      await pool.query(`UPDATE users SET admin_otp_attempts = admin_otp_attempts + 1 WHERE id=$1`, [user.id]);
      return res.status(400).json({ message: 'Incorrect OTP.' });
    }

    await pool.query(
      `UPDATE users SET admin_otp_hash=NULL, admin_otp_expires=NULL, admin_otp_attempts=0 WHERE id=$1`,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    setAuthCookie(res, token, 24 * 60 * 60 * 1000); // 24h
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── Email verification ─────────────────────────────────────────────── */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Verification token required.' });

    const result = await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id
       FROM users
       WHERE verification_token = $1
         AND verification_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification link. Please sign up again.' });
    }

    const user = result.rows[0];
    await pool.query(
      `UPDATE users SET email_verified=TRUE, verification_token=NULL, verification_token_expires=NULL WHERE id=$1`,
      [user.id]
    );

    emailService.sendSignupWelcome(user.email, user.name).catch(err => {
      console.error('Failed to send welcome email:', err.message);
    });

    const jwtToken = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    setAuthCookie(res, jwtToken, 24 * 60 * 60 * 1000); // 1d
    res.json({
      success: true,
      token: jwtToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, is_partner: !!user.is_partner },
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const result = await pool.query("SELECT id, name, email_verified, is_partner FROM users WHERE email = $1", [email]);
    // Always return the same vague message to prevent email enumeration
    const VAGUE = { message: "If that email exists, a reset link has been sent." };
    if (result.rows.length === 0) return res.json(VAGUE);

    const user = result.rows[0];
    const frontendUrl = process.env.FRONTEND_URL || 'https://habibihe.com';

    // If account was never verified, resend the verification link instead of a reset link.
    // The user cannot have "forgotten" a password they never set up on a verified account.
    if (!user.email_verified) {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        'UPDATE users SET verification_token=$1, verification_token_expires=$2 WHERE id=$3',
        [verificationToken, verificationExpires, user.id]
      );
      const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
      emailService.sendEmailVerification(email, user.name, verifyUrl).catch(err => {
        console.error('Failed to resend verification email:', err.message);
      });
      return res.json(VAGUE);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Store the hash — raw token only ever lives in the email link, never in the DB
    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
      [tokenHash, expires, email]
    );

    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    if (user.is_partner) {
      emailService.sendPartnerPasswordReset(email, resetUrl).catch(err => {
        console.error('Failed to send partner password reset email:', err.message);
      });
    } else {
      emailService.sendPasswordReset(email, resetUrl).catch(err => {
        console.error('Failed to send password reset email:', err.message);
      });
    }

    if (process.env.NODE_ENV?.toLowerCase() !== 'production') {
      console.log('[DEV] Password reset URL:', resetUrl);
    }
    res.json(VAGUE);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (!/[0-9]/.test(password)) return res.status(400).json({ message: "Password must contain at least one number." });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hashedPassword, result.rows[0].id]
    );

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── SMS 5-digit recovery code ──────────────────────────────────────── */
const sendSmsRecoveryCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      return res.status(400).json({ message: 'Invalid phone number.' });
    }

    const result = await pool.query(
      `SELECT id, name, sms_code_expires FROM users WHERE phone_number = $1 OR phone_number = $2`,
      [cleaned, `+1${cleaned.slice(-10)}`]
    );
    // Always respond success to avoid user enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If that number is on file, a code has been sent.' });
    }

    const user = result.rows[0];

    // Rate-limit: don't send a new code if a valid one was sent < 60s ago
    if (user.sms_code_expires && new Date(user.sms_code_expires) > new Date(Date.now() + 9 * 60 * 1000)) {
      return res.status(429).json({ message: 'A code was recently sent. Please wait before requesting another.' });
    }

    const code    = String(crypto.randomInt(10000, 100000)); // cryptographically secure 5 digits
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const hash    = await bcrypt.hash(code, 10); // OTP: 10 is fine — short-lived

    await pool.query(
      `UPDATE users SET sms_code_hash=$1, sms_code_expires=$2, sms_code_attempts=0 WHERE id=$3`,
      [hash, expires, user.id]
    );

    await sendSMS(phone.trim(), `Your Habibi account recovery code is: ${code}. It expires in 10 minutes. Do not share it.`);

    res.json({ message: 'If that number is on file, a code has been sent.' });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const verifySmsRecoveryCode = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ message: 'Phone and code are required.' });
    }
    if (!/^\d{5}$/.test(String(code))) {
      return res.status(400).json({ message: 'Code must be exactly 5 digits.' });
    }

    const cleaned = phone.replace(/\D/g, '');
    const result  = await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id, sms_code_hash, sms_code_expires, sms_code_attempts
       FROM users WHERE phone_number = $1 OR phone_number = $2`,
      [cleaned, `+1${cleaned.slice(-10)}`]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid phone number or code.' });
    }

    const user = result.rows[0];

    if (!user.sms_code_hash || !user.sms_code_expires) {
      return res.status(400).json({ message: 'No recovery code found. Please request a new one.' });
    }
    if (new Date(user.sms_code_expires) < new Date()) {
      return res.status(400).json({ message: 'Recovery code has expired. Please request a new one.' });
    }
    if ((user.sms_code_attempts || 0) >= 5) {
      return res.status(429).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    const valid = await bcrypt.compare(String(code), user.sms_code_hash);
    if (!valid) {
      await pool.query(`UPDATE users SET sms_code_attempts = sms_code_attempts + 1 WHERE id=$1`, [user.id]);
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    // Invalidate the code after successful verification
    await pool.query(
      `UPDATE users SET sms_code_hash=NULL, sms_code_expires=NULL, sms_code_attempts=0 WHERE id=$1`,
      [user.id]
    );

    // Phone-based recovery is a lower-assurance channel than the mandatory
    // admin email-OTP step (SIM-swap/carrier compromise/a glanced-at lock
    // screen can all deliver an SMS code) -- previously this issued a full
    // login token for ANY role, completely bypassing admin MFA. Privileged
    // accounts must use the standard password + OTP login instead.
    if (PRIVILEGED_ROLES.has(user.role)) {
      return res.status(403).json({ message: 'Phone-based recovery is not available for this account. Please use the standard login.' });
    }

    // Issue a short-lived recovery token (for password reset or direct login)
    const token = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, sms_verified: true, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    setAuthCookie(res, token, 15 * 60 * 1000); // 15m
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── Phone signup OTP verification ──────────────────────────────── */
const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: 'Phone and code are required.' });
    if (!/^\d{6}$/.test(String(code))) return res.status(400).json({ message: 'Code must be 6 digits.' });

    const cleaned = phone.replace(/\D/g, '');
    const result = await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id, sms_code_hash, sms_code_expires, sms_code_attempts
       FROM users WHERE (phone_number=$1 OR phone_number=$2) AND email_verified=FALSE`,
      [cleaned, `+1${cleaned.slice(-10)}`]
    );

    if (!result.rows.length) return res.status(400).json({ message: 'Invalid phone number or code.' });
    const user = result.rows[0];

    if (!user.sms_code_hash || !user.sms_code_expires) {
      return res.status(400).json({ message: 'No code found. Please sign up again.' });
    }
    if (new Date(user.sms_code_expires) < new Date()) {
      return res.status(400).json({ message: 'Code has expired. Please sign up again.' });
    }
    if ((user.sms_code_attempts || 0) >= 5) {
      return res.status(429).json({ message: 'Too many attempts. Please sign up again.' });
    }

    const valid = await bcrypt.compare(String(code), user.sms_code_hash);
    if (!valid) {
      await pool.query('UPDATE users SET sms_code_attempts=sms_code_attempts+1 WHERE id=$1', [user.id]);
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    await pool.query(
      'UPDATE users SET email_verified=TRUE, sms_code_hash=NULL, sms_code_expires=NULL, sms_code_attempts=0 WHERE id=$1',
      [user.id]
    );

    sendSMS(phone.trim(), `Welcome to Habibi Halal Express, ${user.name}! Your account is now active. Start ordering at habibihe.com`).catch(() => {});

    const token = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    setAuthCookie(res, token, 24 * 60 * 60 * 1000);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── /api/auth/me ────────────────────────────────────────────────── */
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'User not found.' });
    const u = result.rows[0];
    res.json({ id: u.id, name: u.name, email: u.email, role: u.role,
               is_partner: !!u.is_partner, partner_id: u.partner_id || null });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

/* ── Social login (Google / Apple via Firebase) ─────────────────────── */
let _firebaseAuth = null;
async function getFirebaseAdmin() {
  if (_firebaseAuth) return _firebaseAuth;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    _firebaseAuth = { auth: () => getAuth() };
    return _firebaseAuth;
  } catch (err) {
    console.error('[Firebase Admin] init failed:', err.message);
    return null;
  }
}

const socialAuth = async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token || typeof id_token !== 'string') {
      return res.status(400).json({ message: 'Firebase ID token is required.' });
    }

    const admin = await getFirebaseAdmin();
    if (!admin) {
      return res.status(503).json({ message: 'Social login is not configured on this server yet.' });
    }

    // Verify the Firebase ID token
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(id_token);
    } catch (_) {
      return res.status(401).json({ message: 'Invalid or expired token. Please try again.' });
    }

    const { uid, email, name: fbName, picture, firebase } = decoded;
    const provider = firebase?.sign_in_provider || 'unknown'; // google.com | apple.com

    if (!email) {
      return res.status(400).json({ message: 'No email address associated with this account.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const displayName = (fbName || cleanEmail.split('@')[0]).slice(0, 100);

    // Find existing user or create one
    let user = (await pool.query(
      `SELECT id, name, email, role, is_partner, partner_id, date_of_birth, birthday_rewarded_year
         FROM users WHERE email = $1`,
      [cleanEmail]
    )).rows[0];

    if (!user) {
      // New user — insert with a random un-guessable password hash (they won't use password login)
      const dummyHash = await bcrypt.hash(crypto.randomUUID(), 12);
      user = (await pool.query(
        `INSERT INTO users (name, email, password_hash, email_verified, provider, provider_id)
         VALUES ($1, $2, $3, TRUE, $4, $5)
         RETURNING id, name, email, role, is_partner, partner_id, date_of_birth, birthday_rewarded_year`,
        [displayName, cleanEmail, dummyHash, provider, uid]
      )).rows[0];
    } else {
      // Update social info in case they previously registered with email/password
      await pool.query(
        `UPDATE users SET provider = COALESCE(provider, $1), provider_id = COALESCE(provider_id, $2), email_verified = TRUE WHERE id = $3`,
        [provider, uid, user.id]
      );
    }

    // Social login has no admin-MFA step of its own -- previously this
    // issued a full login token for ANY role, including admin/superadmin,
    // completely bypassing the OTP-email step the password login path
    // treats as mandatory. Privileged accounts must use the standard
    // password + OTP login instead.
    if (PRIVILEGED_ROLES.has(user.role)) {
      return res.status(403).json({ message: 'Social login is not available for this account. Please use the standard login.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, partner_id: user.partner_id || null, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token, 7 * 24 * 60 * 60 * 1000);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_partner: !!user.is_partner,
        partner_id: user.partner_id || null,
      },
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const changeAdminPassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Both current and new password are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }
  try {
    const userRes = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

    if (current_password === new_password) {
      return res.status(400).json({ message: 'New password must differ from the current one.' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyAdminMfa,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhoneOtp,
  getMe,
  sendSmsRecoveryCode,
  verifySmsRecoveryCode,
  socialAuth,
  changeAdminPassword,
};