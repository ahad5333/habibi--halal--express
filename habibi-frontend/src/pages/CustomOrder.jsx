import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ChevronDown, Info, ShoppingBag, Check, Bookmark, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { menuAPI, savedCustomAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import './CustomOrder.css';

/* ================================================================
   DATA DEFINITIONS
   ================================================================ */

const BASES = [
  { id: '39a', label: 'Hero',        price: 1.99, img: '/images/menu/39a.webp', family: 'hero'       },
  { id: '39b', label: 'Wrap',        price: 1.99, img: '/images/menu/39b.webp', family: 'wrap',       note: 'Habibi Special Wrap' },
  { id: '39c', label: 'Pita Bread',  price: 1.99, img: '/images/menu/39c.webp', family: 'wrap'       },
  { id: '39d', label: 'Croissant',   price: 1.99, img: '/images/menu/39d.webp', family: 'compact'    },
  { id: '39e', label: 'Bagel',       price: 1.99, img: '/images/menu/39e.webp', family: 'standard'   },
  { id: '39f', label: 'Roll',        price: 1.49, img: '/images/menu/39f.webp', family: 'standard'   },
  { id: '39g', label: 'Burger Bun',  price: 1.99, img: '/images/menu/39g.webp', family: 'standard'   },
  { id: '39h', label: 'Hot Dog Bun', price: 0.99, img: '/images/menu/39h.webp', family: 'compact'    },
  { id: '39i', label: 'Platter',     price: 2.99, img: '/images/menu/39i.webp', family: 'platter'    },
  { id: '39j', label: 'Family Tray', price: 4.99, img: '/images/menu/39j.webp', family: 'familyTray' },
];

const CHEESE_OPTS = [
  { id: 'none',     label: 'No Cheese',      price: 0,    emoji: '⬜', default: true },
  { id: 'american', label: 'American Cheese', price: 1.00, emoji: '🧀', img: '/images/byo/ing/american-cheese.webp' },
  { id: 'cream',    label: 'Cream Cheese',    price: 2.00, emoji: '🧈', img: '/images/byo/ing/cream-cheese.webp'   },
  { id: 'butter',   label: 'Butter',          price: 2.00, emoji: '🫙', img: '/images/byo/ing/butter.webp'        },
];

const VEG_OPTS = [
  { id: 'onions',    label: 'Onions',        price: 0.50, emoji: '🧅', img: '/images/byo/ing/onion.webp'    },
  { id: 'peppers',   label: 'Green Peppers', price: 0.50, emoji: '🌿', img: '/images/byo/ing/pepper.webp'   },
  { id: 'cucumbers', label: 'Cucumbers',     price: 0.50, emoji: '🥒', img: '/images/byo/ing/cucumber.webp' },
  { id: 'lettuce',   label: 'Lettuce',       price: 0.50, emoji: '🥬', img: '/images/byo/ing/lettuce.webp'  },
  { id: 'tomatoes',  label: 'Tomatoes',      price: 0.50, emoji: '🍅', img: '/images/byo/ing/tomato.webp'   },
  { id: 'rice',      label: 'Rice',          price: 2.00, emoji: '🍚', img: '/images/byo/ing/rice.webp' },
];

/* qtyType determines which quantity selector is shown:
   'low-extra'     → Low / Regular / Extra / Double
   'eggs'          → 1 / 2 / 3 / 4 eggs  ($1 each)
   'single-double' → Single / Double
   'single-triple' → Single / Double / Triple               */
const PROTEIN_OPTS = [
  { id: 'egg-fried',       label: 'Egg (Fried)',           price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-fried.webp'       },
  { id: 'egg-scrambled',   label: 'Egg (Scrambled)',        price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-scrambled.webp'   },
  { id: 'chicken',         label: 'Chicken (Grilled)',      price: 6.00, qtyType: 'low-extra',     emoji: '🍗', img: '/images/byo/ing/chicken.webp'  },
  { id: 'lamb-gyro',       label: 'Lamb Gyro',             price: 6.00, qtyType: 'low-extra',     emoji: '🥩', img: '/images/byo/ing/lamb-gyro.webp'       },
  { id: 'mix',             label: 'Mix (Chicken + Gyro)',  price: 7.00, qtyType: 'low-extra',     emoji: '🍖', img: '/images/byo/ing/mix.webp'      },
  { id: 'hotdog',          label: 'Hot Dog',               price: 2.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hotdog.webp'           },
  { id: 'bacon',           label: 'Bacon',                 price: 3.00, qtyType: 'low-extra',     emoji: '🥓', img: '/images/byo/ing/bacon.webp',    note: 'Beef bacon, halal' },
  { id: 'hot-sausage',     label: 'Hot Sausage',           price: 3.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hot-sausage.webp'     },
  { id: 'italian-sausage', label: 'Italian Sausage',       price: 6.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/italian-sausage.webp' },
  { id: 'turkey',          label: 'Turkey',                price: 6.00, qtyType: 'low-extra',     emoji: '🦃', img: '/images/byo/ing/turkey.webp'   },
  { id: 'chicken-kabab',   label: 'Chicken Shish Kabab',   price: 3.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/chicken-kabab.webp'   },
  { id: 'beef-kabab',      label: 'Beef Shish Kabab',      price: 4.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/beef-kabab.webp'      },
  { id: 'philly-steak',    label: 'Philly Steak',          price: 6.00, qtyType: 'single-double', emoji: '🥩', img: '/images/byo/ing/philly-steak.webp'    },
  { id: 'falafel',         label: 'Falafel',               price: 6.00, qtyType: 'low-extra',     emoji: '🧆', img: '/images/byo/ing/falafel-6.webp', imgByQty: { low: '/images/byo/ing/falafel-3.webp', regular: '/images/byo/ing/falafel-6.webp', extra: '/images/byo/ing/falafel-9.webp', double: '/images/byo/ing/falafel-12.webp' } },
  { id: 'fish-fillet',     label: 'Fish Fillet',           price: 7.00, qtyType: 'single-double', emoji: '🐟', img: '/images/byo/ing/fish-fillet.webp'     },
  { id: 'shrimp',          label: 'Shrimp',                price: 8.00, qtyType: 'low-extra',     emoji: '🍤', img: '/images/byo/ing/shrimp.webp'          },
  { id: 'tuna',            label: 'Tuna Fish',             price: 7.00, qtyType: 'low-extra',     emoji: '🐠', img: '/images/byo/ing/tuna.webp'            },
  { id: 'beef-burger',     label: 'Beef Berger',           price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/beef-burger.webp'     },
  { id: 'chicken-burger',  label: 'Chicken Berger',        price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/chicken-burger.webp'  },
];

const SAUCE_OPTS = [
  { id: 'white',   label: 'White Sauce',         price: 1.00, emoji: '🤍', img: '/images/byo/ing/sauce-white-bowl.webp'  },
  { id: 'hot',     label: 'Hot Sauce',           price: 1.00, emoji: '🔥', img: '/images/byo/ing/sauce-hot-bowl.webp'    },
  { id: 'ketchup', label: 'Ketchup',             price: 0.75, emoji: '🍅', img: '/images/byo/ing/sauce-ketchup.webp'     },
  { id: 'mustard', label: 'Mustard',             price: 0.75, emoji: '💛', img: '/images/byo/ing/sauce-mustard.webp'     },
  { id: 'bbq',     label: 'BBQ Sauce',           price: 1.00, emoji: '🫙', img: '/images/byo/ing/sauce-bbq.webp'         },
  { id: 'green',   label: 'Special Green Sauce', price: 1.25, emoji: '💚', img: '/images/byo/ing/sauce-green.webp'       },
  { id: 'mayo',    label: 'Mayonnaise',          price: 0.75, emoji: '🍶', img: '/images/byo/ing/sauce-mayo.webp'        },
  { id: 'blue',    label: 'Blue Cheese',         price: 1.25, emoji: '🫐', img: '/images/byo/ing/sauce-blue-cheese.webp' },
];

/* ── Price helpers ───────────────────────────────────────────── */
const VEG_QTY_MULT  = { low: 1, regular: 1, extra: 1.5, double: 2 };
const SAUCE_FOOD_MULT = { low: 0.5, regular: 1, extra: 2 };

/* Proteins whose price scales with the selected base */
const PROTEIN_BASE_TIERED = new Set([
  'chicken', 'lamb-gyro', 'mix', 'bacon', 'tuna', 'shrimp', 'turkey',
]);

/* Base-dependent multipliers (per client spec):
   - Cheese:   2× on Hero or Family Tray
   - Veg:      3× on Family Tray
   - Tiered proteins: 4× on Family Tray, 0.8× on compact/wrap/standard bases,
                      1× on Hero or Platter                                     */
function getBaseMultipliers(base) {
  if (!base) return { cheese: 1, veg: 1, protein: 1 };
  const isFamilyTray = base.id === '39j';
  const isHero       = base.id === '39a';
  const isPlatter    = base.id === '39i';
  return {
    cheese:  (isHero || isFamilyTray) ? 2 : 1,
    veg:     isFamilyTray ? 3 : 1,
    protein: isFamilyTray ? 4 : (isHero || isPlatter) ? 1 : 0.8,
  };
}

function calcProteinPrice(protein, qty) {
  const b = protein.price;
  switch (protein.qtyType) {
    case 'low-extra':
      return b * ({ low: 0.75, regular: 1, extra: 4 / 3, double: 2 }[qty] ?? 1);
    case 'eggs':
      return b * (parseInt(qty) || 1);
    case 'single-double':
      return b * (qty === 'double' ? 2 : 1);
    case 'single-triple':
      return b * (qty === 'triple' ? 3 : qty === 'double' ? 2 : 1);
    default:
      return b;
  }
}

function proteinQtyLabel(protein, qty) {
  if (protein.qtyType === 'eggs') return `${qty} egg${qty > 1 ? 's' : ''}`;
  return qty.charAt(0).toUpperCase() + qty.slice(1);
}

/* ── Quantity option lists per type ──────────────────────────── */
const QTY_OPTS = {
  'low-extra':     ['low', 'regular', 'extra', 'double'],
  'eggs':          [1, 2, 3, 4],
  'single-double': ['single', 'double'],
  'single-triple': ['single', 'double', 'triple'],
  'veg':           ['low', 'regular', 'extra', 'double'],
  'cheese':        ['low', 'regular', 'extra'],
  'sauce-food':    ['low', 'regular', 'extra'],
};

/* ================================================================
   CANVAS INGREDIENT DATABASE — top-down food-photography view
   Canvas: 4:3 ratio, base image fills 92%×88%, centered at (50%,50%)
   z-layers: 2=lettuce/rice bed  3=cheese  4=protein  5=small veggies
   pos[family]: [{x, y, w, rot?}]  x/y=center %, w=width % of canvas
   familyTray/platter: protein LEFT zone (~27%), rice RIGHT zone (~68%)
   ================================================================ */
const CO_ING_DB = {
  /* ── PROTEINS  z=4 — large, centered on base ──────────────── */
  chicken:         { src:'/images/byo/ing/chicken.webp',         z:4, pos:{ hero:[{x:50,y:44,w:64}], standard:[{x:50,y:44,w:54}], compact:[{x:50,y:44,w:50}], wrap:[{x:50,y:44,w:50}], platter:[{x:50,y:44,w:52}],     familyTray:[{x:50,y:44,w:56}] } },
  'lamb-gyro':     { src:'/images/byo/ing/lamb-gyro.webp',       z:4, pos:{ hero:[{x:50,y:43,w:66}], standard:[{x:50,y:43,w:56}], compact:[{x:50,y:43,w:52}], wrap:[{x:50,y:43,w:52}], platter:[{x:50,y:43,w:54}],     familyTray:[{x:50,y:43,w:58}] } },
  mix:             { src:'/images/byo/ing/mix.webp',              z:4, pos:{ hero:[{x:50,y:44,w:62}], standard:[{x:50,y:44,w:52}], compact:[{x:50,y:44,w:48}], wrap:[{x:50,y:44,w:49}], platter:[{x:50,y:44,w:52}],     familyTray:[{x:50,y:44,w:56}] } },
  hotdog:          { src:'/images/byo/ing/hotdog.webp',           z:4, pos:{ hero:[{x:50,y:43,w:70}], standard:[{x:50,y:43,w:58}], compact:[{x:50,y:43,w:54}], wrap:[{x:50,y:43,w:54}], platter:[{x:50,y:43,w:56}],     familyTray:[{x:50,y:43,w:60}] } },
  bacon:           { src:'/images/byo/ing/bacon.webp',            z:4, pos:{ hero:[{x:37,y:44,w:34},{x:64,y:44,w:34}], standard:[{x:38,y:44,w:30},{x:62,y:44,w:30}], compact:[{x:40,y:44,w:28},{x:60,y:44,w:28}], wrap:[{x:40,y:44,w:29,rot:8},{x:60,y:44,w:29,rot:-8}], platter:[{x:38,y:44,w:32},{x:62,y:44,w:32}], familyTray:[{x:36,y:44,w:36},{x:64,y:44,w:36}] } },
  'hot-sausage':   { src:'/images/byo/ing/hot-sausage.webp',     z:4, pos:{ hero:[{x:50,y:43,w:66}], standard:[{x:50,y:43,w:56}], compact:[{x:50,y:43,w:52}], wrap:[{x:50,y:43,w:52}], platter:[{x:50,y:43,w:54}],     familyTray:[{x:50,y:43,w:58}] } },
  'italian-sausage':{ src:'/images/byo/ing/italian-sausage.webp',z:4, pos:{ hero:[{x:50,y:43,w:68}], standard:[{x:50,y:43,w:58}], compact:[{x:50,y:43,w:54}], wrap:[{x:50,y:43,w:54}], platter:[{x:50,y:43,w:56}],     familyTray:[{x:50,y:43,w:60}] } },
  turkey:          { src:'/images/byo/ing/turkey.webp',           z:4, pos:{ hero:[{x:50,y:44,w:60}], standard:[{x:50,y:44,w:50}], compact:[{x:50,y:44,w:46}], wrap:[{x:50,y:44,w:48}], platter:[{x:50,y:44,w:50}],     familyTray:[{x:50,y:44,w:54}] } },
  'chicken-kabab': { src:'/images/byo/ing/chicken-kabab.webp',   z:4, pos:{ hero:[{x:30,y:44,w:30},{x:70,y:44,w:30}], standard:[{x:33,y:44,w:28},{x:67,y:44,w:28}], compact:[{x:36,y:44,w:26},{x:64,y:44,w:26}], wrap:[{x:36,y:44,w:27},{x:64,y:44,w:27}], platter:[{x:36,y:44,w:30},{x:64,y:44,w:30}], familyTray:[{x:34,y:44,w:32},{x:66,y:44,w:32}] } },
  'beef-kabab':    { src:'/images/byo/ing/beef-kabab.webp',      z:4, pos:{ hero:[{x:30,y:44,w:30},{x:70,y:44,w:30}], standard:[{x:33,y:44,w:28},{x:67,y:44,w:28}], compact:[{x:36,y:44,w:26},{x:64,y:44,w:26}], wrap:[{x:36,y:44,w:27},{x:64,y:44,w:27}], platter:[{x:36,y:44,w:30},{x:64,y:44,w:30}], familyTray:[{x:34,y:44,w:32},{x:66,y:44,w:32}] } },
  'philly-steak':  { src:'/images/byo/ing/philly-steak.webp',    z:4, pos:{ hero:[{x:50,y:44,w:62}], standard:[{x:50,y:44,w:52}], compact:[{x:50,y:44,w:48}], wrap:[{x:50,y:44,w:50}], platter:[{x:50,y:44,w:52}],     familyTray:[{x:50,y:44,w:56}] } },
  falafel:         { src:'/images/byo/ing/falafel-6.webp', srcByQty:{ low:'/images/byo/ing/falafel-3.webp', regular:'/images/byo/ing/falafel-6.webp', extra:'/images/byo/ing/falafel-9.webp', double:'/images/byo/ing/falafel-12.webp' }, z:4, pos:{ hero:[{x:50,y:44,w:62}], standard:[{x:50,y:44,w:54}], compact:[{x:50,y:44,w:50}], wrap:[{x:50,y:44,w:50}], platter:[{x:50,y:44,w:52}], familyTray:[{x:50,y:44,w:58}] } },
  'fish-fillet':   { src:'/images/byo/ing/fish-fillet.webp',     z:4, pos:{ hero:[{x:50,y:44,w:60}], standard:[{x:50,y:44,w:50}], compact:[{x:50,y:44,w:46}], wrap:[{x:50,y:44,w:48}], platter:[{x:50,y:44,w:50}],     familyTray:[{x:50,y:44,w:54}] } },
  shrimp:          { src:'/images/byo/ing/shrimp.webp',           z:4, pos:{ hero:[{x:27,y:44,w:17,rot:-14},{x:50,y:43,w:17},{x:73,y:44,w:17,rot:14}], standard:[{x:30,y:44,w:18,rot:-11},{x:50,y:43,w:18},{x:70,y:44,w:18,rot:11}], compact:[{x:34,y:44,w:17,rot:-10},{x:50,y:43,w:17},{x:66,y:44,w:17,rot:10}], wrap:[{x:34,y:44,w:17,rot:-12},{x:50,y:43,w:17},{x:66,y:44,w:17,rot:12}], platter:[{x:34,y:44,w:18,rot:-10},{x:50,y:43,w:18},{x:66,y:44,w:18,rot:10}], familyTray:[{x:32,y:44,w:20,rot:-12},{x:50,y:43,w:20},{x:68,y:44,w:20,rot:12}] } },
  tuna:            { src:'/images/byo/ing/tuna.webp',             z:4, pos:{ hero:[{x:50,y:44,w:58}], standard:[{x:50,y:44,w:48}], compact:[{x:50,y:44,w:44}], wrap:[{x:50,y:44,w:46}], platter:[{x:50,y:44,w:48}],     familyTray:[{x:50,y:44,w:52}] } },
  'beef-burger':   { src:'/images/byo/ing/beef-burger.webp',     z:4, pos:{ hero:[{x:50,y:44,w:46}], standard:[{x:50,y:44,w:42}], compact:[{x:50,y:44,w:40}], wrap:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:44}],     familyTray:[{x:50,y:44,w:48}] } },
  'chicken-burger':{ src:'/images/byo/ing/chicken-burger.webp',  z:4, pos:{ hero:[{x:50,y:44,w:46}], standard:[{x:50,y:44,w:42}], compact:[{x:50,y:44,w:40}], wrap:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:44}],     familyTray:[{x:50,y:44,w:48}] } },
  'egg-fried':     { src:'/images/byo/ing/egg-fried.webp',       z:4, pos:{ hero:[{x:36,y:44,w:20,rot:12},{x:63,y:43,w:19,rot:-9}], standard:[{x:37,y:44,w:22,rot:10},{x:63,y:43,w:21,rot:-8}], compact:[{x:39,y:44,w:21,rot:8},{x:61,y:44,w:20,rot:-7}], wrap:[{x:39,y:44,w:21,rot:14},{x:61,y:43,w:20,rot:-12}], platter:[{x:38,y:44,w:22,rot:10},{x:62,y:43,w:21,rot:-8}], familyTray:[{x:36,y:44,w:24,rot:10},{x:64,y:43,w:23,rot:-8}] } },
  'egg-scrambled': { src:'/images/byo/ing/egg-scrambled.webp',   z:4, pos:{ hero:[{x:50,y:44,w:54}], standard:[{x:50,y:44,w:46}], compact:[{x:50,y:44,w:42}], wrap:[{x:50,y:44,w:44}], platter:[{x:50,y:44,w:46}],     familyTray:[{x:50,y:44,w:50}] } },

  /* ── CHEESE / SPREADS  z=3 — just under protein ───────────── */
  american: { src:'/images/byo/ing/american-cheese.webp', z:3, pos:{ hero:[{x:50,y:48,w:66}], standard:[{x:50,y:48,w:56}], compact:[{x:50,y:48,w:52}], wrap:[{x:50,y:48,w:54}], platter:[{x:50,y:49,w:60}], familyTray:[{x:50,y:49,w:64}] } },
  cream:    { src:'/images/byo/ing/cream-cheese.webp',    z:3, pos:{ hero:[{x:50,y:48,w:66}], standard:[{x:50,y:48,w:56}], compact:[{x:50,y:48,w:52}], wrap:[{x:50,y:48,w:54}], platter:[{x:50,y:49,w:60}], familyTray:[{x:50,y:49,w:64}] } },
  butter:   { src:'/images/byo/ing/butter.webp',          z:3, pos:{ hero:[{x:50,y:48,w:64}], standard:[{x:50,y:48,w:54}], compact:[{x:50,y:48,w:50}], wrap:[{x:50,y:48,w:52}], platter:[{x:50,y:49,w:58}], familyTray:[{x:50,y:49,w:62}] } },

  /* ── VEGETABLES  z=2 bed items (wide), z=5 scattered small ── */
  lettuce:  { src:'/images/byo/ing/lettuce.webp',  z:2, pos:{ hero:[{x:50,y:53,w:80}], standard:[{x:50,y:52,w:66}], compact:[{x:50,y:52,w:60}], wrap:[{x:50,y:52,w:64}], platter:[{x:50,y:54,w:72}], familyTray:[{x:50,y:54,w:78}] } },
  rice:     { src:'/images/byo/ing/rice.webp',     z:2, pos:{ hero:[{x:50,y:54,w:78}], standard:[{x:50,y:53,w:64}], compact:[{x:50,y:53,w:58}], wrap:[{x:50,y:53,w:62}], platter:[{x:75,y:50,w:52}],  familyTray:[{x:75,y:50,w:56}] } },
  onions:   { src:'/images/byo/ing/onion.webp',    z:5, pos:{ hero:[{x:22,y:46,w:14},{x:78,y:46,w:14}], standard:[{x:25,y:46,w:16},{x:75,y:46,w:16}], compact:[{x:29,y:46,w:14},{x:71,y:46,w:14}], wrap:[{x:29,y:46,w:15},{x:71,y:46,w:15}], platter:[{x:28,y:46,w:16},{x:72,y:46,w:16}],                    familyTray:[{x:26,y:46,w:17},{x:50,y:39,w:16},{x:74,y:46,w:17}] } },
  peppers:  { src:'/images/byo/ing/pepper.webp',   z:5, pos:{ hero:[{x:18,y:51,w:15},{x:82,y:51,w:15}], standard:[{x:23,y:51,w:16},{x:77,y:51,w:16}], compact:[{x:28,y:51,w:15},{x:72,y:51,w:15}], wrap:[{x:28,y:51,w:16},{x:72,y:51,w:16}], platter:[{x:25,y:51,w:16},{x:75,y:51,w:16}],                    familyTray:[{x:23,y:51,w:17},{x:50,y:58,w:16},{x:77,y:51,w:17}] } },
  cucumbers:{ src:'/images/byo/ing/cucumber.webp', z:5, pos:{ hero:[{x:26,y:55,w:15},{x:74,y:55,w:15}], standard:[{x:28,y:55,w:17},{x:72,y:55,w:17}], compact:[{x:31,y:55,w:15},{x:69,y:55,w:15}], wrap:[{x:30,y:55,w:16},{x:70,y:55,w:16}], platter:[{x:28,y:56,w:17},{x:72,y:56,w:17}],                    familyTray:[{x:26,y:56,w:18},{x:50,y:60,w:17},{x:74,y:56,w:18}] } },
  tomatoes: { src:'/images/byo/ing/tomato.webp',   z:5, pos:{ hero:[{x:50,y:44,w:30}], standard:[{x:50,y:44,w:28}], compact:[{x:50,y:44,w:26}], wrap:[{x:50,y:44,w:27}], platter:[{x:50,y:44,w:28}], familyTray:[{x:50,y:44,w:30}] } },
};

/* ── Top-down food-photography canvas ─────────────────────────── */
function IngCanvas({ base, cfg, onReset }) {
  const family = base?.family;

  /* Collect all selected IDs and build sorted render layers (lower z first) */
  const selectedIds = [
    ...(cfg.cheese.type && cfg.cheese.type !== 'none' ? [cfg.cheese.type] : []),
    ...Object.keys(cfg.proteins),
    ...Object.keys(cfg.vegetables),
  ];

  const layers = [];
  selectedIds.forEach(id => {
    const def = CO_ING_DB[id];
    if (!def || !family) return;
    const positions = def.pos[family] || def.pos.standard;
    if (!positions) return;
    let src = def.src;
    if (def.srcByQty) {
      const qty = cfg.proteins[id]?.qty || cfg.vegetables[id]?.qty;
      if (qty && def.srcByQty[qty]) src = def.srcByQty[qty];
    }
    positions.forEach(pos => layers.push({ id, def, pos, src }));
  });
  layers.sort((a, b) => (a.def.z || 2) - (b.def.z || 2));

  const activeSauces = Object.keys(cfg.sauces)
    .map(id => SAUCE_OPTS.find(o => o.id === id)).filter(Boolean);

  return (
    <>
      <div className="co-canvas">
        <div className="co-canvas-center-glow" />

        {base && onReset && (
          <button className="co-reset-btn" onClick={onReset} title="Start over">
            ↺ Reset
          </button>
        )}

        {base ? (
          <>
            {/* Base: top-down transparent food photo, centered */}
            <img src={base.img} alt={base.label} className="co-canvas-base"
              onError={e => { e.currentTarget.style.opacity = '0.3'; }}
            />

            {/* Ingredient transparent images positioned on base */}
            {layers.map(({ id, def, pos, src }, i) => (
              <img
                key={`${id}-${i}`}
                src={src || def.src}
                alt=""
                className="co-canvas-ing"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${pos.w}%`,
                  zIndex: def.z || 2,
                  transform: pos.rot
                    ? `translate(-50%,-50%) rotate(${pos.rot}deg)`
                    : 'translate(-50%,-50%)',
                  animationDelay: `${i * 0.03}s`,
                }}
              />
            ))}

            {/* Sauce bowl thumbnails — top-right corner */}
            {activeSauces.length > 0 && (
              <div className="co-canvas-sauce-row">
                {activeSauces.slice(0, 4).map(sauce => (
                  sauce.img
                    ? <img key={sauce.id} src={sauce.img} alt={sauce.label} className="co-canvas-sauce-bowl" title={sauce.label} />
                    : <span key={sauce.id} className="co-canvas-sauce-emoji">{sauce.emoji}</span>
                ))}
              </div>
            )}

            {layers.length === 0 && activeSauces.length === 0 && (
              <p className="co-canvas-hint">Add ingredients below ↓</p>
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
        </div>
      )}
    </>
  );
}

/* ── Small reusable quantity pill row ────────────────────────── */
function QtyPills({ opts, value, onChange, formatLabel, formatPrice, basePrice }) {
  return (
    <div className="co-qty-pills">
      {opts.map(opt => {
        const label = formatLabel ? formatLabel(opt) : (typeof opt === 'number' ? `${opt} egg${opt>1?'s':''}` : opt.charAt(0).toUpperCase()+opt.slice(1));
        const price = formatPrice ? formatPrice(opt) : null;
        return (
          <button
            key={opt}
            className={`co-qty-pill${value === opt ? ' active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible section ─────────────────────────────────────── */
function Section({ id, title, icon, badge, open, onToggle, children }) {
  return (
    <div className={`co-section${open ? ' open' : ''}${badge > 0 ? ' completed' : ''}`}>
      <button className="co-section-hdr" onClick={() => onToggle(id)}>
        <span className="co-section-left">
          <span className="co-section-icon">{icon}</span>
          <span className="co-section-title">{title}</span>
          {badge > 0 && <span className="co-section-badge">{badge}</span>}
        </span>
        <ChevronDown size={18} className="co-section-chevron" />
      </button>
      {open && <div className="co-section-body">{children}</div>}
    </div>
  );
}

/* ================================================================
   STAFF-PICK PRESETS
   ================================================================ */
const PRESETS = [
  {
    id: 'classic',
    label: 'The Classic',
    emoji: '🏆',
    desc: 'Hero · Chicken · White Sauce',
    cfg: {
      base:       BASES.find(b => b.id === '39a'),
      cheese:     { type: 'american', qty: 'regular' },
      vegetables: { onions: { qty: 'regular' }, lettuce: { qty: 'regular' }, tomatoes: { qty: 'regular' } },
      proteins:   { chicken: { qty: 'regular' } },
      sauces:     { white: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
  {
    id: 'spicy-gyro',
    label: 'Spicy Gyro',
    emoji: '🔥',
    desc: 'Wrap · Lamb Gyro · Hot Sauce',
    cfg: {
      base:       BASES.find(b => b.id === '39b'),
      cheese:     { type: 'none', qty: 'regular' },
      vegetables: { onions: { qty: 'regular' }, peppers: { qty: 'regular' }, tomatoes: { qty: 'regular' } },
      proteins:   { 'lamb-gyro': { qty: 'regular' } },
      sauces:     { hot: { placement: 'on_food', qty: 'regular', count: 1 }, white: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
  {
    id: 'beef-burger',
    label: 'Beef Berger',
    emoji: '🍔',
    desc: 'Burger Bun · Beef Berger · Ketchup',
    cfg: {
      base:       BASES.find(b => b.id === '39g'),
      cheese:     { type: 'american', qty: 'regular' },
      vegetables: { lettuce: { qty: 'regular' }, tomatoes: { qty: 'regular' }, onions: { qty: 'regular' } },
      proteins:   { 'beef-burger': { qty: 'single' } },
      sauces:     { ketchup: { placement: 'on_food', qty: 'regular', count: 1 }, mayo: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
  {
    id: 'falafel-pita',
    label: 'Falafel Pita',
    emoji: '🧆',
    desc: 'Pita · Falafel · Green Sauce',
    cfg: {
      base:       BASES.find(b => b.id === '39c'),
      cheese:     { type: 'none', qty: 'regular' },
      vegetables: { lettuce: { qty: 'regular' }, cucumbers: { qty: 'regular' }, tomatoes: { qty: 'regular' } },
      proteins:   { falafel: { qty: 'regular' } },
      sauces:     { green: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
const BAGEL_TYPES = ['Plain', 'Sesame', 'Raisin', 'Whole Wheat'];

const INIT = {
  base: null,
  bagelType: 'Plain',
  cheese:    { type: 'none', qty: 'regular' },
  vegetables: {},   // { [id]: { qty } }
  proteins:   {},   // { [id]: { qty } }
  sauces:     {},   // { [id]: { on: true, placement: 'on_food', qty: 'regular', count: 1 } }
  extras:     {},   // { [id]: count }
  drinks:     {},   // { [id]: count }
};

export default function CustomOrder() {
  const { addItem, items: cartItems, subtotal } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate    = useNavigate();
  const [cfg, setCfg]         = useState(INIT);
  const [open, setOpen]       = useState(new Set(['base']));
  const [extras, setExtras]   = useState([]);
  const [drinks, setDrinks]   = useState([]);
  const [added, setAdded]             = useState(false);
  const [warnProtein, setWarnProtein] = useState(false);
  const [qty, setQty]                 = useState(1);
  const [dietFilters, setDietFilters]     = useState(new Set());
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [savedOrders, setSavedOrders]     = useState([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName]           = useState('');
  const [saveStatus, setSaveStatus]       = useState('idle'); // idle | saving | saved | error
  const [totalFlash, setTotalFlash]       = useState(false);

  /* Fetch extras + drinks from menu */
  useEffect(() => {
    menuAPI.getAll().then(items => {
      if (!Array.isArray(items)) return;
      setExtras(items.filter(i => /extra|side/i.test(i.category_name || i.category || '')));
      setDrinks(items.filter(i => /drink|beverage|soda|juice/i.test(i.category_name || i.category || '')));
    }).catch(() => {});
  }, []);

  /* Dietary filter exclusion sets */
  const VEG_EXCLUDED   = new Set(['chicken','lamb-gyro','mix','hotdog','bacon','hot-sausage','italian-sausage','turkey','chicken-kabab','beef-kabab','philly-steak','fish-fillet','shrimp','tuna','beef-burger','chicken-burger']);
  const DAIRY_CHEESES  = new Set(['american','cream','butter']);
  const DAIRY_SAUCES   = new Set(['blue']);
  const isProteinExcluded = id => dietFilters.has('vegetarian')  && VEG_EXCLUDED.has(id);
  const isCheeseExcluded  = id => dietFilters.has('dairyFree')   && DAIRY_CHEESES.has(id);
  const isSauceExcluded   = id => dietFilters.has('dairyFree')   && DAIRY_SAUCES.has(id);

  const toggleDietFilter = key => {
    setDietFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      next.add(key);
      // Clear any currently selected incompatible items
      if (key === 'vegetarian') {
        setCfg(p => {
          const proteins = { ...p.proteins };
          VEG_EXCLUDED.forEach(id => delete proteins[id]);
          return { ...p, proteins };
        });
      }
      if (key === 'dairyFree') {
        setCfg(p => ({
          ...p,
          cheese: DAIRY_CHEESES.has(p.cheese.type) ? { type: 'none', qty: 'regular' } : p.cheese,
          sauces: Object.fromEntries(Object.entries(p.sauces).filter(([id]) => !DAIRY_SAUCES.has(id))),
        }));
      }
      return next;
    });
  };

  /* Load saved orders when logged in */
  useEffect(() => {
    if (!isLoggedIn) return;
    savedCustomAPI.getAll().then(data => {
      if (Array.isArray(data)) setSavedOrders(data);
    }).catch(() => {});
  }, [isLoggedIn]);

  /* Save current config */
  const handleSave = async () => {
    if (!saveName.trim() || !cfg.base) return;
    setSaveStatus('saving');
    try {
      const saved = await savedCustomAPI.save(saveName.trim(), cfg);
      setSavedOrders(prev => [saved, ...prev]);
      setSaveStatus('saved');
      setSaveName('');
      setTimeout(() => { setSaveStatus('idle'); setShowSaveInput(false); }, 1800);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  /* Delete a saved order */
  const handleDeleteSaved = async id => {
    await savedCustomAPI.delete(id).catch(() => {});
    setSavedOrders(prev => prev.filter(o => o.id !== id));
  };

  /* Load a saved config */
  const loadSaved = saved => {
    setCfg({ ...INIT, ...saved.config });
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
    setWarnProtein(false);
    setQty(1);
  };

  /* Apply a staff-pick preset */
  const applyPreset = preset => {
    setCfg({ ...preset.cfg });
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
    setWarnProtein(false);
    setQty(1);
  };

  const handleReset = () => {
    setCfg(INIT);
    setOpen(new Set(['base']));
    setQty(1);
    setWarnProtein(false);
  };

  /* Section toggle */
  const toggleSection = id => setOpen(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  /* State updaters */
  const setBase = base => {
    setCfg(p => ({ ...p, base, bagelType: 'Plain' }));
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
  };

  const setCheeseType = type => setCfg(p => ({ ...p, cheese: { ...p.cheese, type } }));
  const setCheeseQty  = qty  => setCfg(p => ({ ...p, cheese: { ...p.cheese, qty  } }));

  const toggleVeg = id => setCfg(p => {
    const v = { ...p.vegetables };
    v[id] ? delete v[id] : (v[id] = { qty: 'regular' });
    return { ...p, vegetables: v };
  });
  const setVegQty = (id, qty) => setCfg(p => ({
    ...p, vegetables: { ...p.vegetables, [id]: { ...p.vegetables[id], qty } }
  }));

  const toggleProtein = id => setCfg(p => {
    const v = { ...p.proteins };
    const pr = PROTEIN_OPTS.find(x => x.id === id);
    v[id] ? delete v[id] : (v[id] = { qty: pr?.qtyType === 'eggs' ? 1 : pr?.qtyType === 'single-double' || pr?.qtyType === 'single-triple' ? 'single' : 'regular' });
    return { ...p, proteins: v };
  });
  const setProteinQty = (id, qty) => setCfg(p => ({
    ...p, proteins: { ...p.proteins, [id]: { ...p.proteins[id], qty } }
  }));

  const toggleSauce = id => setCfg(p => {
    const v = { ...p.sauces };
    v[id] ? delete v[id] : (v[id] = { placement: 'on_food', qty: 'regular', count: 1 });
    return { ...p, sauces: v };
  });
  const setSaucePlacement = (id, placement) => setCfg(p => ({
    ...p, sauces: { ...p.sauces, [id]: { ...p.sauces[id], placement } }
  }));
  const setSauceQty   = (id, qty)   => setCfg(p => ({ ...p, sauces: { ...p.sauces, [id]: { ...p.sauces[id], qty   } } }));
  const setSauceCount = (id, count) => setCfg(p => ({ ...p, sauces: { ...p.sauces, [id]: { ...p.sauces[id], count } } }));

  const setExtraCount = (id, count) => setCfg(p => ({
    ...p, extras: count > 0 ? { ...p.extras, [id]: count } : (({ [id]: _, ...rest }) => rest)(p.extras)
  }));
  const setDrinkCount = (id, count) => setCfg(p => ({
    ...p, drinks: count > 0 ? { ...p.drinks, [id]: count } : (({ [id]: _, ...rest }) => rest)(p.drinks)
  }));

  /* Running total */
  const total = useMemo(() => {
    const mult = getBaseMultipliers(cfg.base);
    let t = cfg.base?.price || 0;
    if (cfg.cheese.type !== 'none') {
      const c = CHEESE_OPTS.find(x => x.id === cfg.cheese.type);
      if (c) t += c.price * mult.cheese;
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = VEG_OPTS.find(x => x.id === id);
      if (v) t += v.price * (VEG_QTY_MULT[qty] || 1) * mult.veg;
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = PROTEIN_OPTS.find(x => x.id === id);
      if (p) {
        const m = PROTEIN_BASE_TIERED.has(id) ? mult.protein : 1;
        t += calcProteinPrice(p, qty) * m;
      }
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = SAUCE_OPTS.find(x => x.id === id);
      if (!sc) return;
      t += s.placement === 'on_side'
        ? sc.price * (s.count || 1)
        : sc.price * (SAUCE_FOOD_MULT[s.qty] || 1);
    });
    Object.entries(cfg.extras).forEach(([id, cnt]) => {
      const item = extras.find(x => String(x._id ?? x.id) === id);
      if (item) t += parseFloat(item.price || 0) * cnt;
    });
    Object.entries(cfg.drinks).forEach(([id, cnt]) => {
      const item = drinks.find(x => String(x._id ?? x.id) === id);
      if (item) t += parseFloat(item.price || 0) * cnt;
    });
    return Math.max(0, t);
  }, [cfg, extras, drinks]);

  /* Flash running total when it changes — must be after `total` useMemo to avoid TDZ */
  useEffect(() => {
    if (total <= 0) return;
    setTotalFlash(true);
    const t = setTimeout(() => setTotalFlash(false), 450);
    return () => clearTimeout(t);
  }, [total]);

  /* Price breakdown lines */
  const breakdown = useMemo(() => {
    if (!cfg.base) return [];
    const mult = getBaseMultipliers(cfg.base);
    const lines = [];
    lines.push({ label: cfg.base.label + ' (base)', price: cfg.base.price });
    if (cfg.cheese.type !== 'none') {
      const c = CHEESE_OPTS.find(x => x.id === cfg.cheese.type);
      if (c) lines.push({ label: `${c.label} (${cfg.cheese.qty})`, price: c.price * mult.cheese });
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = VEG_OPTS.find(x => x.id === id);
      if (v) lines.push({ label: `${v.label} (${qty})`, price: v.price * (VEG_QTY_MULT[qty] || 1) * mult.veg });
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = PROTEIN_OPTS.find(x => x.id === id);
      if (p) {
        const m = PROTEIN_BASE_TIERED.has(id) ? mult.protein : 1;
        lines.push({ label: `${p.label} (${proteinQtyLabel(p, qty)})`, price: calcProteinPrice(p, qty) * m });
      }
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = SAUCE_OPTS.find(x => x.id === id);
      if (!sc) return;
      const price = s.placement === 'on_side' ? sc.price * (s.count || 1) : sc.price * (SAUCE_FOOD_MULT[s.qty] || 1);
      lines.push({ label: `${sc.label}${s.placement === 'on_side' ? ' (on side)' : ''}`, price });
    });
    Object.entries(cfg.extras).forEach(([id, cnt]) => {
      const item = extras.find(x => String(x._id ?? x.id) === id);
      if (item) lines.push({ label: `${item.name} ×${cnt}`, price: parseFloat(item.price || 0) * cnt });
    });
    Object.entries(cfg.drinks).forEach(([id, cnt]) => {
      const item = drinks.find(x => String(x._id ?? x.id) === id);
      if (item) lines.push({ label: `${item.name} ×${cnt}`, price: parseFloat(item.price || 0) * cnt });
    });
    return lines;
  }, [cfg, extras, drinks]);

  /* Build cart item note */
  const buildNote = () => {
    const parts = [];
    if (cfg.base?.id === '39e') parts.push(`Bagel: ${cfg.bagelType}`);
    if (cfg.cheese.type !== 'none') {
      const c = CHEESE_OPTS.find(x => x.id === cfg.cheese.type);
      parts.push(`${c?.label} (${cfg.cheese.qty})`);
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = VEG_OPTS.find(x => x.id === id);
      if (v) parts.push(`${v.label} (${qty})`);
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = PROTEIN_OPTS.find(x => x.id === id);
      if (p) parts.push(`${p.label} (${proteinQtyLabel(p, qty)})`);
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = SAUCE_OPTS.find(x => x.id === id);
      if (sc) parts.push(`${sc.label} (${s.placement === 'on_side' ? `x${s.count} on side` : s.qty})`);
    });
    Object.entries(cfg.extras).forEach(([id, cnt]) => {
      const item = extras.find(x => String(x._id ?? x.id) === id);
      if (item) parts.push(`${item.name} x${cnt}`);
    });
    Object.entries(cfg.drinks).forEach(([id, cnt]) => {
      const item = drinks.find(x => String(x._id ?? x.id) === id);
      if (item) parts.push(`${item.name} x${cnt}`);
    });
    return parts.join(' | ');
  };

  const handleAdd = () => {
    if (!cfg.base) return;
    if (Object.keys(cfg.proteins).length === 0) {
      setWarnProtein(true);
      return;
    }
    doAdd();
  };

  const doAdd = () => {
    if (!cfg.base) return;
    setWarnProtein(false);

    /* Bundle sides and drinks as addons on the custom item so each
       person's meal stays together (like a McDonald's combo meal). */
    const addons = [];
    let addonsTotal = 0;

    Object.entries(cfg.extras).forEach(([id, cnt]) => {
      const item = extras.find(x => String(x._id ?? x.id) === id);
      if (item && cnt > 0) {
        const price = parseFloat(item.price || 0);
        addons.push({ name: item.name, price, qty: cnt });
        addonsTotal += price * cnt;
      }
    });
    Object.entries(cfg.drinks).forEach(([id, cnt]) => {
      const item = drinks.find(x => String(x._id ?? x.id) === id);
      if (item && cnt > 0) {
        const price = parseFloat(item.price || 0);
        addons.push({ name: item.name, price, qty: cnt });
        addonsTotal += price * cnt;
      }
    });

    /* One cart line per person's order.
       price = full total (used for subtotal/cart-strip).
       baseItemPrice = base+ingredients only (displayed in checkout).
       addons = sides+drinks shown as indented sub-rows in checkout. */
    /* Build visual layers for checkout preview:
       base photo + up to 3 ingredient transparent PNGs */
    const customLayers = [
      cfg.base.img,
      ...Object.keys(cfg.proteins).map(id => CO_ING_DB[id]?.src),
      cfg.cheese.type && cfg.cheese.type !== 'none' ? CO_ING_DB[cfg.cheese.type]?.src : null,
      ...Object.keys(cfg.vegetables).map(id => CO_ING_DB[id]?.src),
    ].filter(Boolean).slice(0, 5);

    addItem({
      id:            `custom-${cfg.base.id}-${Date.now()}`,
      name:          cfg.base.id === '39e' ? `Custom ${cfg.bagelType} Bagel` : `Custom ${cfg.base.label}`,
      price:         total,
      baseItemPrice: Math.max(0, total - addonsTotal),
      note:          buildNote(),
      img:           cfg.base.img,
      customLayers,
      addons,
      qty,
    });

    /* Reset form so the user can immediately build another order */
    setCfg(INIT);
    setOpen(new Set(['base']));
    setWarnProtein(false);
    setQty(1);

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  /* Section badges */
  const badges = {
    base:       cfg.base ? 1 : 0,
    cheese:     cfg.cheese.type !== 'none' ? 1 : 0,
    vegetables: Object.keys(cfg.vegetables).length,
    proteins:   Object.keys(cfg.proteins).length,
    sauces:     Object.keys(cfg.sauces).length,
    extras:     Object.values(cfg.extras).reduce((a, b) => a + b, 0),
    drinks:     Object.values(cfg.drinks).reduce((a, b) => a + b, 0),
  };

  return (
    <div className="co-page">
      <SEO
        title="Customize Your Order | Habibi Halal Express"
        description="Build your perfect halal meal — choose your base, protein, vegetables, and sauces. Fully custom, fully halal."
        url="/customize"
      />

      {/* ── Header image ── */}
      <div className="co-hero">
        <img src="/images/byo/customize-hero.jpg" alt="Customize Your Order" className="co-hero-img" />
        <div className="co-hero-overlay" aria-hidden="true" />
        <div className="co-hero-lines"  aria-hidden="true" />

        {/* Left — title */}
        <div className="co-hero-text">
          <span className="co-hero-eyebrow">✦ Habibi Halal Express</span>
          <h1 className="co-hero-title">Build Your<br/>Perfect Meal</h1>
          <p className="co-hero-sub">Choose your base · Pick your proteins · Add your sauces</p>
        </div>

        {/* Right — quick-stats badge */}
        <div className="co-hero-stats">
          <div className="co-hero-stat"><strong>19</strong><span>Proteins</span></div>
          <div className="co-hero-stat-sep" />
          <div className="co-hero-stat"><strong>8</strong><span>Sauces</span></div>
          <div className="co-hero-stat-sep" />
          <div className="co-hero-stat"><strong>100+</strong><span>Combos</span></div>
        </div>
      </div>

      <div className="co-layout">

        {/* ── Mobile-only canvas (above sections, hidden on desktop) ── */}
        <div className="co-mobile-canvas-wrap">
          <IngCanvas base={cfg.base} cfg={cfg} onReset={handleReset} />
        </div>

        {/* ── Left: sticky canvas (desktop sidebar) ── */}
        <aside className="co-sidebar">
          <IngCanvas base={cfg.base} cfg={cfg} onReset={handleReset} />
          <div className="co-price-card">
            <span className="co-price-label">Your Total</span>
            <span className={`co-price-val${totalFlash ? ' co-price-flash' : ''}`}>${total.toFixed(2)}</span>
            {cfg.base?.id === '39j' && (
              <span className="co-base-hint">Family Tray: ingredients scaled ×4 portions</span>
            )}
            {cfg.base?.id === '39a' && (
              <span className="co-base-hint">Hero: cheese doubled</span>
            )}

            {/* Price breakdown */}
            {breakdown.length > 0 && (
              <div className="co-breakdown">
                <button className="co-breakdown-toggle" onClick={() => setShowBreakdown(p => !p)}>
                  <span>{showBreakdown ? '▲' : '▼'} breakdown</span>
                </button>
                {showBreakdown && (
                  <div className="co-breakdown-list">
                    {breakdown.map((line, i) => (
                      <div key={i} className="co-breakdown-row">
                        <span className="co-breakdown-label">{line.label}</span>
                        <span className="co-breakdown-price">${line.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="co-breakdown-total-row">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantity stepper */}
            {cfg.base && (
              <div className="co-qty-row">
                <button className="co-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}>
                  <Minus size={14} />
                </button>
                <span className="co-qty-val">{qty}</span>
                <button className="co-qty-btn" onClick={() => setQty(q => Math.min(20, q + 1))}>
                  <Plus size={14} />
                </button>
              </div>
            )}

            <button
              className="co-add-btn"
              onClick={handleAdd}
              disabled={!cfg.base || added}
            >
              {added
                ? <><Check size={16} /> Added!</>
                : <><ShoppingBag size={16} /> {qty > 1 ? `Add ${qty} to Cart` : 'Add to Cart'}</>
              }
            </button>

            {/* Save to account — logged-in + base selected */}
            {isLoggedIn && cfg.base && (
              <div className="co-save-row">
                {!showSaveInput ? (
                  <button className="co-save-btn" onClick={() => { setShowSaveInput(true); setSaveName(''); }}>
                    <Bookmark size={14} /> Save this order
                  </button>
                ) : (
                  <div className="co-save-input-row">
                    <input
                      className="co-save-input"
                      placeholder="Name it (e.g. Dad's Special)"
                      value={saveName}
                      maxLength={60}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      autoFocus
                    />
                    <button className="co-save-confirm" onClick={handleSave} disabled={!saveName.trim() || saveStatus === 'saving'}>
                      {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓' : saveStatus === 'error' ? '!' : '↵'}
                    </button>
                    <button className="co-save-cancel" onClick={() => setShowSaveInput(false)}>✕</button>
                  </div>
                )}
              </div>
            )}

            {warnProtein && (
              <div className="co-protein-warn">
                <p className="co-protein-warn-msg">⚠️ No protein selected, your order will be veggie only.</p>
                <div className="co-protein-warn-actions">
                  <button className="co-protein-warn-pick"
                    onClick={() => {
                      setWarnProtein(false);
                      setOpen(prev => { const n = new Set(prev); n.add('proteins'); return n; });
                      document.querySelector('.co-groups')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>
                    Pick Protein
                  </button>
                  <button className="co-protein-warn-anyway" onClick={doAdd}>
                    Add Anyway
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Make it a meal nudge ── */}
          {cfg.base &&
           Object.keys(cfg.proteins).length > 0 &&
           Object.keys(cfg.extras).length === 0 &&
           Object.values(cfg.drinks).reduce((a, b) => a + b, 0) === 0 &&
           (extras.length > 0 || drinks.length > 0) && (
            <div className="co-meal-nudge">
              <p className="co-meal-nudge-title">🍟 Make it a meal?</p>
              <p className="co-meal-nudge-sub">Add a side or drink</p>
              <div className="co-meal-nudge-chips">
                {extras.slice(0, 2).map(item => {
                  const id = String(item.id);
                  return (
                    <button key={id} className="co-meal-chip"
                      onClick={() => setExtraCount(id, 1)}>
                      + {item.name}
                      <span className="co-meal-chip-price">${parseFloat(item.price).toFixed(2)}</span>
                    </button>
                  );
                })}
                {drinks.slice(0, 2).map(item => {
                  const id = String(item.id);
                  return (
                    <button key={id} className="co-meal-chip co-meal-chip-drink"
                      onClick={() => setDrinkCount(id, 1)}>
                      + {item.name}
                      <span className="co-meal-chip-price">${parseFloat(item.price).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ── Right: configuration groups ── */}
        <main className="co-groups">

          {/* ── My Saved Orders (logged-in only) ── */}
          {isLoggedIn && savedOrders.length > 0 && (
            <div className="co-saved-section">
              <p className="co-presets-label">🔖 My Saved Orders</p>
              <div className="co-presets-track">
                {savedOrders.map(order => (
                  <div key={order.id} className="co-saved-card">
                    <button className="co-saved-load" onClick={() => loadSaved(order)}>
                      <span className="co-preset-emoji">🍽️</span>
                      <span className="co-preset-name">{order.name}</span>
                      <span className="co-preset-desc">{order.config?.base?.label || 'Custom order'}</span>
                    </button>
                    <button className="co-saved-del" onClick={() => handleDeleteSaved(order.id)} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Dietary filters ── */}
          <div className="co-diet-filters">
            {[
              { key: 'vegetarian', label: 'Vegetarian',  emoji: '🥗' },
              { key: 'dairyFree',  label: 'Dairy-Free',  emoji: '🥛' },
            ].map(({ key, label, emoji }) => (
              <button
                key={key}
                className={`co-diet-chip${dietFilters.has(key) ? ' active' : ''}`}
                onClick={() => toggleDietFilter(key)}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* ── Staff picks ── */}
          <div className="co-presets">
            <p className="co-presets-label">⭐ Staff Picks, tap to pre-fill</p>
            <div className="co-presets-track">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`co-preset-card${cfg.base?.id === preset.cfg.base?.id && JSON.stringify(cfg.proteins) === JSON.stringify(preset.cfg.proteins) ? ' active' : ''}`}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="co-preset-emoji">{preset.emoji}</span>
                  <span className="co-preset-name">{preset.label}</span>
                  <span className="co-preset-desc">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 1 — BASE */}
          <Section id="base" title="Choose Your Base" icon="🍞"
            badge={badges.base} open={open.has('base')} onToggle={toggleSection}>
            {cfg.base && (
              <div className="co-base-preview">
                <div className="co-base-preview-img" style={{ backgroundImage: `url(${cfg.base.img})` }} />
                <span className="co-base-preview-label">
                  {cfg.base.id === '39e' ? `${cfg.bagelType} Bagel` : cfg.base.label}
                </span>
              </div>
            )}
            {cfg.base?.id === '39e' && (
              <div className="co-bagel-types">
                <span className="co-bagel-types-label">Bagel Style</span>
                <div className="co-bagel-pills">
                  {BAGEL_TYPES.map(t => (
                    <button
                      key={t}
                      className={`co-bagel-pill${cfg.bagelType === t ? ' active' : ''}`}
                      onClick={() => setCfg(p => ({ ...p, bagelType: t }))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="co-base-grid">
              {BASES.map(base => (
                <button
                  key={base.id}
                  className={`co-base-card${cfg.base?.id === base.id ? ' selected' : ''}`}
                  onClick={() => setBase(base)}
                >
                  <div className="co-base-info">
                    <span className="co-base-name">{base.label}</span>
                    <span className="co-base-price">${base.price.toFixed(2)}</span>
                  </div>
                  {cfg.base?.id === base.id && <span className="co-check"><Check size={12} /></span>}
                </button>
              ))}
            </div>
          </Section>

          {/* 2 — CHEESE */}
          <Section id="cheese" title="Cheese" icon="🧀"
            badge={badges.cheese} open={open.has('cheese')} onToggle={toggleSection}>
            <div className="co-opt-grid co-grid-4">
              {CHEESE_OPTS.map(opt => (
                <button
                  key={opt.id}
                  className={`co-opt-card${cfg.cheese.type === opt.id ? ' selected' : ''}${isCheeseExcluded(opt.id) ? ' co-filtered' : ''}`}
                  onClick={() => !isCheeseExcluded(opt.id) && setCheeseType(opt.id)}
                >
                  {opt.img
                    ? <div className="co-opt-thumb" style={{ backgroundImage: `url(${opt.img})` }} />
                    : <span className="co-opt-emoji">{opt.emoji}</span>
                  }
                  <span className="co-opt-name">{opt.label}</span>
                  {cfg.cheese.type === opt.id && <span className="co-check"><Check size={11} /></span>}
                </button>
              ))}
            </div>
            {cfg.cheese.type !== 'none' && (
              <div className="co-sub-row">
                <span className="co-sub-label">Amount</span>
                <QtyPills opts={QTY_OPTS.cheese} value={cfg.cheese.qty} onChange={setCheeseQty} />
              </div>
            )}
          </Section>

          {/* 3 — VEGETABLES */}
          <Section id="vegetables" title="Vegetables & Fillings" icon="🥗"
            badge={badges.vegetables} open={open.has('vegetables')} onToggle={toggleSection}>
            <div className="co-opt-grid co-grid-3">
              {VEG_OPTS.map(veg => {
                const sel = cfg.vegetables[veg.id];
                return (
                  <div key={veg.id} className="co-opt-wrap">
                    <button
                      className={`co-opt-card${sel ? ' selected' : ''}`}
                      onClick={() => toggleVeg(veg.id)}
                    >
                      {veg.img
                        ? <div className="co-opt-thumb" style={{ backgroundImage: `url(${veg.img})` }} />
                        : <span className="co-opt-emoji">{veg.emoji}</span>
                      }
                      <span className="co-opt-name">{veg.label}</span>
                      {veg.note && <span className="co-opt-note">{veg.note}</span>}
                      {sel && <span className="co-check"><Check size={11} /></span>}
                    </button>
                    {sel && (
                      <QtyPills
                        opts={QTY_OPTS.veg}
                        value={sel.qty}
                        onChange={qty => setVegQty(veg.id, qty)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="co-qty-legend">Low · Regular · Extra · Double, price updates in running total above</p>
          </Section>

          {/* 4 — PROTEIN */}
          <Section id="proteins" title="Protein (All Halal)" icon="🥩"
            badge={badges.proteins} open={open.has('proteins')} onToggle={toggleSection}>
            <div className="co-opt-grid co-grid-2">
              {PROTEIN_OPTS.map(prot => {
                const sel = cfg.proteins[prot.id];
                return (
                  <div key={prot.id} className="co-opt-wrap">
                    <button
                      className={`co-opt-card co-prot-card${sel ? ' selected' : ''}${isProteinExcluded(prot.id) ? ' co-filtered' : ''}`}
                      onClick={() => !isProteinExcluded(prot.id) && toggleProtein(prot.id)}
                    >
                      {prot.img
                        ? <div className="co-prot-thumb" style={{ backgroundImage: `url(${sel && prot.imgByQty ? (prot.imgByQty[sel.qty] || prot.img) : prot.img})` }} />
                        : <span className="co-opt-emoji">{prot.emoji}</span>
                      }
                      <div className="co-prot-info">
                        <span className="co-opt-name">{prot.label}</span>
                        {prot.note && <span className="co-opt-note">{prot.note}</span>}
                      </div>
                      {sel && <span className="co-check"><Check size={11} /></span>}
                    </button>
                    {sel && (
                      <QtyPills
                        opts={prot.qtyType === 'eggs' ? QTY_OPTS.eggs : QTY_OPTS[prot.qtyType]}
                        value={sel.qty}
                        onChange={qty => setProteinQty(prot.id, qty)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 5 — SAUCES */}
          <Section id="sauces" title="Sauces" icon="🫙"
            badge={badges.sauces} open={open.has('sauces')} onToggle={toggleSection}>
            <div className="co-opt-grid co-grid-4">
              {SAUCE_OPTS.map(sauce => {
                const sel = cfg.sauces[sauce.id];
                return (
                  <div key={sauce.id} className="co-opt-wrap">
                    <button
                      className={`co-opt-card${sel ? ' selected' : ''}${isSauceExcluded(sauce.id) ? ' co-filtered' : ''}`}
                      onClick={() => !isSauceExcluded(sauce.id) && toggleSauce(sauce.id)}
                    >
                      {sauce.img
                        ? <div className="co-opt-thumb" style={{ backgroundImage: `url(${sauce.img})` }} />
                        : <span className="co-opt-emoji">{sauce.emoji}</span>
                      }
                      <span className="co-opt-name">{sauce.label}</span>
                      {sel && <span className="co-check"><Check size={11} /></span>}
                    </button>
                    {sel && (
                      <div className="co-sauce-opts">
                        {/* Placement */}
                        <div className="co-placement-row">
                          {['on_food', 'on_side'].map(p => (
                            <button
                              key={p}
                              className={`co-placement-btn${sel.placement === p ? ' active' : ''}`}
                              onClick={() => setSaucePlacement(sauce.id, p)}
                            >
                              {p === 'on_food' ? 'On Food' : 'On Side'}
                            </button>
                          ))}
                        </div>
                        {sel.placement === 'on_food' ? (
                          <QtyPills
                            opts={QTY_OPTS['sauce-food']}
                            value={sel.qty}
                            onChange={qty => setSauceQty(sauce.id, qty)}
                          />
                        ) : (
                          <div className="co-counter-row">
                            <span className="co-counter-label">Containers</span>
                            <div className="co-counter">
                              <button onClick={() => setSauceCount(sauce.id, Math.max(1, (sel.count||1)-1))}><Minus size={13}/></button>
                              <span>{sel.count || 1}</span>
                              <button onClick={() => setSauceCount(sauce.id, (sel.count||1)+1)}><Plus size={13}/></button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {Object.values(cfg.sauces).some(s => s.placement === 'on_food') && (
              <div className="co-sauce-note">
                <Info size={14} />
                <span>We will do our best to follow your preference; however, some sauces may be served on the side to maintain food quality and freshness.</span>
              </div>
            )}
          </Section>

          {/* 6 — FRESH ADDITIONS ON SIDE */}
          <Section id="extras" title="Fresh Addition on the Side" icon="🍟"
            badge={badges.extras} open={open.has('extras')} onToggle={toggleSection}>
            {extras.length === 0 ? (
              <p className="co-empty-msg">Side items will appear here once the menu is loaded.</p>
            ) : (
              <div className="co-menu-grid">
                {extras.map(item => {
                  const id    = String(item._id ?? item.id);
                  const count = cfg.extras[id] || 0;
                  return (
                    <div key={id} className="co-menu-card">
                      {item.img && <img src={item.img} alt={item.name} className="co-menu-img" />}
                      <div className="co-menu-info">
                        <Link to={`/menu/item/${id}`} className="co-menu-name">{item.name}</Link>
                        <span className="co-menu-price">${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                      <div className="co-counter">
                        <button onClick={() => setExtraCount(id, Math.max(0, count-1))} disabled={count===0}><Minus size={13}/></button>
                        <span>{count}</span>
                        <button onClick={() => setExtraCount(id, count+1)}><Plus size={13}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* 7 — DRINKS */}
          <Section id="drinks" title="Drink" icon="🥤"
            badge={badges.drinks} open={open.has('drinks')} onToggle={toggleSection}>
            {drinks.length === 0 ? (
              <p className="co-empty-msg">Drinks will appear here once the menu is loaded.</p>
            ) : (
              <div className="co-menu-grid">
                {drinks.map(item => {
                  const id    = String(item._id ?? item.id);
                  const count = cfg.drinks[id] || 0;
                  return (
                    <div key={id} className="co-menu-card">
                      {item.img && <img src={item.img} alt={item.name} className="co-menu-img" />}
                      <div className="co-menu-info">
                        <Link to={`/menu/item/${id}`} className="co-menu-name">{item.name}</Link>
                        <span className="co-menu-price">${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                      <div className="co-counter">
                        <button onClick={() => setDrinkCount(id, Math.max(0, count-1))} disabled={count===0}><Minus size={13}/></button>
                        <span>{count}</span>
                        <button onClick={() => setDrinkCount(id, count+1)}><Plus size={13}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

        </main>
      </div>

      {/* ── Sticky cart strip (same as Menu page) ── */}
      {cartItems.length > 0 && (
        <div className="menu-cart-strip">
          <div className="menu-cart-strip-left">
            <ShoppingBag size={16} />
            <span className="menu-cart-count">
              {cartItems.reduce((s, c) => s + c.qty, 0)} items
            </span>
            <span className="menu-cart-names">
              {cartItems.slice(0, 2).map(ci => ci.name).join(', ')}
              {cartItems.length > 2 && ` +${cartItems.length - 2} more`}
            </span>
          </div>
          <Link to="/checkout" className="menu-cart-strip-btn">
            View Cart · ${subtotal.toFixed(2)}
          </Link>
        </div>
      )}

      {/* ── Sticky mobile footer ── */}
      <div className="co-mobile-footer">
        <div className="co-mobile-total">
          <span>Total</span>
          <strong className={totalFlash ? 'co-price-flash' : ''}>${total.toFixed(2)}</strong>
        </div>
        {cfg.base && (
          <div className="co-qty-row co-qty-row-mobile">
            <button className="co-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}><Minus size={13}/></button>
            <span className="co-qty-val">{qty}</span>
            <button className="co-qty-btn" onClick={() => setQty(q => Math.min(20, q + 1))}><Plus size={13}/></button>
          </div>
        )}
        <button className="co-add-btn co-add-btn-mobile" onClick={handleAdd} disabled={!cfg.base || added}>
          {added ? <><Check size={15}/> Added!</> : <><ShoppingBag size={15}/> {qty > 1 ? `Add ${qty}` : 'Add to Cart'}</>}
        </button>
      </div>

    </div>
  );
}
