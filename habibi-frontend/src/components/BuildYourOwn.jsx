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
  { id: '39i', label: 'Platter',       price: 2.99, img: '/images/menu/39i.jpg', family: 'platter'    },
  { id: '39j', label: 'Family Tray',   price: 4.99, img: '/images/menu/39j.jpg', family: 'familyTray' },
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
    img: '/images/byo/ing/hotdog.png',
    layer: 5, tile: false, blend: 'multiply',
    /* Scale rules come from the family diagram:
       Hero = full-length; Standard = ~60%; Compact = fits snugly;
       Wrap = angled; Platter = 2 side-by-side; FamilyTray = 3 */
    family: {
      hero:       { x: 50, y: 52, scale: 0.82, rot: 0,   count: 1 },
      standard:   { x: 50, y: 54, scale: 0.58, rot: 0,   count: 1 },
      compact:    { x: 50, y: 57, scale: 0.50, rot: 0,   count: 1 },
      wrap:       { x: 50, y: 52, scale: 0.52, rot: -22, count: 1 },
      platter:    { x: 36, y: 52, scale: 0.54, rot: 0,   count: 2, sx: 28 },
      familyTray: { x: 30, y: 52, scale: 0.44, rot: 0,   count: 3, sx: 20 },
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
    img: '/images/byo/ing/lettuce.png',
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
    img: '/images/byo/ing/tomato.png',
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
    img: '/images/byo/ing/onion.png',
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
    img: '/images/byo/ing/pepper.png',
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
   INGREDIENT CANVAS RENDERER
   Returns an array of <img> elements, each absolutely positioned
   within the canvas div.  Multiple copies handle duplication.
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
   BYO STEP DEFINITIONS (protein → toppings → sauce)
───────────────────────────────────────────────────────────────── */
const ADD_ON_STEPS = [
  {
    id: 'protein',
    title: 'Choose Your Protein',
    subtitle: 'Freshly prepared, Zabiha halal certified',
    type: 'single',
    options: [
      { id: 'chicken',   label: 'Chicken',       emoji: '🍗', desc: 'Marinated chopped chicken' },
      { id: 'lamb-gyro', label: 'Lamb Gyro',      emoji: '🥩', desc: 'Slow-roasted gyro slices' },
      { id: 'mixed',     label: 'Mixed (Both)',   emoji: '🍖', desc: 'Chicken + Lamb gyro' },
      { id: 'falafel',   label: 'Falafel',        emoji: '🧆', desc: 'Crispy chickpea fritters' },
      { id: 'hotdog',    label: 'Frank / Hotdog', emoji: '🌭', desc: 'Grilled halal beef frank' },
    ],
  },
  {
    id: 'toppings',
    title: 'Add Your Toppings',
    subtitle: 'Select all that apply',
    type: 'multi',
    options: [
      { id: 'lettuce',  label: 'Lettuce',     emoji: '🥬' },
      { id: 'tomatoes', label: 'Tomatoes',    emoji: '🍅' },
      { id: 'onions',   label: 'Onions',      emoji: '🧅' },
      { id: 'pickles',  label: 'Pickles',     emoji: '🥒' },
      { id: 'peppers',  label: 'Hot Peppers', emoji: '🌶️' },
      { id: 'hummus',   label: 'Hummus',      emoji: '🥣' },
    ],
  },
  {
    id: 'sauce',
    title: 'Choose Your Sauce',
    subtitle: 'The finishing touch — drizzled on top',
    type: 'single',
    options: [
      { id: 'white', label: 'White Sauce', emoji: '🤍', desc: 'Creamy & garlicky' },
      { id: 'hot',   label: 'Hot Sauce',   emoji: '🔥', desc: 'Spicy harissa blend' },
      { id: 'both',  label: 'Both',        emoji: '✨', desc: 'White + hot side by side' },
      { id: 'none',  label: 'No Sauce',    emoji: '⬜', desc: 'Plain & simple' },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────── */
export default function BuildYourOwn({ item, onClose, onAdd, initialSelections = {} }) {
  const [stepIdx, setStepIdx]       = useState(-1);          // -1 = base picker
  const [selectedBase, setBase]     = useState(null);
  const [selections, setSelections] = useState({ toppings: [], ...initialSelections });

  const isBasePicker = stepIdx === -1;
  const step         = !isBasePicker ? ADD_ON_STEPS[stepIdx] : null;
  const isLast       = stepIdx === ADD_ON_STEPS.length - 1;
  const totalSteps   = ADD_ON_STEPS.length + 1;
  const displayStep  = stepIdx + 2;

  const canAdvance = isBasePicker
    ? !!selectedBase
    : (step.type === 'multi' || !!selections[step.id]);

  const basePrice = selectedBase ? selectedBase.price : 0;
  const family    = selectedBase?.family || 'standard';

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
    setSelections(s => ({ ...s, base: base.id }));
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
    onAdd({ ...item, name: buildName(), note: buildNote(), price: basePrice }, 1);
  };

  const goBack = () => setStepIdx(i => (i === 0 ? -1 : i - 1));

  return (
    <div className="byo-overlay" onClick={onClose}>
      <div className="byo-modal" onClick={e => e.stopPropagation()}>

        {/* ── Visual Compositing Canvas ──────────────────────── */}
        <div className="byo-canvas">
          {selectedBase && (
            <img
              src={selectedBase.img}
              alt={selectedBase.label}
              className="byo-canvas-base"
            />
          )}

          {/* Render ingredient layers (sorted by z-index for correct order) */}
          {selectedBase && activeIngredients.map(id =>
            renderIngredient(id, family, id)
          )}

          {/* Canvas overlay UI */}
          <div className="byo-canvas-ui">
            <button className="byo-close-btn" onClick={onClose}><X size={18} /></button>
            {selectedBase ? (
              <div className="byo-canvas-badge">
                <span className="byo-canvas-base-name">{selectedBase.label}</span>
                <span className="byo-canvas-price">from ${selectedBase.price.toFixed(2)}</span>
              </div>
            ) : (
              <div className="byo-canvas-empty">
                <span className="byo-canvas-empty-title">Build Your Own</span>
                <span className="byo-canvas-empty-sub">Start by choosing a base ↓</span>
              </div>
            )}
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
              {isBasePicker ? 'Pick the bread or vessel — sets your starting price' : step.subtitle}
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
          <div className={`byo-options ${step.type === 'multi' ? 'byo-grid-3' : 'byo-grid-2'}`}>
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
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button
              className="byo-btn byo-btn-add"
              onClick={handleAdd}
              disabled={!canAdvance}
            >
              <ShoppingBag size={16} />
              Add to Cart — ${basePrice.toFixed(2)}
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
