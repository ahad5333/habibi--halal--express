const nodemailer = require('nodemailer');
const { renderBody, renderEmail } = require('./templateRenderer');

const sendgridKey = process.env.SENDGRID_API_KEY;
const smtpHost   = process.env.SMTP_HOST;
const smtpPort   = process.env.SMTP_PORT || 587;
const smtpUser   = process.env.SMTP_USER;
const smtpPass   = process.env.SMTP_PASS;
const emailFrom  = process.env.EMAIL_FROM || 'noreply@habibihalal.com';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

let transporter;

if (sendgridKey) {
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net', port: 587,
    auth: { user: 'apikey', pass: sendgridKey },
  });
  console.log('[Email Service] Configured via SendGrid SMTP.');
} else if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost, port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  console.log(`[Email Service] Configured via custom SMTP (${smtpHost}).`);
} else {
  console.log('[Email Service] Running in SIMULATION mode. Emails will log to console.');
}

const BANNER_COLORS = {
  promo:        { bg: '#1e3a8a', text: '#ffffff' },
  announcement: { bg: '#0f172a', text: '#E5B64E' },
  discount:     { bg: '#dc2626', text: '#ffffff' },
  default:      { bg: '#E5B64E', text: '#0f172a' },
};

const ORDER_STATUS_COPY = {
  preparing:          'Our chefs have accepted your order and are preparing it right now with fresh, authentic ingredients.',
  'in-transit':       'Great news! Your order is fresh out of the kitchen and is currently on its way to your door. Get ready for the feast!',
  'out-for-delivery': 'Great news! Your order is fresh out of the kitchen and is currently on its way to your door. Get ready for the feast!',
  delivered:          'Your order has been safely delivered. We hope you enjoy your meal! Thank you for dining with Habibi Halal Express.',
  completed:          'Your order has been safely delivered. We hope you enjoy your meal! Thank you for dining with Habibi Halal Express.',
};

const PARTNER_STATUS = {
  confirmed:  { label: 'Confirmed',  body: 'Your order has been reviewed and confirmed. Our team is preparing your wholesale shipment.' },
  processing: { label: 'Processing', body: 'Your order is now being processed and packed for dispatch.' },
  shipped:    { label: 'Shipped',    body: 'Your order is on its way! Expect delivery within the agreed timeframe.' },
  delivered:  { label: 'Delivered',  body: 'Your order has been successfully delivered. Thank you for your business!' },
  cancelled:  { label: 'Cancelled',  body: 'Your order has been cancelled. Please contact your account manager if you have questions.' },
};

const logSimulatedEmail = (to, subject, html) => {
  const lines = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n').map(l => l.trim()).filter(Boolean);

  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│                  ✉  SIMULATED EMAIL SEND                │`);
  console.log(`├────────────────────────────────────────────────────────┤`);
  console.log(`│ FROM:    ${emailFrom.padEnd(46)} │`);
  console.log(`│ TO:      ${to.slice(0, 46).padEnd(46)} │`);
  console.log(`│ SUBJECT: ${subject.slice(0, 43).padEnd(46)} │`);
  console.log(`├────────────────────────────────────────────────────────┤`);
  let count = 0;
  for (const line of lines) {
    if (count++ > 15) { console.log(`│ ... [truncated]                                       │`); break; }
    (line.match(/.{1,52}/g) || [line]).forEach(chunk => console.log(`│ ${chunk.padEnd(54)} │`));
  }
  console.log('└────────────────────────────────────────────────────────┘\n');
};

const sendMailHelper = async (to, subject, html) => {
  if (!transporter) {
    logSimulatedEmail(to, subject, html);
    return { success: true, simulated: true };
  }
  try {
    const info = await transporter.sendMail({ from: emailFrom, to, subject, html });
    console.log(`[Email Service] Sent to ${to}. MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service] FAILED to send to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

const sendOrderConfirmation = async (email, order) => {
  if (!email) return { success: false, error: 'No email provided' };
  let rawItems = [];
  try { rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []); } catch (_) {}
  const items = (Array.isArray(rawItems) ? rawItems : []).map(i => ({
    ...i, qty: i.quantity || i.qty || 1,
  }));
  const html = renderEmail('order-confirmation', {
    ...order,
    items,
    trackingLink: `${frontendUrl}/order-tracking/${order.order_number}`,
    delivery_method: (order.delivery_method || 'DELIVERY').toUpperCase(),
  });
  return sendMailHelper(email, `Order Confirmation #${order.order_number} - Habibi Halal Express`, html);
};

