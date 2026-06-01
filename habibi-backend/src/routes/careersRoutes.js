const express = require('express');
const router = express.Router();
const { getVacancies, submitApplication } = require('../controllers/careersController');

// Public routes
router.get('/vacancies', getVacancies);
router.post('/apply', submitApplication);

module.exports = router;
