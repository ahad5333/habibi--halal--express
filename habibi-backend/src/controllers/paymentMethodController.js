const safeError = require('../utils/safeError');
const pool = require("../config/db");

// Get saved payment methods
const getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT id, type AS brand, last_four AS last4, is_default, created_at FROM payment_methods WHERE customer_id=$1 ORDER BY is_default DESC, created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Add payment method (Mock)
const addPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { brand, last4, token } = req.body;

    // If is_default is true, unset others
    if (req.body.is_default) {
      await pool.query("UPDATE payment_methods SET is_default=FALSE WHERE customer_id=$1", [userId]);
    }

    const result = await pool.query(
      `INSERT INTO payment_methods (customer_id, type, last_four, token, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, type AS brand, last_four AS last4, is_default, created_at`,
      [userId, brand, last4, token || 'mock_token', req.body.is_default || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Set default
const setDefaultMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query("UPDATE payment_methods SET is_default=FALSE WHERE customer_id=$1", [userId]);
    const result = await pool.query(
      "UPDATE payment_methods SET is_default=TRUE WHERE id=$1 AND customer_id=$2 RETURNING id, type AS brand, last_four AS last4, is_default, created_at",
      [id, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Delete payment method
const deletePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query("DELETE FROM payment_methods WHERE id=$1 AND customer_id=$2", [id, userId]);
    res.json({ message: "Payment method removed" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultMethod,
  deletePaymentMethod
};