const sendOrderStatusUpdate = async (email, orderNumber, status) => {
  if (!email) return { success: false, error: 'No email provided' };
  const key = status.toLowerCase();
  const statusDescription = ORDER_STATUS_COPY[key]
    || `Your order status is now: <strong>${status.toUpperCase()}</strong>.`;
  const html = renderEmail('order-status', {
    orderNumber,
    statusDescription,
    trackingLink: `${frontendUrl}/order-tracking/${orderNumber}`,
  });
  return sendMailHelper(email, `Update on Order #${orderNumber} - ${status.toUpperCase()}`, html);
};

const sendSignupWelcome = async (email, name) => {
  if (!email) return { success: false, error: 'No email provided' };
  const html = renderEmail('welcome', { name: name || 'there', menuUrl: `${frontendUrl}/menu` });
  return sendMailHelper(email, `Welcome to Habibi Halal Express!`, html);
};

const sendPasswordReset = async (email, resetUrl) => {
  if (!email) return { success: false, error: 'No email provided' };
  const html = renderEmail('password-reset', { resetUrl });
  return sendMailHelper(email, `Password Reset Request - Habibi Halal Express`, html);
};

const sendEmailVerification = async (email, name, verifyUrl) => {
  if (!email) return { success: false, error: 'No email provided' };
  const html = renderEmail('email-verification', { name: name || 'there', verifyUrl });
  return sendMailHelper(email, `Verify your email — Habibi Halal Express`, html);
};

// Builds newsletter inner-content HTML for use in broadcast campaigns.
// Kept as a utility so broadcastsController can pass it to sendNewsletter.
const buildNewsletterHTML = (body, template = {}) => {
  const { banner_type = 'default', hero_text = '', cta_text = '', cta_url = '', footer_note = '' } = template;
  const { bg: banner_bg, text: banner_text } = BANNER_COLORS[banner_type] || BANNER_COLORS.default;
  return renderBody('newsletter', {
    hero_text, cta_text, cta_url, footer_note, banner_bg, banner_text,
    body_html: body.replace(/\n/g, '<br>'),
  });
};

const sendNewsletter = async (subscribers, subject, body, template = {}) => {
  if (!subscribers?.length) return { success: false, error: 'No recipients provided' };
  console.log(`[Email Service] Preparing campaign: "${subject}" to ${subscribers.length} recipients...`);

  // Build the newsletter body once — only the per-subscriber unsubscribe URL differs
  const content = buildNewsletterHTML(body, template);

  if (!transporter) {
    const first = subscribers[0];
    const sampleEmail = typeof first === 'string' ? first : first.email;
    const sampleToken = typeof first === 'string' ? null : first.unsubscribeToken;
    const unsubscribeUrl = sampleToken ? `${frontendUrl}/api/contact/unsubscribe?token=${sampleToken}` : null;
    const html = renderBody('base-light', { content, title: subject, unsubscribeUrl, year: new Date().getFullYear() });
    console.log(`--- SIMULATED NEWSLETTER CAMPAIGN --- RECIPIENTS: ${subscribers.length}`);
    logSimulatedEmail(`${sampleEmail} (+ others)`, subject, html);
    return { success: true, sent_count: subscribers.length };
  }

  let successCount = 0;
  for (const sub of subscribers) {
    const email = typeof sub === 'string' ? sub : sub.email;
    const token = typeof sub === 'string' ? null : sub.unsubscribeToken;
    const unsubscribeUrl = token ? `${frontendUrl}/api/contact/unsubscribe?token=${token}` : null;
    try {
      const html = renderBody('base-light', { content, title: subject, unsubscribeUrl, year: new Date().getFullYear() });
      await transporter.sendMail({ from: emailFrom, to: email, subject, html });
      successCount++;
    } catch (err) {
      console.error(`[Email Service] Failed to send newsletter to ${email}: ${err.message}`);
    }
  }
  console.log(`[Email Service] Campaign finished. Sent to ${successCount}/${subscribers.length} recipients.`);
  return { success: true, sent_count: successCount };
};

