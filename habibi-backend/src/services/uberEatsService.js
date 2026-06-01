/**
 * Simulated Uber Eats Webhook Service
 * Handles incoming webhooks for new orders placed on the Uber Eats Marketplace.
 */

async function processIncomingOrder(payload) {
  console.log('[SIMULATION] Processing incoming Uber Eats order webhook...');
  
  if (!payload || !payload.id) {
    throw new Error('Invalid Uber Eats payload');
  }

  // Simulated payload transformation to local Order format
  const normalizedOrder = {
    partner_order_id: payload.id,
    delivery_partner: 'uber_eats',
    customer_name: payload.eater ? `${payload.eater.first_name} ${payload.eater.last_name}` : 'UberEats Customer',
    sub_total: (payload.payment && payload.payment.subtotal) ? (payload.payment.subtotal / 100).toFixed(2) : '0.00',
    total: (payload.payment && payload.payment.total) ? (payload.payment.total / 100).toFixed(2) : '0.00',
    items: payload.items || [],
    special_notes: payload.special_instructions || '',
    order_status: 'received'
  };

  console.log('[SIMULATION] Normalized Uber Eats Order:', normalizedOrder);
  return normalizedOrder;
}

module.exports = {
  processIncomingOrder
};
