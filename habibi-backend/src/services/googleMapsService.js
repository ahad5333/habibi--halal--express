const { Client } = require("@googlemaps/google-maps-services-js");

const client = new Client({});

/**
 * Calculates the driving distance between two addresses using the Google Maps Distance Matrix API.
 * Currently runs in simulation mode if no API key is provided.
 * 
 * @param {string} originAddress - The starting address (e.g., Restaurant Location)
 * @param {string} destinationAddress - The ending address (e.g., Customer Address)
 * @returns {Promise<number>} Distance in miles
 */
async function calculateDistanceMiles(originAddress, destinationAddress) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey === 'SIMULATED') {
    console.log(`[SIMULATION] Calculating distance from ${originAddress} to ${destinationAddress}`);
    // Simulate a random distance between 1 and 8 miles for testing
    const simulatedDistance = Math.floor(Math.random() * 70) / 10 + 1.0; 
    return simulatedDistance;
  }

  try {
    const response = await client.distancematrix({
      params: {
        origins: [originAddress],
        destinations: [destinationAddress],
        units: 'imperial',
        key: apiKey
      },
      timeout: 3000,
    });

    if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
      const distanceText = response.data.rows[0].elements[0].distance.text;
      // distanceText is typically "3.4 mi", parse the float
      const miles = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
      return miles;
    } else {
      console.error('Google Maps API returned error status:', response.data);
      throw new Error('Could not calculate distance');
    }
  } catch (error) {
    console.error('Error fetching distance from Google Maps:', error.message);
    throw error;
  }
}

/**
 * Calculates the total delivery fee based on the distance.
 * 
 * @param {number} distanceMiles - The driving distance in miles
 * @param {number} baseFee - The flat base fee configured by the restaurant
 * @param {number} perMileFee - The fee charged per mile (typically applied after a certain radius, but applied linearly here)
 * @returns {number} The total calculated delivery fee
 */
function calculateDeliveryFee(distanceMiles, baseFee = 3.00, perMileFee = 1.00) {
  // Example calculation: Base fee + (perMileFee * distanceMiles)
  const fee = parseFloat(baseFee) + (parseFloat(perMileFee) * distanceMiles);
  return parseFloat(fee.toFixed(2));
}

module.exports = {
  calculateDistanceMiles,
  calculateDeliveryFee
};
