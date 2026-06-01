const { io } = require("socket.io-client");

const socket = io("http://localhost:5001");
const order_id = process.argv[2] || 1;

console.log(`Listening for updates on order #${order_id}...`);

socket.on("connect", () => {
  console.log("Connected to server");
  socket.emit("join_order", order_id);
});

socket.on("driver_location", (data) => {
  console.log("Received location:", data);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
