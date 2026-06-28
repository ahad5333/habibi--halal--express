import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ChevronDown, Info, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { menuAPI } from '../services/api';
import SEO from '../components/SEO';
import './CustomOrder.css';

/* ================================================================
   DATA DEFINITIONS
   ================================================================ */

const BASES = [
  { id: '39a', label: 'Hero',        price: 1.99, img: '/images/menu/39a.jpg', family: 'hero'       },
  { id: '39b', label: 'Wrap',        price: 1.99, img: '/images/menu/39b.jpg', family: 'wrap',       note: 'Habibi Special Wrap' },
  { id: '39c', label: 'Pita Bread',  price: 1.99, img: '/images/menu/39c.jpg', family: 'wrap'       },
  { id: '39d', label: 'Croissant',   price: 1.99, img: '/images/menu/39d.jpg', family: 'compact'    },
  { id: '39e', label: 'Bagel',       price: 1.99, img: '/images/menu/39e.jpg', family: 'standard'   },
  { id: '39f', label: 'Roll',        price: 1.49, img: '/images/menu/39f.jpg', family: 'standard'   },
  { id: '39g', label: 'Burger Bun',  price: 1.99, img: '/images/menu/39g.jpg', family: 'standard'   },
  { id: '39h', label: 'Hot Dog Bun', price: 0.99, img: '/images/menu/39h.jpg', family: 'compact'    },
  { id: '39i', label: 'Platter',     price: 2.99, img: '/images/menu/39i.jpg', family: 'platter'    },
  { id: '39j', label: 'Family Tray', price: 4.99, img: '/images/menu/39j.jpg', family: 'familyTray' },
];

const CHEESE_OPTS = [
  { id: 'none',     label: 'No Cheese',      price: 0,    emoji: '⬜', default: true },
  { id: 'american', label: 'American Cheese', price: 1.00, emoji: '🧀', img: '/images/byo/ing/american-cheese.jpg' },
  { id: 'cream',    label: 'Cream Cheese',    price: 2.00, emoji: '🧈', img: '/images/byo/ing/cream-cheese.jpg'   },
  { id: 'butter',   label: 'Butter',          price: 2.00, emoji: '🫙', img: '/images/byo/ing/butter.jpg'        },
];

const VEG_OPTS = [
  { id: 'onions',    label: 'Onions',        price: 0.50, emoji: '🧅', img: '/images/byo/ing/onion.jpg'    },
  { id: 'peppers',   label: 'Green Peppers', price: 0.50, emoji: '🌿', img: '/images/byo/ing/pepper.jpg'   },
  { id: 'cucumbers', label: 'Cucumbers',     price: 0.50, emoji: '🥒', img: '/images/byo/ing/cucumber.jpg' },
  { id: 'lettuce',   label: 'Lettuce',       price: 0.50, emoji: '🥬', img: '/images/byo/ing/lettuce.jpg'  },
  { id: 'tomatoes',  label: 'Tomatoes',      price: 0.50, emoji: '🍅', img: '/images/byo/ing/tomato.jpg'   },
  { id: 'rice',      label: 'Rice',          price: 2.00, emoji: '🍚', img: '/images/byo/ing/rice.jpg', note: 'Basmati rice' },
];

/* qtyType determines which quantity selector is shown:
   'low-extra'     → Low / Regular / Extra / Double
   'eggs'          → 1 / 2 / 3 / 4 eggs  ($1 each)
   'single-double' → Single / Double
   'single-triple' → Single / Double / Triple               */
