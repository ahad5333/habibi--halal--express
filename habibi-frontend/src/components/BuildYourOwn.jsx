import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, ShoppingBag } from 'lucide-react';
import './BuildYourOwn.css';

/* ─────────────────────────────────────────────────────────────────
   BASE DEFINITIONS (sandwich vessels / 39a–39j)
───────────────────────────────────────────────────────────────── */
const BASES = [
  { id: '39a', label: 'Hero',          price: 1.99, img: '/images/menu/39a.jpg', family: 'hero'       },
  { id: '39b', label: 'Wrap',          price: 1.99, img: '/images/menu/39b.jpg', family: 'wrap',       note: 'Habibi Special Wrap' },
  { id: '39c', label: 'Pita Bread',    price: 1.99, img: '/images/menu/39c.jpg', family: 'wrap'       },
  { id: '39d', label: 'Croissant',     price: 1.99, img: '/images/menu/39d.jpg', family: 'compact'    },
  { id: '39e', label: 'Bagel',         price: 1.99, img: '/images/menu/39e.jpg', family: 'standard'   },
  { id: '39f', label: 'Roll',          price: 1.49, img: '/images/menu/39f.jpg', family: 'standard'   },
  { id: '39g', label: 'Burger Bun',    price: 1.99, img: '/images/menu/39g.jpg', family: 'standard'   },
  { id: '39h', label: 'Hot Dog Bun',   price: 0.99, img: '/images/menu/39h.jpg', family: 'compact'    },
  { id: '39i', label: 'Platter',       price: 2.99, img: '/images/menu/39i.jpg', family: 'platter',
    note: 'Includes: Rice · Pita · House Salad',
    includes: ['🍚 Rice', '🫓 Pita Bread', '🥗 House Salad'],
    defaultToppings: ['lettuce', 'tomatoes', 'onions'],
  },
  { id: '39j', label: 'Family Tray',   price: 4.99, img: '/images/menu/39j.jpg', family: 'familyTray',
    note: 'Feeds 4–6 · Rice · Pita · Salad · Hummus',
    includes: ['🍚 Rice (Large)', '🫓 Pita Bread ×4', '🥗 House Salad', '🥣 Hummus'],
    defaultToppings: ['lettuce', 'tomatoes', 'onions', 'pickles', 'hummus'],
  },
];

