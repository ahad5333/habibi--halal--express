import { Platform, Vibration } from 'react-native';

// Singleton AudioContext — reusing avoids Chrome's "too many contexts" warning
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!_ctx || _ctx.state === 'closed') _ctx = new AC();
    // Resume if suspended (browser policy)
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, startAt: number, duration: number, volume = 0.35) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Fade in then out
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/**
 * Plays a two-tone "ding ding" alert.
 * Web  → synthesized via Web Audio API (no file needed).
 * Native → vibration pattern (expo-av + bundled file needed for real sound).
 */
export function playNewOrderSound(quiet = false) {
  if (quiet) return;

  if (Platform.OS === 'web') {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(ctx, 880,  t,        0.25);   // first ding  — A5
    tone(ctx, 1108, t + 0.28, 0.30);   // second ding — C#6 (brighter)
    tone(ctx, 1318, t + 0.56, 0.35);   // third ding  — E6  (resolve up)
  } else {
    // Native: vibrate a recognisable pattern
    // Replace with expo-av + bundled mp3 when doing a native build
    Vibration.vibrate([0, 200, 80, 200, 80, 400]);
  }
}

/**
 * Prime the AudioContext on first user interaction so autoplay is unlocked.
 * Call this once on the login button press.
 */
export function primeAudio() {
  if (Platform.OS !== 'web') return;
  const ctx = getCtx();
  // Play a 0-volume blip just to unlock the context
  if (ctx) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    o.start();
    o.stop(ctx.currentTime + 0.001);
  }
}
