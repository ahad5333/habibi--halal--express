const express = require('express');
const router = express.Router();
const { getReviews, submitReview } = require('../controllers/reviewsController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { handleValidation, rules, body, query } = require('../middleware/validate');

router.get('/',
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100.'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5.'),
  handleValidation,
  getReviews
);

router.post('/',
  optionalAuth,
  body('customer_name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }).withMessage('Name too long.'),
  rules.rating(),
  body('comment').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Comment must be 1000 characters or fewer.'),
  body('order_number').optional({ checkFalsy: true }).isLength({ max: 50 }).withMessage('Order number too long.'),
  handleValidation,
  submitReview
);

module.exports = router;
