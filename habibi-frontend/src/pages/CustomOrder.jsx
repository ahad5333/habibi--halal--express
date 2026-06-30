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
  { id: 'rice',      label: 'Rice',          price: 2.00, emoji: '🍚', img: '/images/byo/ing/rice.webp', note: 'Basmati rice' },
];

/* qtyType determines which quantity selector is shown:
   'low-extra'     → Low / Regular / Extra / Double
   'eggs'          → 1 / 2 / 3 / 4 eggs  ($1 each)
   'single-double' → Single / Double
   'single-triple' → Single / Double / Triple               */
const PROTEIN_OPTS = [
  { id: 'egg-fried',       label: 'Egg (Fried)',           price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-fried.webp'       },
  { id: 'egg-scrambled',   label: 'Egg (Scrambled)',        price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-scrambled.webp'   },
  { id: 'chicken',         label: 'Chicken (Grilled)',      price: 6.00, qtyType: 'low-extra',     emoji: '🍗', img: '/images/byo/ing/chicken.webp',  note: 'Grilled cubes w/ onions & peppers' },
  { id: 'lamb-gyro',       label: 'Lamb Gyro',             price: 6.00, qtyType: 'low-extra',     emoji: '🥩', img: '/images/byo/ing/lamb-gyro.webp'       },
  { id: 'mix',             label: 'Mix (Chicken + Gyro)',  price: 7.00, qtyType: 'low-extra',     emoji: '🍖', img: '/images/byo/ing/mix.webp',      note: 'Half chicken, half lamb gyro' },
  { id: 'hotdog',          label: 'Hot Dog',               price: 2.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hotdog.webp'           },
  { id: 'bacon',           label: 'Bacon',                 price: 3.00, qtyType: 'low-extra',     emoji: '🥓', img: '/images/byo/ing/bacon.webp',    note: 'Beef bacon, halal' },
  { id: 'hot-sausage',     label: 'Hot Sausage',           price: 3.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hot-sausage.webp'     },
  { id: 'italian-sausage', label: 'Italian Sausage',       price: 6.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/italian-sausage.webp' },
  { id: 'turkey',          label: 'Turkey',                price: 6.00, qtyType: 'low-extra',     emoji: '🦃', img: '/images/byo/ing/turkey.webp',   note: 'Plain turkey slices' },
  { id: 'chicken-kabab',   label: 'Chicken Shish Kabab',   price: 3.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/chicken-kabab.webp'   },
  { id: 'beef-kabab',      label: 'Beef Shish Kabab',      price: 4.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/beef-kabab.webp'      },
  { id: 'philly-steak',    label: 'Philly Steak',          price: 6.00, qtyType: 'single-double', emoji: '🥩', img: '/images/byo/ing/philly-steak.webp'    },
  { id: 'falafel',         label: 'Falafel',               price: 6.00, qtyType: 'low-extra',     emoji: '🧆', img: '/images/byo/ing/falafel.webp',  note: 'Low=3 balls, Regular=6, Extra=9, Double=12' },
  { id: 'fish-fillet',     label: 'Fish Fillet',           price: 7.00, qtyType: 'single-double', emoji: '🐟', img: '/images/byo/ing/fish-fillet.webp'     },
  { id: 'shrimp',          label: 'Shrimp',                price: 8.00, qtyType: 'low-extra',     emoji: '🍤', img: '/images/byo/ing/shrimp.webp'          },
  { id: 'tuna',            label: 'Tuna Fish',             price: 7.00, qtyType: 'low-extra',     emoji: '🐠', img: '/images/byo/ing/tuna.webp'            },
  { id: 'beef-burger',     label: 'Beef Burger',           price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/beef-burger.webp'     },
  { id: 'chicken-burger',  label: 'Chicken Burger',        price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/chicken-burger.webp'  },
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
   INGREDIENT MEDALLION DATABASE  (CustomOrder — full ingredient set)
   shape: 'circle' | 'rect' | 'wide' | 'sauce'
   pos[family]: [{x, y, w, rot?, ar?}]  (x/y/w in % of canvas)
   ================================================================ */
const CO_ING_DB = {
  /* ── Proteins ──────────────────────────────────────────────── */
  chicken: {
    src: '/images/byo/ing/chicken.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:34,y:54,w:15},{x:57,y:53,w:15}], standard:[{x:48,y:53,w:19}],
      compact:[{x:48,y:55,w:16}], wrap:[{x:46,y:53,w:17}],
      platter:[{x:62,y:53,w:19}], familyTray:[{x:55,y:52,w:15},{x:67,y:53,w:15}],
    }
  },
  'lamb-gyro': {
    src: '/images/byo/ing/lamb-gyro.webp', layer: 4, shape: 'rect', ar:'3/2',
    pos: {
      hero:[{x:33,y:53,w:16,rot:-8},{x:55,y:52,w:16,rot:6}], standard:[{x:47,y:52,w:22,rot:-4}],
      compact:[{x:47,y:54,w:19,rot:-3}], wrap:[{x:45,y:52,w:20,rot:-3}],
      platter:[{x:61,y:52,w:22}], familyTray:[{x:55,y:52,w:18,rot:-5},{x:67,y:52,w:18,rot:5}],
    }
  },
  mix: {
    src: '/images/byo/ing/mix.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:34,y:54,w:15},{x:57,y:53,w:15}], standard:[{x:48,y:53,w:19}],
      compact:[{x:48,y:55,w:16}], wrap:[{x:46,y:53,w:17}],
      platter:[{x:62,y:53,w:19}], familyTray:[{x:55,y:52,w:15},{x:67,y:53,w:15}],
    }
  },
  hotdog: {
    src: '/images/byo/ing/hotdog.webp', layer: 5, shape: 'rect', ar:'5/2',
    pos: {
      hero:[{x:50,y:52,w:48}], standard:[{x:48,y:53,w:30}],
      compact:[{x:48,y:55,w:26}], wrap:[{x:47,y:52,w:24,rot:78}],
      platter:[{x:63,y:52,w:28}], familyTray:[{x:57,y:52,w:24},{x:71,y:52,w:24}],
    }
  },
  falafel: {
    src: '/images/byo/ing/falafel.webp', layer: 5, shape: 'circle',
    pos: {
      hero:[{x:30,y:52,w:9},{x:44,y:51,w:9},{x:58,y:52,w:9}], standard:[{x:40,y:52,w:11},{x:56,y:52,w:11}],
      compact:[{x:42,y:54,w:10},{x:55,y:54,w:10}], wrap:[{x:41,y:52,w:10},{x:54,y:52,w:10}],
      platter:[{x:58,y:52,w:10},{x:68,y:52,w:10},{x:76,y:52,w:10}], familyTray:[{x:53,y:52,w:9},{x:62,y:52,w:9},{x:71,y:52,w:9}],
    }
  },
  'egg-fried': {
    src: '/images/byo/ing/egg-fried.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:36,y:53,w:13},{x:56,y:53,w:13}], standard:[{x:48,y:53,w:16}],
      compact:[{x:48,y:55,w:14}], wrap:[{x:46,y:53,w:15}],
      platter:[{x:62,y:53,w:16}], familyTray:[{x:56,y:53,w:14},{x:68,y:53,w:14}],
    }
  },
  'egg-scrambled': {
    src: '/images/byo/ing/egg-scrambled.webp', layer: 4, shape: 'wide', ar:'3/2',
    pos: {
      hero:[{x:38,y:53,w:18},{x:58,y:53,w:18}], standard:[{x:48,y:53,w:22}],
      compact:[{x:48,y:55,w:18}], wrap:[{x:46,y:53,w:20}],
      platter:[{x:62,y:53,w:22}], familyTray:[{x:57,y:53,w:18},{x:69,y:53,w:18}],
    }
  },
  bacon: {
    src: '/images/byo/ing/bacon.webp', layer: 4, shape: 'rect', ar:'4/1',
    pos: {
      hero:[{x:50,y:52,w:44,rot:2},{x:50,y:56,w:44,rot:-2}], standard:[{x:48,y:52,w:28,rot:2}],
      compact:[{x:48,y:54,w:24,rot:2}], wrap:[{x:46,y:52,w:26,rot:2}],
      platter:[{x:62,y:52,w:26}], familyTray:[{x:58,y:52,w:22,rot:2},{x:70,y:52,w:22,rot:-2}],
    }
  },
  'hot-sausage': {
    src: '/images/byo/ing/hot-sausage.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:33,y:53,w:14},{x:55,y:53,w:14}], standard:[{x:48,y:53,w:17}],
      compact:[{x:48,y:55,w:14}], wrap:[{x:46,y:53,w:16}],
      platter:[{x:62,y:53,w:17}], familyTray:[{x:56,y:53,w:14},{x:68,y:53,w:14}],
    }
  },
  'italian-sausage': {
    src: '/images/byo/ing/italian-sausage.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:33,y:53,w:14},{x:55,y:53,w:14}], standard:[{x:48,y:53,w:18}],
      compact:[{x:48,y:55,w:14}], wrap:[{x:46,y:53,w:16}],
      platter:[{x:62,y:53,w:18}], familyTray:[{x:56,y:53,w:14},{x:68,y:53,w:14}],
    }
  },
  turkey: {
    src: '/images/byo/ing/turkey.webp', layer: 4, shape: 'rect', ar:'3/2',
    pos: {
      hero:[{x:34,y:53,w:16,rot:-5},{x:56,y:52,w:16,rot:4}], standard:[{x:47,y:52,w:22,rot:-3}],
      compact:[{x:47,y:54,w:18}], wrap:[{x:45,y:52,w:20}],
      platter:[{x:61,y:52,w:22}], familyTray:[{x:55,y:52,w:18},{x:67,y:52,w:18}],
    }
  },
  'chicken-kabab': {
    src: '/images/byo/ing/chicken-kabab.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:30,y:52,w:10},{x:47,y:52,w:10},{x:63,y:52,w:10}], standard:[{x:40,y:52,w:13},{x:56,y:52,w:13}],
      compact:[{x:42,y:54,w:11},{x:56,y:54,w:11}], wrap:[{x:41,y:52,w:12},{x:55,y:52,w:12}],
      platter:[{x:59,y:52,w:12},{x:69,y:52,w:12}], familyTray:[{x:54,y:52,w:10},{x:63,y:52,w:10},{x:72,y:52,w:10}],
    }
  },
  'beef-kabab': {
    src: '/images/byo/ing/beef-kabab.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:30,y:52,w:10},{x:47,y:52,w:10},{x:63,y:52,w:10}], standard:[{x:40,y:52,w:13},{x:56,y:52,w:13}],
      compact:[{x:42,y:54,w:11},{x:56,y:54,w:11}], wrap:[{x:41,y:52,w:12},{x:55,y:52,w:12}],
      platter:[{x:59,y:52,w:12},{x:69,y:52,w:12}], familyTray:[{x:54,y:52,w:10},{x:63,y:52,w:10},{x:72,y:52,w:10}],
    }
  },
  'philly-steak': {
    src: '/images/byo/ing/philly-steak.webp', layer: 4, shape: 'rect', ar:'3/2',
    pos: {
      hero:[{x:34,y:53,w:17,rot:-6},{x:57,y:52,w:17,rot:5}], standard:[{x:47,y:52,w:22,rot:-4}],
      compact:[{x:47,y:54,w:19}], wrap:[{x:45,y:52,w:20}],
      platter:[{x:61,y:52,w:22}], familyTray:[{x:55,y:52,w:18,rot:-4},{x:67,y:52,w:18,rot:4}],
    }
  },
  'fish-fillet': {
    src: '/images/byo/ing/fish-fillet.webp', layer: 4, shape: 'rect', ar:'4/2',
    pos: {
      hero:[{x:50,y:52,w:36}], standard:[{x:48,y:52,w:28}],
      compact:[{x:48,y:54,w:24}], wrap:[{x:46,y:52,w:26}],
      platter:[{x:62,y:52,w:28}], familyTray:[{x:57,y:52,w:24}],
    }
  },
  shrimp: {
    src: '/images/byo/ing/shrimp.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:29,y:52,w:9},{x:43,y:51,w:9},{x:58,y:52,w:9},{x:71,y:52,w:9}], standard:[{x:39,y:52,w:11},{x:54,y:52,w:11}],
      compact:[{x:41,y:54,w:10},{x:55,y:54,w:10}], wrap:[{x:40,y:52,w:10},{x:54,y:52,w:10}],
      platter:[{x:57,y:52,w:11},{x:66,y:52,w:11},{x:75,y:52,w:11}], familyTray:[{x:52,y:52,w:9},{x:61,y:52,w:9},{x:70,y:52,w:9}],
    }
  },
  tuna: {
    src: '/images/byo/ing/tuna.webp', layer: 4, shape: 'wide', ar:'3/2',
    pos: {
      hero:[{x:50,y:53,w:32}], standard:[{x:48,y:53,w:24}],
      compact:[{x:47,y:55,w:20}], wrap:[{x:46,y:53,w:22}],
      platter:[{x:62,y:53,w:24}], familyTray:[{x:57,y:53,w:20},{x:70,y:53,w:20}],
    }
  },
  'beef-burger': {
    src: '/images/byo/ing/beef-burger.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:50,y:53,w:22}], standard:[{x:48,y:52,w:22}],
      compact:[{x:47,y:54,w:20}], wrap:[{x:46,y:52,w:20}],
      platter:[{x:62,y:52,w:22}], familyTray:[{x:56,y:52,w:20},{x:70,y:52,w:20}],
    }
  },
  'chicken-burger': {
    src: '/images/byo/ing/chicken-burger.webp', layer: 4, shape: 'circle',
    pos: {
      hero:[{x:50,y:53,w:22}], standard:[{x:48,y:52,w:22}],
      compact:[{x:47,y:54,w:20}], wrap:[{x:46,y:52,w:20}],
      platter:[{x:62,y:52,w:22}], familyTray:[{x:56,y:52,w:20},{x:70,y:52,w:20}],
    }
  },
  /* ── Vegetables ─────────────────────────────────────────────── */
  lettuce: {
    src: '/images/byo/ing/lettuce.webp', layer: 3, shape: 'wide', ar:'6/2',
    pos: {
      hero:[{x:50,y:58,w:54}], standard:[{x:49,y:57,w:36}],
      compact:[{x:48,y:58,w:30}], wrap:[{x:48,y:56,w:34}],
      platter:[{x:64,y:56,w:28}], familyTray:[{x:60,y:56,w:26},{x:74,y:56,w:26}],
    }
  },
  onions: {
    src: '/images/byo/ing/onion.webp', layer: 7, shape: 'circle',
    pos: {
      hero:[{x:33,y:47,w:7},{x:47,y:47,w:7},{x:61,y:47,w:7}], standard:[{x:42,y:47,w:9},{x:56,y:47,w:9}],
      compact:[{x:43,y:49,w:8},{x:55,y:49,w:8}], wrap:[{x:42,y:47,w:8},{x:54,y:47,w:8}],
      platter:[{x:59,y:47,w:8},{x:68,y:47,w:8}], familyTray:[{x:54,y:47,w:7},{x:63,y:47,w:7},{x:72,y:47,w:7}],
    }
  },
  peppers: {
    src: '/images/byo/ing/pepper.webp', layer: 7, shape: 'circle',
    pos: {
      hero:[{x:30,y:47,w:7,rot:-20},{x:47,y:46,w:7,rot:15},{x:63,y:47,w:7,rot:-10}], standard:[{x:41,y:46,w:9,rot:-15},{x:56,y:46,w:9,rot:10}],
      compact:[{x:43,y:48,w:8,rot:-10},{x:55,y:48,w:8,rot:8}], wrap:[{x:42,y:46,w:8,rot:-12},{x:54,y:46,w:8,rot:8}],
      platter:[{x:58,y:46,w:8},{x:67,y:46,w:8}], familyTray:[{x:53,y:46,w:7},{x:62,y:46,w:7},{x:71,y:46,w:7}],
    }
  },
  cucumbers: {
    src: '/images/byo/ing/cucumber.webp', layer: 6, shape: 'circle',
    pos: {
      hero:[{x:30,y:48,w:8},{x:46,y:49,w:8},{x:62,y:48,w:8}], standard:[{x:41,y:48,w:10},{x:57,y:48,w:10}],
      compact:[{x:42,y:50,w:9},{x:55,y:50,w:9}], wrap:[{x:41,y:48,w:9},{x:54,y:48,w:9}],
      platter:[{x:59,y:48,w:9},{x:68,y:48,w:9}], familyTray:[{x:53,y:48,w:8},{x:62,y:48,w:8},{x:71,y:48,w:8}],
    }
  },
  tomatoes: {
    src: '/images/byo/ing/tomato.webp', layer: 6, shape: 'circle',
    pos: {
      hero:[{x:27,y:49,w:8},{x:44,y:49,w:8},{x:62,y:49,w:8}], standard:[{x:41,y:49,w:10},{x:57,y:50,w:10}],
      compact:[{x:42,y:51,w:9},{x:55,y:51,w:9}], wrap:[{x:41,y:49,w:9},{x:54,y:49,w:9}],
      platter:[{x:59,y:49,w:9},{x:68,y:49,w:9}], familyTray:[{x:53,y:49,w:8},{x:62,y:49,w:8},{x:71,y:49,w:8}],
    }
  },
  rice: {
    src: '/images/byo/ing/rice.webp', layer: 3, shape: 'wide', ar:'4/2',
    pos: {
      hero:[{x:50,y:60,w:44}], standard:[{x:49,y:59,w:32}],
      compact:[{x:48,y:60,w:26}], wrap:[{x:48,y:58,w:30}],
      platter:[{x:63,y:58,w:28}], familyTray:[{x:59,y:58,w:26},{x:73,y:58,w:26}],
    }
  },
  /* ── Cheese ─────────────────────────────────────────────────── */
  american: {
    src: '/images/byo/ing/american-cheese.webp', layer: 3, shape: 'rect', ar:'1/1',
    pos: {
      hero:[{x:50,y:57,w:36}], standard:[{x:49,y:56,w:26}],
      compact:[{x:48,y:57,w:22}], wrap:[{x:48,y:55,w:24}],
      platter:[{x:63,y:55,w:22}], familyTray:[{x:59,y:55,w:20},{x:72,y:55,w:20}],
    }
  },
  cream: {
    src: '/images/byo/ing/cream-cheese.webp', layer: 2, shape: 'wide', ar:'4/1',
    pos: {
      hero:[{x:50,y:61,w:46}], standard:[{x:49,y:60,w:30}],
      compact:[{x:48,y:61,w:24}], wrap:[{x:48,y:59,w:28}],
      platter:[{x:63,y:59,w:24}], familyTray:[{x:59,y:59,w:22},{x:73,y:59,w:22}],
    }
  },
  butter: {
    src: '/images/byo/ing/butter.webp', layer: 2, shape: 'rect', ar:'2/1',
    pos: {
      hero:[{x:40,y:60,w:16},{x:62,y:60,w:16}], standard:[{x:49,y:59,w:18}],
      compact:[{x:48,y:60,w:14}], wrap:[{x:48,y:58,w:16}],
      platter:[{x:63,y:58,w:16}], familyTray:[{x:59,y:58,w:14},{x:72,y:58,w:14}],
    }
  },
  /* ── Sauces — use drizzle images with multiply, or color gradient ── */
  white: {
    src: '/images/byo/ing/sauce-white.webp', layer: 9, shape: 'sauce',
    pos: { hero:[{x:50,y:51,w:54}], standard:[{x:49,y:51,w:36}], compact:[{x:48,y:53,w:30}], wrap:[{x:48,y:51,w:34}], platter:[{x:63,y:51,w:28}], familyTray:[{x:60,y:51,w:26}] }
  },
  hot: {
    src: '/images/byo/ing/sauce-hot.webp', layer: 9, shape: 'sauce',
    pos: { hero:[{x:50,y:51,w:54}], standard:[{x:49,y:51,w:36}], compact:[{x:48,y:53,w:30}], wrap:[{x:48,y:51,w:34}], platter:[{x:63,y:51,w:28}], familyTray:[{x:60,y:51,w:26}] }
  },
  /* Other sauces shown as small flavor circles */
  ketchup:  { src: '/images/byo/ing/tomato.webp',      layer: 9, shape: 'circle', pos: { hero:[{x:34,y:50,w:7},{x:52,y:50,w:7},{x:68,y:50,w:7}], standard:[{x:41,y:50,w:9},{x:57,y:50,w:9}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:8},{x:55,y:50,w:8}], platter:[{x:59,y:50,w:8},{x:68,y:50,w:8}], familyTray:[{x:53,y:50,w:7},{x:62,y:50,w:7},{x:71,y:50,w:7}] } },
  mustard:  { src: '/images/byo/ing/egg-fried.webp',   layer: 9, shape: 'circle', pos: { hero:[{x:34,y:50,w:7},{x:52,y:50,w:7}], standard:[{x:41,y:50,w:9},{x:57,y:50,w:9}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:8},{x:55,y:50,w:8}], platter:[{x:59,y:50,w:8},{x:68,y:50,w:8}], familyTray:[{x:53,y:50,w:7},{x:62,y:50,w:7}] } },
  bbq:      { src: '/images/byo/ing/bacon.webp',        layer: 9, shape: 'circle', pos: { hero:[{x:36,y:50,w:7},{x:54,y:50,w:7}], standard:[{x:42,y:50,w:9},{x:56,y:50,w:9}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:8},{x:55,y:50,w:8}], platter:[{x:59,y:50,w:8},{x:68,y:50,w:8}], familyTray:[{x:54,y:50,w:7},{x:63,y:50,w:7}] } },
  green:    { src: '/images/byo/ing/lettuce.webp',      layer: 9, shape: 'circle', pos: { hero:[{x:36,y:50,w:8},{x:54,y:50,w:8}], standard:[{x:42,y:50,w:10},{x:56,y:50,w:10}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:9},{x:55,y:50,w:9}], platter:[{x:59,y:50,w:9},{x:68,y:50,w:9}], familyTray:[{x:54,y:50,w:7},{x:63,y:50,w:7}] } },
  mayo:     { src: '/images/byo/ing/cream-cheese.webp', layer: 9, shape: 'circle', pos: { hero:[{x:36,y:50,w:7},{x:54,y:50,w:7}], standard:[{x:42,y:50,w:9},{x:56,y:50,w:9}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:8},{x:55,y:50,w:8}], platter:[{x:59,y:50,w:8},{x:68,y:50,w:8}], familyTray:[{x:54,y:50,w:7},{x:63,y:50,w:7}] } },
  blue:     { src: '/images/byo/ing/american-cheese.webp', layer: 9, shape: 'circle', pos: { hero:[{x:36,y:50,w:7},{x:54,y:50,w:7}], standard:[{x:42,y:50,w:9},{x:56,y:50,w:9}], compact:[{x:43,y:52,w:8},{x:55,y:52,w:8}], wrap:[{x:42,y:50,w:8},{x:55,y:50,w:8}], platter:[{x:59,y:50,w:8},{x:68,y:50,w:8}], familyTray:[{x:54,y:50,w:7},{x:63,y:50,w:7}] } },
};

