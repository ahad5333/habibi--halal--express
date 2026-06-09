const express = require('express');
const router = express.Router();
const {
  createReservation,
  createTableReservation,
  getAllReservations,
  getReservationById,
  updateReservationStatus,
  sendInvoice,
} = require('../controllers/reservationController');
const protect = require('../middleware/authMiddleware');
const admin   = require('../middleware/adminMiddleware');
const { handleValidation, rules, body } = require('../middleware/validate');

// Public: submit catering inquiry
router.post('/public',
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 100 }),
  rules.email(),
  rules.phone(),
  body('event_date').notEmpty().withMessage('Event date is required.').isISO8601().withMessage('Invalid date format.'),
  body('guest_count').notEmpty().withMessage('Guest count is required.').isInt({ min: 1, max: 2000 }).withMessage('Guest count must be between 1 and 2000.'),
  body('event_type').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('notes').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Notes too long.'),
  handleValidation,
  createReservation
);

// Public: table / dine-in booking
router.post('/table',
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
  body('contact').trim().notEmpty().withMessage('Phone or email is required.').isLength({ max: 150 }),
  body('location').notEmpty().withMessage('Location is required.').isLength({ max: 100 }),
  body('date').notEmpty().withMessage('Date is required.').isISO8601().withMessage('Invalid date.'),
  body('time').notEmpty().withMessage('Time is required.').isLength({ max: 20 }),
  body('party').notEmpty().withMessage('Party size is required.').isInt({ min: 1, max: 50 }),
  body('notes').optional({ checkFalsy: true }).isLength({ max: 500 }),
  handleValidation,
  createTableReservation
);

// Admin-protected management
router.get('/admin',               protect, admin, getAllReservations);
router.get('/admin/:id',           protect, admin, getReservationById);
router.patch('/admin/:id/status',  protect, admin, updateReservationStatus);
router.post('/admin/:id/invoice',  protect, admin, sendInvoice);

module.exports = router;
