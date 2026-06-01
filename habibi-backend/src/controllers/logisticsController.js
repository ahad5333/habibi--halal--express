const safeError = require('../utils/safeError');
const pool = require("../config/db");

// Haversine Formula to calculate distance between two coordinates in miles
const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateRoutingTier = async (req, res) => {
  try {
    const { storeLat, storeLon, customerLat, customerLon } = req.body;
    
    const distance = getDistanceInMiles(storeLat, storeLon, customerLat, customerLon);
    
    // Fetch active tiers from DB
    const { rows: tiers } = await pool.query(
      "SELECT * FROM delivery_tiers WHERE is_active = true ORDER BY min_distance ASC"
    );

    // Find the matching tier
    const matchingTier = tiers.find(tier => 
      distance >= parseFloat(tier.min_distance) && 
      distance < parseFloat(tier.max_distance)
    );

    res.json({
      distance_miles: distance.toFixed(2),
      tier: matchingTier || { name: "Manual Handling Required", provider_type: "manual" },
      suggestion: matchingTier ? `Route via ${matchingTier.name}` : "Outside known delivery zones"
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const dispatchToPartner = async (orderId, providerType) => {
  console.log(`[LOGISTICS ENGINE] Dispatching Order #${orderId} to ${providerType}...`);
  
  // This is where the 6-8 week "Plug & Play" integration logic lives
  switch (providerType) {
    case 'doordash':
      // return await doorDashService.createDelivery(orderId);
      break;
    case 'uber':
      // return await uberService.createDelivery(orderId);
      break;
    case 'grubhub':
      // return await grubhubService.createDelivery(orderId);
      break;
    default:
      console.log(`Order #${orderId} assigned to In-House Runner.`);
  }
};

module.exports = {
  calculateRoutingTier,
  dispatchToPartner
};
