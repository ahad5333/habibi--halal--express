const router = require("express").Router();
const {
    assignDriver,
    updateDriverLocation,
    updateDeliveryStatus
} = require("../controllers/deliveryController");
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');

router.post("/assign",    protect, admin, assignDriver);
router.put("/location",   protect, updateDriverLocation);
router.put("/status",     protect, admin, updateDeliveryStatus);

module.exports = router;