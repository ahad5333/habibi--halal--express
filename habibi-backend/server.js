require("dotenv").config();
require("./instrument"); // Sentry — must load before express/http

const http = require("http");
const app = require("./src/app");
const pool = require("./src/config/db");
const createTables = require("./src/config/init");
const { Server } = require("socket.io");
const { startScheduledDispatch } = require("./src/services/scheduledDispatch");
const { startScheduledSubscriptions } = require("./src/services/scheduledSubscriptions");
const cron = require("node-cron");
const { cleanupAbandonedPendingCheckouts } = require("./src/controllers/orderController");

const PORT = process.env.PORT || 5001;
const initSocket = require("./src/socket");

// HTTP server
const server = http.createServer(app);

// Socket setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:8081", "http://localhost:8082", "http://localhost:8083", "http://localhost:8084", "http://localhost:8085", "http://localhost:19006"],
    credentials: true,
  },
});
app.set("io", io);
initSocket(io);

// Start everything
pool.connect()
  .then(async () => {
    console.log("PostgreSQL Connected");

    await createTables();

    // Bind to localhost only — nginx already proxies to this port via
    // localhost:5001, and this app has no other reason to be reachable
    // directly from the internet. Binding to all interfaces (the default)
    // let anyone hit the backend directly by IP, skipping nginx's TLS,
    // CORS, and security headers entirely.
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Server running on port ${PORT} (localhost only)`);
      startScheduledDispatch(io);
      startScheduledSubscriptions(io);
      cron.schedule("0 * * * *", cleanupAbandonedPendingCheckouts);
    });
  })
  .catch((err) => {
    console.log("Database connection failed:", err);
  });