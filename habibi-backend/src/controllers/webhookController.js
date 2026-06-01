const safeError = require('../utils/safeError');
const pool = require("../config/db");

/**
 * Habibi Partner Webhook Controller
 * Processes incoming signals from DoorDash, Uber Direct, and Grubhub.
 */

const handleDoorDashWebhook = async (req, res) => {
  const { event_name, data } = req.body;
  const io = req.app.get("io");

  console.log(`[Webhook] DoorDash Signal Received: ${event_name}`);

  try {
    if (event_name === 'DASHER_STATUS_UPDATE') {
      const { delivery_id, dasher_location, status } = data;
      // Update order status and driver location in DB
      await pool.query(
        "UPDATE orders SET status = $1, driver_lat = $2, driver_lng = $3 WHERE external_order_id = $4",
        [status, dasher_location?.lat, dasher_location?.lng, delivery_id]
      );

      // Notify frontend tracking via Socket.io
      if (io) {
        io.to(`order_external_${delivery_id}`).emit("driver_location_update", {
          lat: dasher_location?.lat,
          lng: dasher_location?.lng,
          status
        });
      }
    }
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Error] DoorDash:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

const handleUberWebhook = async (req, res) => {
  const { type, data } = req.body;
  console.log(`[Webhook] Uber Signal Received: ${type}`);
  // Similar logic for Uber Direct
  res.status(200).send("OK");
};

const { processIncomingOrder: processUberOrder } = require('../services/uberEatsService');
const { processIncomingOrder: processGrubhubOrder } = require('../services/grubhubService');

const handleOrderIngest = async (req, res) => {
  const { partner, order_data } = req.body;
  const io = req.app.get("io");
  
  try {
    let normalizedOrder;
    if (partner === 'uber_eats') {
      normalizedOrder = await processUberOrder(order_data);
    } else if (partner === 'grubhub') {
      normalizedOrder = await processGrubhubOrder(order_data);
    } else {
      return res.status(400).json({ error: "Unsupported partner" });
    }

    const { rows } = await pool.query(
      `INSERT INTO orders 
       (order_number, delivery_partner, partner_order_id, sub_total, total, special_notes, order_status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [
        `PARTNER-${Date.now()}`,
        normalizedOrder.delivery_partner,
        normalizedOrder.partner_order_id,
        normalizedOrder.sub_total,
        normalizedOrder.total,
        normalizedOrder.special_notes,
        normalizedOrder.order_status
      ]
    );

    const newOrder = rows[0];

    // Notify Admin CPanel via Socket.io
    if (io) {
      io.emit('new_partner_order', newOrder);
    }
    
    console.log(`[Order Ingest] New order ingested from ${partner} (ID: ${newOrder.id})`);
    res.status(201).json({ success: true, message: "Order ingested", order: newOrder });
  } catch (error) {
    console.error("[Webhook Error] Ingest:", error.message);
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  handleDoorDashWebhook,
  handleUberWebhook,
  handleOrderIngest
};
