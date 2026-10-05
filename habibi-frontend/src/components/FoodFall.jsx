import { useEffect, useRef } from 'react';
import './FoodFall.css';

// Food cut-outs that start bunched over an empty-state message, then loosen,
// tumble slowly and settle into a pile on the floor -- the "no results" drop
// from Mobbin that Ahad asked for (2026-10-05), with the boot loader's food.
//
// What makes it read as smooth rather than a plain drop:
//   - pieces start as a tight cluster mid-box, not above it,
//   - low gravity plus air drag, so the fall is floaty (~1.5-2 s),
//   - each piece gets a small outward push and its own spin,
//   - a soft landing (little bounce) and real piece-on-piece contacts, so they
//     stack into a pile at random angles instead of overlapping.
//
// Decorative only: aria-hidden, pointer-events none, and with reduced motion
// the pile is simulated off-screen and shown already settled.

const FOODS = [
  'burger', 'platter', 'chicken-burger', 'gyro', 'steak', 'rice-bowl', 'kabab',
  'chicken-crispy', 'falafel', 'hummus', 'soda', 'shrimp', 'tomato', 'onion', 'pepper',
];

const GRAVITY = 520;     // px/s^2 -- a fifth of the boot loader's: Mobbin's ~2 s float
const DRAG = 1.1;        // per second; caps the speed so nothing slams down
const BOUNCE = 0.2;      // floor and contacts: a soft landing
const STEP = 1 / 120;    // fixed physics step, independent of frame rate
const MAX_SIM = 6;       // seconds; a hard stop even if something keeps jittering

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePieces(W, H, count, clusterY) {
  const size = Math.round(Math.max(44, Math.min(84, W / 11)));
  const names = shuffle([...FOODS]).slice(0, count);
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  const gap = size * 0.82;
  const rows = Math.ceil(count / cols);
  const cx = W / 2, cy = H * clusterY;
  return names.map((name, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const ox = (c - (cols - 1) / 2) * gap + (r % 2 ? gap / 2 : 0) + (Math.random() * 10 - 5);
    const oy = (r - (rows - 1) / 2) * gap + (Math.random() * 10 - 5);
    const s = size * (0.85 + Math.random() * 0.3);
    return {
      name, size: s, r: s * 0.42,
      x: cx + ox, y: cy + oy,
      // outward push from the cluster's centre: this is what fans it out
      vx: ox * 0.9 + (Math.random() * 40 - 20),
      vy: -40 - Math.random() * 60,
      rot: Math.random() * 30 - 15,
      vrot: Math.random() * 120 - 60,
    };
  });
}

function step(ps, W, floor, dt) {
  const drag = Math.exp(-DRAG * dt);
  for (const p of ps) {
    p.vy += GRAVITY * dt;
    p.vx *= drag; p.vy *= drag; p.vrot *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
    if (p.x - p.r < 0) { p.x = p.r; p.vx = Math.abs(p.vx) * BOUNCE; }
    if (p.x + p.r > W) { p.x = W - p.r; p.vx = -Math.abs(p.vx) * BOUNCE; }
    if (p.y + p.r > floor) {
      p.y = floor - p.r;
      if (p.vy > 0) p.vy = -p.vy * BOUNCE;
      p.vx *= 0.9; p.vrot *= 0.85;   // floor friction: they slide, then stop
    }
  }
  // Circle contacts: push apart, then remove the closing speed along the
  // contact so pieces rest on each other instead of sinking through.
  for (let a = 0; a < ps.length; a++) {
    for (let b = a + 1; b < ps.length; b++) {
      const pa = ps[a], pb = ps[b];
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const min = pa.r + pb.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      const nx = dx / d, ny = dy / d, push = (min - d) / 2;
      pa.x -= nx * push; pa.y -= ny * push;
      pb.x += nx * push; pb.y += ny * push;
      const rel = (pb.vx - pa.vx) * nx + (pb.vy - pa.vy) * ny;
      if (rel < 0) {
        const j = -(1 + BOUNCE) * rel / 2;
        pa.vx -= j * nx; pa.vy -= j * ny;
        pb.vx += j * nx; pb.vy += j * ny;
        pa.vrot *= 0.95; pb.vrot *= 0.95;
      }
    }
  }
}

