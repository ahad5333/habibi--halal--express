const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const assistantController = require('../controllers/assistantController');

const isDev = process.env.NODE_ENV !== 'production';
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 30,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', assistantLimiter, assistantController.assistantChat);

module.exports = router;
