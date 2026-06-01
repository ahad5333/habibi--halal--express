const express = require("express");
const router  = express.Router();
const protect = require("../middleware/authMiddleware");
const { handleValidation, rules, body } = require('../middleware/validate');
const {
  getProfile, updateProfile, changePassword, deleteAccount,
  getMyOrders, getLoyalty,
  getAddresses, addAddress, setDefaultAddress, deleteAddress,
  createUser, getUsers,
  registerDeviceToken,
} = require("../controllers/userController");

// All /api/users routes require auth
router.use(protect);

// ── Profile ──────────────────────────────────────────────────────────────────
router.get ("/me", getProfile);

router.put ("/me",
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Name too long.'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.').normalizeEmail(),
  body('phone_number').optional({ checkFalsy: true }).isLength({ max: 20 }).withMessage('Phone too long.'),
  body('date_of_birth').optional({ checkFalsy: true }).isDate().withMessage('Invalid date of birth.'),
  handleValidation,
  updateProfile
);

router.put ("/me/password",
  body('current_password').notEmpty().withMessage('Current password is required.'),
  rules.password(8),
  handleValidation,
  changePassword
);

router.delete("/me",
  body('password').notEmpty().withMessage('Password confirmation is required.'),
  handleValidation,
  deleteAccount
);

router.post("/me/device-token",
  body('token').notEmpty().withMessage('Device token is required.'),
  handleValidation,
  registerDeviceToken
);

// ── Orders ───────────────────────────────────────────────────────────────────
router.get("/me/orders",  getMyOrders);
router.get("/me/loyalty", getLoyalty);

// ── Addresses ────────────────────────────────────────────────────────────────
router.get("/me/addresses", getAddresses);

router.post("/me/addresses",
  body('street_address').trim().notEmpty().withMessage('Street address is required.').isLength({ max: 200 }).withMessage('Street address too long.'),
  body('city').trim().notEmpty().withMessage('City is required.').isLength({ max: 100 }).withMessage('City too long.'),
  body('state').trim().notEmpty().withMessage('State is required.').isLength({ max: 50 }),
  body('zip_code').trim().notEmpty().withMessage('ZIP code is required.').isLength({ max: 20 }),
  body('second_line').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('Second line too long.'),
  body('receiver_name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Receiver name too long.'),
  body('driver_instruction').optional({ checkFalsy: true }).isLength({ max: 300 }).withMessage('Instructions too long.'),
  handleValidation,
  addAddress
);

router.put   ("/me/addresses/:id/default", setDefaultAddress);
router.delete("/me/addresses/:id",         deleteAddress);

// ── Legacy ───────────────────────────────────────────────────────────────────
router.post("/", createUser);
router.get ("/", getUsers);

module.exports = router;
