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
} = require("../controllers/authController");

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

module.exports = router;
