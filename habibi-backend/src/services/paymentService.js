/**
 * Habibi Payment Gateway Service
 * Architected for Square and Clover integration.
 */

class PaymentService {
  constructor() {
    this.mode = process.env.PAYMENT_MODE || 'mock'; // mock or production
  }

  /**
   * Process a Credit Card transaction
   */
  async processPayment({ amount, currency, sourceId, provider = 'square' }) {
    console.log(`[Payment] Initializing ${provider} transaction for $${amount}...`);

    if (this.mode === 'mock') {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 95% success rate for mocks
      if (Math.random() > 0.05) {
        return {
          success: true,
          transactionId: `TXN_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          status: 'COMPLETED',
          provider
        };
      } else {
        throw new Error("Insufficient funds (Simulated Error)");
      }
    }

    // PRODUCTION LOGIC (To be activated with keys)
    if (provider === 'square') {
      // return await squareClient.paymentsApi.createPayment({ ... });
    } else if (provider === 'clover') {
      // return await cloverClient.process({ ... });
    }
  }

  /**
   * Calculate Taxes and Fees
   */
  calculateTotals(subtotal, tipPercent = 0, customTip = 0) {
    const TAX_RATE = 0.08875; // NYC 8.875%
    const SERVICE_FEE_RATE = 0.04273; // 4.273%
    
    const tax = subtotal * TAX_RATE;
    const serviceFee = subtotal * SERVICE_FEE_RATE;
    const tip = tipPercent > 0 ? (subtotal * (tipPercent / 100)) : parseFloat(customTip);
    
    const total = subtotal + tax + serviceFee + tip;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      serviceFee: parseFloat(serviceFee.toFixed(2)),
      tip: parseFloat(tip.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }
}

module.exports = new PaymentService();
