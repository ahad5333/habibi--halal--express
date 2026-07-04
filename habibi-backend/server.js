require("dotenv").config();
require("./instrument"); // Sentry — must load before express/http

const http = require("http");
const app = require("./src/app");
const pool = require("./src/config/db");
const createTables = require("./src/config/init");
const { Server } = require("socket.io");
const { startScheduledDispatch } = require("./src/services/scheduledDispatch");

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

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startScheduledDispatch(io);
    });
  })
  .catch((err) => {
    console.log("Database connection failed:", err);
  });