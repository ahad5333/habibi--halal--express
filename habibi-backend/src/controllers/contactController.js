const safeError = require('../utils/safeError');
const crypto = require('crypto');
const twilio = require('twilio');
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

// Twilio inbound SMS webhook — handles STOP/START/HELP replies.
// SmsTerms.jsx explicitly promises all three keywords work (opt out, re-enroll,
// get help) — this used to treat *every* inbound message as a STOP unconditionally,
// with no check on the actual message body. If this URL is Twilio's general inbound
// webhook (rather than one that only ever receives pre-filtered STOP replies), that
// meant replying HELP — literally what this page tells customers to do — would have
// silently unsubscribed them instead. Keying off the real keyword fixes that either
// way: it's a no-op if Twilio was already pre-filtering, and a real fix if not.
function escapeXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const STOP_KEYWORDS  = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'];
const START_KEYWORDS = ['start', 'unstop'];
const HELP_KEYWORDS  = ['help', 'info'];

const smsTwilioStop = async (req, res) => {
  try {
    // This endpoint previously had no signature verification at all --
    // anyone who found the URL could POST fake From/Body form data to
    // silently toggle any real phone number's SMS opt-in status (a TCPA
    // compliance risk: mass opt-out real customers, or force-resubscribe
    // a number that had legitimately opted out). Twilio signs every
    // webhook request; reject anything that doesn't verify.
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers['x-twilio-signature'];
    const publicUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    if (!authToken || !signature || !twilio.validateRequest(authToken, signature, publicUrl, req.body || {})) {
      console.error('[SMS Webhook] Invalid or missing Twilio signature -- rejecting.');
      return res.status(403).send('<Response></Response>');
    }

    const from = req.body?.From || '';
    const body = (req.body?.Body || '').trim().toLowerCase();
    let reply = '';

    if (from && STOP_KEYWORDS.includes(body)) {
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
      // Phone-number-keyed, independent of any account — covers guest
      // checkout customers too, who have no users/customers row to update.
      await pool.query(
        `INSERT INTO sms_optouts (phone_digits) VALUES ($1) ON CONFLICT DO NOTHING`,
        [digits]
      ).catch(() => {});
      console.log(`[SMS Opt-out] ${from} opted out via Twilio STOP webhook`);
      reply = 'You have been unsubscribed from Habibi Halal Express texts and will receive no further messages. Reply START to re-subscribe.';
    } else if (from && START_KEYWORDS.includes(body)) {
      const digits = from.replace(/\D/g, '');
      await pool.query(
        `UPDATE users SET receive_sms_updates = TRUE
         WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') = $1`,
        [digits]
      ).catch(() => {});
      await pool.query(
        `UPDATE customers SET receive_sms_updates = TRUE
         WHERE regexp_replace((SELECT phone_number FROM users WHERE id = customers.user_id), '[^0-9]', '', 'g') = $1`,
        [digits]
      ).catch(() => {});
      await pool.query(`DELETE FROM sms_optouts WHERE phone_digits = $1`, [digits]).catch(() => {});
      console.log(`[SMS Opt-in] ${from} re-subscribed via Twilio START webhook`);
      reply = 'You are re-subscribed to Habibi Halal Express texts. Reply STOP to opt out anytime.';
    } else if (from && HELP_KEYWORDS.includes(body)) {
      let phone = '', email = '';
      try {
        const s = await pool.query(`SELECT phone_main, email_contact FROM site_settings WHERE id=1`);
        phone = s.rows[0]?.phone_main || '';
        email = s.rows[0]?.email_contact || '';
      } catch (_) {}
      reply = `Habibi Halal Express: For help, contact us${phone ? ` at ${phone}` : ''}${email ? ` or ${email}` : ''}. Msg&data rates may apply. Reply STOP to opt out.`;
    }

    // Twilio expects a TwiML response
    res.set('Content-Type', 'text/xml');
    res.send(reply ? `<Response><Message>${escapeXml(reply)}</Message></Response>` : '<Response></Response>');
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
