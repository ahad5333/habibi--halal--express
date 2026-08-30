const pool = require("../config/db");
const jwt  = require("jsonwebtoken");
const { getDriverSecretSalt } = require("../utils/driverSecret");

// Per-socket message rate limiting: max 30 chat messages per minute
const MSG_WINDOW_MS = 60 * 1000;
const MSG_MAX = 30;
const msgCounters = new Map(); // socket.id → { count, resetAt }

function allowMessage(socketId) {
  const now = Date.now();
  let entry = msgCounters.get(socketId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + MSG_WINDOW_MS };
    msgCounters.set(socketId, entry);
  }
  entry.count++;
  return entry.count <= MSG_MAX;
}


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
      // Accept token from auth payload (mobile / legacy), query string, or httpOnly cookie
      let token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        const raw = socket.handshake.headers?.cookie || '';
        const match = raw.match(/(?:^|;\s*)auth_token=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }
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

    // ── join_admin ────────────────────────────────────────────────────────────
    // Merchant/admin clients join this room to receive kitchen-wide broadcasts.
    socket.on("join_admin", () => {
      const role = socket.data.user?.role;
      if (role === "admin" || role === "merchant") {
        socket.join("admins");
        console.log(`[SOCKET] ${userLabel} joined admins room`);
      } else {
        socket.emit("error", { message: "Admin authentication required." });
      }
    });

    // ── join_group / leave_group ──────────────────────────────────────
    // No auth required — session_id is unguessable (random hex)
    socket.on("join_group", (sessionId) => {
      if (!sessionId || typeof sessionId !== "string" || sessionId.length > 40) return;
      socket.join(`group_${sessionId}`);
    });

    socket.on("leave_group", (sessionId) => {
      if (sessionId) socket.leave(`group_${sessionId}`);
    });

    // ── join_driver ───────────────────────────────────────────────────────────
    // Only the driver themselves or an admin may join a driver room.
    socket.on("join_driver", (driverId) => {
      const id   = parseInt(driverId);
      const user = socket.data.user;
      if (!id || isNaN(id)) return;
      if (!user) {
        socket.emit("error", { message: "Authentication required." });
        return;
      }
      const isOwnRoom = user.role === "driver" && user.id === id;
      const isAdmin   = user.role === "admin";
      if (!isOwnRoom && !isAdmin) {
        socket.emit("error", { message: "Not authorised." });
        return;
      }
      socket.join(`driver_${id}`);
      console.log(`[SOCKET] Driver ${id} joined room driver_${id} (${socket.id})`);
    });

    // ── join_drivers_online ───────────────────────────────────────────────────
    // Drivers join this shared room to receive new order broadcasts.
    // Auth: JWT role=driver OR HMAC token (same scheme as REST endpoints).
    socket.on("join_drivers_online", ({ driver_id, hmac_token } = {}) => {
      const user = socket.data.user;
      const isJwtDriver  = user?.role === "driver";
      const isJwtAdmin   = user?.role === "admin";
      // HMAC token validation (drivers open via SMS link, no JWT)
      let isHmacValid = false;
      if (driver_id && hmac_token) {
        try {
          const crypto = require("crypto");
          const salt   = getDriverSecretSalt();
          const expected = crypto.createHmac("sha256", salt).update(String(driver_id)).digest("hex");
          isHmacValid = hmac_token === expected;
        } catch (_) {}
      }
      if (!isJwtDriver && !isJwtAdmin && !isHmacValid) {
        socket.emit("error", { message: "Driver auth required for broadcast room." });
        return;
      }
      socket.join("drivers_online");
      if (driver_id) {
        socket.data.driver_id = parseInt(driver_id);
        // Also join personal room so dispatch can send direct messages/replies
        socket.join(`driver_${driver_id}`);
      }
      console.log(`[SOCKET] Driver ${driver_id || user?.id} joined drivers_online`);
    });

    // ── update_location ───────────────────────────────────────────────────────
    // Only authenticated drivers or admins may push GPS updates.
    // Looks up order_number from order_id to emit to the correct customer room.
    socket.on("update_location", async (data) => {
      const role = socket.data.user?.role;
      if (role !== "driver" && role !== "admin") return;
      const { order_id, order_number, lat, lng, progress } = data;
      const room = order_number ? `order_${order_number}` : `order_${order_id}`;
      io.to(room).emit("driver_location_update", { order_id, order_number, lat, lng, progress });

      // Persist alongside the REST GPS path (PATCH /assignments/:id/gps) so this
      // socket-only path -- currently used only by the dev tool simulate-driver.js,
      // confirmed via repo-wide search -- doesn't silently diverge from the DB.
      // Previously this only emitted the live event and never wrote to
      // delivery_assignments at all, making it a non-authoritative shadow path.
      if (lat != null && lng != null && (order_number || order_id)) {
        try {
          await pool.query(
            `UPDATE delivery_assignments
                SET current_lat=$1, current_lng=$2, last_location_update=NOW()
              WHERE (order_number=$3 OR order_id=$4) AND status IN ('assigned','en_route','picked_up')`,
            [lat, lng, order_number || null, order_id || null]
          );
        } catch (err) {
          console.error('[Socket] Failed to persist GPS from update_location:', err.message);
        }
      }
    });

    // ── send_message ──────────────────────────────────────────────────────────
    // Sender identity comes from the verified JWT, not the client payload.
    // Unauthenticated sockets are labelled "customer" (guest order tracking).
    socket.on("send_message", async (data) => {
      if (!allowMessage(socket.id)) {
        socket.emit("error", { message: "Message rate limit exceeded. Please slow down." });
        return;
      }
      const { order_id, text, timestamp } = data;
      if (!order_id || !text || typeof text !== "string" || text.length > 2000) return;

      // Derive sender from JWT role; fall back to "customer" for guests
      const role   = socket.data.user?.role;
      const sender = (role === "admin" || role === "driver") ? role : "customer";
      const room   = `order_${order_id}`;

      await saveMessage(order_id, sender, text);
      io.to(room).emit("receive_message", { order_id, sender, text, timestamp });
      // Also notify the admin inbox room directly — an admin only auto-joins
      // order_<id> once they've opened that specific conversation, so without
      // this, a customer's first message on an order nobody has opened yet
      // would never appear in the admin Chat Inbox until a manual refresh.
      // Separate event name (not receive_message) so an admin who has BOTH
      // this room and the specific order room joined doesn't get the same
      // message appended twice to an already-open thread — this event is
      // list-level only, never touches the open thread's message array.
      if (sender === "customer") {
        io.to("admins").emit("new_chat_message", { order_id, sender, text, timestamp });
      }
      console.log(`[SOCKET] Chat [${room}] ${sender}: ${text}`);
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] User disconnected:", socket.id);
      msgCounters.delete(socket.id);
    });
  });
};

