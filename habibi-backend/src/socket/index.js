const pool = require("../config/db");
const jwt  = require("jsonwebtoken");

const DRIVER_RESPONSES = [
  "Assalamu Alaikum! I'm currently picking up your food. It should be hot and fresh!",
  "I'm at the Bronx Habibi Express kitchen now. They are packing it up.",
  "En route to your location. Traffic is light, should be there soon!",
  "I've arrived near your delivery location. Coming up now!",
  "Got your message! Let me know if you need anything else.",
  "Thank you for ordering with Habibi Halal Express! Delivery is on the way.",
];

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
  // Optional JWT decode — sets socket.data.user if a valid token is provided;
  // does NOT disconnect unauthenticated clients (tracking page works without login).
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
      }
    } catch (_) { /* invalid token — proceed as guest */ }
    next();
  });

  io.on("connection", (socket) => {
    const userLabel = socket.data.user ? `user:${socket.data.user.id}` : "guest";
    console.log(`[SOCKET] ${userLabel} connected (${socket.id})`);

    socket.on("join_order", (orderId) => {
      const room = `order_${orderId}`;
      socket.join(room);
    });

    socket.on("leave_order", (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    socket.on("update_location", (data) => {
      // Only authenticated drivers or admins may push GPS updates
      const role = socket.data.user?.role;
      if (role !== "driver" && role !== "admin") return;
      const { order_id, lat, lng, progress } = data;
      io.to(`order_${order_id}`).emit("driver_location_update", { order_id, lat, lng, progress });
    });

    socket.on("send_message", async (data) => {
      const { order_id, sender, text, timestamp } = data;
      const room = `order_${order_id}`;

      // Persist customer message
      await saveMessage(order_id, sender, text);

      // Broadcast to everyone in the room
      io.to(room).emit("receive_message", { order_id, sender, text, timestamp });
      console.log(`[SOCKET] Chat [${room}] ${sender}: ${text}`);

      // Simulated driver auto-reply (remove when real driver app is live)
      if (sender === "customer") {
        setTimeout(async () => {
          const text = DRIVER_RESPONSES[Math.floor(Math.random() * DRIVER_RESPONSES.length)];
          const ts   = new Date().toISOString();
          await saveMessage(order_id, "driver", text);
          io.to(room).emit("receive_message", { order_id, sender: "driver", text, timestamp: ts });
        }, 1500);
      }
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] User disconnected:", socket.id);
    });
  });
};

