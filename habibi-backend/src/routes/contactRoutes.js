const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const emailService = require('../services/emailService');
const { subscribeNewsletter, unsubscribeNewsletter, smsTwilioStop, submitFeedback } = require('../controllers/contactController');

/* ── POST /api/contact — public contact form ── */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message, phone, nature, order_number, urgent } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'name, email, and message are required.' });
    }
    const reason = nature || subject || 'Contact Form';
    const urgency = urgent ? 'High' : 'Normal';
    const result = await pool.query(
      `INSERT INTO urgent_requests (name, email, phone, reason, order_id, message, urgency_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, email, phone || null, reason, order_number || null, message, urgency]
    );
    // Fire-and-forget admin notification if the method exists
    if (typeof emailService.sendContactFormNotification === 'function') {
      emailService.sendContactFormNotification({ name, email, subject, message }).catch(() => {});
    }
    res.status(201).json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subscribe', subscribeNewsletter);
router.get('/unsubscribe', unsubscribeNewsletter);
router.post('/sms-optout', smsTwilioStop);
router.post('/feedback', submitFeedback);

module.exports = router;
