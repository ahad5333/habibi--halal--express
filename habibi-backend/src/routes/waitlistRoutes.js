const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { joinWaitlist } = require('../controllers/waitlistController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { handleValidation, body } = require('../middleware/validate');

const isDev = process.env.NODE_ENV !== 'production';
const waitlistLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 10,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/',
  waitlistLimiter,
  optionalAuth,
  body('menu_item_id').notEmpty().withMessage('menu_item_id is required.').isInt().withMessage('menu_item_id must be a number.'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email.').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 20 }).withMessage('Phone number too long.'),
  handleValidation,
  joinWaitlist
);

module.exports = router;
