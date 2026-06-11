const express    = require("express");
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const { body }   = require('express-validator');
const { handleValidation, rules } = require('../middleware/validate');

const isDev = process.env.NODE_ENV !== 'production';

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
  sendSmsRecoveryCode,
  verifySmsRecoveryCode,
} = require("../controllers/authController");
const protect = require('../middleware/authMiddleware');
const { revokeToken } = require('../middleware/authMiddleware');

router.post("/register",
  rules.name(),
  rules.email(),
  rules.password(8),
  handleValidation,
  registerUser
);

router.post("/login",
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

// SMS 5-digit recovery code
router.post("/sms-recovery/send",   smsLimiter,       body('phone').trim().notEmpty().withMessage('Phone is required.'), handleValidation, sendSmsRecoveryCode);
router.post("/sms-recovery/verify", smsVerifyLimiter, body('phone').trim().notEmpty(), body('code').trim().isLength({ min: 5, max: 5 }).withMessage('Code must be 5 digits.'), handleValidation, verifySmsRecoveryCode);

// Invalidate the calling token (admin logout / "sign out everywhere")
router.post('/logout', protect, (req, res) => {
  const { jti, exp } = req.user || {};
  revokeToken(jti, exp);
  res.json({ ok: true });
});

module.exports = router;