function coRenderMedallion(id, family) {
  const def = CO_ING_DB[id];
  if (!def) return null;
  const positions = def.pos[family] || def.pos.standard || def.pos.compact;
  if (!positions) return null;

  return positions.map((pos, i) => {
    if (def.shape === 'sauce') {
      return (
        <img key={`${id}-s-${i}`} src={def.src} alt=""
          style={{
            position: 'absolute', left:`${pos.x}%`, top:`${pos.y}%`,
            width:`${pos.w}%`, height:'auto',
            transform:'translate(-50%,-50%)',
            zIndex: def.layer, mixBlendMode:'multiply', pointerEvents:'none',
          }}
          onError={e => { e.currentTarget.style.display='none'; }}
        />
      );
    }
    const radius = def.shape === 'circle' ? '50%' : def.shape === 'wide' ? '6px' : '10px';
    return (
      <div key={`${id}-m-${i}`} className="co-medallion"
        style={{
          left:`${pos.x}%`, top:`${pos.y}%`,
          width:`${pos.w}%`,
          aspectRatio: pos.ar || def.ar || '1 / 1',
          backgroundImage:`url(${def.src})`,
          backgroundSize:'cover', backgroundPosition:'center',
          borderRadius: radius,
          transform:`translate(-50%,-50%) rotate(${pos.rot||0}deg)`,
          zIndex: def.layer,
        }}
      />
    );
  });
}

