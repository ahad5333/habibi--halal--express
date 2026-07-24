const express    = require("express");
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const { body }   = require('express-validator');
const { handleValidation, rules } = require('../middleware/validate');

const isDev = process.env.NODE_ENV !== 'production';

// Applies only to register/login — the routes with a real brute-force
// attack surface (a guessable password). Previously applied blanket to all
// of /api/auth, including GET /me, which the SPA calls on every page
// navigation just to check an already-issued JWT is still valid — that
// silently shared this same 20-req/15-min budget, so normal admin usage
// (clicking through more than ~20 pages) could exceed it and, since the
// frontend treats a failed /me call as "not logged in", got bounced to the
// login screen mid-session. Confirmed live during a full-app smoke test.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  message: { error: "Too many attempts, try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /me and POST /logout require a valid JWT (via `protect`) before they
// do anything, so there's no credential-guessing surface to rate-limit
// against here — this ceiling exists only to stop runaway/malicious
// polling, not routine SPA usage.
const meLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 300,
  message: { error: "Too many requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 3,
  message: { error: 'Too many SMS requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  message: { error: 'Too many password reset requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const smsVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  message: { error: 'Too many verification attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const {
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
} = require("../controllers/authController");
const protect = require('../middleware/authMiddleware');
const { revokeToken } = require('../middleware/authMiddleware');

router.post("/register",
  authLimiter,
  rules.name(),
  // Accept a valid email OR a phone number (user can sign up with either)
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .custom(val => {
      if (!val) return true; // phone-only signup — controller handles it
      const isPhone = /^\+?[\d\s\-(). ]{7,20}$/.test(val) && !val.includes('@');
      if (isPhone) return true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) throw new Error('Must be a valid email address.');
      return true;
    }),
  rules.password(8),
  handleValidation,
  registerUser
);

router.post("/login",
  authLimiter,
  body('email').trim().notEmpty().withMessage('Email or phone is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  handleValidation,
  loginUser
);

router.post("/admin-mfa/verify",
  smsVerifyLimiter,
  body('email').trim().isEmail().withMessage('Valid email required.'),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.'),
  handleValidation,
  verifyAdminMfa
);

router.post("/forgot-password",
  forgotPasswordLimiter,
  rules.email(),
  handleValidation,
  forgotPassword
);

router.post("/reset-password",
  body('token').notEmpty().withMessage('Reset token is required.'),
  rules.password(8),
  handleValidation,
  resetPassword
);

router.get("/verify-email", verifyEmail);

// Phone signup OTP verification
router.post("/verify-phone-otp", smsVerifyLimiter, body('phone').trim().notEmpty(), body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits.'), handleValidation, verifyPhoneOtp);

// SMS 5-digit recovery code
router.post("/sms-recovery/send",   smsLimiter,       body('phone').trim().notEmpty().withMessage('Phone is required.'), handleValidation, sendSmsRecoveryCode);
router.post("/sms-recovery/verify", smsVerifyLimiter, body('phone').trim().notEmpty(), body('code').trim().isLength({ min: 5, max: 5 }).withMessage('Code must be 5 digits.'), handleValidation, verifySmsRecoveryCode);

// Social login — Google & Apple via Firebase ID token
router.post('/social', body('id_token').notEmpty().withMessage('ID token required.'), handleValidation, socialAuth);

// Return current user info from the httpOnly cookie — used by frontend on page load
router.get('/me', meLimiter, protect, getMe);

// Invalidate the calling token and clear the httpOnly cookie
router.post('/logout', meLimiter, protect, (req, res) => {
  const { jti, exp } = req.user || {};
  revokeToken(jti, exp);
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' });
  res.json({ ok: true });
});

module.exports = router;
