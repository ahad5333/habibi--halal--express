const pool = require('../config/db');

// Fetch pickup location details — uses location_id if provided, falls back to env vars
async function getPickupLocation(locationId) {
  if (locationId) {
    const res = await pool.query(
      `SELECT exact_address, phone_number FROM locations WHERE id = $1 AND is_active = true`,
      [locationId]
    );
    if (res.rows[0]) return { exact_address: res.rows[0].exact_address, phone_number: res.rows[0].phone_number };
  }
  // fallback to env vars (single-location mode)
  return {
    exact_address: process.env.RESTAURANT_ADDRESS || '204 E Mosholu Pkwy S, Bronx, NY 10458',
    phone_number:  process.env.RESTAURANT_PHONE   || '(718) 367-7878',
  };
}

async function createDelivery(order, customerAddress, partnerCredentials) {
  const pickupLocation = await getPickupLocation(order.location_id);
  const { api_key, api_secret } = partnerCredentials || {};

  if (!api_key || api_key === 'SIMULATED') {
    console.log(`[SIMULATION] Dispatching DoorDash delivery for Order #${order.order_number} from "${pickupLocation.exact_address}"`);
    const payload = {
      external_delivery_id:  order.order_number,
      pickup_address:        pickupLocation.exact_address,
      pickup_phone_number:   pickupLocation.phone_number,
      dropoff_address:       customerAddress,
      dropoff_phone_number:  order.customer_phone || '000-000-0000',
      order_value:           Math.round(order.total * 100),
    };
    console.log('[SIMULATION] DoorDash Payload:', payload);
    return {
      success:      true,
      delivery_id:  `DD_SIM_${Date.now()}`,
      tracking_url: `https://simulated.doordash.com/track/${order.order_number}`,
      fee:          6.99,
      status:       'quote_accepted',
    };
  }

  // Real DoorDash Drive API (requires JWT signing with api_secret)
  throw new Error('Real DoorDash API not fully implemented yet.');
}

module.exports = { createDelivery, getPickupLocation };
