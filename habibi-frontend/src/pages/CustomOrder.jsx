import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Minus, ChevronDown, Info, ShoppingBag, Check, Bookmark, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { menuAPI, savedCustomAPI, byoIngredientsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import IngCanvas, { CO_ING_DB, DEFAULT_PROTEIN_OPTS, DEFAULT_SAUCE_OPTS } from '../components/IngCanvas';
import './CustomOrder.css';

/* ================================================================
   DATA DEFINITIONS
   ================================================================ */

const DEFAULT_BASES = [
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

const DEFAULT_CHEESE_OPTS = [
  { id: 'none',          label: 'No Cheese',      price: 0,    emoji: '⬜', default: true },
  { id: 'american',      label: 'American Cheese', price: 1.00, emoji: '🧀', img: '/images/byo/ing/american-cheese.webp'  },
  { id: 'butter',        label: 'Butter',          price: 2.00, emoji: '🫙', img: '/images/byo/ing/butter2.webp'           },
  { id: 'liquid_cheese', label: 'Cream Cheese',    price: 1.50, emoji: '🫕', img: '/images/byo/ing/liquid-cheese.webp'   },
];

const DEFAULT_VEG_OPTS = [
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
      baseId:     '39a',
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
      baseId:     '39b',
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
      baseId:     '39g',
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
      baseId:     '39c',
      cheese:     { type: 'none', qty: 'regular' },
      vegetables: { lettuce: { qty: 'regular' }, cucumbers: { qty: 'regular' }, tomatoes: { qty: 'regular' } },
      proteins:   { falafel: { qty: 'regular' } },
      sauces:     { green: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
  {
    id: 'mix-platter',
    label: 'Mix Platter',
    emoji: '🥘',
    desc: 'Platter · Mix · Rice · White & Hot Sauce',
    cfg: {
      baseId:     '39i',
      cheese:     { type: 'none', qty: 'regular' },
      vegetables: { rice: { qty: 'regular' }, lettuce: { qty: 'regular' }, tomatoes: { qty: 'regular' } },
      proteins:   { mix: { qty: 'regular' } },
      sauces:     { white: { placement: 'on_food', qty: 'regular', count: 1 }, hot: { placement: 'on_food', qty: 'regular', count: 1 } },
      extras: {}, drinks: {},
    },
  },
  {
    id: 'family-feast',
    label: 'Family Feast',
    emoji: '👨‍👩‍👧‍👦',
    desc: 'Family Tray · Mix · Rice · White & Hot Sauce',
    cfg: {
      baseId:     '39j',
      cheese:     { type: 'none', qty: 'regular' },
      vegetables: { rice: { qty: 'regular' }, onions: { qty: 'regular' }, peppers: { qty: 'regular' } },
      proteins:   { mix: { qty: 'regular' } },
      sauces:     { white: { placement: 'on_food', qty: 'regular', count: 1 }, hot: { placement: 'on_food', qty: 'regular', count: 1 } },
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

  /* The sticky sidebar (canvas + price card) needs to sit BELOW the sticky
     site navbar, not just 72px down — the navbar's real height varies a lot
     by viewport (90px–176px depending on whether the promo bar/nav wraps),
     so a hardcoded offset left the top of the canvas hidden behind the
     navbar while scrolling. Measure it live instead of guessing. */
  const [navbarH, setNavbarH] = useState(72);
  useEffect(() => {
    const navEl = document.querySelector('header.navbar');
    if (!navEl) return;
    const update = () => setNavbarH(navEl.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(navEl);
    return () => ro.disconnect();
  }, []);

  /* BYO ingredient data — admin-managed via Menu Builder. Seeded with the
     hardcoded defaults so the builder renders identically even before the
     fetch resolves (or if it fails), then swapped for live data on success. */
  const [basesData, setBasesData]     = useState(DEFAULT_BASES);
  const [cheeseData, setCheeseData]   = useState(DEFAULT_CHEESE_OPTS);
  const [vegData, setVegData]         = useState(DEFAULT_VEG_OPTS);
  const [proteinData, setProteinData] = useState(DEFAULT_PROTEIN_OPTS);
  const [sauceData, setSauceData]     = useState(DEFAULT_SAUCE_OPTS);

  useEffect(() => {
    byoIngredientsAPI.getAll().then(d => {
      const adapt = row => ({
        id: row.option_key,
        label: row.label,
        price: parseFloat(row.price),
        img: row.image_url || undefined,
        emoji: row.emoji || undefined,
        qtyType: row.qty_type || undefined,
        family: row.family || undefined,
        note: row.note || undefined,
        rim: row.rim_image_url || undefined,
        imgByQty: row.img_by_qty || undefined,
      });
      if (d.base?.length)    setBasesData(d.base.map(adapt));
      if (d.cheese?.length)  setCheeseData(d.cheese.map(adapt));
      if (d.veg?.length)     setVegData(d.veg.map(adapt));
      if (d.protein?.length) setProteinData(d.protein.map(adapt));
      if (d.sauce?.length)   setSauceData(d.sauce.map(adapt));
    }).catch(() => {}); // keep hardcoded defaults on failure
  }, []);

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

  /* Apply a staff-pick preset — resolves the base from live (possibly
     admin-edited) ingredient data rather than the preset's own baseId,
     so pricing always reflects current prices. */
  const applyPreset = preset => {
    const liveBase = basesData.find(b => b.id === preset.cfg.baseId) || DEFAULT_BASES.find(b => b.id === preset.cfg.baseId);
    setCfg({ ...preset.cfg, base: liveBase });
    setOpen(new Set(['base', 'cheese', 'vegetables', 'proteins', 'sauces', 'extras', 'drinks']));
    setWarnProtein(false);
    setQty(1);
  };

  /* Surprise Me — random base + protein + 2 veg + sauce, respecting active diet filters */
  const [rollAnim, setRollAnim] = useState(false);
  const randomizeOrder = () => {
    const base = basesData[Math.floor(Math.random() * basesData.length)];

    // A meal with zero protein looks broken/incomplete -- if the diet-filtered
    // pool ever comes up empty, fall back to the full list rather than
    // leaving the "surprise" with no protein at all.
    const proteinPool = proteinData.filter(p => !isProteinExcluded(p.id));
    const proteinChoices = proteinPool.length ? proteinPool : proteinData;
    const protein = proteinChoices[Math.floor(Math.random() * proteinChoices.length)];

    const vegPicks = shuffleArray(vegData).slice(0, 2);

    const saucePool = sauceData.filter(s => !isSauceExcluded(s.id));
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
        const opt = proteinData.find(x => x.id === id);
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
    const pr = proteinData.find(x => x.id === id);
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
      const c = cheeseData.find(x => x.id === cfg.cheese.type);
      if (c) t += c.price * mult.cheese;
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = vegData.find(x => x.id === id);
      if (v) t += v.price * (VEG_QTY_MULT[qty] || 1) * mult.veg;
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = proteinData.find(x => x.id === id);
      if (p) {
        const m = PROTEIN_BASE_TIERED.has(id) ? mult.protein : 1;
        t += calcProteinPrice(p, qty) * m;
      }
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = sauceData.find(x => x.id === id);
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
      const c = cheeseData.find(x => x.id === cfg.cheese.type);
      if (c) lines.push({ label: `${c.label} (${cfg.cheese.qty})`, price: c.price * mult.cheese });
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = vegData.find(x => x.id === id);
      if (v) lines.push({ label: `${v.label} (${qty})`, price: v.price * (VEG_QTY_MULT[qty] || 1) * mult.veg });
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = proteinData.find(x => x.id === id);
      if (p) {
        const m = PROTEIN_BASE_TIERED.has(id) ? mult.protein : 1;
        lines.push({ label: `${p.label} (${proteinQtyLabel(p, qty)})`, price: calcProteinPrice(p, qty) * m });
      }
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = sauceData.find(x => x.id === id);
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
      const c = cheeseData.find(x => x.id === cfg.cheese.type);
      parts.push(`${c?.label} (${cfg.cheese.qty})`);
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = vegData.find(x => x.id === id);
      if (v) parts.push(`${v.label} (${qty})`);
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = proteinData.find(x => x.id === id);
      if (p) parts.push(`${p.label} (${proteinQtyLabel(p, qty)})`);
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = sauceData.find(x => x.id === id);
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
    /* Build visual layers for the checkout cart-thumbnail preview: base
       photo + up to 5 ingredient PNGs, each tagged with what it actually
       IS (not just its position in this array) -- Checkout.jsx positions
       each layer by role (protein centered, cheese/veg in their own
       corners), so e.g. an order with 2 proteins and no cheese doesn't
       show a protein sitting in the "cheese" spot the way a plain
       array-index mapping would. */
    const proteinIds = Object.keys(cfg.proteins);
    const vegIds     = Object.keys(cfg.vegetables);
    const roleLayer = (id, src, role) => (id && src ? { src, role } : null);
    const customLayers = [
      { src: cfg.base.img, role: 'base' },
      roleLayer(proteinIds[0], CO_ING_DB[proteinIds[0]]?.src, 'protein'),
      roleLayer(proteinIds[1], CO_ING_DB[proteinIds[1]]?.src, 'protein2'),
      (cfg.cheese.type && cfg.cheese.type !== 'none')
        ? roleLayer(cfg.cheese.type, CO_ING_DB[cfg.cheese.type]?.src, 'cheese')
        : null,
      roleLayer(vegIds[0], CO_ING_DB[vegIds[0]]?.src, 'veg1'),
      roleLayer(vegIds[1], CO_ING_DB[vegIds[1]]?.src, 'veg2'),
    ].filter(Boolean);

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

        {/* ── Mobile-only canvas (above sections, hidden on desktop) ──
            Sticky like the desktop sidebar below -- previously this only
            appeared once at the top and scrolled away with the rest of the
            page, so by the time someone was picking sauces or extras there
            was no visual feedback left at all of what they were building,
            just the running total in the fixed footer. */}
        <div className="co-mobile-canvas-wrap" style={{ top: navbarH }}>
          <IngCanvas base={cfg.base} cfg={cfg} onReset={handleReset} proteinOpts={proteinData} sauceOpts={sauceData} />
        </div>

        {/* ── Left: sticky canvas (desktop sidebar) ── */}
        {/* position:sticky alone doesn't give an element its own scroll region --
            this sidebar's content (canvas + price breakdown + instructions +
            Add to Cart + Save + meal-nudge chips) runs ~1150px tall, which is
            taller than the sticky "window" (viewport height minus the navbar
            offset) at every common desktop/laptop height, including 1000px+.
            Without maxHeight+overflowY, Add to Cart and everything below it
            is completely unreachable while pinned -- the only way to see it
            was to scroll the whole page past every ingredient section until
            the sidebar naturally un-stuck at the bottom of its container. */}
        <aside
          className="co-sidebar"
          style={{ top: navbarH + 12, maxHeight: `calc(100vh - ${navbarH + 12}px - 12px)` }}
        >
          {/* The flex column + gap that used to live directly on .co-sidebar
              moved to this inner wrapper. Flex items get an implicit
              min-height:auto that keeps them from shrinking below their
              natural content size -- but that protection is switched off
              for any flex container whose own overflow isn't `visible`.
              Putting overflow-y:auto on .co-sidebar itself (the flex
              container) let the canvas silently get crushed down to a few
              px instead of the sidebar scrolling, since every child became
              free to shrink to fit. Keeping the scrolling element (aside)
              and the flex-column element (this div) separate avoids that. */}
          <div className="co-sidebar-inner">
          <IngCanvas base={cfg.base} cfg={cfg} onReset={handleReset} proteinOpts={proteinData} sauceOpts={sauceData} />
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
          </div>
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
                  className={`co-preset-card${cfg.base?.id === preset.cfg.baseId && JSON.stringify(cfg.proteins) === JSON.stringify(preset.cfg.proteins) ? ' active' : ''}`}
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
              {basesData.map(base => (
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
              {cheeseData.map(opt => (
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
              {vegData.map(veg => {
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
              {proteinData.map(prot => {
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
              {sauceData.map(sauce => {
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
