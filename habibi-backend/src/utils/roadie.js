const ROADIE_BASE = 'https://connect.roadie.com/v1';

function isConfigured() {
  return !!(process.env.ROADIE_API_KEY);
}

function isSimulated() {
  return process.env.ROADIE_API_KEY === 'SIMULATED';
}

async function roadieRequest(path, method = 'GET', body = null) {
  if (!isConfigured()) {
    throw new Error('Roadie credentials not configured (ROADIE_API_KEY)');
  }

  if (isSimulated()) {
    console.log(`[SIMULATION] Roadie ${method} ${path}`, body);
    const id = `ROAD_SIM_${Date.now()}`;
    return {
      id,
      state:           'pending',
      price:           1499,
      tracking_number: id,
      agent:           null,
      estimated_pickup_time:  null,
      estimated_dropoff_time: null,
    };
  }

  const opts = {
    method,
    headers: {
      Authorization:  `Bearer ${process.env.ROADIE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(`${ROADIE_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || `Roadie API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

module.exports = { roadieRequest, isConfigured, isSimulated };
