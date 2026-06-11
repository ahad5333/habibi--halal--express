const safeError = require('../utils/safeError');
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailService = require("../services/emailService");
const { sendAdminOTP } = require('../services/emailService');

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
    const { name, email, password, phone, dob, first_name, last_name } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    if (name.length > 100) {
      return res.status(400).json({ message: 'Name too long.' });
    }

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token (expires in 24 h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 86400000);

    const dobValue = dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
    const phoneValue = phone ? String(phone).trim().slice(0, 20) : null;

    const result = await pool.query(
      `INSERT INTO users(name, email, password_hash, verification_token, verification_token_expires, phone_number, date_of_birth)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, verificationToken, verificationExpires, phoneValue, dobValue]
    );

    const user = result.rows[0];

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    if (process.env.NODE_ENV?.toLowerCase() !== 'production') {
      console.log(`[DEV] Email verification link for ${email}: ${verifyUrl}`);
    }

    emailService.sendEmailVerification(email, name, verifyUrl).catch(err => {
      console.error('Failed to send verification email:', err.message);
    });

    res.status(201).json({ needs_verification: true, email: user.email });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Accept login by email or phone number
    const identifier = (email || '').trim();

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 OR phone_number=$1",
      [identifier]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    // VULN-05: block unverified emails (admin accounts are exempt)
    if (!user.email_verified && user.role !== 'admin') {
      return res.status(403).json({
        message: "Please verify your email address before logging in.",
        needs_verification: true,
        email: user.email,
      });
    }

    // VULN-11: admin login requires email OTP second factor
    // MFA is only enforced when SMTP/SendGrid is configured — skipped otherwise so
    // admin can still log in before email credentials are set up.
    if (user.role === 'admin') {
      const smtpConfigured = !!(
        process.env.SENDGRID_API_KEY ||
        (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      );
      if (smtpConfigured) {
        const otp        = String(crypto.randomInt(100000, 1000000)); // 6 digits
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);     // 10 min
        const otpHash    = await bcrypt.hash(otp, 12);
        await pool.query(
          `UPDATE users SET admin_otp_hash=$1, admin_otp_expires=$2, admin_otp_attempts=0 WHERE id=$3`,
          [otpHash, otpExpires, user.id]
        );
        sendAdminOTP(user.email, otp).catch(err => console.error('Admin OTP email failed:', err.message));
        return res.json({ mfa_required: true, email: user.email });
      }
      console.warn('[Auth] Admin MFA skipped — SMTP not configured. Set SENDGRID_API_KEY or SMTP_HOST+SMTP_USER+SMTP_PASS to enable.');
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_partner: !!user.is_partner,
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
       FROM users WHERE email=$1 AND role='admin'`,
      [email]
    );

    if (result.rows.length === 0) return res.status(400).json({ message: 'Invalid request.' });
    const user = result.rows[0];

    if (!user.admin_otp_hash || !user.admin_otp_expires) {
      return res.status(400).json({ message: 'No pending MFA session. Please log in again.' });
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
      { id: user.id, role: user.role, is_partner: !!user.is_partner, jti: crypto.randomUUID() },
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
      `SELECT id, name, email, role, is_partner
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
      { id: user.id, role: user.role, is_partner: !!user.is_partner },
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

    const result = await pool.query("SELECT id, is_partner FROM users WHERE email = $1", [email]);
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
      [token, expires, email]
    );

    // In production this would send an email. For now return the token in dev.
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);

    const user = result.rows[0];
    if (user.is_partner) {
      emailService.sendPartnerPasswordReset(email, resetUrl).catch(err => {
        console.error('Failed to send partner password reset email:', err.message);
      });
    } else {
      emailService.sendPasswordReset(email, resetUrl).catch(err => {
        console.error('Failed to send password reset email:', err.message);
      });
    }

    // In dev, log the URL to server console only — never expose tokens in API responses
    if (process.env.NODE_ENV?.toLowerCase() !== 'production') {
      console.log('[DEV] Password reset URL:', resetUrl);
    }
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });

    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
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
const { sendSMS } = require('../services/smsService');

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
      `SELECT id, name, sms_code_expires FROM users WHERE phone_number LIKE $1`,
      [`%${cleaned.slice(-10)}`]
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
      `SELECT id, name, email, role, is_partner, sms_code_hash, sms_code_expires, sms_code_attempts
       FROM users WHERE phone_number LIKE $1`,
      [`%${cleaned.slice(-10)}`]
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

    // Issue a short-lived recovery token (for password reset or direct login)
    const token = jwt.sign(
      { id: user.id, role: user.role, is_partner: !!user.is_partner, sms_verified: true, jti: crypto.randomUUID() },
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

module.exports = {
  registerUser,
  loginUser,
  verifyAdminMfa,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendSmsRecoveryCode,
  verifySmsRecoveryCode,
};