const safeError = require('../utils/safeError');
const pool = require("../config/db");

const assignDriver = async (req, res) => {
    try {
        const io = req.app.get("io");

        const { order_id, driver_name, driver_phone } = req.body;

        const result = await pool.query(
            `
      INSERT INTO deliveries
      (order_id, driver_name, driver_phone, status)
      VALUES($1,$2,$3,'assigned')
      RETURNING *
      `,
            [order_id, driver_name, driver_phone]
        );

        const delivery = result.rows[0];

        // 🔥 REALTIME UPDATE
        io.to(`order_${order_id}`).emit("driver_assigned", {
            order_id,
            driver_name,
            driver_phone
        });

        res.json({
            message: "Driver assigned",
            delivery
        });

    } catch (err) {
        res.status(500).json(safeError(err));
    }
};
const updateDriverLocation = async (req, res) => {
    try {
        const io = req.app.get("io");

        const { order_id, lat, lng } = req.body;

        await pool.query(
            `
      UPDATE deliveries
      SET current_lat=$1, current_lng=$2
      WHERE order_id=$3
      `,
            [lat, lng, order_id]
        );

        // 🔥 REALTIME LOCATION
        io.to(`order_${order_id}`).emit("driver_location_update", {
            order_id,
            lat,
            lng
        });

        res.json({ message: "Location updated" });

    } catch (err) {
        res.status(500).json(safeError(err));
    }
};
const updateDeliveryStatus = async (req, res) => {
    try {
        const io = req.app.get("io");

        const { order_id, status } = req.body;

        await pool.query(
            `
      UPDATE deliveries
      SET status=$1
      WHERE order_id=$2
      `,
            [status, order_id]
        );

        // 🔥 REALTIME STATUS UPDATE
        io.to(`order_${order_id}`).emit("delivery_status", {
            order_id,
            status
        });

        res.json({ message: "Delivery status updated" });

    } catch (err) {
        res.status(500).json(safeError(err));
    }
};
module.exports = {
    assignDriver,
    updateDriverLocation,
    updateDeliveryStatus
};