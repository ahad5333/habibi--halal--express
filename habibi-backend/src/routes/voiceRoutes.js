const express = require('express');
const router = express.Router();
const { handleIncomingCall, handleMenuChoice } = require('../controllers/voiceController');

router.post('/incoming', handleIncomingCall);
router.post('/menu', handleMenuChoice);

module.exports = router;
