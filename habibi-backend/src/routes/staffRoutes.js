const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { admin } = require('../middleware/authMiddleware');
const staffAuth = require('../middleware/staffMiddleware');
const {
  staffLogin, staffSetPin, sendStaffSetupSms, adminResetStaffPin,
  signOutStaffEverywhere, saveStaffFcmToken,
} = require('../controllers/staffAuthController');

router.post('/login', staffLogin);
// The SMS setup link's HMAC token IS the setup authorization (same pattern as
// the driver app) -- staffAuth verifies it matches a real, active, allowed-role
// row before staffSetPin is ever reached.
router.post('/set-pin', staffAuth, staffSetPin);
router.post('/send-setup-sms', protect, admin, sendStaffSetupSms);
router.patch('/:id/reset-pin', protect, admin, adminResetStaffPin);
router.post('/:id/sign-out-everywhere', protect, admin, signOutStaffEverywhere);
router.post('/fcm-token', staffAuth, saveStaffFcmToken);

// Waste log from the staff PIN screen
const waste = require('../controllers/wasteController');
router.get('/waste/options', staffAuth, waste.staffWasteOptions);
router.get('/waste/mine',    staffAuth, waste.staffMyWaste);
router.post('/waste',        staffAuth, waste.staffLogWaste);
router.delete('/waste/:id',  staffAuth, waste.staffUndoWaste);

// My schedule: shifts, clock in/out, time off
const schedule = require('../controllers/scheduleController');
router.get('/schedule/me',               staffAuth, schedule.staffMe);
router.post('/schedule/clock-in',        staffAuth, schedule.staffClockIn);
router.post('/schedule/clock-out',       staffAuth, schedule.staffClockOut);
router.post('/schedule/time-off',        staffAuth, schedule.staffRequestTimeOff);
router.delete('/schedule/time-off/:id',  staffAuth, schedule.staffCancelTimeOff);

module.exports = router;
