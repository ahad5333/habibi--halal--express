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

// Tiered delivery fee based on distance (miles)
function feeFromMiles(miles) {
  if (miles <= 1)  return 2.99;
  if (miles <= 3)  return 4.99;
  if (miles <= 5)  return 6.99;
  if (miles <= 8)  return 8.99;
  if (miles <= 12) return 11.99;
  return null; // out of delivery range
}

module.exports = { getDistance, feeFromMiles };