/* ─────────────────────────────────────────────────────────────────
   INGREDIENT COMPOSITING DATABASE

   Rules per base family:
     x, y    — center of the ingredient as % of canvas (0–100)
     scale   — ingredient img width as fraction of canvas width
     rot     — rotation in degrees
     count   — how many copies to render
     sx, sy  — spacing between copies as % of canvas width/height
     layer   — CSS z-index (determines visual stacking order)
     tile    — true = duplicate copies instead of scaling up
                       (for portioned items: chicken, rice, etc.)
     blend   — CSS mix-blend-mode ('multiply' for white-bg images,
                'normal' for images with true transparency)
               'multiply' makes white pixels invisible against the
                base image — no Photoshop needed for the background.

   Layer ordering guide:
     1  = spreads / sauces that are fully under everything (hummus)
     3  = leafy base layer (lettuce, cabbage)
     4  = bulk protein (chicken pieces, gyro slices)
     5  = individual proteins (hotdog, falafel balls)
     6  = chunky toppings (tomato, pickle, onion)
     7  = lighter scattered toppings (peppers)
     9  = drizzled sauces (always top layer)
───────────────────────────────────────────────────────────────── */
const INGREDIENT_DB = {

  /* ── PROTEINS ─────────────────────────────────────────────── */

  hotdog: {
    img: '/images/byo/ing/hotdog.jpg',
    layer: 5, tile: false, blend: 'multiply',
    /*
      Rules derived from the family diagram (WhatsApp image 2026-06-28):
      - Hero:       full-length, horizontal — nearly spans the whole bread
      - Standard:   ~55% width, horizontal — fits a round bun
      - Compact:    ~44% width, horizontal, sits low in bun opening
      - Wrap:       rotated 85° (nearly vertical) — rolled inside the wrap
      - Platter:    horizontal, slight 8° tilt, medium size
      - FamilyTray: full-size horizontal, large serving (one big frank)
    */
    family: {
      hero:       { x: 50, y: 53, scale: 0.84, rot:  0,  count: 1 },
      standard:   { x: 50, y: 54, scale: 0.56, rot:  0,  count: 1 },
      compact:    { x: 50, y: 58, scale: 0.44, rot:  0,  count: 1 },
      wrap:       { x: 50, y: 52, scale: 0.46, rot: 85,  count: 1 },
      platter:    { x: 50, y: 52, scale: 0.60, rot:  8,  count: 1 },
      familyTray: { x: 50, y: 52, scale: 0.76, rot:  0,  count: 1 },
    },
  },

  chicken: {
    img: '/images/byo/ing/chicken.png',
    layer: 4, tile: true, blend: 'multiply',
    /* Chicken is a PORTION item — duplicate copies rather than
       scaling up one piece (scaling up = unnaturally large chunks).
       Two or more copies side-by-side fill the bread area. */
    family: {
      hero:       { x: 50, y: 52, scale: 0.50, rot: 0,  count: 2, sx: 30 },
      standard:   { x: 50, y: 52, scale: 0.52, rot: 0,  count: 1 },
      compact:    { x: 50, y: 55, scale: 0.44, rot: 0,  count: 1 },
      wrap:       { x: 50, y: 52, scale: 0.50, rot: 0,  count: 1 },
      platter:    { x: 50, y: 50, scale: 0.56, rot: 0,  count: 2, sy: 22 },
      familyTray: { x: 50, y: 50, scale: 0.50, rot: 0,  count: 3, sx: 22 },
    },
  },

  'lamb-gyro': {
    img: '/images/byo/ing/lamb-gyro.png',
    layer: 4, tile: true, blend: 'multiply',
    /* Thin-sliced gyro meat — tiles nicely with slight overlap */
    family: {
      hero:       { x: 50, y: 52, scale: 0.58, rot: 5,  count: 2, sx: 26 },
      standard:   { x: 50, y: 52, scale: 0.55, rot: 0,  count: 1 },
      compact:    { x: 50, y: 55, scale: 0.45, rot: 0,  count: 1 },
      wrap:       { x: 50, y: 52, scale: 0.52, rot: 0,  count: 2, sx: 22 },
      platter:    { x: 50, y: 50, scale: 0.58, rot: 0,  count: 2, sx: 26 },
      familyTray: { x: 50, y: 50, scale: 0.54, rot: 0,  count: 4, sx: 18 },
    },
  },

  falafel: {
    img: '/images/byo/ing/falafel.png',
    layer: 5, tile: true, blend: 'multiply',
    /* Falafel balls — always duplicated in a row, never scaled alone */
    family: {
      hero:       { x: 50, y: 52, scale: 0.14, rot: 0,  count: 5, sx: 13 },
      standard:   { x: 50, y: 52, scale: 0.18, rot: 0,  count: 3, sx: 13 },
      compact:    { x: 50, y: 55, scale: 0.16, rot: 0,  count: 2, sx: 13 },
      wrap:       { x: 50, y: 52, scale: 0.16, rot: 0,  count: 3, sx: 13 },
      platter:    { x: 50, y: 50, scale: 0.18, rot: 0,  count: 4, sx: 13 },
      familyTray: { x: 50, y: 50, scale: 0.18, rot: 0,  count: 6, sx: 12 },
    },
  },

  /* mixed = chicken + lamb-gyro rendered together (handled in JSX) */

  /* ── TOPPINGS ─────────────────────────────────────────────── */

  lettuce: {
    img: '/images/byo/ing/lettuce.jpg',
    layer: 3, tile: false, blend: 'multiply',
    /* Lettuce is the BASE LAYER — it goes UNDER the protein.
       It should peek out from the sides and bottom slightly. */
    family: {
      hero:       { x: 50, y: 55, scale: 0.86, rot: 0, count: 1 },
      standard:   { x: 50, y: 56, scale: 0.62, rot: 0, count: 1 },
      compact:    { x: 50, y: 58, scale: 0.52, rot: 0, count: 1 },
      wrap:       { x: 50, y: 55, scale: 0.60, rot: 0, count: 1 },
      platter:    { x: 50, y: 54, scale: 0.65, rot: 0, count: 1 },
      familyTray: { x: 50, y: 54, scale: 0.72, rot: 0, count: 1 },
    },
  },

  tomatoes: {
    img: '/images/byo/ing/tomato.jpg',
    layer: 6, tile: true, blend: 'multiply',
    /* Tomato slices — tiled in a row, slightly above center */
    family: {
      hero:       { x: 50, y: 48, scale: 0.14, rot: 0, count: 4, sx: 14 },
      standard:   { x: 50, y: 49, scale: 0.18, rot: 0, count: 2, sx: 15 },
      compact:    { x: 50, y: 51, scale: 0.16, rot: 0, count: 2, sx: 13 },
      wrap:       { x: 50, y: 49, scale: 0.16, rot: 0, count: 3, sx: 13 },
      platter:    { x: 50, y: 48, scale: 0.18, rot: 0, count: 3, sx: 14 },
      familyTray: { x: 50, y: 48, scale: 0.17, rot: 0, count: 5, sx: 12 },
    },
  },

  onions: {
    img: '/images/byo/ing/onion.jpg',
    layer: 7, tile: true, blend: 'multiply',
    /* Onion rings/slices — small, many scattered pieces */
    family: {
      hero:       { x: 50, y: 50, scale: 0.11, rot: 0,  count: 5, sx: 12 },
      standard:   { x: 50, y: 50, scale: 0.16, rot: 10, count: 2, sx: 13 },
      compact:    { x: 50, y: 52, scale: 0.14, rot: 5,  count: 2, sx: 11 },
      wrap:       { x: 50, y: 50, scale: 0.14, rot: 0,  count: 3, sx: 11 },
      platter:    { x: 50, y: 50, scale: 0.16, rot: 0,  count: 3, sx: 12 },
      familyTray: { x: 50, y: 50, scale: 0.14, rot: 0,  count: 5, sx: 11 },
    },
  },

  pickles: {
    img: '/images/byo/ing/pickle.png',
    layer: 6, tile: true, blend: 'multiply',
    /* Pickle chips — overlapping fan pattern, slight angles */
    family: {
      hero:       { x: 50, y: 50, scale: 0.20, rot: 12,  count: 3, sx: 16 },
      standard:   { x: 50, y: 50, scale: 0.24, rot: 8,   count: 2, sx: 15 },
      compact:    { x: 50, y: 52, scale: 0.20, rot: 0,   count: 2, sx: 13 },
      wrap:       { x: 50, y: 50, scale: 0.20, rot: -18, count: 2, sx: 14 },
      platter:    { x: 50, y: 50, scale: 0.22, rot: 12,  count: 3, sx: 14 },
      familyTray: { x: 50, y: 50, scale: 0.20, rot: 10,  count: 4, sx: 13 },
    },
  },

  peppers: {
    img: '/images/byo/ing/pepper.jpg',
    layer: 7, tile: true, blend: 'multiply',
    /* Hot pepper rings — angled and scattered, above most toppings */
    family: {
      hero:       { x: 50, y: 47, scale: 0.17, rot: -22, count: 3, sx: 16 },
      standard:   { x: 50, y: 47, scale: 0.20, rot: -15, count: 2, sx: 15 },
      compact:    { x: 50, y: 49, scale: 0.18, rot: -10, count: 1 },
      wrap:       { x: 50, y: 48, scale: 0.18, rot: -25, count: 2, sx: 14 },
      platter:    { x: 50, y: 47, scale: 0.20, rot: -15, count: 3, sx: 14 },
      familyTray: { x: 50, y: 47, scale: 0.18, rot: -20, count: 4, sx: 12 },
    },
  },

  hummus: {
    img: '/images/byo/ing/hummus.png',
    layer: 2, tile: false, blend: 'multiply',
    /* Hummus is a SPREAD — lowest layer, fills the bread surface.
       Must be below lettuce, protein, everything. */
    family: {
      hero:       { x: 50, y: 53, scale: 0.82, rot: 0, count: 1 },
      standard:   { x: 50, y: 53, scale: 0.60, rot: 0, count: 1 },
      compact:    { x: 50, y: 55, scale: 0.50, rot: 0, count: 1 },
      wrap:       { x: 50, y: 53, scale: 0.58, rot: 0, count: 1 },
      platter:    { x: 50, y: 52, scale: 0.64, rot: 0, count: 1 },
      familyTray: { x: 50, y: 52, scale: 0.70, rot: 0, count: 1 },
    },
  },

  /* ── SAUCES (always topmost layer) ─────────────────────────── */

  white: {
    img: '/images/byo/ing/sauce-white.png',
    layer: 9, tile: false, blend: 'multiply',
    /* White sauce — full drizzle across the whole sandwich */
    family: {
      hero:       { x: 50, y: 51, scale: 0.82, rot: 0, count: 1 },
      standard:   { x: 50, y: 51, scale: 0.60, rot: 0, count: 1 },
      compact:    { x: 50, y: 54, scale: 0.50, rot: 0, count: 1 },
      wrap:       { x: 50, y: 51, scale: 0.58, rot: 0, count: 1 },
      platter:    { x: 50, y: 50, scale: 0.64, rot: 0, count: 1 },
      familyTray: { x: 50, y: 50, scale: 0.72, rot: 0, count: 1 },
    },
  },

  hot: {
    img: '/images/byo/ing/sauce-hot.png',
    layer: 9, tile: false, blend: 'multiply',
    family: {
      hero:       { x: 50, y: 51, scale: 0.82, rot: 0, count: 1 },
      standard:   { x: 50, y: 51, scale: 0.60, rot: 0, count: 1 },
      compact:    { x: 50, y: 54, scale: 0.50, rot: 0, count: 1 },
      wrap:       { x: 50, y: 51, scale: 0.58, rot: 0, count: 1 },
      platter:    { x: 50, y: 50, scale: 0.64, rot: 0, count: 1 },
      familyTray: { x: 50, y: 50, scale: 0.72, rot: 0, count: 1 },
    },
  },

  /* 'both' sauce is rendered as white (left) + hot (right offset) */
  both: {
    img: '/images/byo/ing/sauce-white.png',
    layer: 9, tile: false, blend: 'multiply',
    family: {
      hero:       { x: 38, y: 51, scale: 0.44, rot: -4, count: 1 },
      standard:   { x: 38, y: 51, scale: 0.32, rot: -4, count: 1 },
      compact:    { x: 40, y: 54, scale: 0.26, rot:  0, count: 1 },
      wrap:       { x: 38, y: 51, scale: 0.30, rot:  0, count: 1 },
      platter:    { x: 38, y: 50, scale: 0.34, rot:  0, count: 1 },
      familyTray: { x: 38, y: 50, scale: 0.38, rot:  0, count: 1 },
    },
  },

  'both-hot': {
    img: '/images/byo/ing/sauce-hot.png',
    layer: 9, tile: false, blend: 'multiply',
    family: {
      hero:       { x: 62, y: 51, scale: 0.44, rot: 4, count: 1 },
      standard:   { x: 62, y: 51, scale: 0.32, rot: 4, count: 1 },
      compact:    { x: 60, y: 54, scale: 0.26, rot: 0, count: 1 },
      wrap:       { x: 62, y: 51, scale: 0.30, rot: 0, count: 1 },
      platter:    { x: 62, y: 50, scale: 0.34, rot: 0, count: 1 },
      familyTray: { x: 62, y: 50, scale: 0.38, rot: 0, count: 1 },
    },
  },
};

