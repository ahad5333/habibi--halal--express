const { validationResult, body, param, query } = require('express-validator');

/**
 * Runs after a chain of express-validator checks.
 * Returns 422 with a structured errors array if any checks failed.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Reusable field rules ──────────────────────────────────────────────────────

const rules = {
  email: () =>
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Must be a valid email address.')
      .normalizeEmail(),

  password: (min = 8) =>
    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min }).withMessage(`Password must be at least ${min} characters.`),

  name: () =>
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required.')
      .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer.'),

  phone: () =>
    body('phone_number')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 20 }).withMessage('Phone number is too long.'),

  positiveFloat: (field, label) =>
    body(field)
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage(`${label} must be a non-negative number.`),

  positiveInt: (field, label) =>
    body(field)
      .optional({ checkFalsy: true })
      .isInt({ min: 0 }).withMessage(`${label} must be a non-negative integer.`),

  rating: () =>
    body('rating')
      .notEmpty().withMessage('Rating is required.')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),

  couponCode: () =>
    body('code')
      .trim()
      .notEmpty().withMessage('Coupon code is required.')
      .isLength({ max: 50 }).withMessage('Coupon code is too long.')
      .matches(/^[A-Z0-9_-]+$/i).withMessage('Coupon code may only contain letters, numbers, hyphens and underscores.'),

  idParam: () =>
    param('id')
      .isInt({ min: 1 }).withMessage('ID must be a positive integer.'),
};

module.exports = { handleValidation, rules, body, param, query };
