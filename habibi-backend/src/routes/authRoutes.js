const express = require("express");
const router  = express.Router();
const { body } = require('express-validator');
const { handleValidation, rules } = require('../middleware/validate');

const {
  registerUser,
  loginUser,
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

router.post("/forgot-password",
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
router.post("/sms-recovery/send",   body('phone').trim().notEmpty().withMessage('Phone is required.'), handleValidation, sendSmsRecoveryCode);
router.post("/sms-recovery/verify", body('phone').trim().notEmpty(), body('code').trim().isLength({ min: 5, max: 5 }).withMessage('Code must be 5 digits.'), handleValidation, verifySmsRecoveryCode);

// Invalidate the calling token (admin logout / "sign out everywhere")
router.post('/logout', protect, (req, res) => {
  const { jti, exp } = req.user || {};
  revokeToken(jti, exp);
  res.json({ ok: true });
});

module.exports = router;
