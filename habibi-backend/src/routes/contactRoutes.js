const safeError = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const emailService = require('../services/emailService');
const { subscribeNewsletter, unsubscribeNewsletter, smsTwilioStop, submitFeedback } = require('../controllers/contactController');

const isDev = process.env.NODE_ENV !== 'production';
// Applied only to the contact form / newsletter subscribe / feedback --
// NOT to /sms-optout below, which is the Twilio webhook (already protected
// by signature verification, a stronger guarantee than IP-based rate
// limiting, and could see legitimate bursts an IP limiter would wrongly
// throttle). These three previously had no limiter at all, so any could be
// spammed to flood the admin inbox or the urgent_requests/
// newsletter_subscribers tables.
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 10,
  message: { error: "Too many requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ── POST /api/contact — public contact form ── */
router.post('/', contactLimiter, async (req, res) => {
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
    res.status(500).json(safeError(err));
  }
});

router.post('/subscribe', contactLimiter, subscribeNewsletter);
router.get('/unsubscribe', unsubscribeNewsletter);
router.post('/sms-optout', smsTwilioStop);
router.post('/feedback', contactLimiter, submitFeedback);

module.exports = router;

