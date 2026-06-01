const twilio = require('twilio');

/**
 * Habibi SMS Gateway - Powered by Twilio
 * This service handles all outgoing transmissions (Urgent SOS, Order Updates, Marketing).
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

let client;

// Initialize Twilio client only if credentials exist
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

const sendSMS = async (to, body) => {
  console.log(`[Habibi SMS Gateway] Attempting transmission to ${to}...`);
  
  if (!client) {
    console.log("--- MOCK SMS (No Credentials) ---");
    console.log(`TO: ${to}`);
    console.log(`BODY: ${body}`);
    console.log("---------------------------------");
    return { success: true, message: "Mock SMS logged to console." };
  }

  try {
    const message = await client.messages.create({
      body: `Habibi Halal: ${body}`,
      from: twilioNumber,
      to: to
    });
    console.log(`[Habibi SMS Gateway] Transmission successful! SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error(`[Habibi SMS Gateway] Transmission FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Specialized Transmissions
 */

const sendOrderUpdate = async (to, orderId, status) => {
  const statusMessages = {
    'preparing': `Your legendary order #${orderId} is now in the kitchen! The chef is working their magic.`,
    'in-transit': `Good news! Order #${orderId} is out for delivery. Stand by for the Habibi experience.`,
    'delivered': `Order #${orderId} has been delivered. Enjoy your meal! Stay legendary.`,
    'cancelled': `Order #${orderId} has been cancelled. If this was a mistake, please contact us.`
  };
  
  const body = statusMessages[status.toLowerCase()] || `Your order #${orderId} status is now: ${status}`;
  return await sendSMS(to, body);
};

const sendUrgentSOS = async (adminPhone, details) => {
  const body = `🚨 URGENT SOS: ${details.name} requested immediate help. Reason: ${details.reason}. Contact: ${details.phone}`;
  return await sendSMS(adminPhone, body);
};

module.exports = {
  sendSMS,
  sendOrderUpdate,
  sendUrgentSOS
};
