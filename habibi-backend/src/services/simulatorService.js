const pool = require("../config/db");
const { sendOrderUpdate } = require("./smsService");

/**
 * Habibi Order Progression and Driver GPS Simulator
 * Automates real-time order states and driver movement triggers in Developer/Mock mode.
 */
class SimulatorService {
  constructor() {
    this.activeSimulations = new Set();
  }

  /**
   * Start a background state progression and GPS coordinate tick simulation for an order
   */
  startOrderSimulation(io, orderId, orderType = "delivery", customerName = "Customer", customerPhone = "") {
    if (this.activeSimulations.has(orderId)) return;
    this.activeSimulations.add(orderId);

    console.log(`[SIMULATOR] Commencing automated progression for Order #${orderId} (Type: ${orderType})...`);

    // Helper to safely update database status columns
    const updateDbStatus = async (status) => {
      try {
        // Update both standard order status columns just in case
        await pool.query(
          "UPDATE orders SET status = $1, order_status = $1 WHERE id = $2",
          [status, orderId]
        );
        
        // Dispatch SMS updates (simulated/log output)
        if (customerPhone) {
          sendOrderUpdate(customerPhone, orderId, status);
        }
      } catch (err) {
        console.error(`[SIMULATOR] DB update failed for Order #${orderId}:`, err.message);
      }
    };

    // Helper to emit status socket updates
    const emitStatus = (status) => {
      if (io) {
        io.to(`order_${orderId}`).emit("order_status_updated", {
          order_id: orderId,
          status
        });
      }
    };

    // Stage 1: Placed (Instant - already set)

    // Stage 2: Preparing (after 6 seconds)
    setTimeout(async () => {
      console.log(`[SIMULATOR] Order #${orderId} -> PREPARING`);
      await updateDbStatus("preparing");
      emitStatus("preparing");
    }, 6000);

    // Stage 3: Cooking (after 16 seconds)
    setTimeout(async () => {
      console.log(`[SIMULATOR] Order #${orderId} -> COOKING`);
      await updateDbStatus("cooking");
      emitStatus("cooking");
    }, 16000);

    // Stage 4: Ready (after 28 seconds)
    setTimeout(async () => {
      console.log(`[SIMULATOR] Order #${orderId} -> READY`);
      await updateDbStatus("ready");
      emitStatus("ready");
    }, 28000);

    // Stage 5: Courier Dispatch / Delivery Flow (after 36 seconds)
    setTimeout(async () => {
      if (orderType === "pickup") {
        console.log(`[SIMULATOR] Order #${orderId} (Pickup) -> DELIVERED`);
        await updateDbStatus("delivered");
        emitStatus("delivered");
        this.activeSimulations.delete(orderId);
      } else {
        console.log(`[SIMULATOR] Order #${orderId} (Delivery) -> OUT FOR DELIVERY. Dispatching simulated courier...`);
        await updateDbStatus("out_for_delivery");
        emitStatus("out_for_delivery");

        // Broadcast Driver Profile Details
        if (io) {
          io.to(`order_${orderId}`).emit("driver_info", {
            order_id: orderId,
            driver_name: "Sherif Halal Express Courier",
            driver_phone: "+1 (718) 555-0199",
            driver_vehicle: "White Toyota Prius (Plate: HHE-2026)"
          });
        }

        // Start GPS progression ticks
        // From Hub (Midtown Manhattan) to Customer (Times Square)
        let lat = 40.7128;
        let lng = -74.0060;
        const destLat = 40.7580;
        const destLng = -73.9855;
        
        const steps = 15;
        const latStep = (destLat - lat) / steps;
        const lngStep = (destLng - lng) / steps;
        let currentStep = 0;

        const gpsInterval = setInterval(async () => {
          lat += latStep;
          lng += lngStep;
          currentStep++;

          console.log(`[SIMULATOR] Order #${orderId} Courier GPS Tick ${currentStep}/${steps}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

          if (io) {
            io.to(`order_${orderId}`).emit("driver_location_update", {
              order_id: orderId,
              lat,
              lng
            });
          }

          if (currentStep >= steps) {
            clearInterval(gpsInterval);
            console.log(`[SIMULATOR] Order #${orderId} Courier arrived! -> DELIVERED`);
            await updateDbStatus("delivered");
            emitStatus("delivered");
            this.activeSimulations.delete(orderId);
          }
        }, 1500); // 1.5 seconds per step
      }
    }, 36000);
  }
}

module.exports = new SimulatorService();
