const safeError = require('../utils/safeError');
const pool = require("../config/db");

// payment_methods.customer_id is a foreign key to customers.id, NOT
// users.id — customers is a separate 1:1 profile table (linked via
// customers.user_id) that nothing else populates. Resolve/create it here
// so the authenticated user's JWT id can be used to reach their payment
// methods without ever touching the customers table directly elsewhere.
async function resolveCustomerId(userId, { create = false } = {}) {
  const existing = await pool.query("SELECT id FROM customers WHERE user_id=$1", [userId]);
  if (existing.rows.length) return existing.rows[0].id;
  if (!create) return null;

  // first_name/last_name are NOT NULL on customers — pull from the user's
  // account name (falling back to placeholders for a nameless guest-turned-user).
  const userRow = await pool.query("SELECT name FROM users WHERE id=$1", [userId]);
  const fullName = (userRow.rows[0]?.name || '').trim();
  const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : ['Customer'];
  const lastName = rest.join(' ') || '—';

  const created = await pool.query(
    "INSERT INTO customers (user_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
    [userId, firstName, lastName]
  );
  return created.rows[0].id;
}

// Get saved payment methods
const getPaymentMethods = async (req, res) => {
  try {
    const customerId = await resolveCustomerId(req.user.id);
    if (!customerId) return res.json([]); // no customer profile yet => no saved methods
    const result = await pool.query(
      "SELECT id, type AS brand, last_four AS last4, is_default, created_at FROM payment_methods WHERE customer_id=$1 ORDER BY is_default DESC, created_at DESC",
      [customerId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Add payment method (Mock)
const addPaymentMethod = async (req, res) => {
  try {
    const customerId = await resolveCustomerId(req.user.id, { create: true });
    const { brand, last4, token } = req.body;

    // If is_default is true, unset others
    if (req.body.is_default) {
      await pool.query("UPDATE payment_methods SET is_default=FALSE WHERE customer_id=$1", [customerId]);
    }

    const result = await pool.query(
      `INSERT INTO payment_methods (customer_id, type, last_four, token, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, type AS brand, last_four AS last4, is_default, created_at`,
      [customerId, brand, last4, token || 'mock_token', req.body.is_default || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Set default
const setDefaultMethod = async (req, res) => {
  try {
    const customerId = await resolveCustomerId(req.user.id);
    const { id } = req.params;
    if (!customerId) return res.status(404).json({ message: 'Payment method not found' });

    await pool.query("UPDATE payment_methods SET is_default=FALSE WHERE customer_id=$1", [customerId]);
    const result = await pool.query(
      "UPDATE payment_methods SET is_default=TRUE WHERE id=$1 AND customer_id=$2 RETURNING id, type AS brand, last_four AS last4, is_default, created_at",
      [id, customerId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Delete payment method
const deletePaymentMethod = async (req, res) => {
  try {
    const customerId = await resolveCustomerId(req.user.id);
    const { id } = req.params;
    if (!customerId) return res.json({ message: "Payment method removed" });

    await pool.query("DELETE FROM payment_methods WHERE id=$1 AND customer_id=$2", [id, customerId]);
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
