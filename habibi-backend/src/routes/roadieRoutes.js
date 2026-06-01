const express = require('express');
const router  = express.Router();
const protect = require('../middleware/authMiddleware');
const admin   = require('../middleware/adminMiddleware');
const {
  createShipment,
  getShipment,
  cancelShipment,
  listShipments,
  handleWebhook,
  getEstimate,
} = require('../controllers/roadieController');

// Public webhook — Roadie POSTs state changes here
router.post('/webhook', handleWebhook);

// Admin-protected routes
router.use(protect, admin);
router.get('/',                         listShipments);
router.post('/estimate',                getEstimate);
router.post('/orders/:order_id',        createShipment);
router.get('/:shipment_id',             getShipment);
router.delete('/:shipment_id/cancel',   cancelShipment);

module.exports = router;
