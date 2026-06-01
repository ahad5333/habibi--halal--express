const safeError = require('../utils/safeError');
const pool = require("../config/db");

const { sendUrgentSOS } = require("../services/smsService");

const createUrgentRequest = async (req, res) => {
  try {
    const { name, phone, email, order_id, reason, message, urgency_level } = req.body;
    
    const result = await pool.query(
      `INSERT INTO urgent_requests (name, phone, email, order_id, reason, message, urgency_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phone, email, order_id, reason, message, urgency_level || 'High']
    );

    // Trigger SMS Notification to Admin
    const adminPhone = process.env.ADMIN_CPANEL_PHONE || "+17185550123";
    sendUrgentSOS(adminPhone, { name, phone, reason });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getUrgentRequests = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM urgent_requests ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  createUrgentRequest,
  getUrgentRequests
};
