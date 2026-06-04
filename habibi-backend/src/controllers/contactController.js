const safeError = require('../utils/safeError');
const crypto = require('crypto');
const pool = require('../config/db');
const emailService = require('../services/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const check = await pool.query(
      'SELECT id, is_subscribed FROM newsletter_subscribers WHERE email = $1',
      [email]
    );

    if (check.rows.length > 0) {
      if (!check.rows[0].is_subscribed) {
        await pool.query(
          'UPDATE newsletter_subscribers SET is_subscribed = TRUE WHERE email = $1',
          [email]
        );
        return res.status(200).json({ message: 'Re-subscribed successfully' });
      }
      return res.status(200).json({ message: 'Already subscribed' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO newsletter_subscribers (email, unsubscribe_token) VALUES ($1, $2)',
      [email, token]
    );

    emailService.syncNewsletterContact(email).catch(err => {
      console.error('Failed to sync newsletter contact:', err.message);
    });

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const unsubscribeNewsletter = async (req, res) => {
  const { token } = req.query;
  const wantsJson = req.headers.accept?.includes('application/json');

  if (!token) {
    return wantsJson
      ? res.status(400).json({ error: 'Missing token. Please use the link from your email.' })
      : res.redirect(`${FRONTEND_URL}/unsubscribe?error=missing_token`);
  }

  try {
    const result = await pool.query(
      `UPDATE newsletter_subscribers SET is_subscribed = FALSE WHERE unsubscribe_token = $1 RETURNING email`,
      [token]
    );
    if (!result.rows[0]) {
      return wantsJson
        ? res.status(404).json({ error: 'This link is invalid or has already been used.' })
        : res.redirect(`${FRONTEND_URL}/unsubscribe?error=invalid_token`);
    }
    return wantsJson
      ? res.json({ success: true, email: result.rows[0].email })
      : res.redirect(`${FRONTEND_URL}/unsubscribe?success=1`);
  } catch (err) {
    return wantsJson
      ? res.status(500).json({ error: 'Something went wrong. Please try again later.' })
      : res.redirect(`${FRONTEND_URL}/unsubscribe?error=server_error`);
  }
};

// Twilio STOP webhook — called by Twilio when a recipient replies STOP/UNSUBSCRIBE
const smsTwilioStop = async (req, res) => {
  try {
    const from = req.body?.From || '';
    if (from) {
      // Normalise E.164 to digits-only for flexible matching
      const digits = from.replace(/\D/g, '');
      await pool.query(
        `UPDATE users SET receive_sms_updates = FALSE
         WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') = $1`,
        [digits]
      ).catch(() => {});
      await pool.query(
        `UPDATE customers SET receive_sms_updates = FALSE
         WHERE regexp_replace((SELECT phone_number FROM users WHERE id = customers.user_id), '[^0-9]', '', 'g') = $1`,
        [digits]
      ).catch(() => {});
      console.log(`[SMS Opt-out] ${from} opted out via Twilio STOP webhook`);
    }
    // Twilio expects a TwiML response
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    res.status(500).send('<Response></Response>');
  }
};

const submitFeedback = async (req, res) => {
  try {
    const { name, email, type, message } = req.body;
    const result = await pool.query(
      `INSERT INTO urgent_requests (name, email, reason, message, urgency_level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, type, message, 'Normal']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  subscribeNewsletter,
  unsubscribeNewsletter,
  smsTwilioStop,
  submitFeedback,
};