const syncNewsletterContact = async (email) => {
  const mailchimpKey    = process.env.MAILCHIMP_API_KEY;
  const mailchimpListId = process.env.MAILCHIMP_LIST_ID;
  const sendgridListId  = process.env.SENDGRID_MARKETING_LIST_ID;

  console.log(`[Newsletter Sync] Processing subscription for ${email}...`);

  if (mailchimpKey && mailchimpListId) {
    try {
      const dc = mailchimpKey.split('-')[1];
      if (!dc) throw new Error('Invalid Mailchimp API key format (missing datacenter suffix e.g. -us20)');
      const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('any:' + mailchimpKey).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: email, status: 'subscribed' }),
      });
      const data = await res.json();
      if (!res.ok) console.error(`[Newsletter Sync] Mailchimp error: ${data.detail || data.title}`);
      else console.log(`[Newsletter Sync] Synced to Mailchimp.`);
    } catch (err) {
      console.error(`[Newsletter Sync] Mailchimp failed: ${err.message}`);
    }
  }

  if (sendgridKey && sendgridListId) {
    try {
      const res = await fetch(`https://api.sendgrid.com/v3/marketing/contacts`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_ids: [sendgridListId], contacts: [{ email }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) console.error(`[Newsletter Sync] SendGrid error: ${JSON.stringify(data)}`);
      else console.log(`[Newsletter Sync] Synced to SendGrid Contacts.`);
    } catch (err) {
      console.error(`[Newsletter Sync] SendGrid failed: ${err.message}`);
    }
  }

  if (!mailchimpKey && (!sendgridKey || !sendgridListId)) {
    console.log(`[Newsletter Sync] Mock: ${email} added. (Credentials not set)`);
  }
};

const sendPartnerOrderUpdate = async (email, businessName, orderNumber, status, items = [], total = 0) => {
  if (!email) return { success: false, error: 'No email provided' };
  const copy = PARTNER_STATUS[status] || { label: status.toUpperCase(), body: `Your order status has been updated to ${status}.` };
  const normalizedItems = items.map(i => ({
    ...i,
    name:     i.name || i.title || 'Item',
    qty:      i.quantity || i.qty || 1,
    unit:     i.unit || 'ea',
    lineTotal: ((parseFloat(i.unit_price || i.price || 0)) * (i.quantity || i.qty || 1)).toFixed(2),
  }));
  const html = renderEmail('partner-order-update', {
    business_name: businessName,
    order_number:  orderNumber,
    status_label:  copy.label,
    status_body:   copy.body,
    items:         normalizedItems.length ? normalizedItems : null,
    total,
    portal_url:    `${frontendUrl}/partner`,
  }, 'base-dark');
  return sendMailHelper(
    email,
    `Wholesale Order #${orderNumber} — ${copy.label} | Habibi Partner Portal`,
    html,
  );
};

const sendPartnerPasswordReset = async (email, resetUrl) => {
  if (!email) return { success: false, error: 'No email provided' };
  const html = renderEmail('partner-password-reset', {
    resetUrl,
    partnerLoginUrl: `${frontendUrl}/partner/login`,
    frontendUrl,
  }, 'base-dark');
  return sendMailHelper(email, `Partner Portal — Password Reset | Habibi Wholesale`, html);
};

const sendCateringQuoteConfirmation = async (email, name, quote) => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  const html = renderEmail('catering-quote', {
    name,
    event_type:      quote.event_type || 'Event',
    event_date:      eventDate,
    party_size:      quote.party_size,
    service_type:    quote.service_type || 'Delivery',
    quote_number:    `#CAT-${String(quote.id).padStart(4, '0')}`,
    estimated_total: quote.estimated_total || 0,
  });
  return sendMailHelper(
    email,
    `Catering Inquiry Received — #CAT-${String(quote.id).padStart(4, '0')}`,
    html,
  );
};

const sendCateringAdminAlert = async (adminEmail, quote) => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleString('en-US')
    : 'TBD';
  const html = renderEmail('catering-admin-alert', {
    name:            quote.name,
    email:           quote.email,
    phone:           quote.phone || '—',
    event_type:      quote.event_type || '—',
    event_date:      eventDate,
    party_size:      quote.party_size,
    service_type:    quote.service_type,
    estimated_total: quote.estimated_total || 0,
    notes:           quote.notes || '—',
  });
  return sendMailHelper(
    adminEmail,
    `[Catering] New Request from ${quote.name} — ${quote.party_size} guests`,
    html,
  );
};

const sendCateringInvoice = async (email, name, quote, invoiceNotes = '') => {
  const eventDate = quote.scheduled_date
    ? new Date(quote.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const finalPrice = parseFloat(quote.quoted_price || quote.estimated_total || 0).toFixed(2);
  const html = renderEmail('catering-invoice', {
    name,
    quote_number:  `#CAT-${String(quote.id).padStart(4, '0')}`,
    event_type:    quote.event_type || 'Event',
    event_date:    eventDate,
    party_size:    quote.party_size,
    service_type:  quote.service_type,
    final_price:   finalPrice,
    invoice_notes: invoiceNotes || null,
  });
  return sendMailHelper(
    email,
    `Catering Invoice #CAT-${String(quote.id).padStart(4, '0')} — $${finalPrice}`,
    html,
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
