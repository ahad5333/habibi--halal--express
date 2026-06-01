const safeError = require('../utils/safeError');
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailService = require("../services/emailService");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

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

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token (expires in 24 h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 86400000);

    const result = await pool.query(
      `INSERT INTO users(name, email, password_hash, verification_token, verification_token_expires)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, verificationToken, verificationExpires]
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

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_partner: !!user.is_partner,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
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
      { expiresIn: '7d' }
    );

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

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hashedPassword, result.rows[0].id]
    );

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
};