/* ─────────────────────────────────────────────────────────────────
   INGREDIENT MEDALLION DATABASE
   Each ingredient rendered as a shaped div (background-image crop)
   positioned on top of the base image with a drop shadow.
   shape: 'circle' | 'rect' | 'wide' | 'sauce'
   pos[family]: array of {x, y, w, rot?, ar?}
     x,y = % of canvas (center of medallion anchor)
     w   = % of canvas width
     ar  = CSS aspect-ratio override (default 1/1 for circle)
     rot = degrees
───────────────────────────────────────────────────────────────── */
const ING_MEDALLION_DB = {
  chicken: {
    src: '/images/byo/ing/chicken.jpg', layer: 4, shape: 'circle',
    pos: {
      hero:       [{ x:34, y:54, w:15 }, { x:57, y:53, w:15 }],
      standard:   [{ x:48, y:53, w:19 }],
      compact:    [{ x:48, y:55, w:16 }],
      wrap:       [{ x:46, y:53, w:17 }],
      platter:    [{ x:62, y:53, w:19 }],
      familyTray: [{ x:55, y:52, w:15 }, { x:67, y:53, w:15 }],
    }
  },
  'lamb-gyro': {
    src: '/images/byo/ing/lamb-gyro.png', layer: 4, shape: 'rect', ar: '3/2',
    pos: {
      hero:       [{ x:33, y:53, w:16, rot:-8 }, { x:55, y:52, w:16, rot:6 }],
      standard:   [{ x:47, y:52, w:22, rot:-4 }],
      compact:    [{ x:47, y:54, w:19, rot:-3 }],
      wrap:       [{ x:45, y:52, w:20, rot:-3 }],
      platter:    [{ x:61, y:52, w:22 }],
      familyTray: [{ x:55, y:52, w:18, rot:-5 }, { x:67, y:52, w:18, rot:5 }],
    }
  },
  hotdog: {
    src: '/images/byo/ing/hotdog.jpg', layer: 5, shape: 'rect', ar: '5/2',
    pos: {
      hero:       [{ x:50, y:52, w:48 }],
      standard:   [{ x:48, y:53, w:30 }],
      compact:    [{ x:48, y:55, w:26 }],
      wrap:       [{ x:47, y:52, w:24, rot:78 }],
      platter:    [{ x:63, y:52, w:28 }],
      familyTray: [{ x:57, y:52, w:24 }, { x:71, y:52, w:24 }],
    }
  },
  falafel: {
    src: '/images/byo/ing/falafel.png', layer: 5, shape: 'circle',
    pos: {
      hero:       [{ x:30, y:52, w:9 }, { x:44, y:51, w:9 }, { x:58, y:52, w:9 }],
      standard:   [{ x:40, y:52, w:11 }, { x:56, y:52, w:11 }],
      compact:    [{ x:42, y:54, w:10 }, { x:55, y:54, w:10 }],
      wrap:       [{ x:41, y:52, w:10 }, { x:54, y:52, w:10 }],
      platter:    [{ x:58, y:52, w:10 }, { x:68, y:52, w:10 }, { x:76, y:52, w:10 }],
      familyTray: [{ x:53, y:52, w:9 }, { x:62, y:52, w:9 }, { x:71, y:52, w:9 }],
    }
  },
  /* Toppings */
  lettuce: {
    src: '/images/byo/ing/lettuce.jpg', layer: 3, shape: 'wide', ar: '6/2',
    pos: {
      hero:       [{ x:50, y:58, w:54 }],
      standard:   [{ x:49, y:57, w:36 }],
      compact:    [{ x:48, y:58, w:30 }],
      wrap:       [{ x:48, y:56, w:34 }],
      platter:    [{ x:64, y:56, w:28 }],
      familyTray: [{ x:60, y:56, w:26 }, { x:74, y:56, w:26 }],
    }
  },
  tomatoes: {
    src: '/images/byo/ing/tomato.jpg', layer: 6, shape: 'circle',
    pos: {
      hero:       [{ x:27, y:49, w:8 }, { x:44, y:49, w:8 }, { x:62, y:49, w:8 }],
      standard:   [{ x:41, y:49, w:10 }, { x:57, y:50, w:10 }],
      compact:    [{ x:42, y:51, w:9 }, { x:55, y:51, w:9 }],
      wrap:       [{ x:41, y:49, w:9 }, { x:54, y:49, w:9 }],
      platter:    [{ x:59, y:49, w:9 }, { x:68, y:49, w:9 }],
      familyTray: [{ x:53, y:49, w:8 }, { x:62, y:49, w:8 }, { x:71, y:49, w:8 }],
    }
  },
  onions: {
    src: '/images/byo/ing/onion.jpg', layer: 7, shape: 'circle',
    pos: {
      hero:       [{ x:33, y:47, w:7 }, { x:47, y:47, w:7 }, { x:61, y:47, w:7 }],
      standard:   [{ x:42, y:47, w:9 }, { x:56, y:47, w:9 }],
      compact:    [{ x:43, y:49, w:8 }, { x:55, y:49, w:8 }],
      wrap:       [{ x:42, y:47, w:8 }, { x:54, y:47, w:8 }],
      platter:    [{ x:59, y:47, w:8 }, { x:68, y:47, w:8 }],
      familyTray: [{ x:54, y:47, w:7 }, { x:63, y:47, w:7 }, { x:72, y:47, w:7 }],
    }
  },
  pickles: {
    src: '/images/byo/ing/pickle.png', layer: 6, shape: 'circle',
    pos: {
      hero:       [{ x:35, y:48, w:7 }, { x:50, y:47, w:7 }, { x:65, y:48, w:7 }],
      standard:   [{ x:42, y:47, w:9 }, { x:57, y:47, w:9 }],
      compact:    [{ x:43, y:49, w:8 }, { x:55, y:49, w:8 }],
      wrap:       [{ x:42, y:47, w:8 }, { x:55, y:47, w:8 }],
      platter:    [{ x:59, y:47, w:8 }, { x:68, y:47, w:8 }],
      familyTray: [{ x:54, y:47, w:7 }, { x:63, y:47, w:7 }, { x:71, y:47, w:7 }],
    }
  },
  peppers: {
    src: '/images/byo/ing/pepper.jpg', layer: 7, shape: 'circle',
    pos: {
      hero:       [{ x:30, y:47, w:7, rot:-20 }, { x:47, y:46, w:7, rot:15 }, { x:63, y:47, w:7, rot:-10 }],
      standard:   [{ x:41, y:46, w:9, rot:-15 }, { x:56, y:46, w:9, rot:10 }],
      compact:    [{ x:43, y:48, w:8, rot:-10 }, { x:55, y:48, w:8, rot:8 }],
      wrap:       [{ x:42, y:46, w:8, rot:-12 }, { x:54, y:46, w:8, rot:8 }],
      platter:    [{ x:58, y:46, w:8 }, { x:67, y:46, w:8 }],
      familyTray: [{ x:53, y:46, w:7 }, { x:62, y:46, w:7 }, { x:71, y:46, w:7 }],
    }
  },
  hummus: {
    src: '/images/byo/ing/hummus.png', layer: 2, shape: 'wide', ar: '5/1',
    pos: {
      hero:       [{ x:50, y:62, w:50 }],
      standard:   [{ x:49, y:61, w:32 }],
      compact:    [{ x:48, y:62, w:26 }],
      wrap:       [{ x:48, y:60, w:30 }],
      platter:    [{ x:63, y:60, w:26 }],
      familyTray: [{ x:60, y:60, w:24 }, { x:74, y:60, w:24 }],
    }
  },
  /* Sauces — use actual drizzle images with multiply blend */
  white: {
    src: '/images/byo/ing/sauce-white.png', layer: 9, shape: 'sauce',
    pos: {
      hero:       [{ x:50, y:51, w:54 }],
      standard:   [{ x:49, y:51, w:36 }],
      compact:    [{ x:48, y:53, w:30 }],
      wrap:       [{ x:48, y:51, w:34 }],
      platter:    [{ x:63, y:51, w:28 }],
      familyTray: [{ x:60, y:51, w:26 }],
    }
  },
  hot: {
    src: '/images/byo/ing/sauce-hot.png', layer: 9, shape: 'sauce',
    pos: {
      hero:       [{ x:50, y:51, w:54 }],
      standard:   [{ x:49, y:51, w:36 }],
      compact:    [{ x:48, y:53, w:30 }],
      wrap:       [{ x:48, y:51, w:34 }],
      platter:    [{ x:63, y:51, w:28 }],
      familyTray: [{ x:60, y:51, w:26 }],
    }
  },
  both: {
    src: '/images/byo/ing/sauce-white.png', layer: 9, shape: 'sauce',
    pos: {
      hero:       [{ x:37, y:51, w:27 }],
      standard:   [{ x:39, y:51, w:18 }],
      compact:    [{ x:40, y:53, w:15 }],
      wrap:       [{ x:39, y:51, w:17 }],
      platter:    [{ x:56, y:51, w:14 }],
      familyTray: [{ x:54, y:51, w:13 }],
    }
  },
  'both-hot': {
    src: '/images/byo/ing/sauce-hot.png', layer: 9, shape: 'sauce',
    pos: {
      hero:       [{ x:63, y:51, w:27 }],
      standard:   [{ x:59, y:51, w:18 }],
      compact:    [{ x:57, y:53, w:15 }],
      wrap:       [{ x:57, y:51, w:17 }],
      platter:    [{ x:70, y:51, w:14 }],
      familyTray: [{ x:67, y:51, w:13 }],
    }
  },
};

