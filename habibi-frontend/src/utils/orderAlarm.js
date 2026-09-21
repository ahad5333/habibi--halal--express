// The new-order alarm for the kitchen and staff screens: a ring that loops
// until someone accepts the order, plus the two things that keep it audible on
// an unattended tablet.
//
// The ring is ported from habibi-admin/src/utils/orderAlerts.js, which already
// behaved this way. The two apps are separate builds and can't share a module,
// so keep the ring pattern in step if either changes.
//
// Browser behaviours this exists to handle:
//  - Autoplay. Audio stays muted until someone taps the page. A tablet that
//    reloads overnight, restarts, or has its tab discarded comes back SILENT
//    while still showing orders. enableSound() must be called from a tap, and
//    soundIsOn() lets the screen say plainly when sound is off.
//  - Sleep. A sleeping screen plays nothing. keepScreenOn() holds a Wake Lock
//    and re-takes it whenever the page is shown again, because the browser
//    drops it every time the page is hidden.

let ctx = null;
let ringSource = null;
let ringBuffer = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => { try { fn(); } catch (_) { /* a listener's problem is its own */ } });

// One context for the page's lifetime. The admin version made a new one on
// every unlock, which could orphan a context that was still ringing.
function audioContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  ctx.onstatechange = notify;   // e.g. iOS suspending it when the page is backgrounded
  return ctx;
}

export const soundIsOn = () => !!ctx && ctx.state === 'running';

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Must be called from a tap or click -- that is what lets the browser unmute.
export async function enableSound() {
  const c = audioContext();
  if (!c) return false;
  try { await c.resume(); } catch (_) { /* state below says whether it worked */ }
  notify();
  return c.state === 'running';
}

// The admin panel's "trin-trin" pattern (two double rings, 1.4 s, looped), at
// 0.7 amplitude rather than 0.4: this has to carry across a working kitchen.
function buildRing(c) {
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.floor(sr * 1.4), sr);
  const data = buf.getChannelData(0);
  const rings = [[0.02, 0.18], [0.24, 0.40], [0.70, 0.86], [0.92, 1.08]];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const r = rings.find(([s, e]) => t >= s && t < e);
    if (!r) continue;
    const fade = Math.min(Math.min(t - r[0], r[1] - t) / 0.008, 1);   // no clicks at the edges
    data[i] = fade * 0.7 * Math.sin(2 * Math.PI * 900 * t);
  }
  return buf;
}

export function startRing() {
  const c = ctx;
  // Starting while muted would "succeed" in silence and then block the real
  // start once sound comes on, so only ring when it can actually be heard.
  if (!c || c.state !== 'running' || ringSource) return;
  try {
    ringBuffer = ringBuffer || buildRing(c);
    ringSource = c.createBufferSource();
    ringSource.buffer = ringBuffer;
    ringSource.loop = true;
    ringSource.connect(c.destination);
    ringSource.start();
  } catch (_) {
    ringSource = null;
  }
}

export function stopRing() {
  if (!ringSource) return;
  try { ringSource.stop(); ringSource.disconnect(); } catch (_) { /* already stopped */ }
  ringSource = null;
}

// One ring cycle so staff hear that sound works when they start a shift. A
// separate, non-looping source: it can never cut off a real ring.
export function testRing() {
  const c = ctx;
  if (!c || c.state !== 'running') return;
  try {
    ringBuffer = ringBuffer || buildRing(c);
    const s = c.createBufferSource();
    s.buffer = ringBuffer;
    s.connect(c.destination);
    s.start();
  } catch (_) { /* a failed test chime is not worth surfacing */ }
}

let wakeLock = null;
let wantAwake = false;

async function takeWakeLock() {
  if (!wantAwake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) {
    // Refused (unsupported browser, battery saver). The screen may sleep; the
    // shift screen already tells staff to keep the tablet plugged in.
  }
}

export function keepScreenOn() {
  if (wantAwake) return;
  wantAwake = true;
  document.addEventListener('visibilitychange', takeWakeLock);
  takeWakeLock();
}
