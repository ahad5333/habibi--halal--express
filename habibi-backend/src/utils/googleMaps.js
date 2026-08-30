const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

// Returns { unavailable: true } when the Maps integration itself isn't
// configured (no API key) — distinct from a plain `null`, which means the
// key IS configured and Google was reached, but this specific address
// couldn't be resolved/routed to at all. Callers need to tell these apart:
// "service unavailable" should fail open (existing behavior), but "this
// address doesn't resolve to anywhere real" should not.
async function getDistance(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { unavailable: true };

  const url =
    `${MAPS_BASE}/distancematrix/json` +
    `?origins=${encodeURIComponent(origin)}` +
    `&destinations=${encodeURIComponent(destination)}` +
    `&units=imperial` +
    // Traffic-aware duration only comes back for driving mode with a departure_time;
    // "now" gets Google's live/current-traffic estimate rather than the historical average.
    `&departure_time=now` +
    `&key=${key}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    // Request-level failure (bad key, over quota, malformed request) is a
    // service problem, not evidence the destination is bogus — fail open.
    if (data.status !== 'OK') return { unavailable: true };

    // Per-pair failure (e.g. ZERO_RESULTS/NOT_FOUND) means Google itself
    // couldn't find or route to this specific destination — that IS a real
    // signal the address doesn't resolve to anywhere real.
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return null;

    const miles = element.distance.value / 1609.34;
    // duration_in_traffic isn't always present (e.g. Google has no live data for the
    // route) -- fall back to the typical/historical duration when it's missing.
    const trafficDuration = element.duration_in_traffic;
    return {
      miles:                       parseFloat(miles.toFixed(2)),
      text:                        element.distance.text,
      duration:                    element.duration.text,
      duration_minutes:            element.duration.value / 60,
      duration_in_traffic:         trafficDuration?.text ?? null,
      duration_in_traffic_minutes: trafficDuration ? trafficDuration.value / 60 : null,
    };
  } catch {
    // Network/fetch failure — service problem, not an address problem.
    return { unavailable: true };
  }
}

// Real routed directions (turn-by-turn steps + an overview polyline) between
// two points, driving mode. Same fail-open convention as getDistance:
// {unavailable:true} means the service itself couldn't be reached (no key,
// network failure, quota) -- callers should fall back to a straight-line
// guess. `null` means Google WAS reached but genuinely can't route between
// these two points (e.g. one resolves to water/an unreachable spot).
async function getDirections(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { unavailable: true };

  const url =
    `${MAPS_BASE}/directions/json` +
    `?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&mode=driving` +
    `&key=${key}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') return null;
    if (data.status !== 'OK') return { unavailable: true };

    const route = data.routes?.[0];
    const leg   = route?.legs?.[0];
    if (!route || !leg) return null;

    return {
      polyline:         route.overview_polyline?.points || null,
      distance_text:    leg.distance?.text || null,
      duration_text:    leg.duration?.text || null,
      duration_minutes: leg.duration ? leg.duration.value / 60 : null,
      steps: (leg.steps || []).map(s => ({
        // html_instructions carries basic markup (e.g. <b>, <div>) -- strip it
        // down to plain text for display rather than rendering raw HTML.
        instruction:   (s.html_instructions || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        distance_text: s.distance?.text || null,
        end_lat:       s.end_location?.lat ?? null,
        end_lng:       s.end_location?.lng ?? null,
      })),
    };
  } catch {
    return { unavailable: true };
  }
}

// Geocodes an address and returns its ISO-3166-1 alpha-2 country code (e.g.
// "US"), or null if it can't be determined — either the address doesn't
// resolve to a real place, or the Maps service itself isn't reachable/
// configured. Callers should fail OPEN on null (don't block an order just
// because we couldn't confirm the country) and only act when a country code
// IS returned but doesn't match what's expected — that's a real signal.
async function geocodeCountry(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url =
    `${MAPS_BASE}/geocode/json` +
    `?address=${encodeURIComponent(address)}` +
    `&key=${key}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;

    const components = data.results?.[0]?.address_components || [];
    const countryComponent = components.find(c => c.types?.includes('country'));
    return countryComponent?.short_name || null;
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

// "37 min" / "1 hr 5 min" — for displaying a minute count back to customers
function formatMinutes(totalMinutes) {
  const mins = Math.round(totalMinutes);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

module.exports = { getDistance, getDirections, geocodeCountry, feeFromMiles, providerFromMiles, formatMinutes };