/* Render one ingredient as a shaped photo medallion or sauce drizzle */
function renderMedallion(id, family) {
  const def = ING_MEDALLION_DB[id];
  if (!def) return null;
  const positions = def.pos[family] || def.pos.standard || def.pos.compact;
  if (!positions) return null;

  return positions.map((pos, i) => {
    if (def.shape === 'sauce') {
      return (
        <img
          key={`${id}-s-${i}`}
          src={def.src}
          alt=""
          style={{
            position: 'absolute',
            left: `${pos.x}%`, top: `${pos.y}%`,
            width: `${pos.w}%`, height: 'auto',
            transform: 'translate(-50%,-50%)',
            zIndex: def.layer,
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }
    const radius = def.shape === 'circle' ? '50%' : def.shape === 'wide' ? '6px' : '10px';
    return (
      <div
        key={`${id}-m-${i}`}
        className="byo-medallion"
        style={{
          left: `${pos.x}%`, top: `${pos.y}%`,
          width: `${pos.w}%`,
          aspectRatio: pos.ar || def.ar || '1 / 1',
          backgroundImage: `url(${def.src})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: radius,
          transform: `translate(-50%,-50%) rotate(${pos.rot || 0}deg)`,
          zIndex: def.layer,
        }}
      />
    );
  });
}

/* ─────────────────────────────────────────────────────────────────
   LEGACY INGREDIENT CANVAS RENDERER (no longer used in render)
───────────────────────────────────────────────────────────────── */
function renderIngredient(id, family, extra) {
  const def = INGREDIENT_DB[id];
  if (!def) return null;

  const rule = def.family[family] || def.family.standard || def.family.compact;
  if (!rule) return null;

  const count = rule.count || 1;
  const sx = rule.sx || 0;
  const sy = rule.sy || 0;

  return Array.from({ length: count }).map((_, i) => {
    /* Distribute copies symmetrically around the anchor point */
    const offset = i - (count - 1) / 2;
    const cx = rule.x + offset * sx;
    const cy = rule.y + offset * sy;

    return (
      <img
        key={`${id}-${extra ?? ''}-${i}`}
        src={def.img}
        alt=""
        className="byo-ing"
        style={{
          left:      `${cx}%`,
          top:       `${cy}%`,
          transform: `translate(-50%, -50%) scale(${rule.scale}) rotate(${rule.rot ?? 0}deg)`,
          zIndex:    def.layer,
          mixBlendMode: def.blend || 'multiply',
        }}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
    );
  });
}

/* ─────────────────────────────────────────────────────────────────
   INGREDIENT PRICING  (base prices + base-family multipliers)
───────────────────────────────────────────────────────────────── */
const PROTEIN_FIRST_IDS = new Set(['chicken', 'lamb-gyro', 'mixed', 'bacon', 'tuna', 'shrimp', 'turkey']);
const VEG_IDS           = new Set(['lettuce', 'tomatoes', 'onions', 'pickles', 'peppers']);

const ING_BASE_PRICE = {
  chicken: 3.99, 'lamb-gyro': 4.49, mixed: 4.99,
  bacon:   2.49, tuna:        2.49, shrimp: 3.99, turkey: 2.49,
  falafel: 2.49, hotdog:      1.99,
  cheese:  0.99,
  lettuce: 0,    tomatoes: 0.49, onions: 0.49,
  pickles: 0.49, peppers:  0.49, hummus: 0.99,
};

/* Apply base-family multipliers per client spec:
   - Protein first group: 0.8× compact/wrap/standard, 1× hero/platter, 4× familyTray
   - Cheese: 2× on hero or familyTray
   - Vegetables: 3× on familyTray */
const calcIngPrice = (id, family) => {
  const base = ING_BASE_PRICE[id] ?? 0;
  if (base === 0) return 0;
  if (PROTEIN_FIRST_IDS.has(id)) {
    if (family === 'familyTray') return +(base * 4).toFixed(2);
    if (family === 'hero' || family === 'platter') return base;
    return +(base * 0.8).toFixed(2);
  }
  if (id === 'cheese') {
    if (family === 'hero' || family === 'familyTray') return +(base * 2).toFixed(2);
    return base;
  }
  if (VEG_IDS.has(id)) {
    if (family === 'familyTray') return +(base * 3).toFixed(2);
    return base;
  }
  return base;
};

/* ─────────────────────────────────────────────────────────────────
   BYO STEP DEFINITIONS (protein → toppings → sauce)
───────────────────────────────────────────────────────────────── */
const ADD_ON_STEPS = [
  {
    id: 'protein',
    title: 'Choose Your Protein',
    subtitle: 'Freshly prepared, Zabiha halal certified',
    type: 'single',
    cols: 3,
    options: [
      { id: 'chicken',   label: 'Chicken',       emoji: '🍗', desc: 'Marinated chopped chicken' },
      { id: 'lamb-gyro', label: 'Lamb Gyro',      emoji: '🥩', desc: 'Slow-roasted gyro slices' },
      { id: 'mixed',     label: 'Mixed (Both)',   emoji: '🍖', desc: 'Chicken + Lamb gyro' },
      { id: 'bacon',     label: 'Halal Bacon',    emoji: '🥓', desc: 'Crispy halal beef bacon' },
      { id: 'tuna',      label: 'Tuna',           emoji: '🐟', desc: 'Fresh tuna salad' },
      { id: 'shrimp',    label: 'Shrimp',         emoji: '🍤', desc: 'Grilled halal shrimp' },
      { id: 'turkey',    label: 'Turkey',         emoji: '🦃', desc: 'Sliced turkey breast' },
      { id: 'falafel',   label: 'Falafel',        emoji: '🧆', desc: 'Crispy chickpea fritters' },
      { id: 'hotdog',    label: 'Frank / Hotdog', emoji: '🌭', desc: 'Grilled halal beef frank' },
    ],
  },
  {
    id: 'toppings',
    title: 'Add Your Toppings & Cheese',
    subtitle: 'Select all that apply',
    type: 'multi',
    cols: 3,
    options: [
      { id: 'cheese',   label: 'Cheese',      emoji: '🧀' },
      { id: 'lettuce',  label: 'Lettuce',      emoji: '🥬' },
      { id: 'tomatoes', label: 'Tomatoes',     emoji: '🍅' },
      { id: 'onions',   label: 'Onions',       emoji: '🧅' },
      { id: 'pickles',  label: 'Pickles',      emoji: '🥒' },
      { id: 'peppers',  label: 'Hot Peppers',  emoji: '🌶️' },
      { id: 'hummus',   label: 'Hummus',       emoji: '🥣' },
    ],
  },
  {
    id: 'sauce',
    title: 'Choose Your Sauce',
    subtitle: 'The finishing touch, drizzled on top',
    type: 'single',
    cols: 2,
    options: [
      { id: 'white', label: 'White Sauce', emoji: '🤍', desc: 'Creamy & garlicky' },
      { id: 'hot',   label: 'Hot Sauce',   emoji: '🔥', desc: 'Spicy harissa blend' },
      { id: 'both',  label: 'Both',        emoji: '✨', desc: 'White + hot side by side' },
      { id: 'none',  label: 'No Sauce',    emoji: '⬜', desc: 'Plain & simple' },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────
   INGREDIENT META  (label + thumbnail for chip bar)
───────────────────────────────────────────────────────────────── */
const BYO_ING_META = {
  chicken:     { label: 'Chicken',     img: '/images/byo/ing/chicken.jpg' },
  'lamb-gyro': { label: 'Lamb Gyro',   img: '/images/byo/ing/lamb-gyro.png' },
  mixed:       { label: 'Mixed',       img: '/images/byo/ing/mix.jpg' },
  bacon:       { label: 'Halal Bacon', img: '/images/byo/ing/bacon.jpg' },
  tuna:        { label: 'Tuna',        img: '/images/byo/ing/tuna.jpg' },
  shrimp:      { label: 'Shrimp',      img: '/images/byo/ing/shrimp.jpg' },
  turkey:      { label: 'Turkey',      img: '/images/byo/ing/turkey.jpg' },
  falafel:     { label: 'Falafel',     img: '/images/byo/ing/falafel.png' },
  hotdog:      { label: 'Hot Dog',     img: '/images/byo/ing/hotdog.jpg' },
  cheese:      { label: 'Cheese',      img: '/images/byo/ing/american-cheese.jpg' },
  lettuce:     { label: 'Lettuce',     img: '/images/byo/ing/lettuce.jpg' },
  tomatoes:    { label: 'Tomatoes',    img: '/images/byo/ing/tomato.jpg' },
  onions:      { label: 'Onions',      img: '/images/byo/ing/onion.jpg' },
  pickles:     { label: 'Pickles',     img: '/images/byo/ing/pickle.jpg' },
  peppers:     { label: 'Hot Peppers', img: '/images/byo/ing/pepper.jpg' },
  hummus:      { label: 'Hummus',      img: '/images/byo/ing/hummus.jpg' },
  white:       { label: 'White Sauce', img: '/images/byo/ing/sauce-white.png' },
  hot:         { label: 'Hot Sauce',   img: '/images/byo/ing/sauce-hot.png' },
  both:        { label: 'White Sauce', img: '/images/byo/ing/sauce-white.png' },
  'both-hot':  { label: 'Hot Sauce',   img: '/images/byo/ing/sauce-hot.png' },
};

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────── */
export default function BuildYourOwn({ item, onClose, onAdd, initialSelections = {} }) {
  const [stepIdx, setStepIdx]       = useState(-1);          // -1 = base picker
  const [selectedBase, setBase]     = useState(null);
  const [selections, setSelections] = useState({ toppings: [], ...initialSelections });

  const isBasePicker  = stepIdx === -1;
  const step          = !isBasePicker ? ADD_ON_STEPS[stepIdx] : null;
  const isLast        = stepIdx === ADD_ON_STEPS.length - 1;
  const basePrice     = selectedBase ? selectedBase.price : 0;
  const family        = selectedBase?.family || 'standard';
  const isPlatterBase = family === 'platter' || family === 'familyTray';
  const totalSteps    = ADD_ON_STEPS.length + 1;
  const displayStep   = stepIdx + 2;

  const canAdvance = isBasePicker
    ? !!selectedBase
    : (step.type === 'multi' || !!selections[step.id]);

  const calcTotal = () => {
    let total = basePrice;
    const prot = selections.protein;
    if (prot === 'mixed') {
      total += calcIngPrice('chicken', family) + calcIngPrice('lamb-gyro', family);
    } else if (prot && prot !== 'none') {
      total += calcIngPrice(prot, family);
    }
    (selections.toppings || []).forEach(t => { total += calcIngPrice(t, family); });
    return total;
  };

  const runningTotal = calcTotal();

  /* Collect all ingredient IDs currently selected */
  const activeIngredients = (() => {
    const ids = [];
    /* Toppings */
    ids.push(...(selections.toppings || []));
    /* Protein */
    if (selections.protein === 'mixed') {
      ids.push('chicken', 'lamb-gyro');
    } else if (selections.protein && selections.protein !== 'none') {
      ids.push(selections.protein);
    }
    /* Sauce */
    if (selections.sauce === 'both') {
      ids.push('both', 'both-hot');
    } else if (selections.sauce && selections.sauce !== 'none') {
      ids.push(selections.sauce);
    }
    return ids;
  })();

  const selectBase = (base) => {
    setBase(base);
    setSelections(s => ({
      ...s,
      base: base.id,
      // Platter/tray bases come with a house salad — pre-select those toppings
      toppings: base.defaultToppings ? [...base.defaultToppings] : [],
    }));
  };

  const selectSingle = (optId) =>
    setSelections(s => ({ ...s, [step.id]: optId }));

  const toggleMulti = (optId) =>
    setSelections(s => {
      const arr = s.toppings;
      return {
        ...s,
        toppings: arr.includes(optId) ? arr.filter(x => x !== optId) : [...arr, optId],
      };
    });

  const buildName = () => {
    const base    = selectedBase?.label || '';
    const protein = ADD_ON_STEPS[0].options.find(o => o.id === selections.protein)?.label || '';
    const sauce   = ADD_ON_STEPS[2].options.find(o => o.id === selections.sauce)?.label || '';
    return `BYO: ${protein} on ${base}${sauce && sauce !== 'No Sauce' ? ` w/ ${sauce}` : ''}`;
  };

  const buildNote = () => {
    const tops = ADD_ON_STEPS[1].options
      .filter(o => selections.toppings.includes(o.id))
      .map(o => o.label);
    return tops.length ? `Toppings: ${tops.join(', ')}` : 'No toppings';
  };

  const handleAdd = () => {
    onAdd({ ...item, name: buildName(), note: buildNote(), price: runningTotal }, 1);
  };

  const goBack = () => setStepIdx(i => (i === 0 ? -1 : i - 1));

  const handleReset = () => {
    setBase(null);
    setSelections({ toppings: [] });
    setStepIdx(-1);
  };

  return (
    <div className="byo-overlay" onClick={onClose}>
      <div className="byo-modal" onClick={e => e.stopPropagation()}>

        {/* ── Live Build Canvas ──────────────────────────────── */}
        <div className="byo-canvas" data-family={selectedBase?.family || ''}>
          {selectedBase ? (
            <>
              <img
                src={selectedBase.img}
                alt={selectedBase.label}
                className="byo-canvas-base"
                onError={e => { e.currentTarget.style.opacity = '0.3'; }}
              />
              <div className="byo-canvas-overlay" />
              <div className="byo-canvas-info">
                <span className="byo-canvas-base-name">{selectedBase.label}</span>
                <span className="byo-canvas-price">
                {runningTotal > basePrice
                  ? `Total $${runningTotal.toFixed(2)}`
                  : `from $${basePrice.toFixed(2)}`}
              </span>
              </div>
              {/* ── Universal food zone — every base type ── */}
              <div className={`byo-food-zone byo-food-zone--${family}`}>
                {isPlatterBase && selectedBase.includes && (
                  <div className="byo-platter-includes byo-platter-includes--inzone">
                    <span className="byo-inc-label">Included</span>
                    {selectedBase.includes.map((item, i) => (
                      <span key={i} className="byo-inc-item">{item}</span>
                    ))}
                  </div>
                )}
                {activeIngredients.length > 0 ? (
                  <div className="byo-zone-grid">
                    {activeIngredients.slice(0, 9).map((id, i) => {
                      const meta = BYO_ING_META[id];
                      if (!meta) return null;
                      return (
                        <div key={id} className="byo-zone-tile" style={{ animationDelay: `${i * 0.05}s` }}>
                          <div className="byo-zone-tile-img" style={{ backgroundImage: `url(${meta.img})` }} />
                          <span className="byo-zone-tile-label">{meta.label}</span>
                        </div>
                      );
                    })}
                    {activeIngredients.length > 9 && (
                      <div className="byo-zone-tile byo-zone-tile--more">
                        <span>+{activeIngredients.length - 9}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="byo-zone-hint">
                    {isPlatterBase ? 'Choose your protein →' : 'Add ingredients below ↓'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="byo-canvas-empty">
              <span className="byo-canvas-empty-title">Build Your Own</span>
              <span className="byo-canvas-empty-sub">Choose a base below ↓</span>
            </div>
          )}
          <div className="byo-canvas-actions">
            {selectedBase && (
              <button className="byo-reset-btn" onClick={handleReset} title="Start over">
                ↺ Reset
              </button>
            )}
            <button className="byo-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────── */}
        <div className="byo-progress-bar">
          <div
            className="byo-progress-fill"
            style={{ width: `${(isBasePicker ? 1 : displayStep) / totalSteps * 100}%` }}
          />
        </div>

        {/* ── Step header ──────────────────────────────────── */}
        <div className="byo-header">
          <div>
            <p className="byo-step-label">
              Step {isBasePicker ? 1 : displayStep} of {totalSteps}
            </p>
            <h2 className="byo-title">
              {isBasePicker ? 'Choose Your Base' : step.title}
            </h2>
            <p className="byo-sub">
              {isBasePicker
                ? 'Pick the bread, platter or tray — sets your starting price'
                : (isPlatterBase && step.id === 'protein'
                    ? 'Served over rice with pita & house salad — already included'
                    : isPlatterBase && step.id === 'toppings'
                    ? 'House salad already added — add more or remove what you like'
                    : step.subtitle)
              }
            </p>
          </div>
        </div>

        {/* ── Options ──────────────────────────────────────── */}
        {isBasePicker ? (
          <div className="byo-bases">
            {BASES.map(base => (
              <button
                key={base.id}
                className={`byo-base-card${selectedBase?.id === base.id ? ' selected' : ''}`}
                onClick={() => selectBase(base)}
              >
                <div
                  className="byo-base-img"
                  style={{ backgroundImage: `url(${base.img})` }}
                />
                <div className="byo-base-info">
                  <span className="byo-base-name">{base.label}</span>
                  {base.note && <span className="byo-base-note">{base.note}</span>}
                  <span className="byo-base-price">${base.price.toFixed(2)}</span>
                </div>
                {selectedBase?.id === base.id && (
                  <span className="byo-check"><Check size={12} /></span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className={`byo-options byo-grid-${step.cols || 2}`}>
            {step.options.map(opt => {
              const selected = step.type === 'multi'
                ? selections.toppings.includes(opt.id)
                : selections[step.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  className={`byo-option${selected ? ' selected' : ''}`}
                  onClick={() =>
                    step.type === 'multi' ? toggleMulti(opt.id) : selectSingle(opt.id)
                  }
                >
                  <span className="byo-emoji">{opt.emoji}</span>
                  <span className="byo-opt-label">{opt.label}</span>
                  {opt.desc && <span className="byo-opt-desc">{opt.desc}</span>}
                  {selected && <span className="byo-check"><Check size={12} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="byo-footer">
          {!isBasePicker && (
            <button className="byo-btn byo-btn-back" onClick={goBack}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {selectedBase && !isBasePicker && (
            <span className="byo-total-badge">${runningTotal.toFixed(2)}</span>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button
              className="byo-btn byo-btn-add"
              onClick={handleAdd}
              disabled={!canAdvance}
            >
              <ShoppingBag size={16} />
              Add to Cart · ${runningTotal.toFixed(2)}
            </button>
          ) : (
            <button
              className="byo-btn byo-btn-next"
              onClick={() => setStepIdx(i => i + 1)}
              disabled={!canAdvance}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
