const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const admin   = require('../middleware/adminMiddleware');
const {
  getAssignments,
  assignDriver,
  getDriverAssignment,
  getAssignmentForOrder,
  updateDriverGPS,
  updateAssignmentStatus,
  getDeliveryDrivers,
  calculateDeliveryFee,
} = require('../controllers/dispatchController');

// Public — driver app calls these (no admin auth, identified by driver_id)
router.get('/driver/:driver_id',                    getDriverAssignment);
router.patch('/assignments/:assignment_id/gps',     updateDriverGPS);
router.patch('/assignments/:assignment_id/status',  updateAssignmentStatus);

// Public — checkout fee calculation
router.post('/calculate-fee', calculateDeliveryFee);

// Public — customer order tracking page
router.get('/order/:order_number', getAssignmentForOrder);

// Admin-protected
router.use(protect, admin);
router.get('/assignments',   getAssignments);
router.get('/drivers',       getDeliveryDrivers);
router.post('/assign',       assignDriver);

module.exports = router;