const PROTEIN_OPTS = [
  { id: 'egg-fried',       label: 'Egg (Fried)',           price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-fried.jpg'       },
  { id: 'egg-scrambled',   label: 'Egg (Scrambled)',        price: 1.00, qtyType: 'eggs',          emoji: '🍳', img: '/images/byo/ing/egg-scrambled.jpg'   },
  { id: 'chicken',         label: 'Chicken (Grilled)',      price: 6.00, qtyType: 'low-extra',     emoji: '🍗', img: '/images/byo/ing/chicken.jpg',  note: 'Grilled cubes w/ onions & peppers' },
  { id: 'lamb-gyro',       label: 'Lamb Gyro',             price: 6.00, qtyType: 'low-extra',     emoji: '🥩', img: '/images/byo/ing/lamb-gyro.jpg'       },
  { id: 'mix',             label: 'Mix (Chicken + Gyro)',  price: 7.00, qtyType: 'low-extra',     emoji: '🍖', img: '/images/byo/ing/mix.jpg',      note: 'Half chicken, half lamb gyro' },
  { id: 'hotdog',          label: 'Hot Dog',               price: 2.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hotdog.jpg'           },
  { id: 'bacon',           label: 'Bacon',                 price: 3.00, qtyType: 'low-extra',     emoji: '🥓', img: '/images/byo/ing/bacon.jpg',    note: 'Beef bacon, halal' },
  { id: 'hot-sausage',     label: 'Hot Sausage',           price: 3.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/hot-sausage.jpg'     },
  { id: 'italian-sausage', label: 'Italian Sausage',       price: 6.00, qtyType: 'single-double', emoji: '🌭', img: '/images/byo/ing/italian-sausage.jpg' },
  { id: 'turkey',          label: 'Turkey',                price: 6.00, qtyType: 'low-extra',     emoji: '🦃', img: '/images/byo/ing/turkey.jpg',   note: 'Plain turkey slices' },
  { id: 'chicken-kabab',   label: 'Chicken Shish Kabab',   price: 3.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/chicken-kabab.jpg'   },
  { id: 'beef-kabab',      label: 'Beef Shish Kabab',      price: 4.00, qtyType: 'single-triple', emoji: '🍢', img: '/images/byo/ing/beef-kabab.jpg'      },
  { id: 'philly-steak',    label: 'Philly Steak',          price: 6.00, qtyType: 'single-double', emoji: '🥩', img: '/images/byo/ing/philly-steak.jpg'    },
  { id: 'falafel',         label: 'Falafel',               price: 6.00, qtyType: 'low-extra',     emoji: '🧆', img: '/images/byo/ing/falafel.jpg',  note: 'Low=3 balls, Regular=6, Extra=9, Double=12' },
  { id: 'fish-fillet',     label: 'Fish Fillet',           price: 7.00, qtyType: 'single-double', emoji: '🐟', img: '/images/byo/ing/fish-fillet.jpg'     },
  { id: 'shrimp',          label: 'Shrimp',                price: 8.00, qtyType: 'low-extra',     emoji: '🍤', img: '/images/byo/ing/shrimp.jpg'          },
  { id: 'tuna',            label: 'Tuna Fish',             price: 7.00, qtyType: 'low-extra',     emoji: '🐠', img: '/images/byo/ing/tuna.jpg'            },
  { id: 'beef-burger',     label: 'Beef Burger',           price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/beef-burger.jpg'     },
  { id: 'chicken-burger',  label: 'Chicken Burger',        price: 5.00, qtyType: 'single-double', emoji: '🍔', img: '/images/byo/ing/chicken-burger.jpg'  },
];

const SAUCE_OPTS = [
  { id: 'white',   label: 'White Sauce',      price: 1.00, emoji: '🤍' },
  { id: 'hot',     label: 'Hot Sauce',        price: 1.00, emoji: '🔥' },
  { id: 'ketchup', label: 'Ketchup',          price: 0.75, emoji: '🍅' },
  { id: 'mustard', label: 'Mustard',          price: 0.75, emoji: '💛' },
  { id: 'bbq',     label: 'BBQ Sauce',        price: 1.00, emoji: '🫙' },
  { id: 'green',   label: 'Special Green Sauce', price: 1.25, emoji: '💚' },
  { id: 'mayo',    label: 'Mayonnaise',       price: 0.75, emoji: '🍶' },
  { id: 'blue',    label: 'Blue Cheese',      price: 1.25, emoji: '🫐' },
];

/* ── Price helpers ───────────────────────────────────────────── */
const VEG_QTY_MULT  = { low: 1, regular: 1, extra: 1.5, double: 2 };
const SAUCE_FOOD_MULT = { low: 0.5, regular: 1, extra: 2 };

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
   INGREDIENT COMPOSITING ENGINE  (mirrors BuildYourOwn.jsx)
   ================================================================ */
const ING_DB = {
  hotdog:   { img: '/images/byo/ing/hotdog.jpg', layer: 5, blend: 'multiply',
    rules: { hero:{x:50,y:53,sc:0.84,rot:0}, standard:{x:50,y:54,sc:0.56,rot:0}, compact:{x:50,y:58,sc:0.44,rot:0}, wrap:{x:50,y:52,sc:0.46,rot:85}, platter:{x:65,y:52,sc:0.50,rot:8}, familyTray:{x:65,y:52,sc:0.55,rot:0} } },
  chicken:  { img: '/images/byo/ing/chicken.jpg', layer: 4, blend: 'multiply',
    rules: { hero:{x:50,y:52,sc:0.50,rot:0,cnt:2,sx:30}, standard:{x:50,y:52,sc:0.52,rot:0}, compact:{x:50,y:55,sc:0.44,rot:0}, wrap:{x:50,y:52,sc:0.50,rot:0}, platter:{x:65,y:52,sc:0.55,rot:0}, familyTray:{x:65,y:52,sc:0.50,rot:0,cnt:2,sx:16} } },
  lettuce:  { img: '/images/byo/ing/lettuce.jpg', layer: 3, blend: 'multiply',
    rules: { hero:{x:50,y:55,sc:0.86}, standard:{x:50,y:56,sc:0.62}, compact:{x:50,y:58,sc:0.52}, wrap:{x:50,y:55,sc:0.60}, platter:{x:65,y:54,sc:0.55}, familyTray:{x:65,y:54,sc:0.60} } },
  tomatoes: { img: '/images/byo/ing/tomato.jpg', layer: 6, blend: 'multiply',
    rules: { hero:{x:50,y:48,sc:0.14,cnt:4,sx:14}, standard:{x:50,y:49,sc:0.18,cnt:2,sx:15}, compact:{x:50,y:51,sc:0.16,cnt:2,sx:13}, wrap:{x:50,y:49,sc:0.16,cnt:3,sx:13}, platter:{x:65,y:48,sc:0.18,cnt:2,sx:12}, familyTray:{x:65,y:48,sc:0.17,cnt:3,sx:11} } },
  onions:   { img: '/images/byo/ing/onion.jpg', layer: 7, blend: 'multiply',
    rules: { hero:{x:50,y:50,sc:0.11,cnt:5,sx:12}, standard:{x:50,y:50,sc:0.16,cnt:2,sx:13}, compact:{x:50,y:52,sc:0.14,cnt:2,sx:11}, wrap:{x:50,y:50,sc:0.14,cnt:3,sx:11}, platter:{x:65,y:50,sc:0.14,cnt:2,sx:12}, familyTray:{x:65,y:50,sc:0.13,cnt:3,sx:11} } },
  peppers:  { img: '/images/byo/ing/pepper.jpg', layer: 7, blend: 'multiply',
    rules: { hero:{x:50,y:47,sc:0.17,rot:-22,cnt:3,sx:16}, standard:{x:50,y:47,sc:0.20,rot:-15,cnt:2,sx:15}, compact:{x:50,y:49,sc:0.18,rot:-10}, wrap:{x:50,y:48,sc:0.18,rot:-25,cnt:2,sx:14}, platter:{x:65,y:47,sc:0.18,rot:-15,cnt:2,sx:12}, familyTray:{x:65,y:47,sc:0.17,rot:-20,cnt:3,sx:11} } },
  white:    { img: '/images/byo/ing/sauce-white.png', layer: 9, blend: 'multiply',
    rules: { hero:{x:50,y:51,sc:0.82}, standard:{x:50,y:51,sc:0.60}, compact:{x:50,y:54,sc:0.50}, wrap:{x:50,y:51,sc:0.58}, platter:{x:65,y:50,sc:0.52}, familyTray:{x:65,y:50,sc:0.55} } },
  hot:      { img: '/images/byo/ing/sauce-hot.png', layer: 9, blend: 'multiply',
    rules: { hero:{x:50,y:51,sc:0.82}, standard:{x:50,y:51,sc:0.60}, compact:{x:50,y:54,sc:0.50}, wrap:{x:50,y:51,sc:0.58}, platter:{x:65,y:50,sc:0.52}, familyTray:{x:65,y:50,sc:0.55} } },
};

function IngCanvas({ base, cfg }) {
  const family = base?.family || 'standard';
  const activeIds = [];
  if (cfg.vegetables.lettuce)  activeIds.push('lettuce');
  if (cfg.vegetables.tomatoes) activeIds.push('tomatoes');
  if (cfg.vegetables.onions)   activeIds.push('onions');
  if (cfg.vegetables.peppers)  activeIds.push('peppers');
  const p = cfg.proteins;
  if (p.chicken || p.mix)    activeIds.push('chicken');
  if (p.hotdog)              activeIds.push('hotdog');
  if (cfg.sauces.white?.on)  activeIds.push('white');
  if (cfg.sauces.hot?.on)    activeIds.push('hot');

  return (
    <div className="co-canvas">
      {base && <img src={base.img} alt={base.label} className="co-canvas-base" />}
      {!base && (
        <div className="co-canvas-empty">
          <img src="/images/byo/customize-icon.jpg" alt="" className="co-canvas-icon" />
          <span>Choose a base to preview your order</span>
        </div>
      )}
      {base && activeIds.map(id => {
        const def = ING_DB[id];
        if (!def) return null;
        const r = def.rules[family] || def.rules.standard;
        if (!r) return null;
        const cnt = r.cnt || 1;
        return Array.from({ length: cnt }).map((_, i) => {
          const off = i - (cnt - 1) / 2;
          return (
            <img key={`${id}-${i}`} src={def.img} alt="" className="co-ing"
              style={{
                left: `${r.x + off * (r.sx || 0)}%`,
                top:  `${r.y + off * (r.sy || 0)}%`,
                transform: `translate(-50%,-50%) scale(${r.sc}) rotate(${r.rot||0}deg)`,
                zIndex: def.layer,
                mixBlendMode: def.blend,
              }}
              onError={e => { e.currentTarget.style.display='none'; }}
            />
          );
        });
      })}
      {base && (
        <div className="co-canvas-tag">
          <span>{base.label}</span>
          <span className="co-canvas-tag-price">from ${base.price.toFixed(2)}</span>
        </div>
      )}
    </div>
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
            {price !== null && <span className="co-qty-pill-price">${price.toFixed(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible section ─────────────────────────────────────── */
function Section({ id, title, icon, badge, open, onToggle, children }) {
  return (
    <div className={`co-section${open ? ' open' : ''}`}>
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
  const { addItem } = useCart();
  const navigate    = useNavigate();
  const [cfg, setCfg]         = useState(INIT);
  const [open, setOpen]       = useState(new Set(['base']));
  const [extras, setExtras]   = useState([]);
  const [drinks, setDrinks]   = useState([]);
  const [added, setAdded]     = useState(false);

  /* Fetch extras + drinks from menu */
  useEffect(() => {
    menuAPI.getAll().then(items => {
      if (!Array.isArray(items)) return;
      setExtras(items.filter(i => /extra|side/i.test(i.category_name || i.category || '')));
      setDrinks(items.filter(i => /drink|beverage|soda|juice/i.test(i.category_name || i.category || '')));
    }).catch(() => {});
  }, []);

  /* Section toggle */
  const toggleSection = id => setOpen(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  /* State updaters */
  const setBase = base => {
    setCfg(p => ({ ...p, base }));
    setOpen(prev => { const n = new Set(prev); n.add('cheese'); return n; });
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
    let t = cfg.base?.price || 0;
    if (cfg.cheese.type !== 'none') {
      t += CHEESE_OPTS.find(c => c.id === cfg.cheese.type)?.price || 0;
    }
    Object.entries(cfg.vegetables).forEach(([id, { qty }]) => {
      const v = VEG_OPTS.find(x => x.id === id);
      if (v) t += v.price * (VEG_QTY_MULT[qty] || 1);
    });
    Object.entries(cfg.proteins).forEach(([id, { qty }]) => {
      const p = PROTEIN_OPTS.find(x => x.id === id);
      if (p) t += calcProteinPrice(p, qty);
    });
    Object.entries(cfg.sauces).forEach(([id, s]) => {
      const sc = SAUCE_OPTS.find(x => x.id === id);
      if (!sc) return;
      t += s.placement === 'on_side'
        ? sc.price * (s.count || 1)
        : sc.price * (SAUCE_FOOD_MULT[s.qty] || 1);
    });
    Object.entries(cfg.extras).forEach(([id, cnt]) => {
      const item = extras.find(x => (x._id || x.id) === id);
      if (item) t += item.price * cnt;
    });
    Object.entries(cfg.drinks).forEach(([id, cnt]) => {
      const item = drinks.find(x => (x._id || x.id) === id);
      if (item) t += item.price * cnt;
    });
    return Math.max(0, t);
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
    return parts.join(' | ');
  };

  const handleAdd = () => {
    if (!cfg.base) return;
    addItem({
      _id: `custom-${Date.now()}`,
      name: `Custom ${cfg.base.label}`,
      price: total,
      note: buildNote(),
      img: cfg.base.img,
      quantity: 1,
    });
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
      </div>

      <div className="co-layout">

        {/* ── Left: sticky canvas ── */}
        <aside className="co-sidebar">
          <IngCanvas base={cfg.base} cfg={cfg} />
          <div className="co-price-card">
            <span className="co-price-label">Your Total</span>
            <span className="co-price-val">${total.toFixed(2)}</span>
            <button
              className="co-add-btn"
              onClick={handleAdd}
              disabled={!cfg.base || added}
            >
              {added
                ? <><Check size={16} /> Added!</>
                : <><ShoppingBag size={16} /> Add to Cart</>
              }
            </button>
          </div>
        </aside>

        {/* ── Right: configuration groups ── */}
        <main className="co-groups">

          {/* 1 — BASE */}
          <Section id="base" title="Choose Your Base" icon="🍞"
            badge={badges.base} open={open.has('base')} onToggle={toggleSection}>
            <div className="co-base-grid">
              {BASES.map(base => (
                <button
                  key={base.id}
                  className={`co-base-card${cfg.base?.id === base.id ? ' selected' : ''}`}
                  onClick={() => setBase(base)}
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
                  className={`co-opt-card${cfg.cheese.type === opt.id ? ' selected' : ''}`}
                  onClick={() => setCheeseType(opt.id)}
                >
                  <span className="co-opt-emoji">{opt.emoji}</span>
                  <span className="co-opt-name">{opt.label}</span>
                  {opt.price > 0 && <span className="co-opt-price">+${opt.price.toFixed(2)}</span>}
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
                      <span className="co-opt-emoji">{veg.emoji}</span>
                      <span className="co-opt-name">{veg.label}</span>
                      <span className="co-opt-price">+${veg.price.toFixed(2)}</span>
                      {veg.note && <span className="co-opt-note">{veg.note}</span>}
                      {sel && <span className="co-check"><Check size={11} /></span>}
                    </button>
                    {sel && (
                      <QtyPills
                        opts={QTY_OPTS.veg}
                        value={sel.qty}
                        onChange={qty => setVegQty(veg.id, qty)}
                        formatPrice={qty => veg.price * (VEG_QTY_MULT[qty] || 1)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="co-qty-legend">Low/Regular = same price · Extra +50% · Double +100%</p>
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
                      className={`co-opt-card co-prot-card${sel ? ' selected' : ''}`}
                      onClick={() => toggleProtein(prot.id)}
                    >
                      <span className="co-opt-emoji">{prot.emoji}</span>
                      <div className="co-prot-info">
                        <span className="co-opt-name">{prot.label}</span>
                        {prot.note && <span className="co-opt-note">{prot.note}</span>}
                      </div>
                      <span className="co-opt-price">${prot.price.toFixed(2)}</span>
                      {sel && <span className="co-check"><Check size={11} /></span>}
                    </button>
                    {sel && (
                      <QtyPills
                        opts={prot.qtyType === 'eggs' ? QTY_OPTS.eggs : QTY_OPTS[prot.qtyType]}
                        value={sel.qty}
                        onChange={qty => setProteinQty(prot.id, qty)}
                        formatPrice={qty => calcProteinPrice(prot, qty)}
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
                      className={`co-opt-card${sel ? ' selected' : ''}`}
                      onClick={() => toggleSauce(sauce.id)}
                    >
                      <span className="co-opt-emoji">{sauce.emoji}</span>
                      <span className="co-opt-name">{sauce.label}</span>
                      <span className="co-opt-price">${sauce.price.toFixed(2)}</span>
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
                            <span className="co-counter-price">${(sauce.price*(sel.count||1)).toFixed(2)}</span>
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
                  const id    = item._id || item.id;
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
                  const id    = item._id || item.id;
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

      {/* ── Sticky mobile footer ── */}
      <div className="co-mobile-footer">
        <div className="co-mobile-total">
          <span>Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
        <button className="co-add-btn co-add-btn-mobile" onClick={handleAdd} disabled={!cfg.base || added}>
          {added ? <><Check size={15}/> Added!</> : <><ShoppingBag size={15}/> Add to Cart</>}
        </button>
      </div>

    </div>
  );
}
