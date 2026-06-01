const nodemailer = require('nodemailer');

const sendgridKey = process.env.SENDGRID_API_KEY;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM || 'noreply@habibihalal.com';

let transporter;

if (sendgridKey) {
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
      user: 'apikey',
      pass: sendgridKey
    }
  });
  console.log('[Email Service] Configured via SendGrid SMTP.');
} else if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  console.log(`[Email Service] Configured via custom SMTP (${smtpHost}).`);
} else {
  console.log('[Email Service] Running in SIMULATION mode. Emails will log to console.');
}

/**
 * Standard Email Wrapper with Premium USA Light Theme (Navy & Gold Accent)
 * @param {string} title - Email <title>
 * @param {string} contentHTML - Body content
 * @param {string|null} unsubscribeUrl - If provided, adds one-click unsubscribe link in footer
 */
const wrapHtmlTemplate = (title, contentHTML, unsubscribeUrl = null) => {
  const unsubscribeFooter = unsubscribeUrl
    ? `<p style="margin-top:10px;font-size:11px;">Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe here</a>.</p>`
    : '';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .wrapper { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; }
          .header { background-color: #0f172a; padding: 30px 20px; text-align: center; border-bottom: 4px solid #d97706; }
          .header-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #d97706; margin: 0 0 6px; }
          .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase; }
          .content { padding: 35px 25px; line-height: 1.6; font-size: 15px; }
          .cta-btn { display: inline-block; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; margin: 20px 0; border: none; letter-spacing: 0.5px; }
          .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          .footer a { color: #1e3a8a; text-decoration: none; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <p class="header-eyebrow">Habibi Halal Express</p>
            <h1>&#x1F956; Fresh &amp; Halal</h1>
          </div>
          <div class="content">
            ${contentHTML}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Habibi Halal Express. All rights reserved.</p>
            <p>204 E Mosholu Pkwy S, Bronx, NY 10458 | <a href="https://habibihalal.com">Visit our website</a></p>
            ${unsubscribeFooter}
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Log simulated email to terminal with premium visual frame
 */
const logSimulatedEmail = (to, subject, html) => {
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│                  ✉  SIMULATED EMAIL SEND                │`);
  console.log(`├────────────────────────────────────────────────────────┤`);
  console.log(`│ FROM:    ${emailFrom.padEnd(46)} │`);
  console.log(`│ TO:      ${to.padEnd(46)} │`);
  console.log(`│ SUBJECT: ${subject.slice(0, 43).padEnd(46)} │`);
  console.log(`├────────────────────────────────────────────────────────┤`);
  // Print content inside frame
  const textBody = html
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  let printedCount = 0;
  for (const line of textBody) {
    if (printedCount > 15) {
      console.log(`│ ... [truncated content]                             │`);
      break;
    }
    const chunks = line.match(/.{1,52}/g) || [line];
    for (const chunk of chunks) {
      console.log(`│ ${chunk.padEnd(54)} │`);
      printedCount++;
    }
  }
  console.log('└────────────────────────────────────────────────────────┘\n');
};

/**
 * Helper to dispatch emails via active transporter or logger
 */
const sendMailHelper = async (to, subject, html) => {
  if (!transporter) {
    logSimulatedEmail(to, subject, html);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      html
    });
    console.log(`[Email Service] Email sent successfully to ${to}. MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] FAILED to send email to ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends order confirmation receipt
 */
const sendOrderConfirmation = async (email, order) => {
  if (!email) return { success: false, error: 'No email provided' };

  let itemsHtml = '';
  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch (_) {
    items = order.items || [];
  }

  if (Array.isArray(items)) {
    itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 600; font-size: 14px;">${item.name || 'Item'}</div>
          ${item.selectedOption ? `<div style="font-size: 12px; color: #64748b;">Option: ${item.selectedOption}</div>` : ''}
          ${item.selectedAddons && item.selectedAddons.length ? `<div style="font-size: 12px; color: #64748b;">Addons: ${item.selectedAddons.join(', ')}</div>` : ''}
        </td>
        <td style="padding: 10px 0; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 14px;">x${item.quantity || item.qty || 1}</td>
        <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500;">$${parseFloat(item.price || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  const trackingLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-tracking/${order.order_number}`;

  const htmlContent = `
    <h2 style="color: #1e3a8a; margin-top: 0; font-size: 20px;">Thank You for Your Order!</h2>
    <p>We've received your legendary order <strong>#${order.order_number}</strong> and our kitchen is jumping to action.</p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin-top: 0; font-size: 14px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="color: #64748b; font-size: 12px; text-transform: uppercase;">
            <th style="text-align: left; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Item</th>
            <th style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Qty</th>
            <th style="text-align: right; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <table style="width: 100%; margin-top: 15px; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Subtotal</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 500;">$${parseFloat(order.sub_total || 0).toFixed(2)}</td>
        </tr>
        ${order.tax ? `<tr>
          <td style="padding: 4px 0; color: #64748b;">Tax</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 500;">$${parseFloat(order.tax).toFixed(2)}</td>
        </tr>` : ''}
        ${order.delivery_fee ? `<tr>
          <td style="padding: 4px 0; color: #64748b;">Delivery Fee</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 500;">$${parseFloat(order.delivery_fee).toFixed(2)}</td>
        </tr>` : ''}
        ${order.service_fee ? `<tr>
          <td style="padding: 4px 0; color: #64748b;">Service Fee</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 500;">$${parseFloat(order.service_fee).toFixed(2)}</td>
        </tr>` : ''}
        ${order.tip ? `<tr>
          <td style="padding: 4px 0; color: #64748b;">Tip</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 500;">$${parseFloat(order.tip).toFixed(2)}</td>
        </tr>` : ''}
        ${order.discount ? `<tr>
          <td style="padding: 4px 0; color: #34d399;">Discount</td>
          <td style="padding: 4px 0; text-align: right; color: #34d399; font-weight: 500;">-$${parseFloat(order.discount).toFixed(2)}</td>
        </tr>` : ''}
        <tr style="font-size: 16px; font-weight: 700; border-top: 2px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #0f172a;">Total</td>
          <td style="padding: 10px 0; text-align: right; color: #1e3a8a;">$${parseFloat(order.total || 0).toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div style="margin: 25px 0; text-align: center;">
      <a href="${trackingLink}" class="cta-btn">TRACK YOUR ORDER</a>
    </div>

    <p style="font-size: 14px; color: #64748b;">Delivery Mode: <strong>${order.delivery_method ? order.delivery_method.toUpperCase() : 'DELIVERY'}</strong></p>
    ${order.delivery_address ? `<p style="font-size: 14px; color: #64748b;">Drop-off Address: <strong>${order.delivery_address}</strong></p>` : ''}
  `;

  return await sendMailHelper(email, `Order Confirmation #${order.order_number} - Habibi Halal Express`, wrapHtmlTemplate(`Order #${order.order_number}`, htmlContent));
};

/**
 * Sends order status update notifications
 */
const sendOrderStatusUpdate = async (email, orderNumber, status) => {
  if (!email) return { success: false, error: 'No email provided' };

  const statusCapitalized = status.toUpperCase();
  const trackingLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-tracking/${orderNumber}`;

  let statusDescription = `Your order status is now: <strong>${statusCapitalized}</strong>.`;
  if (status.toLowerCase() === 'preparing') {
    statusDescription = `Our chefs have accepted your order and are preparing it right now with fresh, authentic ingredients.`;
  } else if (status.toLowerCase() === 'in-transit' || status.toLowerCase() === 'out-for-delivery') {
    statusDescription = `Great news! Your order is fresh out of the kitchen and is currently on its way to your door. Get ready for the feast!`;
  } else if (status.toLowerCase() === 'delivered' || status.toLowerCase() === 'completed') {
    statusDescription = `Your order has been safely delivered. We hope you enjoy your meal! Thank you for dining with Habibi Halal Express.`;
  } else if (status.toLowerCase() === 'cancelled') {
    statusDescription = `Your order #${orderNumber} has been cancelled. If this is a mistake, or if you require assistance, please contact our support immediately.`;
  }

  const htmlContent = `
    <h2 style="color: #1e3a8a; margin-top: 0; font-size: 20px;">Order Status Update</h2>
    <p>Hello,</p>
    <p>We are updating you regarding order <strong>#${orderNumber}</strong>.</p>
    <p style="font-size: 16px; background-color: #f1f5f9; padding: 15px; border-left: 4px solid #1e3a8a; border-radius: 4px; margin: 20px 0;">
      ${statusDescription}
    </p>

    <div style="margin: 25px 0; text-align: center;">
      <a href="${trackingLink}" class="cta-btn">TRACK ORDER TIMELINE</a>
    </div>
  `;

  return await sendMailHelper(email, `Update on Order #${orderNumber} - ${statusCapitalized}`, wrapHtmlTemplate(`Order Status Update`, htmlContent));
};

/**
 * Sends welcome email to new users
 */
const sendSignupWelcome = async (email, name) => {
  if (!email) return { success: false, error: 'No email provided' };

  const htmlContent = `
    <h2 style="color: #1e3a8a; margin-top: 0; font-size: 22px;">Welcome to the Habibi Family!</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Thank you for creating an account with <strong>Habibi Halal Express</strong>. We are thrilled to welcome you to our family!</p>
    <p>Get ready to enjoy authentic, freshly prepared platters, sandwiches, and specialties, crafted with premium ingredients and tradition, 365 days a year.</p>
    
    <div style="margin: 20px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
      <h3 style="margin-top: 0; font-size: 15px; color: #1e3a8a;">As a member, you enjoy:</h3>
      <ul style="padding-left: 20px; margin-bottom: 0; line-height: 1.5;">
        <li>⚡ Speedy guest and customer checkouts</li>
        <li>📍 Save multiple delivery addresses</li>
        <li>📋 Easily track order status history</li>
        <li>🎁 Member-exclusive discounts and secret deals</li>
      </ul>
    </div>

    <div style="margin: 30px 0; text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/menu" class="cta-btn">EXPLORE THE MENU</a>
    </div>
    
    <p style="font-size: 14px; color: #64748b;">If you didn't sign up for this account, you can safely ignore this email.</p>
  `;

  return await sendMailHelper(email, `Welcome to Habibi Halal Express!`, wrapHtmlTemplate(`Welcome to Habibi`, htmlContent));
};

/**
 * Sends secure password reset email
 */
const sendPasswordReset = async (email, resetUrl) => {
  if (!email) return { success: false, error: 'No email provided' };

  const htmlContent = `
    <h2 style="color: #1e3a8a; margin-top: 0; font-size: 20px;">Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset the password for your account associated with this email address.</p>
    <p>You can reset your password by clicking the button below. This link is valid for <strong>1 hour</strong>.</p>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="${resetUrl}" class="cta-btn">RESET PASSWORD</a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      If the button above does not work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="word-break: break-all; color: #1e3a8a;">${resetUrl}</a>
    </p>

    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
    <p style="font-size: 14px; color: #64748b;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
  `;

  return await sendMailHelper(email, `Password Reset Request - Habibi Halal Express`, wrapHtmlTemplate(`Password Reset`, htmlContent));
};

/**
 * Sends a newsletter/broadcast campaign to multiple recipients.
 * @param {Array<string|{email:string,unsubscribeToken?:string}>} subscribers
 * @param {string} subject
 * @param {string} body - Plain text; newlines become <br>
 */
const sendNewsletter = async (subscribers, subject, body) => {
  if (!subscribers || !subscribers.length) return { success: false, error: 'No recipients provided' };

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  console.log(`[Email Service] Preparing campaign: "${subject}" to ${subscribers.length} recipients...`);

  const contentHTML = `
    <div style="font-size: 16px; line-height: 1.7; color: #1e293b;">
      ${body.replace(/\n/g, '<br>')}
    </div>
  `;

  let successCount = 0;

  if (!transporter) {
    // Simulated — log once
    const firstSub = subscribers[0];
    const sampleEmail = typeof firstSub === 'string' ? firstSub : firstSub.email;
    const sampleToken = typeof firstSub === 'string' ? null : firstSub.unsubscribeToken;
    const sampleUnsub = sampleToken ? `${baseUrl}/api/contact/unsubscribe?token=${sampleToken}` : null;
    console.log(`--- SIMULATED NEWSLETTER CAMPAIGN ---`);
    console.log(`RECIPIENTS COUNT: ${subscribers.length}`);
    logSimulatedEmail(sampleEmail + ' (+ others)', subject, wrapHtmlTemplate(subject, contentHTML, sampleUnsub));
    return { success: true, sent_count: subscribers.length };
  }

  for (const sub of subscribers) {
    const email = typeof sub === 'string' ? sub : sub.email;
    const token = typeof sub === 'string' ? null : sub.unsubscribeToken;
    const unsubscribeUrl = token ? `${baseUrl}/api/contact/unsubscribe?token=${token}` : null;
    try {
      await transporter.sendMail({
        from: emailFrom,
        to: email,
        subject,
        html: wrapHtmlTemplate(subject, contentHTML, unsubscribeUrl),
      });
      successCount++;
    } catch (err) {
      console.error(`[Email Service] Failed to send newsletter to ${email}: ${err.message}`);
    }
  }

  console.log(`[Email Service] Campaign dispatch finished. Sent to ${successCount}/${subscribers.length} recipients.`);
  return { success: true, sent_count: successCount };
};

/**
 * Syncs email subscribers to Mailchimp or SendGrid contact lists
 */
const syncNewsletterContact = async (email) => {
  const mailchimpKey = process.env.MAILCHIMP_API_KEY;
  const mailchimpListId = process.env.MAILCHIMP_LIST_ID;
  const sendgridListId = process.env.SENDGRID_MARKETING_LIST_ID;

  console.log(`[Newsletter Sync] Processing subscription for ${email}...`);

  // Mailchimp sync
  if (mailchimpKey && mailchimpListId) {
    try {
      const dc = mailchimpKey.split('-')[1];
      if (!dc) throw new Error('Invalid Mailchimp API key format (missing datacenter suffix e.g. -us20)');
      
      const endpoint = `https://${dc}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('any:' + mailchimpKey).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[Newsletter Sync] Mailchimp API returned error: ${data.detail || data.title}`);
      } else {
        console.log(`[Newsletter Sync] Subscriber successfully synced to Mailchimp!`);
      }
    } catch (err) {
      console.error(`[Newsletter Sync] Mailchimp connection failed: ${err.message}`);
    }
  }

  // SendGrid Marketing Contacts sync
  if (sendgridKey && sendgridListId) {
    try {
      const endpoint = `https://api.sendgrid.com/v3/marketing/contacts`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          list_ids: [sendgridListId],
          contacts: [{ email: email }]
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(`[Newsletter Sync] SendGrid Contacts API error: ${JSON.stringify(data)}`);
      } else {
        console.log(`[Newsletter Sync] Subscriber successfully synced to SendGrid Contacts!`);
      }
    } catch (err) {
      console.error(`[Newsletter Sync] SendGrid Contacts sync failed: ${err.message}`);
    }
  }

  if (!mailchimpKey && (!sendgridKey || !sendgridListId)) {
    console.log(`[Newsletter Sync] Mock Sync: ${email} added to newsletter database. (Credentials not set in .env)`);
  }
};

