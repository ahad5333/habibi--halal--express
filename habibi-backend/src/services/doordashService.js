/**
 * Simulated DoorDash Drive Service
 * In a real scenario, this service interacts with the DoorDash Developer API
 * endpoint: POST https://openapi.doordash.com/drive/v2/deliveries
 */

async function createDelivery(order, pickupLocation, customerAddress, partnerCredentials) {
  const { api_key, api_secret } = partnerCredentials;
  
  if (!api_key || api_key === 'SIMULATED') {
    console.log(`[SIMULATION] Dispatching DoorDash delivery for Order #${order.order_number}`);
    
    // Simulate DoorDash payload creation
    const payload = {
      external_delivery_id: order.order_number,
      pickup_address: pickupLocation.exact_address,
      pickup_phone_number: pickupLocation.phone_number,
      dropoff_address: customerAddress,
      dropoff_phone_number: order.customer_phone || "000-000-0000",
      order_value: Math.round(order.total * 100) // in cents
    };

    console.log('[SIMULATION] DoorDash Payload:', payload);

    return {
      success: true,
      delivery_id: `DD_SIM_${Date.now()}`,
      tracking_url: `https://simulated.doordash.com/track/${order.order_number}`,
      fee: 6.99,
      status: 'quote_accepted'
    };
  }

  // Real API implementation goes here (requires JWT signing with api_secret)
  throw new Error("Real DoorDash API not fully implemented yet.");
}

module.exports = {
  createDelivery
};
