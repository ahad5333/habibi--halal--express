const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const admin   = require('../middleware/adminMiddleware');
const {
  createDelivery,
  getDelivery,
  cancelDelivery,
  listDeliveries,
  handleWebhook,
  getQuote,
} = require('../controllers/doordashController');

// Public webhook — DoorDash POSTs status updates here
router.post('/webhook', handleWebhook);

// Admin-protected routes
router.use(protect, admin);
router.get('/',                       listDeliveries);
router.post('/quote',                 getQuote);
router.post('/orders/:order_id',      createDelivery);
router.get('/:delivery_id',           getDelivery);
router.put('/:delivery_id/cancel',    cancelDelivery);

module.exports = router;
