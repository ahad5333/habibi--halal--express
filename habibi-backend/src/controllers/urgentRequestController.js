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

    // Trigger SMS Notification to Admin — these are safety-critical alerts
    // (medical emergency, food safety), so a misconfigured/missing admin
    // phone must never fail silently. If this ever logs, urgent alerts are
    // being sent nowhere despite customers seeing "Alert Dispatched".
    const adminPhone = process.env.ADMIN_CPANEL_PHONE;
    if (!adminPhone) {
      console.error('[URGENT ALERT] ADMIN_CPANEL_PHONE is not configured — urgent SOS SMS was NOT sent for request:', { name, phone, reason });
    } else {
      sendUrgentSOS(adminPhone, { name, phone, reason }).catch(err =>
        console.error('[URGENT ALERT] Failed to send SOS SMS:', err.message)
      );
    }

    // Driver safety SOS additionally gets a live, unmissable alert on the
    // admin dispatch board (DeliveryDispatch.jsx) -- dispatch is already
    // watching that screen in real time while drivers are out, so this
    // reaches them faster than waiting on the SMS/UrgentRequests inbox alone.
    if (reason === 'Driver Safety SOS') {
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('driver_sos', { name, phone, order_id, message, created_at: result.rows[0].created_at });
      }
    }

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
