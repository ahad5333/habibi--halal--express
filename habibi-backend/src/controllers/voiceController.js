const twilio = require('twilio');
const pool = require('../config/db');
const { isOpenNow } = require('../utils/businessHours');
const { toE164 } = require('../services/smsService');

// ── Habibi Voice/IVR ──────────────────────────────────────────────────────────
// Simple info/redirect IVR for the existing toll-free number (confirmed
// identical to TWILIO_PHONE_NUMBER, already used for inbound SMS ordering —
// see contactController.js's handleInboundSms). No ordering or payment lives
// in the phone tree; a caller who wants to order gets a text link instead.
// Modeled directly on that same SMS webhook's signature-verification and
// TwiML-response pattern.

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function escapeXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  const publicUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return !!(authToken && signature && twilio.validateRequest(authToken, signature, publicUrl, req.body || {}));
}

async function isAnyLocationOpen() {
  const locsRes = await pool.query(
    `SELECT accepting_orders, working_days_hours FROM locations WHERE is_active = true`
  );
  return locsRes.rows.length === 0 || locsRes.rows.some(l => {
    if (l.accepting_orders === false) return false;
    const auto = isOpenNow(l.working_days_hours);
    return auto === true || auto === null;
  });
}

async function getHoursAndAddress() {
  const [locRes, settingsRes] = await Promise.all([
    pool.query(`SELECT working_days_hours FROM locations WHERE is_active = true ORDER BY id LIMIT 1`),
    pool.query(`SELECT address_street, address_city, address_state, address_zip, phone_main FROM site_settings WHERE id = 1`),
  ]);
  const hours = locRes.rows[0]?.working_days_hours || 'We are open daily.';
  const s = settingsRes.rows[0] || {};
  const address = s.address_street ? `${s.address_street}, ${s.address_city}, ${s.address_state} ${s.address_zip}` : '';
  return { hours, address, phoneMain: s.phone_main || '' };
}

// Same phone-digits-keyed reorder lookup already used by the ORDER keyword in
// contactController.js's SMS webhook — reused, not reimplemented.
async function findReorderLink(fromNumber) {
  const digits = (fromNumber || '').replace(/\D/g, '');
  if (!digits) return `${FRONTEND_URL}/menu`;
  // RIGHT(...,10) on both sides -- Twilio's From always includes a country
  // code, but guest_orders.customer_phone is a mix of 10- and 11-digit
  // values; an exact-length match would silently miss real matches. Same
  // fix applied to the identical lookup in contactController.js.
  const lastOrder = await pool.query(
    `SELECT order_number FROM guest_orders
      WHERE RIGHT(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = RIGHT($1, 10)
      ORDER BY placed_at DESC LIMIT 1`,
    [digits]
  ).catch(() => ({ rows: [] }));
  return lastOrder.rows[0]
    ? `${FRONTEND_URL}/reorder?order=${lastOrder.rows[0].order_number}`
    : `${FRONTEND_URL}/menu`;
}

const MENU_GATHER = (say) => `
  <Gather numDigits="1" action="/api/voice/menu" method="POST" timeout="6" actionOnEmptyResult="true">
    <Say>${escapeXml(say)}</Say>
  </Gather>
  <Say>We didn't get your selection.</Say>
`;

const handleIncomingCall = async (req, res) => {
  res.set('Content-Type', 'text/xml');
  try {
    if (!verifyTwilioSignature(req)) {
      console.error('[Voice Webhook] Invalid or missing Twilio signature -- rejecting.');
      return res.status(403).send('<Response></Response>');
    }

    const open = await isAnyLocationOpen();
    if (!open) {
      const { hours } = await getHoursAndAddress();
      return res.send(`<Response>
        <Say>Thanks for calling Habibi Halal Express. We're currently closed. ${escapeXml(hours)}</Say>
        <Say>Text ORDER to this number to reorder your last meal, or visit habibihe.com. Goodbye!</Say>
        <Hangup/>
      </Response>`);
    }

    return res.send(`<Response>
      <Say>Thanks for calling Habibi Halal Express!</Say>
      ${MENU_GATHER('Press 1 for a text link to order online. Press 2 to speak with our team. Press 3 to hear our hours and address.')}
    </Response>`);
  } catch (err) {
    console.error('[Voice Webhook] incoming error:', err.message);
    res.status(500).send('<Response></Response>');
  }
};

const handleMenuChoice = async (req, res) => {
  res.set('Content-Type', 'text/xml');
  try {
    if (!verifyTwilioSignature(req)) {
      console.error('[Voice Webhook] Invalid or missing Twilio signature -- rejecting.');
      return res.status(403).send('<Response></Response>');
    }

    const digit = (req.body?.Digits || '').trim();
    const { hours, address, phoneMain } = await getHoursAndAddress();

    if (digit === '1') {
      const link = await findReorderLink(req.body?.From);
      return res.send(`<Response>
        <Sms>Habibi Halal Express: Order online here: ${escapeXml(link)}</Sms>
        <Say>We've just texted you a link to order online. Thanks for calling Habibi Halal Express!</Say>
        <Hangup/>
      </Response>`);
    }

    if (digit === '3') {
      return res.send(`<Response>
        <Say>Our hours are: ${escapeXml(hours)}. We're located at ${escapeXml(address)}.</Say>
        ${MENU_GATHER('Press 1 for a text link to order online. Press 2 to speak with our team. Press 3 to hear our hours and address again.')}
      </Response>`);
    }

    // Digit 2, an unrecognized digit, or no input at all -- always fall back
    // to a real person rather than leaving a caller stuck.
    if (!phoneMain) {
      return res.send(`<Response>
        <Say>Sorry, we're unable to connect your call right now. Please try again later. Goodbye!</Say>
        <Hangup/>
      </Response>`);
    }
    return res.send(`<Response>
      <Say>Connecting you now.</Say>
      <Dial>${escapeXml(toE164(phoneMain))}</Dial>
    </Response>`);
  } catch (err) {
    console.error('[Voice Webhook] menu error:', err.message);
    res.status(500).send('<Response></Response>');
  }
};

module.exports = { handleIncomingCall, handleMenuChoice };
