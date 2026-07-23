const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin, optionalAuth } = require("../middleware/authMiddleware");
const { handleValidation, rules, body } = require('../middleware/validate');
const {
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
} = require("../controllers/couponController");

// Public — validate coupon. optionalAuth so req.user is populated for
// logged-in customers (needed for the customer_email and first-order-only
// restrictions) without requiring login for coupons that don't need it.
router.post("/validate",
  optionalAuth,
  rules.couponCode(),
  body('subtotal').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Subtotal must be non-negative.'),
  handleValidation,
  validateCoupon
);

// Admin only
router.get("/",          protect, admin, getCoupons);

router.post("/",         protect, admin,
  rules.couponCode(),
  body('discount_type').notEmpty().withMessage('Discount type is required.')
    .isIn(['percentage','fixed_amount','free_delivery','bogo','bogo_half','free_item','free_item_from_category']).withMessage('Invalid discount type.'),
  body('discount_value').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Discount value must be non-negative.'),
  body('customer_email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email.').normalizeEmail(),
  handleValidation,
  createCoupon
);

router.patch("/:id",     protect, admin, updateCoupon);
router.put("/:id/toggle",protect, admin, toggleCouponStatus);
router.delete("/:id",    protect, admin, deleteCoupon);

module.exports = router;
