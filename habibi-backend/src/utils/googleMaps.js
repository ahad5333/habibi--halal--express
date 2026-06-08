const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

async function getDistance(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url =
    `${MAPS_BASE}/distancematrix/json` +
    `?origins=${encodeURIComponent(origin)}` +
    `&destinations=${encodeURIComponent(destination)}` +
    `&units=imperial` +
    `&key=${key}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return null;

    const miles = element.distance.value / 1609.34;
    return {
      miles:    parseFloat(miles.toFixed(2)),
      text:     element.distance.text,
      duration: element.duration.text,
    };
  } catch {
    return null;
  }
}

// Tiered delivery fee based on distance (miles).
// 350+ miles = pickup only (returns null).
function feeFromMiles(miles) {
  if (miles <= 1)   return 2.99;
  if (miles <= 3)   return 4.99;
  if (miles <= 5)   return 6.99;
  if (miles <= 8)   return 8.99;
  if (miles <= 12)  return 11.99;
  if (miles <= 20)  return 15.99;  // DoorDash Drive extended range
  if (miles <= 30)  return 19.99;
  if (miles <= 50)  return 24.99;  // Roadie short
  if (miles <= 100) return 34.99;  // Roadie medium
  if (miles <= 200) return 49.99;  // Roadie long
  if (miles <= 350) return 69.99;  // Roadie max
  return null; // beyond 350 miles — pickup only
}

// Returns the delivery method label for a given distance
function providerFromMiles(miles, inHouseRadius = 5) {
  if (miles <= inHouseRadius) return 'in_house';
  if (miles <= 30)            return 'doordash';
  if (miles <= 350)           return 'roadie';
  return 'pickup_only';
}

module.exports = { getDistance, feeFromMiles, providerFromMiles };
