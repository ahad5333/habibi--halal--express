const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const admin   = require('../middleware/adminMiddleware');
const {
  handleUberEatsWebhook,
  handleGrubHubWebhook,
  handleCaviarWebhook,
  getMarketplaceOrders,
  updateMarketplaceOrder,
  getMarketplaceStats,
  getLocationMappings,
  saveLocationMapping,
} = require('../controllers/marketplaceController');

// Public webhook endpoints — each platform POSTs here
router.post('/webhook/ubereats', handleUberEatsWebhook);
router.post('/webhook/grubhub',  handleGrubHubWebhook);
router.post('/webhook/caviar',   handleCaviarWebhook);

// Admin-protected routes
router.use(protect, admin);
router.get('/',                  getMarketplaceOrders);
router.get('/stats',             getMarketplaceStats);
router.get('/location-mappings', getLocationMappings);
router.post('/location-mappings', saveLocationMapping);
router.patch('/:id',             updateMarketplaceOrder);

module.exports = router;
