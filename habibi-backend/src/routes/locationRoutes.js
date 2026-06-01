const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');

// Public Routes
router.get('/', locationController.getAllLocations);
router.get('/:id', locationController.getLocationById);

// Admin-only Routes
router.post('/',      protect, admin, locationController.createLocation);
router.put('/:id',   protect, admin, locationController.updateLocation);
router.delete('/:id', protect, admin, locationController.deleteLocation);

module.exports = router;