/**
 * Sends email verification link to new users
 */
const sendEmailVerification = async (email, name, verifyUrl) => {
  if (!email) return { success: false, error: 'No email provided' };

  const htmlContent = `
    <h2 style="color: #1e3a8a; margin-top: 0; font-size: 22px;">Verify Your Email Address</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Thanks for signing up with <strong>Habibi Halal Express</strong>! Just one more step — please verify your email address to activate your account.</p>
    <p>Click the button below. This link expires in <strong>24 hours</strong>.</p>

    <div style="margin: 30px 0; text-align: center;">
      <a href="${verifyUrl}" class="cta-btn">VERIFY MY EMAIL</a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      If the button above doesn't work, copy and paste this URL into your browser:<br>
      <a href="${verifyUrl}" style="word-break: break-all; color: #1e3a8a;">${verifyUrl}</a>
    </p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
    <p style="font-size: 13px; color: #64748b;">If you didn't create this account, you can safely ignore this email.</p>
  `;

  return await sendMailHelper(email, `Verify your email — Habibi Halal Express`, wrapHtmlTemplate(`Email Verification`, htmlContent));
};

/**
 * Partner-branded wrapper — dark header with gold accent bar, matching portal theme
 */
const wrapPartnerTemplate = (title, contentHTML) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0d0d0d; color: #e5e5e5; margin: 0; padding: 0; }
          .wrapper { max-width: 600px; margin: 20px auto; background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a; }
          .header { background-color: #0a0a0a; padding: 28px 24px; text-align: center; border-bottom: 3px solid #E5B64E; }
          .header-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E5B64E; margin: 0 0 6px; font-weight: 600; }
          .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin: 0; }
          .content { padding: 32px 28px; line-height: 1.65; font-size: 15px; color: #d4d4d4; }
          .content h2 { color: #ffffff; font-size: 18px; margin-top: 0; }
          .status-badge { display: inline-block; background-color: rgba(229,182,78,0.12); color: #E5B64E; border: 1px solid rgba(229,182,78,0.3); padding: 6px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; }
          .info-box { background-color: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 14px; }
          .info-box td:first-child { color: #888; padding-right: 16px; width: 120px; vertical-align: top; padding-bottom: 8px; }
          .info-box td:last-child { color: #e5e5e5; font-weight: 500; padding-bottom: 8px; }
          .cta-btn { display: inline-block; background-color: #E5B64E; color: #0a0a0a !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; margin: 20px 0; }
          .footer { background-color: #0a0a0a; padding: 18px 24px; text-align: center; font-size: 12px; color: #555; border-top: 1px solid #222; }
          .footer a { color: #E5B64E; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <p class="header-eyebrow">Habibi Wholesale</p>
            <h1>Partner Portal</h1>
          </div>
          <div class="content">
            ${contentHTML}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Habibi Halal Express · Wholesale Division</p>
            <p>204 E Mosholu Pkwy S, Bronx, NY 10458 �� <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/partner">Partner Portal</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Sends partner order status notification email (confirmed, processing, shipped, delivered, cancelled)
 */
const sendPartnerOrderUpdate = async (email, businessName, orderNumber, status, items = [], total = 0) => {
  if (!email) return { success: false, error: 'No email provided' };

  const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/partner`;

  const STATUS_COPY = {
    confirmed:  { label: 'Confirmed',  body: 'Your order has been reviewed and confirmed. Our team is preparing your wholesale shipment.' },
    processing: { label: 'Processing', body: 'Your order is now being processed and packed for dispatch.' },
    shipped:    { label: 'Shipped',    body: 'Your order is on its way! Expect delivery within the agreed timeframe.' },
    delivered:  { label: 'Delivered',  body: 'Your order has been successfully delivered. Thank you for your business!' },
    cancelled:  { label: 'Cancelled',  body: 'Your order has been cancelled. Please contact your account manager if you have questions.' },
  };

  const copy = STATUS_COPY[status] || { label: status.toUpperCase(), body: `Your order status has been updated to ${status}.` };

  let itemsHtml = '';
  if (items.length > 0) {
    const rows = items.map(i =>
      `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #222;font-size:13px;color:#e5e5e5;">${i.name || i.title || 'Item'}</td>
        <td style="padding:6px 0;border-bottom:1px solid #222;font-size:13px;text-align:center;color:#aaa;">${i.quantity || i.qty || 1} ${i.unit || 'ea'}</td>
        <td style="padding:6px 0;border-bottom:1px solid #222;font-size:13px;text-align:right;color:#E5B64E;font-weight:600;">
          $${(parseFloat(i.unit_price || i.price || 0) * (i.quantity || i.qty || 1)).toFixed(2)}
        </td>
      </tr>`
    ).join('');
    itemsHtml = `
      <div class="info-box" style="padding:12px 16px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">
            <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #2a2a2a;">Item</th>
            <th style="text-align:center;padding-bottom:8px;border-bottom:1px solid #2a2a2a;">Qty</th>
            <th style="text-align:right;padding-bottom:8px;border-bottom:1px solid #2a2a2a;">Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:right;font-size:15px;font-weight:700;color:#E5B64E;margin-top:10px;padding-top:8px;border-top:1px solid #2a2a2a;">
          Order Total: $${parseFloat(total).toFixed(2)}
        </div>
      </div>`;
  }

  const htmlContent = `
    <h2>Order ${copy.label}</h2>
    <p>Hello${businessName ? `, <strong>${businessName}</strong>` : ''},</p>
    <p>${copy.body}</p>

    <div class="info-box">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td>Order #</td><td><strong>${orderNumber}</strong></td></tr>
        <tr><td>Status</td><td><span class="status-badge">${copy.label}</span></td></tr>
        ${total ? `<tr><td>Order Total</td><td><strong>$${parseFloat(total).toFixed(2)}</strong></td></tr>` : ''}
      </table>
    </div>

    ${itemsHtml}

    <div style="text-align:center;margin:28px 0;">
      <a href="${portalUrl}" class="cta-btn">View in Partner Portal</a>
    </div>

    <p style="font-size:13px;color:#666;">
      Questions about your order? Reply to this email or contact your Habibi account manager.
    </p>
  `;

  return await sendMailHelper(
    email,
    `Wholesale Order #${orderNumber} — ${copy.label} | Habibi Partner Portal`,
    wrapPartnerTemplate(`Order #${orderNumber} ${copy.label}`, htmlContent)
  );
};

/**
 * Partner-branded password reset email
 */
const sendPartnerPasswordReset = async (email, resetUrl) => {
  if (!email) return { success: false, error: 'No email provided' };

  const partnerLoginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/partner/login`;

  const htmlContent = `
    <h2>Reset Your Partner Portal Password</h2>
    <p>Hello,</p>
    <p>We received a request to reset the password for your <strong>Habibi Wholesale Partner Portal</strong> account.</p>
    <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" class="cta-btn">Reset Password</a>
    </div>

    <p style="font-size:13px;color:#666;line-height:1.5;">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="word-break:break-all;color:#E5B64E;">${resetUrl}</a>
    </p>

    <hr style="border:0;border-top:1px solid #2a2a2a;margin:24px 0;">

    <p style="font-size:13px;color:#666;">
      After resetting, you can sign back into the Partner Portal at:<br>
      <a href="${partnerLoginUrl}" style="color:#E5B64E;">${partnerLoginUrl}</a>
    </p>
    <p style="font-size:13px;color:#555;">
      If you did not request a password reset, you can safely ignore this email. Your account remains secure.
    </p>
  `;

  return await sendMailHelper(
    email,
    `Partner Portal — Password Reset | Habibi Wholesale`,
    wrapPartnerTemplate('Partner Portal — Password Reset', htmlContent)
  );
};

/**
 * Catering: confirmation email to the customer who submitted the quote
 */
const sendCateringQuoteConfirmation = async (email, name, quote) => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  const estimated = parseFloat(quote.estimated_total || 0).toFixed(2);
  const htmlContent = `
    <h2 style="color:#1e3a8a;margin-top:0;">Catering Inquiry Received!</h2>
    <p>Hi <strong>${name}</strong>, thank you for reaching out to Habibi Halal Express Catering. We've received your inquiry and will send you a custom quote within 24–48 hours.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;padding:5px 0;width:130px;">Event Type</td><td style="font-weight:600;">${quote.event_type || 'Event'}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Date & Time</td><td style="font-weight:600;">${eventDate}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Guest Count</td><td style="font-weight:600;">${quote.party_size} guests</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Service Type</td><td style="font-weight:600;text-transform:capitalize;">${quote.service_type || 'Delivery'}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Quote # </td><td style="font-weight:600;">#CAT-${String(quote.id).padStart(4,'0')}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Est. Starting Price</td><td style="font-weight:700;color:#b8860b;">~$${estimated}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#64748b;">This is an <em>estimate only</em>. Our team will review your event details and send a finalised invoice within 48 hours. For urgent enquiries call us at <strong>(347) 703-3731</strong>.</p>
    <p>— The Habibi Halal Express Catering Team</p>
  `;
  return await sendMailHelper(
    email,
    `Catering Inquiry Received — #CAT-${String(quote.id).padStart(4,'0')}`,
    wrapHtmlTemplate('Catering Inquiry Confirmed', htmlContent)
  );
};

/**
 * Catering: internal alert to admin when a new catering request arrives
 */
const sendCateringAdminAlert = async (adminEmail, quote) => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleString('en-US')
    : 'TBD';
  const htmlContent = `
    <h2 style="color:#1e3a8a;margin-top:0;">New Catering Request</h2>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;padding:5px 0;width:130px;">Name</td><td style="font-weight:600;">${quote.name}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Email</td><td>${quote.email}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Phone</td><td>${quote.phone || '—'}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Event Type</td><td style="font-weight:600;">${quote.event_type || '—'}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Date</td><td style="font-weight:600;">${eventDate}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Guests</td><td style="font-weight:600;">${quote.party_size}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Service</td><td style="text-transform:capitalize;">${quote.service_type}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Est. Total</td><td style="font-weight:700;color:#b8860b;">$${parseFloat(quote.estimated_total||0).toFixed(2)}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Notes</td><td>${quote.notes || '—'}</td></tr>
      </table>
    </div>
    <p>Log in to the admin panel to review and send an invoice.</p>
  `;
  return await sendMailHelper(
    adminEmail,
    `[Catering] New Request from ${quote.name} — ${quote.party_size} guests`,
    wrapHtmlTemplate('New Catering Request', htmlContent)
  );
};

/**
 * Catering: custom invoice sent to customer by admin
 */
const sendCateringInvoice = async (email, name, quote, invoiceNotes = '') => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const finalPrice = parseFloat(quote.quoted_price || quote.estimated_total || 0).toFixed(2);
  const htmlContent = `
    <h2 style="color:#1e3a8a;margin-top:0;">Your Catering Invoice</h2>
    <p>Hi <strong>${name}</strong>, please find your catering quote below. To confirm your booking, reply to this email or call us at <strong>(347) 703-3731</strong>.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;padding:5px 0;width:130px;">Invoice #</td><td style="font-weight:700;">#CAT-${String(quote.id).padStart(4,'0')}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Event Type</td><td>${quote.event_type || 'Event'}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Event Date</td><td style="font-weight:600;">${eventDate}</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Guest Count</td><td style="font-weight:600;">${quote.party_size} guests</td></tr>
        <tr><td style="color:#64748b;padding:5px 0;">Service Type</td><td style="text-transform:capitalize;">${quote.service_type}</td></tr>
      </table>
    </div>
    <div style="background:#1e3a8a;border-radius:8px;padding:16px 24px;margin:20px 0;text-align:center;">
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 4px;">TOTAL QUOTED PRICE</p>
      <p style="color:#fbbf24;font-size:32px;font-weight:800;margin:0;">$${finalPrice}</p>
    </div>
    ${invoiceNotes ? `<p style="font-size:14px;"><strong>Notes from our team:</strong><br>${invoiceNotes}</p>` : ''}
    <p style="font-size:13px;color:#64748b;">A 25% deposit is required to secure your date. Full payment is due 48 hours before the event. We accept credit card, Zelle, and Cash App.</p>
    <p>— The Habibi Halal Express Catering Team</p>
  `;
  return await sendMailHelper(
    email,
    `Catering Invoice #CAT-${String(quote.id).padStart(4,'0')} — $${finalPrice}`,
    wrapHtmlTemplate('Your Catering Invoice', htmlContent)
  );
};

module.exports = {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendSignupWelcome,
  sendEmailVerification,
  sendPasswordReset,
  sendPartnerPasswordReset,
  sendPartnerOrderUpdate,
  sendNewsletter,
  syncNewsletterContact,
  sendCateringQuoteConfirmation,
  sendCateringAdminAlert,
  sendCateringInvoice,
};
