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

  const page = (title, body, isError = false) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Habibi Halal Express</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Helvetica Neue,Arial,sans-serif;background:#f8fafc;color:#1e293b;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
    .card{background:#fff;border-radius:14px;padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,.06);border:1px solid #e2e8f0}
    h1{color:${isError ? '#ef4444' : '#1e3a8a'};font-size:1.35rem;margin:0 0 .75rem}
    p{color:#64748b;line-height:1.65;font-size:.95rem;margin:.5rem 0}
    a{color:#1e3a8a;text-decoration:none;font-weight:600}
    a:hover{text-decoration:underline}
    .logo{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;margin-bottom:1.25rem}
  </style>
</head>
<body>
  <div class="card">
    <p class="logo">Habibi Halal Express</p>
    <h1>${title}</h1>
    ${body}
    <p style="margin-top:1.5rem"><a href="${FRONTEND_URL}">← Back to website</a></p>
  </div>
</body>
</html>`;

  if (!token) {
    return res.status(400).send(page(
      'Invalid Link',
      '<p>This unsubscribe link is missing a required token. Please use the link from your email.</p>',
      true
    ));
  }

  try {
    const result = await pool.query(
      `UPDATE newsletter_subscribers SET is_subscribed = FALSE WHERE unsubscribe_token = $1 RETURNING email`,
      [token]
    );
    if (!result.rows[0]) {
      return res.status(404).send(page(
        'Link Not Found',
        '<p>This unsubscribe link is invalid or has already been used.</p>',
        true
      ));
    }
    res.send(page(
      'Unsubscribed',
      `<p>You've been removed from the Habibi Halal Express mailing list.<br>You won't receive any further marketing emails from us.</p>`
    ));
  } catch (err) {
    res.status(500).send(page('Error', '<p>Something went wrong. Please try again later.</p>', true));
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
