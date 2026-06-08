const pool = require("../config/db");
const jwt  = require("jsonwebtoken");


async function saveMessage(order_number, sender, text) {
  try {
    await pool.query(
      `INSERT INTO chat_messages (order_number, sender, text) VALUES ($1, $2, $3)`,
      [order_number, sender, text]
    );
  } catch (err) {
    console.error("[SOCKET] Failed to persist chat message:", err.message);
  }
}

module.exports = (io) => {
  // Decode JWT if present — sets socket.data.user for authenticated clients.
  // Unauthenticated guests are allowed through so the order-tracking page
  // works for guest checkouts (order IDs are hard to guess: HAB-<timestamp>).
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
      }
    } catch (_) { /* invalid/expired token — proceed as guest */ }
    next();
  });

  io.on("connection", (socket) => {
    const userLabel = socket.data.user ? `user:${socket.data.user.id}` : "guest";
    console.log(`[SOCKET] ${userLabel} connected (${socket.id})`);

    // ── join_order ────────────────────────────────────────────────────────────
    // Verify the order actually exists before admitting the socket to the room.
    // Authenticated users must own the order (or be admin/driver).
    // Guests may join any room whose order number exists — IDs are time-based
    // UUIDs and not guessable in practice.
    socket.on("join_order", async (orderId) => {
      try {
        if (!orderId || typeof orderId !== "string" || orderId.length > 64) return;

        // Confirm the order exists
        const { rows } = await pool.query(
          `SELECT order_number, customer_email FROM guest_orders WHERE order_number = $1 LIMIT 1`,
          [orderId]
        );
        if (rows.length === 0) {
          socket.emit("error", { message: "Order not found." });
          return;
        }

        const order = rows[0];
        const user  = socket.data.user;

        // If authenticated: must own the order OR be admin/driver
        if (user) {
          const isOwner  = order.customer_email && user.email === order.customer_email;
          const isStaff  = user.role === "admin" || user.role === "driver";
          if (!isOwner && !isStaff) {
            socket.emit("error", { message: "Not authorised to track this order." });
            return;
          }
        }

        socket.join(`order_${orderId}`);
      } catch (err) {
        console.error("[SOCKET] join_order error:", err.message);
      }
    });

    socket.on("leave_order", (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // ── update_location ───────────────────────────────────────────────────────
    // Only authenticated drivers or admins may push GPS updates.
    socket.on("update_location", (data) => {
      const role = socket.data.user?.role;
      if (role !== "driver" && role !== "admin") return;
      const { order_id, lat, lng, progress } = data;
      io.to(`order_${order_id}`).emit("driver_location_update", { order_id, lat, lng, progress });
    });

    // ── send_message ──────────────────────────────────────────────────────────
    // Sender identity comes from the verified JWT, not the client payload.
    // Unauthenticated sockets are labelled "customer" (guest order tracking).
    socket.on("send_message", async (data) => {
      const { order_id, text, timestamp } = data;
      if (!order_id || !text || typeof text !== "string" || text.length > 2000) return;

      // Derive sender from JWT role; fall back to "customer" for guests
      const role   = socket.data.user?.role;
      const sender = (role === "admin" || role === "driver") ? role : "customer";
      const room   = `order_${order_id}`;

      await saveMessage(order_id, sender, text);
      io.to(room).emit("receive_message", { order_id, sender, text, timestamp });
      console.log(`[SOCKET] Chat [${room}] ${sender}: ${text}`);
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] User disconnected:", socket.id);
    });
  });
};

