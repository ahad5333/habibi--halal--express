const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');
const staffAuth = require('../middleware/staffMiddleware');
const { staffLogin, staffSetPin, sendStaffSetupSms, adminResetStaffPin } = require('../controllers/staffAuthController');

router.post('/login', staffLogin);
// The SMS setup link's HMAC token IS the setup authorization (same pattern as
// the driver app) -- staffAuth verifies it matches a real, active, allowed-role
// row before staffSetPin is ever reached.
router.post('/set-pin', staffAuth, staffSetPin);
router.post('/send-setup-sms', protect, admin, sendStaffSetupSms);
router.patch('/:id/reset-pin', protect, admin, adminResetStaffPin);

module.exports = router;
