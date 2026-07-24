// ── Shared new-order bell + browser notification (Web Audio API, no audio file) ──
// Originally built for LiveBoard; extracted here so Orders.jsx can reuse the exact
// same tested ring/notification behavior instead of a second copy drifting apart.
let _audioCtx   = null;
let _ringSource = null; // looping BufferSource — stays alive until stopped

export function unlockAudio() {
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {}
}

// Build a 1.4s PCM buffer containing the trin-trin pattern.
// Using a looping BufferSource keeps the AudioContext alive indefinitely.
function buildRingBuffer() {
  const sr = _audioCtx.sampleRate;
  const duration = 1.4;
  const buf  = _audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
  const data = buf.getChannelData(0);
  // Two pairs of short rings: [start, end] in seconds
  const rings = [[0.02, 0.18], [0.24, 0.40], [0.70, 0.86], [0.92, 1.08]];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const inRing = rings.some(([s, e]) => t >= s && t < e);
    if (inRing) {
      // Slight fade at edges to avoid clicking
      const nearest = rings.reduce((d, [s, e]) => {
        if (t >= s && t < e) return Math.min(d, t - s, e - t);
        return d;
      }, Infinity);
      const fade = Math.min(nearest / 0.008, 1);
      data[i] = fade * 0.4 * Math.sin(2 * Math.PI * 900 * t);
    } else {
      data[i] = 0;
    }
  }
  return buf;
}

export function startContinuousRing() {
  if (!_audioCtx || _ringSource) return;
  try {
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    _ringSource = _audioCtx.createBufferSource();
    _ringSource.buffer = buildRingBuffer();
    _ringSource.loop = true;
    _ringSource.connect(_audioCtx.destination);
    _ringSource.start();
  } catch (_) {}
}

export function stopContinuousRing() {
  if (_ringSource) {
    try { _ringSource.stop(); _ringSource.disconnect(); } catch (_) {}
    _ringSource = null;
  }
}

// Used both to confirm "sound enabled" and as a manual "test bell" button
// while a real ring may already be looping for genuine pending orders — only
// auto-stop the ring this call actually started, so testing the bell doesn't
// cut off a live alert for up to 30s until the next poll restarts it.
export function playBell() {
  const alreadyRinging = !!_ringSource;
  startContinuousRing();
  if (!alreadyRinging) setTimeout(stopContinuousRing, 1400);
}

export function showNewOrderNotification(count) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(`🔔 ${count} New Order${count > 1 ? 's' : ''}!`, {
    body: 'New order received.',
    icon: '/images/logos/logo.png',
    tag:  'habibi-new-order',
  });
}
