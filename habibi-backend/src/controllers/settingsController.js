const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getPaymentSettings = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payment_settings WHERE is_active=TRUE ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getCheckoutSettings = (req, res) => {
  res.json({
    tax_rate:                parseFloat(process.env.TAX_RATE)                || 0.08875,
    service_fee_rate:        parseFloat(process.env.SERVICE_FEE_RATE)        || 0.04273,
    delivery_fee:            parseFloat(process.env.DELIVERY_FEE)            || 3.99,
    free_delivery_threshold: parseFloat(process.env.FREE_DELIVERY_THRESHOLD) || 50,
  });
};

module.exports = {
  getPaymentSettings,
  getCheckoutSettings,
};
