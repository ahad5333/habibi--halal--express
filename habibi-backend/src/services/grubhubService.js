/**
 * Simulated GrubHub Webhook Service
 * Handles incoming webhooks for new orders placed on the GrubHub Marketplace.
 */

async function processIncomingOrder(payload) {
  console.log('[SIMULATION] Processing incoming GrubHub order webhook...');
  
  if (!payload || !payload.order_id) {
    throw new Error('Invalid GrubHub payload');
  }

  // Simulated payload transformation to local Order format
  const normalizedOrder = {
    partner_order_id: payload.order_id,
    delivery_partner: 'grubhub',
    customer_name: payload.customer ? `${payload.customer.first_name} ${payload.customer.last_name}` : 'GrubHub Customer',
    sub_total: payload.totals ? payload.totals.subtotal.toFixed(2) : '0.00',
    total: payload.totals ? payload.totals.total.toFixed(2) : '0.00',
    items: payload.lines || [],
    special_notes: payload.special_instructions || '',
    order_status: 'received'
  };

  console.log('[SIMULATION] Normalized GrubHub Order:', normalizedOrder);
  return normalizedOrder;
}

module.exports = {
  processIncomingOrder
};
