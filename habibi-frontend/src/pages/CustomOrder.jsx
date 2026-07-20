import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Minus, ChevronDown, Info, ShoppingBag, Check, Bookmark, Trash2, Camera } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { useCart } from '../context/CartContext';
import { menuAPI, savedCustomAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import './CustomOrder.css';

/* ================================================================
   DATA DEFINITIONS
   ================================================================ */

const BASES = [
  { id: '39a', label: 'Hero',        price: 1.99, img: '/images/byo/bases/39a.webp', family: 'hero' },
  { id: '39b', label: 'Wrap',        price: 1.99, img: '/images/byo/bases/39b.webp', family: 'wrap',       note: 'Habibi Special Wrap' },
  { id: '39c', label: 'Pita Bread',  price: 1.99, img: '/images/byo/bases/39c.webp', family: 'wrap' },
  { id: '39d', label: 'Croissant',   price: 1.99, img: '/images/byo/bases/39d.webp', family: 'compact' },
  { id: '39e', label: 'Bagel',       price: 1.99, img: '/images/byo/bases/39e.webp', family: 'standard' },
  { id: '39f', label: 'Roll',        price: 1.49, img: '/images/byo/bases/39f.webp', family: 'standard' },
  { id: '39g', label: 'Burger Bun',  price: 1.99, img: '/images/byo/bases/39g.webp', family: 'standard' },
  { id: '39h', label: 'Hot Dog Bun', price: 0.99, img: '/images/byo/bases/39h.webp', family: 'compact' },
  { id: '39i', label: 'Platter',     price: 2.99, img: '/images/byo/bases/39i.webp', family: 'platter',    rim: '/images/byo/bases/39i-rim.webp' },
  { id: '39j', label: 'Family Tray', price: 4.99, img: '/images/byo/bases/39j.webp', family: 'familyTray', rim: '/images/byo/bases/39j-rim.webp' },
];

const CHEESE_OPTS = [
  { id: 'none',          label: 'No Cheese',      price: 0,    emoji: '⬜', default: true },
  { id: 'american',      label: 'American Cheese', price: 1.00, emoji: '🧀', img: '/images/byo/ing/american-cheese.webp'  },
  { id: 'butter',        label: 'Butter',          price: 2.00, emoji: '🫙', img: '/images/byo/ing/butter2.webp'           },
  { id: 'liquid_cheese', label: 'Cream Cheese',    price: 1.50, emoji: '🫕', img: '/images/byo/ing/liquid-cheese.webp'   },
];

const VEG_OPTS = [
  { id: 'onions',    label: 'Onions',        price: 0.50, emoji: '🧅', img: '/images/byo/ing/onion2.webp'    },
  { id: 'peppers',   label: 'Green Peppers', price: 0.50, emoji: '🌿', img: '/images/byo/ing/pepper.webp'   },
  { id: 'cucumbers', label: 'Cucumbers',     price: 0.50, emoji: '🥒', img: '/images/byo/ing/cucumber2.webp' },
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
  chicken:          { zone:'protein', src:'/images/byo/ing/chicken-broasted.webp',          z:4, hotDogPos:[{x:50,y:66,w:39}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:44}], hero:[{x:50,y:44,w:45}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  'lamb-gyro':      { zone:'protein', src:'/images/byo/ing/lamb-gyro.webp',        z:4, hotDogPos:[{x:31,y:50,w:56}], pos:{ familyTray:[{x:50,y:43,w:44}], platter:[{x:50,y:43,w:46}], hero:[{x:50,y:27,w:28}], standard:[{x:50,y:43,w:30}], compact:[{x:50,y:43,w:66}], wrap:[{x:50,y:43,w:74}] } },
  mix:              { zone:'protein', src:'/images/byo/ing/mix.webp',               z:4, hotDogPos:[{x:50,y:70,w:42}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:44}], hero:[{x:50,y:37,w:48}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  hotdog:           { zone:'protein', src:'/images/byo/ing/hotdog.webp',            z:4, hotDogPos:[{x:50,y:43,w:74}], pos:{ familyTray:[{x:50,y:44,w:46}], platter:[{x:50,y:44,w:50}], hero:[{x:50,y:43,w:82}], standard:[{x:50,y:43,w:64}], compact:[{x:50,y:43,w:68}], wrap:[{x:50,y:43,w:74}] } },
  bacon:            { zone:'protein', src:'/images/byo/ing/bacon.webp',             z:4, hotDogPos:[{x:42,y:70,w:28},{x:58,y:70,w:29}], pos:{ familyTray:[{x:36,y:44,w:18},{x:64,y:44,w:18}], platter:[{x:35,y:44,w:24},{x:65,y:44,w:24}], hero:[{x:32,y:40,w:29},{x:68,y:40,w:31}], standard:[{x:36,y:44,w:30},{x:64,y:44,w:30}], compact:[{x:36,y:44,w:30},{x:64,y:44,w:30}], wrap:[{x:34,y:44,w:36},{x:66,y:44,w:36}] } },
  'hot-sausage':    { zone:'protein', src:'/images/byo/ing/hot-sausage.webp',      z:4, showAsideWhen:'hotdog', hotDogPos:[{x:50,y:70,w:49}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:46}], hero:[{x:50,y:40,w:64}], standard:[{x:50,y:44,w:62}], compact:[{x:50,y:44,w:65}], wrap:[{x:50,y:44,w:72}] } },
  'italian-sausage':{ zone:'protein', src:'/images/byo/ing/italian-sausage.webp',  z:4, hotDogPos:[{x:50,y:70,w:46}], pos:{ familyTray:[{x:50,y:44,w:46}], platter:[{x:50,y:44,w:50}], hero:[{x:50,y:35,w:65}], standard:[{x:50,y:44,w:64}], compact:[{x:50,y:44,w:66}], wrap:[{x:50,y:44,w:74}] } },
  turkey:           { zone:'protein', src:'/images/byo/ing/turkey.webp',            z:4, showAsideWhen:'bread', hotDogPos:[{x:50,y:70,w:60}], pos:{ familyTray:[{x:50,y:44,w:40}], platter:[{x:50,y:44,w:40}], hero:[{x:50,y:44,w:70}], standard:[{x:50,y:44,w:60}], compact:[{x:50,y:44,w:63}], wrap:[{x:50,y:44,w:68}] } },
  'chicken-kabab':  { zone:'protein', src:'/images/byo/ing/chicken-kabab.webp',    z:4, pos:{ familyTray:[{x:34,y:44,w:22},{x:66,y:44,w:22}], platter:[{x:32,y:44,w:28},{x:68,y:44,w:28}], hero:[{x:28,y:44,w:44},{x:72,y:44,w:44}], standard:[{x:36,y:44,w:36},{x:64,y:44,w:36}], compact:[{x:36,y:44,w:34},{x:64,y:44,w:34}], wrap:[{x:30,y:44,w:42},{x:70,y:44,w:42}] } },
  'beef-kabab':     { zone:'protein', src:'/images/byo/ing/beef-kabab.webp',       z:4, pos:{ familyTray:[{x:34,y:44,w:22},{x:66,y:44,w:22}], platter:[{x:32,y:44,w:28},{x:68,y:44,w:28}], hero:[{x:28,y:44,w:44},{x:72,y:44,w:44}], standard:[{x:36,y:44,w:36},{x:64,y:44,w:36}], compact:[{x:36,y:44,w:34},{x:64,y:44,w:34}], wrap:[{x:30,y:44,w:42},{x:70,y:44,w:42}] } },
  'philly-steak':   { zone:'protein', src:'/images/byo/ing/philly-steak.webp',     z:4, showAsideWhen:'burger', hotDogPos:[{x:50,y:70,w:60}], pos:{ familyTray:[{x:50,y:44,w:42}], platter:[{x:50,y:44,w:42}], hero:[{x:33,y:39,w:29}], standard:[{x:50,y:44,w:60}], compact:[{x:50,y:44,w:62}], wrap:[{x:50,y:44,w:68}] } },
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
  lettuce:  { zone:'veg', src:'/images/byo/ing/lettuce.webp',  z:2, hotDogPos:[{x:50,y:50,w:71}], pos:{ familyTray:[{x:70,y:53,w:50}], platter:[{x:75,y:53,w:35}], hero:[{x:51,y:50,w:65,peekY:39}], standard:[{x:50,y:44,w:68}], compact:[{x:50,y:52,w:70}], wrap:[{x:50,y:44,w:84}] } },
  /* Rice: square yellow basmati for flat trays; platter uses same dense image, bread bases use elongated pile */
  rice:     { zone:'rice', src:'/images/byo/ing/rice.webp',
    srcByFamily: { familyTray:'/images/byo/ing/rice-tray.webp', platter:'/images/byo/ing/rice-tray.webp' },
    z:2, pos:{ familyTray:[{x:33,y:50,w:50}], platter:[{x:50,y:50,w:22}], hero:[{x:50,y:54,w:62}], standard:[{x:50,y:54,w:50}], compact:[{x:50,y:54,w:48}], wrap:[{x:50,y:54,w:60}] } },
  /* Onions: ~2" slice — fewer, centred for compact round bases */
  onions:   { zone:'veg', src:'/images/byo/ing/onion2.webp',    z:5, hotDogPos:[{x:30,y:44,w:31},{x:44,y:40,w:32}], pos:{
    familyTray:[{x:16,y:43,w:10},{x:34,y:48,w:10},{x:52,y:42,w:10},{x:73,y:61,w:15},{x:79,y:48,w:18}],
    platter:   [{x:22,y:59,w:12},{x:40,y:64,w:12},{x:58,y:58,w:11},{x:76,y:64,w:11}],
    hero:      [{x:40,y:44,w:29},{x:59,y:45,w:35}],
    standard:  [{x:33,y:44,w:18},{x:72,y:45,w:18},{x:52,y:42,w:18}],
    compact:   [{x:33,y:44,w:20},{x:72,y:45,w:19},{x:52,y:42,w:18}],
    wrap:      [{x:16,y:44,w:20},{x:40,y:40,w:18},{x:53,y:30,w:45},{x:82,y:41,w:18}],
  } },
  /* Peppers: ~2" slice */
  peppers:  { zone:'veg', src:'/images/byo/ing/pepper.webp',   z:5, hotDogPos:[{x:28,y:64,w:20}], pos:{
    familyTray:[{x:14,y:49,w:9},{x:30,y:45,w:9},{x:48,y:50,w:9},{x:66,y:45,w:9},{x:82,y:50,w:8}],
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

/* ── Remap x AND w into a zone (used for vegetables, rice) ── */
function remapZone(pos, zoneMin, zoneMax) {
  const zW = zoneMax - zoneMin;
  const newX = zoneMin + (pos.x / 100) * zW;
  const newW = Math.round(pos.w * zW / 100);
  return { ...pos, x: Math.round(newX), w: Math.max(6, newW) };
}

/* ── Remap x only, keep original w (used for proteins) ───── */
function remapZoneX(pos, zoneMin, zoneMax) {
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
  const zW   = zMax - zMin;
  const w    = Math.min(pos.w, maxW, Math.round(zW * 0.92));
  const half = w / 2;
  const x    = Math.max(zMin + half, Math.min(zMax - half, pos.x));
  return { ...pos, x: Math.round(x), w: Math.round(w) };
}


/* ── Top-down food-photography canvas ─────────────────────────── */
function IngCanvas({ base, cfg, onReset }) {
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
  const pushItem = (id, def, rawPositions, src, zone) => {
    rawPositions.forEach(pos => {
      const zPos = isFlatBase
        ? remapZoneX(pos, zone[0], zone[1])
        : remapZone(pos, zone[0], zone[1]);
      const cPos = clampIngPos(zPos, zone[0], zone[1], bounds.maxW);
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
    const protOpt = PROTEIN_OPTS.find(p => p.id === id);
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
      const scaledPos = { ...pos, w: Math.round(pos.w * dup.wScale) };
      const cPos = clampIngPos(remapZoneX(scaledPos, PROT_ZONE[0], PROT_ZONE[1]), PROT_ZONE[0], PROT_ZONE[1], bounds.maxW);
      layers.push({ id, def, src, pos: cPos });
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
    pushItem(id, def, rawPos.map(p => ({ ...p, w: Math.round(p.w * wScale) })), def.src, VEG_ZONE);
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
          const scaledPos = { ...pos, w: Math.round(pos.w * wScale) };
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
    .map(([id]) => SAUCE_OPTS.find(o => o.id === id)).filter(Boolean);
  const onSideSauces  = Object.entries(cfg.sauces).filter(([,s]) => s.placement === 'on_side')
    .map(([id]) => SAUCE_OPTS.find(o => o.id === id)).filter(Boolean);

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
                    top: isHotDog
                      ? `${pos.y}%`
                      : `${isSplitBun ? Math.min(pos.y + splitBunYShift, 82) : pos.y}%`,
                    width: `${isHotDog ? pos.w : bounds.noWiden ? pos.w : def.zone === 'cheese' ? pos.w : Math.round(pos.w * ingWidthScale)}%`,
                    zIndex: def.z || 2,
                    opacity: def.zone === 'cheese' ? cheeseOpacity : 1,
                    '--ing-rot':   pos.rot
                      ? `${pos.rot}deg`
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
                        const label = PROTEIN_OPTS.find(p => p.id === id)?.label || id;
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
            {price != null && <span className="co-qty-pill-price">${price.toFixed(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible section ─────────────────────────────────────── */
function Section({ id, title, icon, badge, open, onToggle, children }) {
  return (
    <div id={`co-sec-${id}`} className={`co-section${open ? ' open' : ''}${badge > 0 ? ' completed' : ''}`}>
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
   BASE-CONTEXTUAL SUGGESTIONS
   Shown once a base is picked and before any protein is chosen —
   a targeted "fill it in for me" nudge for that specific base.
   ================================================================ */
const BASE_SUGGESTIONS = {
  '39a': { label: 'Chicken + Cheese + Veggies + White Sauce',       proteins: ['chicken'],               cheese: 'american',      veg: ['onions', 'lettuce', 'tomatoes'], sauces: ['white'] },
  '39b': { label: 'Lamb Gyro + Veggies + Hot Sauce',                proteins: ['lamb-gyro'],              cheese: null,             veg: ['onions', 'tomatoes'],            sauces: ['hot'] },
  '39c': { label: 'Falafel + Veggies + Green Sauce',                proteins: ['falafel'],                cheese: null,             veg: ['lettuce', 'cucumbers', 'tomatoes'], sauces: ['green'] },
  '39d': { label: 'Egg & Cheese Croissant',                         proteins: ['egg-scrambled'],          cheese: 'american',      veg: [],                                 sauces: [] },
  '39e': { label: 'Bacon, Egg & Cream Cheese Bagel',                proteins: ['bacon', 'egg-fried'],      cheese: 'liquid_cheese', veg: [],                                 sauces: [] },
  '39f': { label: 'Chicken Shish Kabab + Veggies + White Sauce',    proteins: ['chicken-kabab'],          cheese: null,             veg: ['onions', 'peppers'],             sauces: ['white'] },
  '39g': { label: 'Beef Berger + Cheese + Veggies + Ketchup',       proteins: ['beef-burger'],            cheese: 'american',      veg: ['lettuce', 'tomatoes', 'onions'], sauces: ['ketchup'] },
  '39h': { label: 'Hot Dog + Onions + Mustard',                     proteins: ['hotdog'],                 cheese: null,             veg: ['onions'],                        sauces: ['mustard'] },
  '39i': { label: 'Mix + Rice + White & Hot Sauce',                 proteins: ['mix'],                    cheese: null,             veg: ['rice', 'lettuce', 'tomatoes'],   sauces: ['white', 'hot'] },
  '39j': { label: 'Mix + Rice + Veggies + White & Hot Sauce',       proteins: ['mix'],                    cheese: null,             veg: ['rice', 'onions', 'peppers'],     sauces: ['white', 'hot'] },
};

/* ── Fisher-Yates shuffle ─────────────────────────────────────── */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function defaultQtyFor(protein) {
  if (protein.qtyType === 'eggs') return 1;
  if (protein.qtyType === 'single-double' || protein.qtyType === 'single-triple') return 'single';
  return 'regular';
}

/* ================================================================
   STEP PROGRESS
   ================================================================ */
const PROGRESS_STEPS = [
  { id: 'base',       label: 'Base',    icon: '🍞' },
  { id: 'proteins',   label: 'Protein', icon: '🥩' },
  { id: 'vegetables', label: 'Veggies', icon: '🥗' },
  { id: 'sauces',     label: 'Sauces',  icon: '🫙' },
  { id: 'cart',       label: 'Cart',    icon: '🛒' },
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
  instructions: '', // free-text special instructions
};

const INSTRUCTIONS_MAX = 200;

export default function CustomOrder() {
  const { addItem, removeItem, items: cartItems, subtotal } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const [cfg, setCfg]         = useState(() => location.state?.editCustom?.cfg || INIT);
  const [editingCustomCartKey, setEditingCustomCartKey] = useState(() => location.state?.editCustom?.cartKey || null);
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
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

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

  /* Surprise Me — random base + protein + 2 veg + sauce, respecting active diet filters */
  const [rollAnim, setRollAnim] = useState(false);
  const randomizeOrder = () => {
    const base = BASES[Math.floor(Math.random() * BASES.length)];

    const proteinPool = PROTEIN_OPTS.filter(p => !isProteinExcluded(p.id));
    const protein = proteinPool[Math.floor(Math.random() * proteinPool.length)];

    const vegPicks = shuffleArray(VEG_OPTS).slice(0, 2);

    const saucePool = SAUCE_OPTS.filter(s => !isSauceExcluded(s.id));
    const sauce = saucePool[Math.floor(Math.random() * saucePool.length)];

    setCfg({
      ...INIT,
      base,
      proteins:   protein ? { [protein.id]: { qty: defaultQtyFor(protein), placement: 'on_food' } } : {},
      vegetables: Object.fromEntries(vegPicks.map(v => [v.id, { qty: 'regular' }])),
      sauces:     sauce   ? { [sauce.id]: { placement: 'on_food', qty: 'regular', count: 1 } } : {},
    });
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
    setWarnProtein(false);
    setQty(1);
    setShowBreakdown(false);

    setRollAnim(true);
    setTimeout(() => setRollAnim(false), 500);
  };

  /* Apply the base-contextual suggestion — fills protein/cheese/veg/sauce in one click */
  const applyBaseSuggestion = () => {
    const sugg = cfg.base && BASE_SUGGESTIONS[cfg.base.id];
    if (!sugg) return;
    setCfg(p => ({
      ...p,
      proteins: Object.fromEntries(sugg.proteins.map(id => {
        const opt = PROTEIN_OPTS.find(x => x.id === id);
        return [id, { qty: defaultQtyFor(opt), placement: 'on_food' }];
      })),
      cheese:     sugg.cheese ? { type: sugg.cheese, qty: 'regular' } : p.cheese,
      vegetables: Object.fromEntries(sugg.veg.map(id => [id, { qty: 'regular' }])),
      sauces:     Object.fromEntries(sugg.sauces.map(id => [id, { placement: 'on_food', qty: 'regular', count: 1 }])),
    }));
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
    setDismissedSuggestion(true);
  };

  const handleReset = () => {
    setCfg(INIT);
    setOpen(new Set(['base']));
    setQty(1);
    setWarnProtein(false);
    setShowBreakdown(false);
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
    setDismissedSuggestion(false);
    /* Auto-advance: guide the user to the next step in the flow */
    setTimeout(() => {
      document.getElementById('co-sec-proteins')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
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
    v[id] ? delete v[id] : (v[id] = { qty: pr?.qtyType === 'eggs' ? 1 : pr?.qtyType === 'single-double' || pr?.qtyType === 'single-triple' ? 'single' : 'regular', placement: 'on_food' });
    return { ...p, proteins: v };
  });
  const setProteinQty = (id, qty) => setCfg(p => ({
    ...p, proteins: { ...p.proteins, [id]: { ...p.proteins[id], qty } }
  }));
  const setProteinPlacement = (id, placement) => setCfg(p => ({
    ...p, proteins: { ...p.proteins, [id]: { ...p.proteins[id], placement } }
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
  const setInstructions = text => setCfg(p => ({ ...p, instructions: text.slice(0, INSTRUCTIONS_MAX) }));

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
    if (cfg.instructions?.trim()) parts.push(`Note: ${cfg.instructions.trim()}`);
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

    if (editingCustomCartKey) removeItem(editingCustomCartKey);

    addItem({
      id:            `custom-${cfg.base.id}-${Date.now()}`,
      name:          cfg.base.id === '39e' ? `Custom ${cfg.bagelType} Bagel` : `Custom ${cfg.base.label}`,
      price:         total,
      baseItemPrice: Math.max(0, total - addonsTotal),
      note:          buildNote(),
      img:           cfg.base.img,
      customLayers,
      customCfg:     cfg,
      addons,
      qty,
    });

    setEditingCustomCartKey(null);
    /* Reset form so the user can immediately build another order */
    setCfg(INIT);
    setOpen(new Set(['base']));
    setWarnProtein(false);
    setQty(1);
    setShowBreakdown(false);

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

  /* Step progress strip — completion + active step + jump-to-section */
  const stepDone = {
    base:       !!cfg.base,
    proteins:   badges.proteins > 0,
    vegetables: badges.vegetables > 0,
    sauces:     badges.sauces > 0,
    cart:       added,
  };
  const activeStepId = ['base', 'proteins', 'vegetables', 'sauces'].find(id => !stepDone[id]) || 'cart';

  /* Base multipliers — reused by qty-pill price labels below */
  const mult = getBaseMultipliers(cfg.base);

  /* Base-contextual suggestion — only before the user has picked a protein */
  const baseSuggestion = cfg.base ? BASE_SUGGESTIONS[cfg.base.id] : null;
  const showBaseSuggestion = !!baseSuggestion && !dismissedSuggestion && !stepDone.proteins;

  const jumpToStep = stepId => {
    if (stepId === 'cart') {
      const isDesktop = window.matchMedia('(min-width: 860px)').matches;
      if (isDesktop) {
        document.querySelector('.co-price-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    setOpen(prev => { const n = new Set(prev); n.add(stepId); return n; });
    setTimeout(() => {
      document.getElementById(`co-sec-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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

            {/* Price breakdown — always visible, itemised as you build */}
            {breakdown.length > 0 && (
              <div className="co-breakdown">
                <span className="co-breakdown-heading">Price breakdown</span>
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
              </div>
            )}

            {/* Special instructions */}
            {cfg.base && (
              <div className="co-instructions">
                <label className="co-instructions-label" htmlFor="co-instructions-input">
                  Special instructions <span className="co-instructions-optional">(optional)</span>
                </label>
                <textarea
                  id="co-instructions-input"
                  className="co-instructions-input"
                  placeholder="e.g. no onions on one, extra crispy, nut allergy…"
                  value={cfg.instructions || ''}
                  maxLength={INSTRUCTIONS_MAX}
                  onChange={e => setInstructions(e.target.value)}
                  rows={2}
                />
                <span className="co-instructions-count">{(cfg.instructions || '').length}/{INSTRUCTIONS_MAX}</span>
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
                ? <><Check size={16} /> {editingCustomCartKey ? 'Updated!' : 'Added!'}</>
                : <><ShoppingBag size={16} /> {editingCustomCartKey ? 'Update Order' : qty > 1 ? `Add ${qty} to Cart` : 'Add to Cart'}</>
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

          {/* ── Step progress ── */}
          <div className="co-progress-strip">
            {PROGRESS_STEPS.map((step, i) => (
              <React.Fragment key={step.id}>
                {i > 0 && (
                  <div className={`co-progress-line${stepDone[PROGRESS_STEPS[i - 1].id] ? ' filled' : ''}`} />
                )}
                <button
                  type="button"
                  className={`co-progress-node${stepDone[step.id] ? ' done' : ''}${activeStepId === step.id ? ' active' : ''}`}
                  onClick={() => jumpToStep(step.id)}
                >
                  <span className="co-progress-icon">{stepDone[step.id] ? <Check size={15} /> : step.icon}</span>
                  <span className="co-progress-label">{step.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>

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
            <div className="co-presets-header">
              <p className="co-presets-label">⭐ Staff Picks, tap to pre-fill</p>
              <button
                type="button"
                className={`co-randomize-btn${rollAnim ? ' rolling' : ''}`}
                onClick={randomizeOrder}
              >
                🎲 Surprise Me
              </button>
            </div>
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
                        formatPrice={qty => veg.price * (VEG_QTY_MULT[qty] || 1) * mult.veg}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 4 — PROTEIN */}
          <Section id="proteins" title="Protein (All Halal)" icon="🥩"
            badge={badges.proteins} open={open.has('proteins')} onToggle={toggleSection}>
            {showBaseSuggestion && (
              <div className="co-suggestion">
                <span className="co-suggestion-icon">💡</span>
                <div className="co-suggestion-body">
                  <span className="co-suggestion-eyebrow">Try with {cfg.base.label}</span>
                  <span className="co-suggestion-text">{baseSuggestion.label}</span>
                </div>
                <button type="button" className="co-suggestion-apply" onClick={applyBaseSuggestion}>
                  Fill it in
                </button>
                <button type="button" className="co-suggestion-dismiss" onClick={() => setDismissedSuggestion(true)} aria-label="Dismiss suggestion">
                  ✕
                </button>
              </div>
            )}
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
                    {sel && !CO_ING_DB[prot.id]?.showAsideWhen && (
                      <div className="co-placement-row">
                        {['on_food', 'on_side'].map(p => (
                          <button
                            key={p}
                            className={`co-placement-btn${(sel.placement || 'on_food') === p ? ' active' : ''}`}
                            onClick={() => setProteinPlacement(prot.id, p)}
                          >
                            {p === 'on_food' ? 'On Food' : 'On Side'}
                          </button>
                        ))}
                      </div>
                    )}
                    {sel && (
                      <QtyPills
                        opts={prot.qtyType === 'eggs' ? QTY_OPTS.eggs : QTY_OPTS[prot.qtyType]}
                        value={sel.qty}
                        onChange={qty => setProteinQty(prot.id, qty)}
                        formatPrice={qty => calcProteinPrice(prot, qty) * (PROTEIN_BASE_TIERED.has(prot.id) ? mult.protein : 1)}
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
                            formatPrice={qty => sauce.price * (SAUCE_FOOD_MULT[qty] || 1)}
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
        {showBreakdown && breakdown.length > 0 && (
          <div className="co-mobile-breakdown">
            <div className="co-mobile-breakdown-list">
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
          </div>
        )}
        <button
          type="button"
          className="co-mobile-total"
          onClick={() => setShowBreakdown(p => !p)}
          disabled={breakdown.length === 0}
          aria-expanded={showBreakdown}
        >
          <span>Total {breakdown.length > 0 && (showBreakdown ? '▾' : '▴')}</span>
          <strong className={totalFlash ? 'co-price-flash' : ''}>${total.toFixed(2)}</strong>
        </button>
        {cfg.base && (
          <div className="co-qty-row co-qty-row-mobile">
            <button className="co-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}><Minus size={13}/></button>
            <span className="co-qty-val">{qty}</span>
            <button className="co-qty-btn" onClick={() => setQty(q => Math.min(20, q + 1))}><Plus size={13}/></button>
          </div>
        )}
        <button className="co-add-btn co-add-btn-mobile" onClick={handleAdd} disabled={!cfg.base || added}>
          {added ? <><Check size={15}/> {editingCustomCartKey ? 'Updated!' : 'Added!'}</> : <><ShoppingBag size={15}/> {editingCustomCartKey ? 'Update Order' : qty > 1 ? `Add ${qty}` : 'Add to Cart'}</>}
        </button>
      </div>

    </div>
  );
}
