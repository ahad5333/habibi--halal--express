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

// Scheduled orders waiting for dispatch
router.get('/scheduled', async (req, res) => {
  const pool = require('../config/db');
  try {
    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone,
              delivery_address, delivery_city, delivery_state, delivery_zip,
              total, expected_time, placed_at
         FROM guest_orders
        WHERE delivery_method = 'delivery'
          AND dispatch_fired  = FALSE
          AND expected_time  IS NOT NULL
          AND expected_time  != ''
          AND expected_time  != 'ASAP'
        ORDER BY placed_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
