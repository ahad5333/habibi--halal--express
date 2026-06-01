const { io } = require("socket.io-client");

const socket = io("http://localhost:5001");
const order_id = String(process.argv[2] || "1");

console.log(`Starting simulation for order #${order_id}...`);

socket.on("connect", () => {
  console.log("Connected to server");
  
  // Starting point
  let lat = 40.7128;
  let lng = -74.0060;
  
  // Destination point
  const destLat = 40.7580;
  const destLng = -73.9855;
  
  const steps = 100;
  const latStep = (destLat - lat) / steps;
  const lngStep = (destLng - lng) / steps;
  
  let currentStep = 0;
  
  const interval = setInterval(() => {
    lat += latStep;
    lng += lngStep;
    
    const progress = Math.round((currentStep / steps) * 100);
    console.log(`Step ${currentStep + 1}/${steps} (${progress}%): ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    socket.emit("update_location", { order_id, lat, lng, progress });
    
    currentStep++;
    if (currentStep >= steps) {
      clearInterval(interval);
      console.log("Simulation complete!");
      socket.disconnect();
      process.exit(0);
    }
  }, 200); // Update every 200ms
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
