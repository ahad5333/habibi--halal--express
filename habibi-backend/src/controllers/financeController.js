const safeError = require('../utils/safeError');
const pool = require("../config/db");

// Get user balance and transaction history
const getFinanceSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userRes = await pool.query("SELECT balance FROM users WHERE id=$1", [userId]);
    const transRes = await pool.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
      [userId]
    );

    res.json({
      balance: userRes.rows[0].balance,
      transactions: transRes.rows
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Process a Quick Pay or Balance Payment
const processPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const { amount, type, description } = req.body; // type: 'quick_pay' or 'balance_payment'

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }

    // 1. Record transaction
    const transResult = await client.query(
      "INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, type, amount, 'success']
    );

    // 2. If it's a balance payment, reduce the user's balance (debt)
    // Note: In this system, 'balance' in users table represents debt if positive? 
    // Or credit if positive? Usually 'balance' is credit. 
    // Let's assume 'balance' is CREDIT. 
    // So 'Pay Balance' means adding credit to the account.
    
    await client.query(
      "UPDATE users SET balance = balance + $1 WHERE id=$2",
      [amount, userId]
    );

    await client.query('COMMIT');
    res.json({
      message: "Payment processed successfully",
      transaction: transResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json(safeError(error));
  } finally {
    client.release();
  }
};

module.exports = {
  getFinanceSummary,
  processPayment
};
