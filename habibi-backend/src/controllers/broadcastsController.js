const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { sendSMS } = require('../services/smsService');
const emailService = require('../services/emailService');
const fcmService = require('../services/fcmService');
const { logAudit } = require('./auditController');

exports.getBroadcasts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM broadcasts ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.sendBroadcast = async (req, res) => {
  try {
    const { title, message, audience, channels, email_template, scheduled_at } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const adminName = req.user?.name || 'Admin';
    const channelList = channels || ['sms'];

    // A future scheduled_at defers sending entirely — the row is just
    // created and the scheduler cron in app.js picks it up when due. Reusing
    // the same execution path (executeBroadcast) means a scheduled send goes
    // out identically to an immediate one, nothing duplicated.
    const isScheduled = scheduled_at && new Date(scheduled_at).getTime() > Date.now();

    const inserted = await pool.query(
      `INSERT INTO broadcasts (title, message, audience, channels, email_template, scheduled_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, message, audience || 'all', channelList, email_template || null,
       isScheduled ? scheduled_at : null, isScheduled ? 'scheduled' : 'sending', adminName]
    );
    const broadcast = inserted.rows[0];

    if (isScheduled) {
      logAudit(pool, req.user?.id, req.user?.name, 'schedule_broadcast', 'broadcast', String(broadcast.id),
        { title, audience: audience || 'all', channels: channelList, scheduled_at }, req.ip);
      return res.json(broadcast);
    }

    const { totalSent } = await executeBroadcast(broadcast);

    await pool.query(
      `UPDATE broadcasts SET status='sent', sent_at=NOW(), sent_count=$1 WHERE id=$2`,
      [totalSent, broadcast.id]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'send_broadcast', 'broadcast', String(broadcast.id),
      { title, audience: audience || 'all', channels: channelList, sent_count: totalSent }, req.ip);

    res.json({ ...broadcast, status: 'sent', sent_count: totalSent });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// The actual SMS/email/push send — split out from sendBroadcast so the
// scheduler cron (app.js) can run the exact same logic for a broadcast
// that was composed earlier, instead of a second, drifting copy of it.
async function executeBroadcast(broadcast) {
  const { title, message, audience, channels, email_template } = broadcast;
  const channelList = channels || ['sms'];

  // Collect phone numbers for SMS
  let smsSentCount = 0;
  if (channelList.includes('sms')) {
      // Exclude anyone who has opted out — either a registered user who
      // texted STOP (users.receive_sms_updates), or any number (registered
      // or guest) recorded in sms_optouts by the Twilio STOP webhook. Without
      // this, a customer who already opted out would still get texted again
      // on the next broadcast.
      // sms_optouts.phone_digits is a mix of 10- and 11-digit values (Twilio's
      // STOP webhook stores 11-digit E.164; the one-time backfill from
      // users.phone_number in init.js stored 10-digit) -- an exact-string
      // match here would silently let an opted-out customer keep receiving
      // broadcasts whenever the two sides' digit counts didn't line up.
      // Comparing the last 10 digits makes the match length-agnostic. Same
      // bug class found and fixed in contactController.js's STOP/START/ORDER
      // handlers while building the Voice IVR.
      const OPTOUT_FILTER = `NOT EXISTS (
        SELECT 1 FROM sms_optouts o WHERE RIGHT(o.phone_digits, 10) = RIGHT(regexp_replace(combined.phone, '[^0-9]', '', 'g'), 10)
      )`;
      let phones = [];
      try {
        if (audience === 'subscribers') {
          // Subscribers (newsletter only) generally don't have phone numbers
          phones = [];
        } else if (audience === 'customers') {
          const rows = await pool.query(
            `SELECT phone FROM (
               SELECT DISTINCT phone_number AS phone FROM users
               WHERE role = 'customer' AND phone_number IS NOT NULL AND phone_number != ''
                 AND receive_sms_updates IS NOT FALSE
             ) combined
             WHERE ${OPTOUT_FILTER}
             LIMIT 500`
          );
          phones = rows.rows.map(r => r.phone);
        } else { // 'all'
          const rows = await pool.query(
            `SELECT phone FROM (
               SELECT DISTINCT phone_number AS phone FROM users WHERE phone_number IS NOT NULL AND phone_number != '' AND receive_sms_updates IS NOT FALSE
               UNION
               SELECT DISTINCT customer_phone AS phone FROM guest_orders WHERE customer_phone IS NOT NULL AND customer_phone != ''
             ) combined
             WHERE ${OPTOUT_FILTER}
             LIMIT 500`
          );
          phones = rows.rows.map(r => r.phone);
        }

        // Send SMS via Twilio (best-effort, don't fail if some bounce).
        // Uses the raw sendSMS — sendOrderUpdate is for transactional order
        // status texts and only recognizes a fixed set of status keywords;
        // passing broadcast content through it fell into its fallback branch
        // and mangled every broadcast as "Your order # status is now: ...".
        for (const phone of phones) {
          try {
            await sendSMS(phone, `${title}: ${message}`);
            smsSentCount++;
          } catch (_) {}
        }
      } catch (err) {
        console.error('[Broadcast Controller] SMS campaign query failed:', err.message);
      }
    }

    // Collect email addresses for Email
    let emailSentCount = 0;
    if (channelList.includes('email')) {
      let subscribers = [];
      try {
        let emails = [];
        if (audience === 'subscribers') {
          const rows = await pool.query(
            `SELECT email FROM newsletter_subscribers
             WHERE email IS NOT NULL AND email != '' AND is_subscribed IS NOT FALSE
             LIMIT 1000`
          );
          emails = rows.rows.map(r => r.email);
        } else if (audience === 'customers') {
          const rows = await pool.query(
            `SELECT DISTINCT email FROM users
             WHERE role = 'customer' AND email IS NOT NULL AND email != ''
             LIMIT 1000`
          );
          emails = rows.rows.map(r => r.email);
        } else { // 'all'
          const rows = await pool.query(
            `SELECT DISTINCT email FROM (
               SELECT email FROM users WHERE email IS NOT NULL AND email != ''
               UNION
               SELECT customer_email AS email FROM guest_orders WHERE customer_email IS NOT NULL AND customer_email != ''
             ) combined
             LIMIT 1000`
          );
          emails = rows.rows.map(r => r.email);
        }
        emails = [...new Set(emails)];

        if (emails.length > 0) {
          // Every recipient — not just pre-existing newsletter subscribers —
          // needs a real unsubscribe link (CAN-SPAM requires a working opt-out
          // on commercial email). newsletter_subscribers doubles as the opt-out
          // registry: ensure every address has a token, then only send to ones
          // that aren't marked unsubscribed (covers "customers"/"all" audiences
          // too, so a single unsubscribe click suppresses every future audience).
          await pool.query(
            `INSERT INTO newsletter_subscribers (email, unsubscribe_token)
             SELECT unnest($1::text[]), replace(gen_random_uuid()::text,'-','')
             ON CONFLICT (email) DO NOTHING`,
            [emails]
          );
          const tokenRows = await pool.query(
            `SELECT email, unsubscribe_token FROM newsletter_subscribers
             WHERE email = ANY($1::text[]) AND is_subscribed IS NOT FALSE`,
            [emails]
          );
          subscribers = tokenRows.rows.map(r => ({ email: r.email, unsubscribeToken: r.unsubscribe_token }));
        }

        if (subscribers.length > 0) {
          const emailSubject = (email_template?.subject || '').trim() || title;
          const resEmail = await emailService.sendNewsletter(subscribers, emailSubject, message, email_template);
          if (resEmail.success) {
            emailSentCount = resEmail.sent_count || subscribers.length;
          }
        }
      } catch (err) {
        console.error('[Broadcast Controller] Email campaign failed:', err.message);
      }
    }

    // Push notifications via FCM
    let pushSentCount = 0;
    if (channelList.includes('push')) {
      try {
        const tokens = await pool.query(
          `SELECT DISTINCT device_token FROM user_device_tokens
           WHERE device_token IS NOT NULL AND device_token != ''
           LIMIT 2000`
        );
        for (const row of tokens.rows) {
          try {
            const result = await fcmService.sendPushNotification(row.device_token, title, message);
            if (result.success) pushSentCount++;
          } catch (_) {}
        }
      } catch (err) {
        console.error('[Broadcast Controller] Push campaign failed:', err.message);
      }
    }

  const totalSent = smsSentCount + emailSentCount + pushSentCount;
  return { totalSent, smsSentCount, emailSentCount, pushSentCount };
}

exports.deleteBroadcast = async (req, res) => {
  try {
    await pool.query('DELETE FROM broadcasts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Broadcast deleted' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Sends the email exactly as it would go out, but to one address only —
// bypasses the audience/DB recipient lookup entirely so this can never touch
// the real customer/subscriber list, no matter what audience is selected in
// the form.
exports.sendTestBroadcast = async (req, res) => {
  try {
    const { title, message, email_template, test_email } = req.body;
    if (!test_email) return res.status(400).json({ error: 'Test email address is required' });
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const subject = (email_template?.subject || '').trim() || title || 'Test Broadcast';
    const result = await emailService.sendNewsletter(
      [{ email: test_email, unsubscribeToken: 'test-preview' }],
      subject,
      message,
      email_template || {}
    );
    if (!result.success) return res.status(500).json({ error: 'Failed to send test email' });
    res.json({ success: true, sent_to: test_email });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Counts how many people a broadcast would actually reach per channel,
// without sending anything — mirrors the exact same audience queries
// sendBroadcast uses so the number shown to the admin is never a guess.
exports.getRecipientCount = async (req, res) => {
  try {
    const audience = req.query.audience || 'all';
    const channels = (req.query.channels || '').split(',').filter(Boolean);
    const counts = {};

    if (channels.includes('sms')) {
      // sms_optouts.phone_digits is a mix of 10- and 11-digit values (Twilio's
      // STOP webhook stores 11-digit E.164; the one-time backfill from
      // users.phone_number in init.js stored 10-digit) -- an exact-string
      // match here would silently let an opted-out customer keep receiving
      // broadcasts whenever the two sides' digit counts didn't line up.
      // Comparing the last 10 digits makes the match length-agnostic. Same
      // bug class found and fixed in contactController.js's STOP/START/ORDER
      // handlers while building the Voice IVR.
      const OPTOUT_FILTER = `NOT EXISTS (
        SELECT 1 FROM sms_optouts o WHERE RIGHT(o.phone_digits, 10) = RIGHT(regexp_replace(combined.phone, '[^0-9]', '', 'g'), 10)
      )`;
      if (audience === 'subscribers') {
        counts.sms = 0;
      } else if (audience === 'customers') {
        const r = await pool.query(
          `SELECT COUNT(*) FROM (
             SELECT DISTINCT phone_number AS phone FROM users
             WHERE role='customer' AND phone_number IS NOT NULL AND phone_number != '' AND receive_sms_updates IS NOT FALSE
           ) combined WHERE ${OPTOUT_FILTER}`
        );
        counts.sms = parseInt(r.rows[0].count, 10);
      } else {
        const r = await pool.query(
          `SELECT COUNT(*) FROM (
             SELECT DISTINCT phone_number AS phone FROM users WHERE phone_number IS NOT NULL AND phone_number != '' AND receive_sms_updates IS NOT FALSE
             UNION
             SELECT DISTINCT customer_phone AS phone FROM guest_orders WHERE customer_phone IS NOT NULL AND customer_phone != ''
           ) combined WHERE ${OPTOUT_FILTER}`
        );
        counts.sms = parseInt(r.rows[0].count, 10);
      }
    }

    if (channels.includes('email')) {
      let r;
      if (audience === 'subscribers') {
        r = await pool.query(`SELECT COUNT(*) FROM newsletter_subscribers WHERE email IS NOT NULL AND email != '' AND is_subscribed IS NOT FALSE`);
      } else if (audience === 'customers') {
        r = await pool.query(`SELECT COUNT(DISTINCT email) FROM users WHERE role='customer' AND email IS NOT NULL AND email != ''`);
      } else {
        r = await pool.query(
          `SELECT COUNT(*) FROM (
             SELECT DISTINCT email FROM (
               SELECT email FROM users WHERE email IS NOT NULL AND email != ''
               UNION
               SELECT customer_email AS email FROM guest_orders WHERE customer_email IS NOT NULL AND customer_email != ''
             ) x
           ) y`
        );
      }
      counts.email = parseInt(r.rows[0].count, 10);
    }

    if (channels.includes('push')) {
      const r = await pool.query(`SELECT COUNT(DISTINCT device_token) FROM user_device_tokens WHERE device_token IS NOT NULL AND device_token != ''`);
      counts.push = parseInt(r.rows[0].count, 10);
    }

    res.json(counts);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Uploads a photo for the email banner — reuses the same upload middleware
// (Cloudinary in production, local disk in dev) as menu/article images.
exports.uploadBroadcastImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const url = req.file.path?.startsWith('http') ? req.file.path : `/uploads/menus/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports.executeBroadcast = executeBroadcast;
