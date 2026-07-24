const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { sendSMS } = require('../services/smsService');
const emailService = require('../services/emailService');
const fcmService = require('../services/fcmService');

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
    const { title, message, audience, channels, email_template } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const adminName = req.user?.name || 'Admin';
    const channelList = channels || ['sms'];

    // Insert broadcast record
    const inserted = await pool.query(
      `INSERT INTO broadcasts (title, message, audience, channels, status, created_by)
       VALUES ($1,$2,$3,$4,'sending',$5) RETURNING *`,
      [title, message, audience || 'all', channelList, adminName]
    );
    const broadcast = inserted.rows[0];

    // Collect phone numbers for SMS
    let smsSentCount = 0;
    if (channelList.includes('sms')) {
      // Exclude anyone who has opted out — either a registered user who
      // texted STOP (users.receive_sms_updates), or any number (registered
      // or guest) recorded in sms_optouts by the Twilio STOP webhook. Without
      // this, a customer who already opted out would still get texted again
      // on the next broadcast.
      const OPTOUT_FILTER = `NOT EXISTS (
        SELECT 1 FROM sms_optouts o WHERE o.phone_digits = regexp_replace(combined.phone, '[^0-9]', '', 'g')
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

    await pool.query(
      `UPDATE broadcasts SET status='sent', sent_at=NOW(), sent_count=$1 WHERE id=$2`,
      [totalSent, broadcast.id]
    );

    res.json({ ...broadcast, status: 'sent', sent_count: totalSent });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.deleteBroadcast = async (req, res) => {
  try {
    await pool.query('DELETE FROM broadcasts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Broadcast deleted' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
