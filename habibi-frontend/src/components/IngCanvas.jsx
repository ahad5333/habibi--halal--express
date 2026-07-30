import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check } from 'lucide-react';
import { toBlob } from 'html-to-image';
// All of .co-canvas's positioning/visual rules live in CustomOrder.css (not
// renamed/moved here since that's a large, unrelated CSS file). Importing
// it here -- not just from CustomOrder.jsx -- matters because pages that
// only render IngCanvas without ever mounting CustomOrder.jsx (Checkout.jsx)
// would otherwise get zero canvas styling: every ingredient <img> would
// render at default block-flow size/position instead of absolutely
// positioned by percentage, stacking into one enormous unstyled column.
import '../pages/CustomOrder.css';

/* Extracted from CustomOrder.jsx so the checkout cart-thumbnail preview can
   reuse the exact same rendering instead of approximating it separately --
   any future tweak to how the canvas positions/draws ingredients now
   automatically applies to both places, with no risk of the two drifting
   apart the way a hand-written checkout approximation would. */

/* ================================================================
   CANVAS INGREDIENT DATABASE
   zone: 'protein' | 'veg' | 'rice' | 'cheese'
   pos[family]: [{x,y,w,rot?}]  x/y=center%, w=width% of full canvas
   Sizes based on real-world proportions:
     familyTray≈14", platter≈10", hero≈7" opening,
     standard≈4.5", compact≈4", wrap≈7"
   Dynamic zone remapping is applied in IngCanvas for platter/familyTray.
   ================================================================ */