const atRest = ps => ps.every(p => Math.abs(p.vx) < 6 && Math.abs(p.vy) < 6);

// Runs one drop in `stage`; returns its cleanup.
function runDrop(stage, count, clusterY) {
  const { width: W, height: H } = stage.getBoundingClientRect();
  if (W < 50 || H < 50) return () => {};

  // The pile lands on the box's bottom edge -- unless that is below what
  // the visitor can see. On phones the menu's empty state sits near the
  // bottom of the screen, under the fixed category bar, so the pile used to
  // land out of sight. Stop at the visible bottom instead (top of any
  // [data-bottom-bar] pinned to the bottom, else the window's bottom edge).
  let visibleBottom = window.innerHeight;
  document.querySelectorAll('[data-bottom-bar]').forEach(el => {
    const b = el.getBoundingClientRect();
    if (b.height > 0 && b.top < visibleBottom && b.bottom >= window.innerHeight - 4) visibleBottom = b.top;
  });
  const seen = visibleBottom - stage.getBoundingClientRect().top - 6;
  const floor = seen > H * 0.45 ? Math.min(H - 2, seen) : H - 2;
  const ps = makePieces(W, H, count, clusterY);
  const els = ps.map(p => {
    const el = document.createElement('img');
    el.src = `/images/drop/${p.name}.webp`;
    el.alt = '';
    el.decoding = 'async';
    el.className = 'food-fall-piece';
    el.style.width = `${p.size}px`;
    el.onerror = () => el.remove();
    stage.appendChild(el);
    return el;
  });
  const draw = () => ps.forEach((p, i) => {
    els[i].style.transform = `translate3d(${p.x - p.size / 2}px, ${p.y - p.size / 2}px, 0) rotate(${p.rot}deg)`;
  });

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  if (reduced) {
    for (let t = 0; t < MAX_SIM; t += STEP) step(ps, W, floor, STEP);
    draw();
    stage.classList.add('is-settled');
  } else {
    draw();
    let last = performance.now(), acc = 0, simTime = 0, restFor = 0;
    const tick = now => {
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      while (acc >= STEP) { step(ps, W, floor, STEP); acc -= STEP; simTime += STEP; }
      draw();
      restFor = atRest(ps) ? restFor + STEP : 0;
      if (simTime > MAX_SIM || (simTime > 1 && restFor > 0.3)) return;   // settled: stop the loop
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return () => { cancelAnimationFrame(raf); els.forEach(el => el.remove()); };
}

export default function FoodFall({ count = 11, clusterY = 0.34 }) {
  const stageRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let stop = null, cancelled = false;
    // On a full page load the boot screen (index.html) covers everything for
    // ~2.5 s; dropping now would play the whole fall unseen behind it. Wait
    // for its signal -- or, if this page skipped it, for it to be gone.
    const bootShowing = () => !window.__habibiBootDone && !!document.getElementById('boot');
    const start = () => { if (!cancelled && !stop) stop = runDrop(stage, count, clusterY); };
    if (bootShowing()) {
      const onDone = () => start();
      window.addEventListener('habibi:boot-done', onDone, { once: true });
      const poll = setInterval(() => { if (!bootShowing()) { clearInterval(poll); start(); } }, 300);
      return () => { cancelled = true; clearInterval(poll); window.removeEventListener('habibi:boot-done', onDone); stop?.(); };
    }
    start();
    return () => { cancelled = true; stop?.(); };
  }, [count, clusterY]);

  return <div ref={stageRef} className="food-fall" aria-hidden="true" />;
}