/* ── Live build canvas: full-bleed base photo + ingredient chip bar ── */
function IngCanvas({ base, cfg }) {
  /* Sandwich cross-section order: veggies on top, proteins middle, cheese/spread near base */
  const vegLayers  = Object.keys(cfg.vegetables)
    .map(id => VEG_OPTS.find(o => o.id === id)).filter(o => o?.img);
  const protLayers = Object.keys(cfg.proteins)
    .map(id => PROTEIN_OPTS.find(o => o.id === id)).filter(o => o?.img);
  const chzLayers  = (cfg.cheese.type && cfg.cheese.type !== 'none')
    ? [CHEESE_OPTS.find(o => o.id === cfg.cheese.type)].filter(o => o?.img)
    : [];

  /* Top → bottom render order: veg (top of sandwich), then protein, then cheese */
  const allLayers = [...vegLayers, ...protLayers, ...chzLayers];
  const MAX = 6;
  const visible = allLayers.slice(0, MAX);
  const extra   = allLayers.length - visible.length;

  const activeSauces = Object.keys(cfg.sauces)
    .map(id => SAUCE_OPTS.find(o => o.id === id)).filter(Boolean);

  return (
    <>
      <div className="co-canvas">
        <div className="co-canvas-center-glow" />

        {base ? (
          <>
            <div className="co-scene">
              {/* Ingredient strips — stacked top-to-bottom, each overlapping the next */}
              {visible.map((ing, i) => (
                <div
                  key={ing.id + i}
                  className="co-scene-layer"
                  style={{
                    backgroundImage: `url(${ing.img})`,
                    zIndex: MAX - i + 2,
                    animationDelay: `${i * 0.04}s`,
                  }}
                  title={ing.label}
                />
              ))}
              {extra > 0 && (
                <div className="co-scene-layer co-scene-extra" style={{ zIndex: 2 }}>
                  +{extra} more
                </div>
              )}

              {/* Base food image — always at the bottom of the stack */}
              <div className="co-scene-base">
                <img src={base.img} alt={base.label} className="co-scene-base-img"
                  onError={e => { e.currentTarget.style.opacity = '0.3'; }}
                />
              </div>
            </div>

            {/* Sauce bowl thumbnails — bottom-right corner */}
            {activeSauces.length > 0 && (
              <div className="co-canvas-sauce-row">
                {activeSauces.slice(0, 4).map(sauce => (
                  sauce.img
                    ? <img key={sauce.id} src={sauce.img} alt={sauce.label} className="co-canvas-sauce-bowl" title={sauce.label} />
                    : <span key={sauce.id} className="co-canvas-sauce-emoji">{sauce.emoji}</span>
                ))}
              </div>
            )}

            {allLayers.length === 0 && activeSauces.length === 0 && (
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
    label: 'Beef Burger',
    emoji: '🍔',
    desc: 'Burger Bun · Beef Burger · Ketchup',
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
const INIT = {
  base: null,
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
  const GLUTEN_BASES   = new Set(['39a','39b','39c','39d','39e','39f','39g','39h']);

  const isBaseExcluded    = id => dietFilters.has('glutenFree')  && GLUTEN_BASES.has(id);
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
      if (key === 'glutenFree') {
        setCfg(p => GLUTEN_BASES.has(p.base?.id) ? { ...p, base: null } : p);
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

  /* Section toggle */
  const toggleSection = id => setOpen(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  /* State updaters */
  const setBase = base => {
    setCfg(p => ({ ...p, base }));
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
    addItem({
      id:            `custom-${cfg.base.id}-${Date.now()}`,
      name:          `Custom ${cfg.base.label}`,
      price:         total,
      baseItemPrice: Math.max(0, total - addonsTotal),
      note:          buildNote(),
      img:           cfg.base.img,
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
          <IngCanvas base={cfg.base} cfg={cfg} />
        </div>

        {/* ── Left: sticky canvas (desktop sidebar) ── */}
        <aside className="co-sidebar">
          <IngCanvas base={cfg.base} cfg={cfg} />
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
                <p className="co-protein-warn-msg">⚠️ No protein selected — your order will be veggie only.</p>
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
              { key: 'glutenFree', label: 'Gluten-Free', emoji: '🌾' },
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
            <p className="co-presets-label">⭐ Staff Picks — tap to pre-fill</p>
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
            <div className="co-base-grid">
              {BASES.map(base => (
                <button
                  key={base.id}
                  className={`co-base-card${cfg.base?.id === base.id ? ' selected' : ''}${isBaseExcluded(base.id) ? ' co-filtered' : ''}`}
                  onClick={() => !isBaseExcluded(base.id) && setBase(base)}
                >
                  <div className="co-base-img" style={{ backgroundImage: `url(${base.img})` }} />
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
            <p className="co-qty-legend">Low · Regular · Extra · Double — price updates in running total above</p>
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
                        ? <div className="co-prot-thumb" style={{ backgroundImage: `url(${prot.img})` }} />
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
            <div className="co-sauce-note">
              <Info size={14} />
              <span>We will do our best to follow your preference; however, some sauces may be served on the side to maintain food quality and freshness.</span>
            </div>
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
                        <Link to={`/menu/${id}`} className="co-menu-name">{item.name}</Link>
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
                        <Link to={`/menu/${id}`} className="co-menu-name">{item.name}</Link>
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