const CO_ING_DB = {
  /* ── PROTEINS  z=4 ─────────────────────────────────────────── */
  chicken:          { zone:'protein', src:'/images/byo/ing/chicken-broasted.webp',          z:4, hotDogPos:[{x:50,y:66,w:39}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:44}], hero:[{x:50,y:41,w:38,rot:-1.8}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  'lamb-gyro':      { zone:'protein', src:'/images/byo/ing/lamb-gyro.webp',        z:4, hotDogPos:[{x:31,y:50,w:56}], pos:{ familyTray:[{x:50,y:43,w:44}], platter:[{x:50,y:43,w:46}], hero:[{x:50,y:27,w:28}], standard:[{x:50,y:43,w:30}], compact:[{x:50,y:43,w:66}], wrap:[{x:50,y:43,w:74}] } },
  mix:              { zone:'protein', src:'/images/byo/ing/mix.webp',               z:4, hotDogPos:[{x:50,y:70,w:42}], pos:{ familyTray:[{x:69,y:49,w:68,rot:-1.8,final:true}], platter:[{x:50,y:44,w:44}], hero:[{x:50,y:37,w:48}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  hotdog:           { zone:'protein', src:'/images/byo/ing/hotdog.webp',            z:4, hotDogPos:[{x:50,y:43,w:74}], pos:{ familyTray:[{x:50,y:44,w:46}], platter:[{x:50,y:44,w:50}], hero:[{x:50,y:43,w:82}], standard:[{x:50,y:43,w:64}], compact:[{x:50,y:43,w:68}], wrap:[{x:50,y:43,w:74}] } },
  bacon:            { zone:'protein', src:'/images/byo/ing/bacon.webp',             z:4, hotDogPos:[{x:42,y:65,w:28,rot:-3.6},{x:58,y:62,w:29,rot:-1.8}], pos:{ familyTray:[{x:36,y:44,w:18},{x:64,y:44,w:18}], platter:[{x:35,y:44,w:24},{x:65,y:44,w:24}], hero:[{x:32,y:40,w:29},{x:68,y:40,w:31}], standard:[{x:36,y:44,w:30},{x:64,y:44,w:30}], compact:[{x:36,y:44,w:30},{x:64,y:44,w:30}], wrap:[{x:34,y:44,w:36},{x:66,y:44,w:36}] } },
  'hot-sausage':    { zone:'protein', src:'/images/byo/ing/hot-sausage.webp',      z:4, showAsideWhen:'hotdog', hotDogPos:[{x:50,y:70,w:49}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:46}], hero:[{x:50,y:40,w:64}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  'italian-sausage':{ zone:'protein', src:'/images/byo/ing/italian-sausage.webp',  z:4, hotDogPos:[{x:50,y:70,w:46}], pos:{ familyTray:[{x:50,y:44,w:46}], platter:[{x:50,y:44,w:50}], hero:[{x:50,y:35,w:65}], standard:[{x:50,y:44,w:64}], compact:[{x:50,y:44,w:66}], wrap:[{x:50,y:44,w:74}] } },
  turkey:           { zone:'protein', src:'/images/byo/ing/turkey.webp',            z:4, showAsideWhen:'bread', hotDogPos:[{x:50,y:70,w:60}], pos:{ familyTray:[{x:50,y:44,w:40}], platter:[{x:50,y:44,w:40}], hero:[{x:50,y:44,w:70}], standard:[{x:50,y:44,w:60}], compact:[{x:50,y:44,w:63}], wrap:[{x:50,y:44,w:68}] } },
  'chicken-kabab':  { zone:'protein', src:'/images/byo/ing/chicken-kabab.webp',    z:4, pos:{ familyTray:[{x:34,y:44,w:22},{x:66,y:44,w:22}], platter:[{x:32,y:44,w:28},{x:68,y:44,w:28}], hero:[{x:28,y:44,w:44},{x:72,y:44,w:44}], standard:[{x:36,y:44,w:36},{x:64,y:44,w:36}], compact:[{x:36,y:44,w:34},{x:64,y:44,w:34}], wrap:[{x:30,y:44,w:42},{x:70,y:44,w:42}] } },
  'beef-kabab':     { zone:'protein', src:'/images/byo/ing/beef-kabab.webp',       z:4, pos:{ familyTray:[{x:34,y:44,w:22},{x:66,y:44,w:22}], platter:[{x:32,y:44,w:28},{x:68,y:44,w:28}], hero:[{x:28,y:44,w:44},{x:72,y:44,w:44}], standard:[{x:36,y:44,w:36},{x:64,y:44,w:36}], compact:[{x:36,y:44,w:34},{x:64,y:44,w:34}], wrap:[{x:30,y:44,w:42},{x:70,y:44,w:42}] } },
  'philly-steak':   { zone:'protein', src:'/images/byo/ing/philly-steak.webp',     z:4, showAsideWhen:'roundBun', hotDogPos:[{x:50,y:70,w:36}], pos:{ familyTray:[{x:50,y:44,w:26}], platter:[{x:50,y:44,w:26}], hero:[{x:50,y:39,w:28}], standard:[{x:50,y:44,w:37}], compact:[{x:50,y:44,w:38}], wrap:[{x:50,y:44,w:42}] } },
  falafel:          { zone:'protein', src:'/images/byo/ing/falafel-6.webp', hotDogPos:[{x:49,y:63,w:50}], srcByQty:{ low:'/images/byo/ing/falafel-3.webp', regular:'/images/byo/ing/falafel-6.webp', extra:'/images/byo/ing/falafel-9.webp', double:'/images/byo/ing/falafel-12.webp' }, z:4, pos:{ familyTray:[{x:50,y:44,w:38}], platter:[{x:50,y:44,w:38}], hero:[{x:50,y:37,w:32}], standard:[{x:50,y:44,w:42}], compact:[{x:50,y:44,w:44}], wrap:[{x:50,y:44,w:50}] } },
  'fish-fillet':    { zone:'protein', src:'/images/byo/ing/fish-fillet2.webp',      z:4, pos:{ familyTray:[{x:50,y:44,w:38}], platter:[{x:50,y:44,w:40}], hero:[{x:50,y:44,w:51}], standard:[{x:50,y:44,w:58}], compact:[{x:50,y:44,w:60}], wrap:[{x:50,y:44,w:66}] } },
  shrimp:           { zone:'protein', src:'/images/byo/ing/shrimp.webp',            z:4, hotDogPos:[{x:25,y:62,w:24},{x:38,y:63,w:24}], pos:{ familyTray:[{x:34,y:43,w:13},{x:66,y:45,w:13}], platter:[{x:32,y:43,w:13},{x:68,y:45,w:13}], hero:[{x:28,y:36,w:20},{x:72,y:36,w:20}], standard:[{x:36,y:43,w:17},{x:64,y:45,w:17}], compact:[{x:57,y:43,w:16},{x:44,y:42,w:18}], wrap:[{x:30,y:43,w:17},{x:70,y:45,w:17}] } },
  tuna:             { zone:'protein', src:'/images/byo/ing/tuna.webp',              z:4, pos:{ familyTray:[{x:50,y:44,w:38}], platter:[{x:50,y:44,w:40}], hero:[{x:51,y:34,w:39}], standard:[{x:50,y:44,w:58}], compact:[{x:50,y:44,w:60}], wrap:[{x:50,y:44,w:64}] } },
  'beef-burger':    { zone:'protein', src:'/images/byo/ing/beef-burger2.webp',      z:4, hotDogPos:[{x:50,y:62,w:24}], pos:{ familyTray:[{x:50,y:44,w:34}], platter:[{x:55,y:44,w:20}], hero:[{x:50,y:39,w:28}], standard:[{x:50,y:44,w:28}], compact:[{x:50,y:44,w:28}], wrap:[{x:50,y:44,w:32}] } },
  'chicken-burger': { zone:'protein', src:'/images/byo/ing/chicken-burger.webp',   z:4, showAsideWhen:'burger', pos:{ familyTray:[{x:50,y:44,w:34}], platter:[{x:50,y:44,w:34}], hero:[{x:50,y:41,w:35}], standard:[{x:50,y:44,w:56}], compact:[{x:50,y:44,w:58}], wrap:[{x:50,y:44,w:58}] } },
  'egg-fried':      { zone:'protein', src:'/images/byo/ing/egg-fried.webp',        z:4, pos:{ familyTray:[{x:34,y:44,w:14,rot:12},{x:66,y:44,w:14,rot:-9}], platter:[{x:32,y:44,w:18,rot:10},{x:68,y:43,w:18,rot:-8}], hero:[{x:22,y:37,w:30,rot:10},{x:70,y:43,w:29,rot:-9}], standard:[{x:36,y:44,w:28,rot:10},{x:64,y:43,w:27,rot:-8}], compact:[{x:36,y:44,w:28,rot:8},{x:64,y:44,w:27,rot:-7}], wrap:[{x:31,y:44,w:32,rot:12},{x:69,y:43,w:31,rot:-10}] } },
  'egg-scrambled':  { zone:'protein', src:'/images/byo/ing/egg-scrambled.webp',    z:4, hotDogPos:[{x:50,y:70,w:47}], pos:{ familyTray:[{x:50,y:44,w:44}], platter:[{x:50,y:44,w:44}], hero:[{x:76,y:39,w:42}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:64}], wrap:[{x:50,y:44,w:66}] } },

  /* ── CHEESE  z=3 — sits below protein (z=4) so it peeks out at the edges.
     Sizes kept modest so cheese is a layer, not the visual hero.          ── */
  american:      { zone:'cheese', src:'/images/byo/ing/american-cheese.webp', z:3, hotDogPos:[{x:50,y:66,w:22}], pos:{ familyTray:[{x:50,y:47,w:18}], platter:[{x:50,y:47,w:29}], hero:[{x:50,y:36,w:27}], standard:[{x:50,y:47,w:22}], compact:[{x:50,y:47,w:22}], wrap:[{x:50,y:47,w:28}] } },
  cream:         { zone:'cheese', src:'/images/byo/ing/cream-cheese.webp',    z:3, pos:{ familyTray:[{x:50,y:47,w:20}], platter:[{x:50,y:47,w:22}], hero:[{x:50,y:47,w:34}], standard:[{x:50,y:47,w:28}], compact:[{x:50,y:47,w:30}], wrap:[{x:50,y:47,w:32}] } },
  butter:        { zone:'cheese', src:'/images/byo/ing/butter2.webp',          z:3, pos:{ familyTray:[{x:50,y:47,w:13}], platter:[{x:50,y:47,w:14}], hero:[{x:50,y:37,w:38}], standard:[{x:50,y:21,w:16}], compact:[{x:50,y:21,w:16}], wrap:[{x:50,y:47,w:18}] } },
  liquid_cheese: { zone:'cheese', src:'/images/byo/ing/liquid-cheese.webp',   z:3, hotDogPos:[{x:49,y:69,w:57}], pos:{ familyTray:[{x:50,y:47,w:30}], platter:[{x:50,y:47,w:32}], hero:[{x:50,y:35,w:40}], standard:[{x:50,y:47,w:36}], compact:[{x:50,y:47,w:34}], wrap:[{x:50,y:47,w:38}] } },

  /* ── VEGETABLES  z=2 bed / z=5 scattered ───────────────────── */
  lettuce:  { zone:'veg', src:'/images/byo/ing/lettuce.webp',  z:2, hotDogPos:[{x:50,y:50,w:71}], pos:{ familyTray:[{x:70,y:53,w:50}], platter:[{x:75,y:53,w:35}], hero:[{x:51,y:50,w:92,peekY:46}], standard:[{x:50,y:44,w:68}], compact:[{x:50,y:52,w:70}], wrap:[{x:50,y:44,w:84}] } },
  /* Rice: square yellow basmati for flat trays; platter uses same dense image, bread bases use elongated pile */
  rice:     { zone:'rice', src:'/images/byo/ing/rice.webp',
    srcByFamily: { familyTray:'/images/byo/ing/rice-tray.webp', platter:'/images/byo/ing/rice-tray.webp' },
    z:2, pos:{ familyTray:[{x:34,y:50,w:40,final:true}], platter:[{x:50,y:50,w:22}], hero:[{x:50,y:54,w:62}], standard:[{x:50,y:54,w:50}], compact:[{x:50,y:54,w:48}], wrap:[{x:50,y:54,w:60}] } },
  /* Onions: ~2" slice — fewer, centred for compact round bases */
  onions:   { zone:'veg', src:'/images/byo/ing/onion2.webp',    z:5, hotDogPos:[{x:30,y:44,w:31},{x:44,y:40,w:32}], pos:{
    familyTray:[{x:48,y:36,w:28,rot:-3.5,final:true},{x:40,y:61,w:24,rot:7,final:true}],
    platter:   [{x:22,y:59,w:12},{x:40,y:64,w:12},{x:58,y:58,w:11},{x:76,y:64,w:11}],
    hero:      [{x:40,y:44,w:29},{x:59,y:45,w:35}],
    standard:  [{x:33,y:44,w:18},{x:72,y:45,w:18},{x:52,y:42,w:18}],
    compact:   [{x:33,y:44,w:20},{x:72,y:45,w:19},{x:52,y:42,w:18}],
    wrap:      [{x:16,y:44,w:20},{x:40,y:40,w:18},{x:53,y:30,w:45},{x:82,y:41,w:18}],
  } },
  /* Peppers: ~2" slice */
  peppers:  { zone:'veg', src:'/images/byo/ing/pepper.webp',   z:5, hotDogPos:[{x:28,y:64,w:20}], pos:{
    familyTray:[{x:51,y:49,w:21,rot:-10.5,final:true},{x:70,y:45,w:16,rot:-7,final:true}],
    platter:   [{x:22,y:49,w:10},{x:38,y:45,w:10},{x:54,y:50,w:10},{x:70,y:45,w:9},{x:78,y:50,w:9}],
    hero:      [{x:26,y:46,w:25},{x:77,y:46,w:25}],
    standard:  [{x:30,y:50,w:16},{x:52,y:46,w:15},{x:72,y:51,w:15}],
    compact:   [{x:30,y:50,w:17},{x:52,y:46,w:16},{x:72,y:51,w:16}],
    wrap:      [{x:14,y:50,w:18},{x:38,y:46,w:17},{x:62,y:51,w:17},{x:82,y:47,w:16}],
  } },
  /* Cucumbers: ~1.5" slice — fewer, tighter for compact round bases */
  cucumbers: { zone:'veg', src:'/images/byo/ing/cucumber2.webp', z:5, pos:{
    familyTray:[{x:16,y:55,w:10},{x:32,y:51,w:10},{x:48,y:56,w:10},{x:64,y:51,w:9},{x:80,y:56,w:9}],
    platter:   [{x:22,y:55,w:11},{x:38,y:51,w:11},{x:54,y:56,w:11},{x:70,y:51,w:10},{x:78,y:56,w:10}],
    hero:      [{x:12,y:56,w:14},{x:30,y:52,w:14},{x:52,y:57,w:13},{x:72,y:52,w:13},{x:88,y:56,w:12}],
    standard:  [{x:30,y:56,w:14},{x:50,y:52,w:14},{x:70,y:57,w:13}],
    compact:   [{x:30,y:56,w:15},{x:52,y:52,w:14},{x:72,y:57,w:14}],
    wrap:      [{x:14,y:56,w:16},{x:38,y:52,w:15},{x:62,y:57,w:15},{x:84,y:52,w:14}],
  } },
  /* Tomatoes: ~3" slice */
  tomatoes: { zone:'veg', src:'/images/byo/ing/tomato.webp',   z:5, hotDogPos:[{x:33,y:32,w:29},{x:68,y:31,w:22}], pos:{
    familyTray:[{x:26,y:41,w:17},{x:50,y:45,w:17},{x:64,y:41,w:17}],
    platter:   [{x:28,y:41,w:17},{x:50,y:45,w:18},{x:72,y:41,w:17}],
    hero:      [{x:53,y:52,w:29}],
    standard:  [{x:60,y:52,w:32},{x:36,y:52,w:32}],
    compact:   [{x:60,y:52,w:32},{x:36,y:52,w:30}],
    wrap:      [{x:22,y:41,w:34},{x:52,y:45,w:32},{x:80,y:41,w:30}],
  } },
};

/* ── Qty scale multipliers for visual size ──────────────────── */
const QTY_W_SCALE = { low: 0.68, regular: 1.0, extra: 1.28, double: 1.55 };

/* ── Protein duplication config ──────────────────────────────
   wScale: base size of each instance
   extra:  additional instances [{dx,dy,rotAdd,wF}] offset from primary */
const QTY_DUP = {
  /* low-extra */
  low:    { wScale: 0.70, extra: [] },
  regular:{ wScale: 1.00, extra: [] },
  extra:  { wScale: 1.16, extra: [] },  // larger single serving
  double: { wScale: 0.92, extra: [{ dx: +10, dy: -6, rotAdd: +7, wF: 0.88 }] },
  /* single-double / single-triple */
  single: { wScale: 1.00, extra: [] },
  triple: { wScale: 0.90, extra: [
    { dx: +10, dy: -5, rotAdd:  +7, wF: 0.88 },
    { dx:  -9, dy: +6, rotAdd:  -5, wF: 0.80 },
  ]},
};

/* ── Realistic SVG sauce drizzle ────────────────────────────── */
const DRIZZLE_COLORS = {
  white:   { base: '#dfc87a', hi: '#fdfae8', shadow: '#9e8830' },
  hot:     { base: '#c41010', hi: '#ff6644', shadow: '#7a0000' },
  ketchup: { base: '#b80800', hi: '#ee3322', shadow: '#780000' },
  mustard: { base: '#c89000', hi: '#ffd820', shadow: '#806000' },
  bbq:     { base: '#5c1200', hi: '#8c3c1c', shadow: '#280400' },
  green:   { base: '#257a1c', hi: '#4cc030', shadow: '#0e4408' },
  mayo:    { base: '#ddd488', hi: '#ffffec', shadow: '#9e9040' },
  blue:    { base: '#ccc4b0', hi: '#f8f4ee', shadow: '#888070' },
};
function DrizzleSVG({ sauceId, qty }) {
  const c = DRIZZLE_COLORS[sauceId] || DRIZZLE_COLORS.white;
  const sw = qty === 'low' ? 3.0 : qty === 'extra' ? 5.5 : 4.2;
  /* Organic asymmetric paths per qty so each variant has a distinct character */
  const path = qty === 'low'
    ? 'M 2,11 C 20,5 38,17 55,10 C 72,4 88,15 98,10'
    : qty === 'extra'
    ? 'M 1,11 C 10,4 20,17 30,10 C 42,4 54,16 64,10 C 75,4 87,15 98,11'
    : 'M 2,11 C 14,5 27,16 40,10 C 55,5 68,16 82,10 C 89,6 95,13 98,11';
  return (
    <svg viewBox="0 0 100 22" xmlns="http://www.w3.org/2000/svg"
      style={{ width:'100%', height:'100%', overflow:'visible', display:'block' }}>
      {/* Depth shadow beneath */}
      <path d={path} fill="none" stroke={c.shadow} strokeWidth={sw + 1.8}
        strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
        transform="translate(0,1)" />
      {/* Main sauce body */}
      <path d={path} fill="none" stroke={c.base} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Specular highlight — thin bright streak along top edge */}
      <path d={path} fill="none" stroke={c.hi} strokeWidth={sw * 0.28}
        strokeLinecap="round" strokeLinejoin="round" opacity="0.82"
        transform="translate(0,-0.8)" />
    </svg>
  );
}

/* ── Sauce pool colours — used for CSS blob rendering ────── */
const SAUCE_COLORS = {
  white:   { pool: 'rgba(240,228,195,0.95)', hi: 'rgba(255,250,238,1.0)'  },
  hot:     { pool: 'rgba(210,22,8,0.96)',    hi: 'rgba(255,60,25,1.0)'    },
  ketchup: { pool: 'rgba(178,10,10,0.96)',   hi: 'rgba(230,38,22,1.0)'    },
  mustard: { pool: 'rgba(210,155,0,0.96)',   hi: 'rgba(255,198,0,1.0)'    },
  bbq:     { pool: 'rgba(62,18,4,0.97)',     hi: 'rgba(115,40,10,1.0)'    },
  green:   { pool: 'rgba(10,120,10,0.96)',   hi: 'rgba(32,168,24,1.0)'    },
  mayo:    { pool: 'rgba(232,205,75,0.96)',  hi: 'rgba(252,240,138,1.0)'  },
  blue:    { pool: 'rgba(88,75,155,0.96)',   hi: 'rgba(138,125,198,1.0)'  },
};

/* ── Remap x AND w into a zone (used for vegetables, rice) ──
   pos.final short-circuits every transform in this file (this fn,
   remapZoneX, clampIngPos, qty w-scaling, and the ingWidthScale/
   splitBunYShift applied at render time) -- it marks a position as
   hand-tuned to an exact on-canvas placement (from a real customer's
   dev-tools measurement of what actually looked right), which the
   normal zone/qty/family scaling pipeline has no reliable way to
   reverse into automatically. Final positions render pixel-for-pixel
   as stored, nothing else. */
function remapZone(pos, zoneMin, zoneMax) {
  if (pos.final) return pos;
  const zW = zoneMax - zoneMin;
  const newX = zoneMin + (pos.x / 100) * zW;
  const newW = Math.round(pos.w * zW / 100);
  return { ...pos, x: Math.round(newX), w: Math.max(6, newW) };
}

/* ── Remap x only, keep original w (used for proteins) ───── */
function remapZoneX(pos, zoneMin, zoneMax) {
  if (pos.final) return pos;
  const zW = zoneMax - zoneMin;
  const newX = zoneMin + (pos.x / 100) * zW;
  return { ...pos, x: Math.round(newX) };
}

/* ── Per-family ingredient bounds — derived from displayed image dimensions in 4:3 canvas.
   Square images (1:1) in a 4:3 canvas fill ~66% of canvas width centered → xMin≈20, xMax≈80.
   Landscape images (≥4:3) fill ~92% width. Portrait images fill less.               ── */
const FAMILY_BOUNDS = {
  hero:       { xMin: 5,  xMax: 93, maxW: 78, peekMaxW: 95 }, // 1536×1024 landscape ≈ 4:3 → fills ~92%
  wrap:       { xMin: 20, xMax: 80, maxW: 50 }, // square image, round flatbread
  standard:   { xMin: 20, xMax: 80, maxW: 50 }, // square image, round bread fills ~66%
  compact:    { xMin: 22, xMax: 78, maxW: 44 }, // default for compact family
  platter:    { xMin: 12, xMax: 88, maxW: 64 }, // tray floor spans approx x:10-90%
  familyTray: { xMin: 5,  xMax: 93, maxW: 80 }, // 1536×1024 landscape → nearly full width
};
/* Per-base overrides for images whose aspect ratio differs from family norm */
const BASE_BOUNDS_OVERRIDE = {
  '39d': { xMin: 6,  xMax: 92, maxW: 70, peekMaxW: 42, maskH: '69%' }, // croissant 1448×1086 → width-constrained, actual render height 69%
  '39e': { xMin: 25, xMax: 75, maxW: 42, peekMaxW: 54, drizzleMaxW: 30, drizzleScaleY: '2.2', maskSize: '88% 88%' }, // bagel 1254×1254 → square, mask 88%×88%
  '39h': { xMin: 30, xMax: 70, maxW: 24 }, // hot dog bun — narrow portrait bun, keep food tight
};

/* Clamp a position to stay within zone and respect max ingredient width */
function clampIngPos(pos, zMin, zMax, maxW) {
  if (pos.final) return pos;
  const zW   = zMax - zMin;
  const w    = Math.min(pos.w, maxW, Math.round(zW * 0.92));
  const half = w / 2;
  const x    = Math.max(zMin + half, Math.min(zMax - half, pos.x));
  return { ...pos, x: Math.round(x), w: Math.round(w) };
}


/* ── Top-down food-photography canvas ─────────────────────────── */
function IngCanvas({ base, cfg, onReset, proteinOpts, sauceOpts }) {
  const family = base?.family;
  const isFlatBase  = family === 'platter' || family === 'familyTray';
  /* Split-bun bases show both halves opened from above. Food is shifted into the bottom half
     via splitBunYShift so it sits cleanly inside the bottom bread/bun shape, masked by the
     base image alpha. Hero uses a larger shift because its halves are landscape rectangles
     and the bottom-half centre is deeper in the canvas (y≈72%). Bagel uses the largest
     shift to clear the donut hole whose centre falls at y≈72% of canvas. */
  /* Hot dog bun gets its own layout: veg in top half, protein in bottom half — both halves visible */
  const isHotDog    = base?.id === '39h';
  const isSplitBun  = !isFlatBase && !isHotDog && (family === 'standard' || family === 'compact' || family === 'hero');
  const splitBunYShift = base?.id === '39e' ? 28  // bagel: keep items in wider mid-section of bottom ring
                       : base?.id === '39a' ? 28  // hero: landscape bottom half centre ≈ y:72%
                       : base?.id === '39d' ? 22  // croissant: landscape, actual bun bottom at y:84.5%, keep protein clear
                       : 26;                       // roll, burger bun
  /* Flat bases use a larger width scale so items fill their zones (zones are narrow %-wise) */
  const ingWidthScale = isFlatBase ? 1.60 : 1.20;

  /* ── Hand-drop animation — triggered when a new ingredient is added ── */
  const [handPos, setHandPos] = useState(null);
  const prevIngStr = useRef('');

  /* ── Share/screenshot ── */
  const canvasRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const handleShare = async () => {
    if (!canvasRef.current || capturing) return;
    setCapturing(true);
    try {
      const blob = await toBlob(canvasRef.current, {
        pixelRatio: 2,
        backgroundColor: '#141414',
        cacheBust: true,
        filter: node => !node.classList?.contains('co-reset-btn'),
      });
      if (!blob) throw new Error('capture failed');

      const fileName = `habibi-${(base?.label || 'custom').toLowerCase().replace(/\s+/g, '-')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Habibi Halal Express creation',
          text: `Check out my custom ${base?.label || 'meal'} from Habibi Halal Express! 🔥`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed', err);
    } finally {
      setCapturing(false);
    }
  };

  /* ── Analyse what's on the plate ── */
  const hasProtein  = Object.keys(cfg.proteins).length > 0;
  const hasRice     = !!cfg.vegetables.rice;
  const sideProteins = Object.keys(cfg.proteins).filter(id => {
    /* Manual placement override — user chose "On Side" */
    if (cfg.proteins[id]?.placement === 'on_side') return true;
    /* Auto-aside rules by base type */
    const when = CO_ING_DB[id]?.showAsideWhen;
    if (!when) return false;
    if (when === 'hotdog') return isHotDog;
    if (when === 'burger') return base?.id === '39g';
    /* Philly Steak specifically: a whole steak slab centered on any flat
       round bread (Bagel/Roll/Burger Bun — all family 'standard') reads
       as a burger patty, not a stuffed sandwich. Show it as a side item
       on all of those, not just Burger Bun. */
    if (when === 'roundBun') return family === 'standard';
    if (when === 'bread')  return true;
    return false;
  });
  const hasNonRiceVeg = Object.keys(cfg.vegetables).some(k => k !== 'rice');
  const hasCheese   = cfg.cheese.type && cfg.cheese.type !== 'none';
  const hasSides    = (hasRice && !isFlatBase) || sideProteins.length > 0;

  /* ── Layout mode (flat bases only) ──────────────────────────────
     triple  = rice LEFT  + protein CENTER + veg RIGHT
     dual_rv = rice LEFT  + protein RIGHT  (no veg)
     dual_pv = protein LEFT + veg RIGHT    (no rice)
     solo    = full canvas                                       */
  const tripleLayout = isFlatBase && hasProtein && hasRice && hasNonRiceVeg;
  const dualRV       = isFlatBase && hasProtein && hasRice && !hasNonRiceVeg;
  const dualPV       = isFlatBase && hasProtein && !hasRice && hasNonRiceVeg;
  const splitLayout  = tripleLayout || dualRV || dualPV; // any split (for drizzle)

  const isPlatter = family === 'platter';

  /* Safe bounds for this specific base — bread area in the 4:3 canvas */
  const bounds = BASE_BOUNDS_OVERRIDE[base?.id] || FAMILY_BOUNDS[family] || { xMin: 5, xMax: 95, maxW: 80 };
  const bMid   = Math.round((bounds.xMin + bounds.xMax) / 2);
  const bW     = bounds.xMax - bounds.xMin;

  let PROT_ZONE, VEG_ZONE, RICE_ZONE, CHEESE_ZONE;
  if (isFlatBase) {
    /* Platter / FamilyTray — existing zone logic (already works well) */
    if (tripleLayout) {
      if (isPlatter) {
        RICE_ZONE=[9,37]; PROT_ZONE=[37,63]; VEG_ZONE=[63,91]; CHEESE_ZONE=[37,63];
      } else {
        RICE_ZONE=[3,34]; PROT_ZONE=[34,66]; VEG_ZONE=[66,97]; CHEESE_ZONE=[34,66];
      }
    } else if (dualRV) {
      if (isPlatter) { RICE_ZONE=[12,50]; PROT_ZONE=[52,88]; VEG_ZONE=[12,88]; CHEESE_ZONE=[52,88]; }
      else           { RICE_ZONE=[4,50];  PROT_ZONE=[52,97]; VEG_ZONE=[4,96];  CHEESE_ZONE=[52,97]; }
    } else if (dualPV) {
      if (isPlatter) { PROT_ZONE=[12,50]; VEG_ZONE=[52,88]; RICE_ZONE=[12,88]; CHEESE_ZONE=[12,50]; }
      else           { PROT_ZONE=[4,51];  VEG_ZONE=[53,97]; RICE_ZONE=[4,96];  CHEESE_ZONE=[4,51]; }
    } else {
      if (isPlatter) { PROT_ZONE=[12,88]; VEG_ZONE=[12,88]; RICE_ZONE=[12,88]; CHEESE_ZONE=[12,88]; }
      else           { PROT_ZONE=[4,96];  VEG_ZONE=[4,96];  RICE_ZONE=[4,96];  CHEESE_ZONE=[4,96]; }
    }
  } else {
    /* Bread bases — all zones constrained to actual bread display area (never [4,96]) */
    const seg = Math.round(bW / 3);
    if (tripleLayout) {
      /* tripleLayout is only true for isFlatBase so this branch is unreachable here — safety fallback */
      RICE_ZONE=[bounds.xMin, bounds.xMin+seg-2]; PROT_ZONE=[bounds.xMin+seg+1, bounds.xMax-seg-1];
      VEG_ZONE=[bounds.xMax-seg+2, bounds.xMax]; CHEESE_ZONE=PROT_ZONE;
    } else if (dualRV) {
      PROT_ZONE=[bounds.xMin, bMid-1]; RICE_ZONE=[bMid+1, bounds.xMax];
      VEG_ZONE=[bounds.xMin, bounds.xMax]; CHEESE_ZONE=[bounds.xMin, bMid-1];
    } else if (dualPV) {
      PROT_ZONE=[bounds.xMin, bMid-1]; VEG_ZONE=[bMid+1, bounds.xMax];
      RICE_ZONE=[bounds.xMin, bounds.xMax]; CHEESE_ZONE=[bounds.xMin, bMid-1];
    } else {
      PROT_ZONE=[bounds.xMin, bounds.xMax]; VEG_ZONE=[bounds.xMin, bounds.xMax];
      RICE_ZONE=[bounds.xMin, bounds.xMax]; CHEESE_ZONE=[bounds.xMin, bounds.xMax];
    }
  }

  /* ── Build ingredient layers ── */
  const layers = [];

  /* Helper: push positions for one ingredient — includes bounds clamping.
     Flat bases (platter/familyTray) have narrow zones (19–29% wide) so we keep
     natural widths (remapZoneX).  Bread bases use proportional scaling (remapZone)
     so veg doesn't balloon to 2× in split-mode half-zones. */
  const pushItem = (id, def, rawPositions, src, zone, maxWOverride) => {
    rawPositions.forEach(pos => {
      const zPos = isFlatBase
        ? remapZoneX(pos, zone[0], zone[1])
        : remapZone(pos, zone[0], zone[1]);
      const cPos = clampIngPos(zPos, zone[0], zone[1], maxWOverride ?? bounds.maxW);
      layers.push({ id, def, pos: cPos, src });
    });
  };


  /* Proteins */
  Object.entries(cfg.proteins).forEach(([id, sel]) => {
    const def = CO_ING_DB[id];
    if (!def || !family) return;
    /* Skip proteins that are shown as aside badges for this base */
    if (sideProteins.includes(id)) return;
    /* Hot dog bun: use pre-computed hotDogPos directly (final render values, no zone remapping) */
    if (isHotDog && def.hotDogPos) {
      let src = def.src;
      if (def.srcByQty && sel.qty) src = def.srcByQty[sel.qty] || def.src;
      def.hotDogPos.forEach(pos => layers.push({ id, def, src, pos }));
      return;
    }
    const rawPos = def.pos[family] || def.pos.standard;
    if (!rawPos) return;
    const protOpt = proteinOpts.find(p => p.id === id);
    const qtyType = protOpt?.qtyType;

    let src = def.src;
    if (def.srcByQty && sel.qty) src = def.srcByQty[sel.qty] || def.src;

    if (def.srcByQty) {
      rawPos.forEach(pos => {
        const cPos = clampIngPos(remapZoneX(pos, PROT_ZONE[0], PROT_ZONE[1]), PROT_ZONE[0], PROT_ZONE[1], bounds.maxW);
        layers.push({ id, def, src, pos: cPos });
      });
      return;
    }

    if (qtyType === 'eggs') {
      const count = Math.min(4, Math.max(1, parseInt(sel.qty) || 1));
      const anchor = clampIngPos(
        remapZoneX(rawPos[0] || { x:50, y:44, w:28 }, PROT_ZONE[0], PROT_ZONE[1]),
        PROT_ZONE[0], PROT_ZONE[1], bounds.maxW
      );
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 10;
        const nx = Math.round(Math.max(PROT_ZONE[0] + anchor.w / 2, Math.min(PROT_ZONE[1] - anchor.w / 2, anchor.x + spread)));
        layers.push({ id, def, src, pos: { ...anchor, x: nx } });
      }
      return;
    }

    const dup = QTY_DUP[sel.qty] || QTY_DUP.regular;
    rawPos.forEach(pos => {
      const scaledPos = pos.final ? pos : { ...pos, w: Math.round(pos.w * dup.wScale) };
      const cPos = clampIngPos(remapZoneX(scaledPos, PROT_ZONE[0], PROT_ZONE[1]), PROT_ZONE[0], PROT_ZONE[1], bounds.maxW);
      layers.push({ id, def, src, pos: cPos });
      if (pos.final) return; // hand-placed proteins render once, no qty duplicates
      dup.extra.forEach(off => {
        const offPos = {
          ...cPos,
          x:   cPos.x + off.dx,
          y:   Math.round(Math.max(5, Math.min(90, cPos.y + off.dy))),
          w:   Math.round(cPos.w * off.wF),
          rot: (cPos.rot || 0) + off.rotAdd,
        };
        layers.push({ id, def, src, pos: clampIngPos(offPos, PROT_ZONE[0], PROT_ZONE[1], bounds.maxW) });
      });
    });
  });

  /* Vegetables (non-rice) */
  Object.entries(cfg.vegetables).forEach(([id, sel]) => {
    if (id === 'rice') return;
    const def = CO_ING_DB[id];
    if (!def || !family) return;
    /* Hot dog bun: use pre-computed hotDogPos directly (final render values, no zone remapping) */
    if (isHotDog && def.hotDogPos) {
      const wScale = QTY_W_SCALE[sel.qty] || 1;
      def.hotDogPos.forEach(pos => {
        layers.push({ id, def, src: def.src, pos: { ...pos, w: Math.round(pos.w * wScale) } });
      });
      return;
    }
    const rawPos = def.pos[family] || def.pos.standard;
    if (!rawPos) return;
    const wScale = QTY_W_SCALE[sel.qty] || 1;
    /* Veg on split-bun bases (hero/standard/compact) only ever renders via the
       unmasked "peek" path below, which has its own (usually wider) peekMaxW —
       clamping against the regular maxW here left peekMaxW unreachable. */
    pushItem(id, def, rawPos.map(p => p.final ? p : { ...p, w: Math.round(p.w * wScale) }), def.src, VEG_ZONE, bounds.peekMaxW ?? bounds.maxW);
  });

  /* Rice — only render inside the canvas for flat bases (platter / family tray).
     For bread bases rice is shown as a separate "on the side" badge. */
  if (hasRice && isFlatBase) {
    const def = CO_ING_DB.rice;
    if (def && family) {
      const rawPos = def.pos[family] || def.pos.standard;
      if (rawPos) {
        const wScale = QTY_W_SCALE[cfg.vegetables.rice?.qty] || 1;
        const riceSrc = def.srcByFamily?.[family] || def.src;
        rawPos.forEach(pos => {
          const scaledPos = pos.final ? pos : { ...pos, w: Math.round(pos.w * wScale) };
          const cPos = clampIngPos(remapZoneX(scaledPos, RICE_ZONE[0], RICE_ZONE[1]), RICE_ZONE[0], RICE_ZONE[1], bounds.maxW);
          layers.push({ id:'rice', def, src: riceSrc, pos: cPos });
        });
      }
    }
  }

  /* Cheese — food image at z:3, sits between veg (z:2) and protein (z:4) */
  if (hasCheese) {
    const def = CO_ING_DB[cfg.cheese.type];
    if (def && family && def.zone === 'cheese') {
      /* Hot dog bun: use pre-computed hotDogPos directly */
      if (isHotDog && def.hotDogPos) {
        def.hotDogPos.forEach(pos => layers.push({ id: cfg.cheese.type, def, src: def.src, pos }));
      } else {
        const rawPos = def.pos[family] || def.pos.standard;
        if (rawPos) {
          rawPos.forEach(pos => {
            const cPos = clampIngPos(remapZoneX(pos, CHEESE_ZONE[0], CHEESE_ZONE[1]), CHEESE_ZONE[0], CHEESE_ZONE[1], bounds.maxW);
            layers.push({ id: cfg.cheese.type, def, src: def.src, pos: cPos });
          });
        }
      }
    }
  }

  layers.sort((a, b) => (a.def.z || 2) - (b.def.z || 2));

  /* ── Detect newly added ingredient → trigger hand-drop animation ── */
  const ingStr = [
    ...Object.keys(cfg.proteins).sort(),
    ...Object.keys(cfg.vegetables).sort(),
    cfg.cheese.type && cfg.cheese.type !== 'none' ? `ch:${cfg.cheese.type}` : '',
    ...Object.keys(cfg.sauces).sort(),
  ].filter(Boolean).join('|');

  useEffect(() => {
    const prev = prevIngStr.current;
    const prevCount = prev ? prev.split('|').length : 0;
    const currCount = ingStr ? ingStr.split('|').length : 0;
    if (currCount > prevCount && layers.length > 0) {
      const target = layers[layers.length - 1];
      if (target) {
        setHandPos({ x: target.pos.x, y: target.pos.y, key: Date.now() });
        const t = setTimeout(() => setHandPos(null), 1050);
        prevIngStr.current = ingStr;
        return () => clearTimeout(t);
      }
    }
    prevIngStr.current = ingStr;
  }, [ingStr]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cheese opacity based on qty ── */
  const CHEESE_OPACITY = { low: 0.70, regular: 0.92, extra: 1.0 };
  const cheeseOpacity = hasCheese ? (CHEESE_OPACITY[cfg.cheese.qty] || 0.80) : 1;

  /* ── Sauces: split into on-food (drizzle) and on-side (bowl) ── */
  const onFoodSauces  = Object.entries(cfg.sauces).filter(([,s]) => s.placement === 'on_food')
    .map(([id]) => sauceOpts.find(o => o.id === id)).filter(Boolean);
  const onSideSauces  = Object.entries(cfg.sauces).filter(([,s]) => s.placement === 'on_side')
    .map(([id]) => sauceOpts.find(o => o.id === id)).filter(Boolean);

  /* Drizzle — narrowed to 70% of zone width and shifted inward so the sauce looks
     like it's drizzled ON the food, not spanning the whole canvas */
  const drizzleZoneW = splitLayout ? (PROT_ZONE[1] - PROT_ZONE[0]) : (bounds.xMax - bounds.xMin);
  const drizzleZoneL = splitLayout ? PROT_ZONE[0]                  : bounds.xMin;
  const drizzleInset  = Math.round(drizzleZoneW * 0.08);
  const rawDrizzleW   = drizzleZoneW - drizzleInset * 2;
  const drizzleLeft   = `${drizzleZoneL + drizzleInset + (bounds.drizzleMaxW != null ? Math.max(0, rawDrizzleW - bounds.drizzleMaxW) / 2 : 0)}%`;
  const drizzleWidth  = `${bounds.drizzleMaxW != null ? Math.min(rawDrizzleW, bounds.drizzleMaxW) : rawDrizzleW}%`;

  const isEmpty = layers.length === 0 && onFoodSauces.length === 0;

  return (
    <>
      <div ref={canvasRef} className={`co-canvas${handPos ? ' co-canvas--active' : ''}${isFlatBase ? ' co-canvas--flat' : ''}${base ? ' co-canvas--has-base' : ''}`} data-base={base?.id || ''}>
        <div className="co-canvas-center-glow" />
        {/* Food shadow only for bread-based items — flat trays/platters have their own tray depth */}
        {base && !isFlatBase && <div className={`co-canvas-food-shadow co-cfs--${family}`} />}

        {base && onReset && (
          <button className="co-reset-btn" onClick={onReset} title="Start over">
            ↺ Reset
          </button>
        )}

        {base ? (
          <>
            <img src={base.img} alt={base.label} className="co-canvas-base"
              onError={e => { e.currentTarget.style.opacity = '0.3'; }}
            />

            {/* Ingredient + drizzle layers — alpha-masked to base shape */}
            <div
              className="co-canvas-ing-wrap"
              style={{
                WebkitMaskImage: `url(${base.img})`,
                maskImage: `url(${base.img})`,
                WebkitMaskSize: isHotDog ? '66% 88%' : (bounds.maskSize || `92% ${bounds.maskH || '88%'}`),
                maskSize: isHotDog ? '66% 88%' : (bounds.maskSize || `92% ${bounds.maskH || '88%'}`),
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            >
              {/* Tray interior fill — warm silver base visible in empty zone areas */}
              {isFlatBase && <div className="co-canvas-tray-fill" />}

              {/* Zone separators removed — food items naturally define sections */}

              {/* Flat base: rice rendered as a background-covered zone div so it fills edge-to-edge */}
              {/* rice-zone-fill removed — rice ingredient image renders it directly */}

              {/* Ingredients — veg excluded on split buns (rendered unmasked below for peek effect) */}
              {layers.filter(l => !isSplitBun || l.def.zone !== 'veg').map(({ id, def, pos, src }, i) => (
                <img
                  key={`${id}-${i}`}
                  src={src || def.src}
                  alt=""
                  className="co-canvas-ing"
                  data-zone={def.zone}
                  data-id={id}
                  style={{
                    left: `${pos.x}%`,
                    top: pos.final
                      ? `${pos.y}%`
                      : isHotDog
                        ? `${pos.y}%`
                        : `${isSplitBun ? Math.min(pos.y + splitBunYShift, 82) : pos.y}%`,
                    width: `${pos.final ? pos.w : isHotDog ? pos.w : bounds.noWiden ? pos.w : def.zone === 'cheese' ? pos.w : Math.round(pos.w * ingWidthScale)}%`,
                    zIndex: def.z || 2,
                    opacity: def.zone === 'cheese' ? cheeseOpacity : 1,
                    '--ing-rot':   pos.rot
                      ? `${pos.rot}deg`
                      : pos.final
                        ? '0deg'
                        : def.zone === 'protein'
                          ? `${((i % 5) - 2) * 1.8}deg`   // ±3.6° natural tilt for proteins
                          : def.zone === 'veg'
                            ? `${((i % 7) - 3) * 3.5}deg` // ±10.5° scatter tilt for veg
                            : '0deg',
                    '--ing-z':     def.z || 2,
                    '--ing-depth': (1 + (pos.y - 44) * 0.008).toFixed(3),
                    '--ing-sx':    def.zone === 'veg' ? `${((i % 5) - 2) * 7}px` : '0px',
                    '--ing-sr':    def.zone === 'veg' ? `${((i % 3) - 1) * 8}deg` : '0deg',
                    animationDelay: `${i * 0.04}s`,
                  }}
                />
              ))}

              {/* Sauce drizzle — SVG for realistic glossy look */}
              {onFoodSauces.map((sauce, i) => {
                const qty = cfg.sauces[sauce.id]?.qty || 'regular';
                /* Width: ~35% for bread, 40% for flat bases, 53% for hot dog */
                const drizzleW = isFlatBase ? 40 : isHotDog ? 53 : 35;
                /* Position: flat bases fixed at left=20%, hotdog fixed at left=21.5%, bread centered in zone */
                const protCx = isFlatBase
                  ? (PROT_ZONE[0] + PROT_ZONE[1]) / 2
                  : (bounds.xMin + bounds.xMax) / 2;
                const left = isFlatBase ? 20 : isHotDog ? 21.5 : (protCx - drizzleW / 2).toFixed(1);
                /* Y on protein — lower for bread bases */
                const topY = isHotDog
                  ? Math.min(61 + i * 9, 85)
                  : isSplitBun
                    ? Math.min(60 + splitBunYShift * 0.35 + i * 7, 82)
                    : isFlatBase ? 47 + i * 10
                    : 56 + i * 8;
                const rot = [-5, 4, -7, 5, -3][i % 5];
                return (
                  <div
                    key={`drizzle-${sauce.id}`}
                    className="co-canvas-drizzle"
                    style={{
                      left:      `${left}%`,
                      top:       `${topY}%`,
                      width:     `${drizzleW}%`,
                      zIndex:    10 + i,
                      transform: `translateY(-50%) rotate(${rot}deg)`,
                      '--drizzle-rot': `${rot}deg`,
                    }}
                  >
                    <DrizzleSVG sauceId={sauce.id} qty={qty} />
                  </div>
                );
              })}
            </div>

            {/* Lighting overlay — simulates directional food photography light */}
            <div className="co-canvas-light" />

            {/* top-bun overlay removed */}

            {/* Peekout vegetables — unmasked, z:11 (below top-bun overlay z:13).
                Natural Y keeps them in the gap between halves; the top-bun overlay
                hides their upper portion while the lower portion sits on the bottom bun,
                giving the classic "overflowing burger" assembled look. */}
            {isSplitBun && layers.filter(l => l.def.zone === 'veg').map(({ id, def, pos, src }, i) => (
              <img
                key={`peek-${id}-${i}`}
                src={src || def.src}
                alt=""
                className="co-canvas-ing co-canvas-ing--peek"
                data-zone="veg"
                data-id={id}
                style={{
                  left: `${pos.peekX ?? pos.x}%`,
                  top: `calc(${(pos.peekY ?? pos.y) - 6}% - var(--peek-top, 0%))`,
                  width: `${Math.min(Math.round(pos.w), bounds.peekMaxW ?? (bounds.xMax - bounds.xMin))}%`,
                  zIndex: 14,
                  '--ing-rot': `${((i % 5) - 2) * 2.5}deg`,
                  '--ing-z': 14,
                  '--ing-depth': '1.0',
                  '--ing-sx': '0px',
                  '--ing-sr': '0deg',
                  animationDelay: `${i * 0.04}s`,
                }}
              />
            ))}

            {/* Steam wisps rising from protein(s) */}
            {layers.filter(l => l.def.zone === 'protein').slice(0, 2).map((l, si) => (
              <div key={`steam-${l.id}-${si}`} className="co-canvas-steam"
                style={{ left: `${l.pos.x}%`, top: `${Math.max(6, isHotDog ? 57 : (isSplitBun ? Math.min(l.pos.y + splitBunYShift, 82) : l.pos.y) - 16)}%`, zIndex: 17 }}>
                <span /><span /><span />
              </div>
            ))}

            {/* Sides panel — vertical plate column on left edge */}
            {(hasRice && !isFlatBase || sideProteins.length > 0) && (() => {
              const sideCount = (hasRice && !isFlatBase ? 1 : 0) + sideProteins.length;
              const sizeClass = sideCount >= 4 ? ' co-aside-mini' : sideCount >= 3 ? ' co-aside-compact' : '';
              return (
                <div className={`co-aside-list${sizeClass}`}>
                  <div className="co-aside-header">
                    <span className="co-aside-header-label">SIDES</span>
                  </div>
                  {(() => {
                    const plates = [
                      ...(hasRice && !isFlatBase ? [(
                        <div className="co-side-plate" key="rice-aside">
                          <div className="co-side-plate-dish">
                            <img src="/images/byo/ing/rice-bowl.webp" alt="Rice" className="co-side-plate-img" />
                          </div>
                          <span className="co-side-plate-label">Rice</span>
                        </div>
                      )] : []),
                      ...sideProteins.map(id => {
                        const def = CO_ING_DB[id];
                        const label = proteinOpts.find(p => p.id === id)?.label || id;
                        return (
                          <div className="co-side-plate" key={`${id}-aside`}>
                            <div className="co-side-plate-dish">
                              <img src={def.src} alt={label} className="co-side-plate-img" />
                            </div>
                            <span className="co-side-plate-label">{label}</span>
                          </div>
                        );
                      }),
                    ];
                    return plates;
                  })()}
                </div>
              );
            })()}

            {/* Chef hand animation — drops in when a new ingredient is added */}
            {handPos && (
              <div
                key={handPos.key}
                className="co-canvas-hand"
                style={{ left: `${handPos.x}%`, top: `${handPos.y}%` }}
              >
                🤌
              </div>
            )}

            {/* On-side sauces — bowl thumbnails in corner */}
            {onSideSauces.length > 0 && (
              <div className="co-canvas-sauce-row">
                {onSideSauces.slice(0, 4).map(sauce => (
                  sauce.img
                    ? <img key={sauce.id} src={sauce.img} alt={sauce.label} className="co-canvas-sauce-bowl" title={sauce.label} />
                    : <span key={sauce.id} className="co-canvas-sauce-emoji">{sauce.emoji}</span>
                ))}
              </div>
            )}

            {isEmpty && <p className="co-canvas-hint">Add ingredients below ↓</p>}

            {/* Halal badge — reinforces trust right where the food is being built */}
            {hasProtein && (
              <div className="co-halal-badge">
                <span className="co-halal-badge-dot" />
                100% Halal
              </div>
            )}

            {/* Rim overlay — sits on top of all ingredients so food appears inside the vessel */}
            {base?.rim && !isFlatBase && (
              <img
                src={base.rim}
                alt=""
                className="co-canvas-rim"
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <div className="co-canvas-empty">
            <img src="/images/byo/customize-icon.webp" alt="" className="co-canvas-icon" />
            <span>Choose a base to preview your order</span>
          </div>
        )}
      </div>

      {base && (
        <div className="co-canvas-info">
          <span className="co-canvas-base-name">{base.label}</span>
          <button
            type="button"
            className="co-canvas-share-btn"
            onClick={handleShare}
            disabled={capturing}
            title="Share your creation"
          >
            {capturing ? 'Capturing…' : <><Camera size={13} /> Share</>}
          </button>
        </div>
      )}
    </>
  );
}

/* Default protein/sauce option lists -- IngCanvas only reads label/qtyType
   off these (for text and sauce lookups), not full BYO-builder shape, so
   the DB-fetched live versions in CustomOrder.jsx are a superset of what's
   needed here. Kept here (not in CustomOrder.jsx) so importing them doesn't
   drag the whole customize page into whatever bundle imports this file --
   CustomOrder.jsx is route-level lazy-loaded, and Checkout.jsx statically
   importing from it defeated that code-splitting entirely. */
export const DEFAULT_PROTEIN_OPTS = [
  { id: 'egg-fried',       label: 'Egg (Fried)',           price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-fried.webp'       },
  { id: 'egg-scrambled',   label: 'Egg (Scrambled)',        price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-scrambled.webp'   },
  { id: 'chicken',         label: 'Chicken Broasted',       price: 6.00, qtyType: 'low-extra',     emoji: '🍗', img: '/images/byo/ing/chicken-broasted.webp'  },
  { id: 'lamb-gyro',       label: 'Lamb Gyro',             price: 6.00, qtyType: 'low-extra',     emoji: '🥩', img: '/images/byo/ing/lamb-gyro.webp'       },
  { id: 'mix',             label: 'Mix',                   price: 7.00, qtyType: 'low-extra',     emoji: '🍖', img: '/images/byo/ing/mix.webp'      },
  { id: 'hotdog',          label: 'Hot Dog',               price: 2.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hotdog.webp'           },
  { id: 'bacon',           label: 'Bacon',                 price: 3.00, qtyType: 'low-extra',     emoji: '🥓', img: '/images/byo/ing/bacon.webp',    note: 'Beef bacon, halal' },
  { id: 'hot-sausage',     label: 'Hot Sausage',           price: 3.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hot-sausage.webp'     },
  { id: 'italian-sausage', label: 'Italian Sausage',       price: 6.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/italian-sausage.webp' },
  { id: 'turkey',          label: 'Turkey',                price: 6.00, qtyType: 'low-extra',     emoji: '🦃', img: '/images/byo/ing/turkey.webp'   },
  { id: 'chicken-kabab',   label: 'Chicken Shish Kabab',   price: 3.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/chicken-kabab.webp'   },
  { id: 'beef-kabab',      label: 'Beef Shish Kabab',      price: 4.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/beef-kabab.webp'      },
  { id: 'philly-steak',    label: 'Philly Steak',          price: 6.00, qtyType: 'single-double', emoji: '🥩', img: '/images/byo/ing/philly-steak.webp'    },
  { id: 'falafel',         label: 'Falafel',               price: 6.00, qtyType: 'low-extra',     emoji: '🧆', img: '/images/byo/ing/falafel-6.webp', imgByQty: { low: '/images/byo/ing/falafel-3.webp', regular: '/images/byo/ing/falafel-6.webp', extra: '/images/byo/ing/falafel-9.webp', double: '/images/byo/ing/falafel-12.webp' } },
  { id: 'fish-fillet',     label: 'Fish Fillet',           price: 7.00, qtyType: 'single-double', emoji: '🐟', img: '/images/byo/ing/fish-fillet2.webp'     },
  { id: 'shrimp',          label: 'Shrimp',                price: 8.00, qtyType: 'low-extra',     emoji: '🍤', img: '/images/byo/ing/shrimp.webp'          },
  { id: 'tuna',            label: 'Tuna Fish',             price: 7.00, qtyType: 'low-extra',     emoji: '🐠', img: '/images/byo/ing/tuna.webp'            },
  { id: 'beef-burger',     label: 'Beef Berger',           price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/beef-burger2.webp'     },
  { id: 'chicken-burger',  label: 'Chicken Berger',        price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/chicken-burger.webp'  },
];

export const DEFAULT_SAUCE_OPTS = [
  { id: 'white',   label: 'White Sauce',         price: 1.00, emoji: '🤍', img: '/images/byo/ing/sauce-white-bowl.webp'  },
  { id: 'hot',     label: 'Hot Sauce',           price: 1.00, emoji: '🔥', img: '/images/byo/ing/sauce-hot-bowl.webp'    },
  { id: 'ketchup', label: 'Ketchup',             price: 0.75, emoji: '🍅', img: '/images/byo/ing/sauce-ketchup.webp'     },
  { id: 'mustard', label: 'Mustard',             price: 0.75, emoji: '💛', img: '/images/byo/ing/sauce-mustard.webp'     },
  { id: 'bbq',     label: 'BBQ Sauce',           price: 1.00, emoji: '🫙', img: '/images/byo/ing/sauce-bbq.webp'         },
  { id: 'green',   label: 'Special Green Sauce', price: 1.25, emoji: '💚', img: '/images/byo/ing/sauce-green.webp'       },
  { id: 'mayo',    label: 'Mayonnaise',          price: 0.75, emoji: '🍶', img: '/images/byo/ing/sauce-mayo.webp'        },
  { id: 'blue',    label: 'Blue Cheese',         price: 1.25, emoji: '🫐', img: '/images/byo/ing/sauce-blue-cheese.webp' },
];

export { CO_ING_DB };
export default IngCanvas;
