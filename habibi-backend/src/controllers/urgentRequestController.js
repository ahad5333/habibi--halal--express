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

// Admin: mark a request resolved/reopened — this endpoint didn't exist before,
// so every request stayed "open" forever with no way to clear it.
const updateUrgentRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ message: "status must be 'open' or 'resolved'." });
    }
    const result = await pool.query(
      "UPDATE urgent_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Request not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  createUrgentRequest,
  getUrgentRequests,
  updateUrgentRequestStatus,
};
