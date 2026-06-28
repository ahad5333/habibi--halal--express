import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, ShoppingBag } from 'lucide-react';
import './BuildYourOwn.css';

/* ── Bases (category 39a–39j) ───────────────────────────────── */
const BASES = [
  { id: '39a', label: 'Hero',                price: 1.99, img: '/images/menu/39a.jpg' },
  { id: '39b', label: 'Wrap',                price: 1.99, img: '/images/menu/39b.jpg', note: 'Habibi Special Wrap' },
  { id: '39c', label: 'Pita Bread',          price: 1.99, img: '/images/menu/39c.jpg' },
  { id: '39d', label: 'Croissant',           price: 1.99, img: '/images/menu/39d.jpg' },
  { id: '39e', label: 'Bagel',               price: 1.99, img: '/images/menu/39e.jpg' },
  { id: '39f', label: 'Roll',                price: 1.49, img: '/images/menu/39f.jpg' },
  { id: '39g', label: 'Burger Bun',          price: 1.99, img: '/images/menu/39g.jpg' },
  { id: '39h', label: 'Hot Dog Bun',         price: 0.99, img: '/images/menu/39h.jpg' },
  { id: '39i', label: 'Platter',             price: 2.99, img: '/images/menu/39i.jpg' },
  { id: '39j', label: 'Family Tray',         price: 4.99, img: '/images/menu/39j.jpg' },
];

/* ── Remaining steps (protein, toppings, sauce) ─────────────── */
const ADD_ON_STEPS = [
  {
    id: 'protein',
    title: 'Choose Your Protein',
    subtitle: 'Freshly prepared, halal certified',
    type: 'single',
    options: [
      { id: 'chicken',   label: 'Chicken',      emoji: '🍗', desc: 'Marinated grilled chicken' },
      { id: 'lamb-gyro', label: 'Lamb Gyro',     emoji: '🥩', desc: 'Slow-roasted gyro meat' },
      { id: 'mixed',     label: 'Mixed (Both)',  emoji: '🍖', desc: 'Chicken + Lamb gyro' },
      { id: 'falafel',   label: 'Falafel',       emoji: '🧆', desc: 'Crispy chickpea fritters' },
    ],
  },
  {
    id: 'toppings',
    title: 'Add Your Toppings',
    subtitle: 'Select all that apply — all free',
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
    subtitle: 'The finishing touch',
    type: 'single',
    options: [
      { id: 'white', label: 'White Sauce', emoji: '🤍', desc: 'Creamy & garlicky' },
      { id: 'hot',   label: 'Hot Sauce',   emoji: '🔥', desc: 'Spicy harissa blend' },
      { id: 'both',  label: 'Both',        emoji: '✨', desc: 'Best of both worlds' },
      { id: 'none',  label: 'No Sauce',    emoji: '⬜', desc: 'Plain & simple' },
    ],
  },
];

export default function BuildYourOwn({ item, onClose, onAdd, initialSelections = {} }) {
  /* stepIdx: -1 = base picker, 0–2 = add-on steps */
  const [stepIdx, setStepIdx]     = useState(-1);
  const [selectedBase, setBase]   = useState(null);
  const [selections, setSelections] = useState({ toppings: [], ...initialSelections });

  const isBasePicker = stepIdx === -1;
  const step         = !isBasePicker ? ADD_ON_STEPS[stepIdx] : null;
  const isLast       = stepIdx === ADD_ON_STEPS.length - 1;
  const totalSteps   = ADD_ON_STEPS.length + 1; // base + 3 add-on steps
  const displayStep  = stepIdx + 2;             // base = step 1, protein = step 2 …

  const current = step?.type === 'multi' ? selections.toppings : selections[step?.id];
  const canAdvance = isBasePicker ? !!selectedBase : (step.type === 'multi' || !!selections[step.id]);

  const basePrice = selectedBase ? selectedBase.price : (parseFloat(item?.price) || 0);
  const heroImg   = selectedBase ? selectedBase.img : null;

  const selectBase = (base) => {
    setBase(base);
    setSelections(s => ({ ...s, base: base.id }));
  };

  const selectSingle = (optId) => setSelections(s => ({ ...s, [step.id]: optId }));

  const toggleMulti = (optId) => {
    setSelections(s => {
      const arr = s.toppings;
      return { ...s, toppings: arr.includes(optId) ? arr.filter(x => x !== optId) : [...arr, optId] };
    });
  };

  const buildName = () => {
    const base    = selectedBase?.label || '';
    const protein = ADD_ON_STEPS[0].options.find(o => o.id === selections.protein)?.label || '';
    const sauce   = ADD_ON_STEPS[2].options.find(o => o.id === selections.sauce)?.label || '';
    return `BYO: ${protein} on ${base}${sauce && sauce !== 'No Sauce' ? ` / ${sauce}` : ''}`;
  };

  const buildNote = () => {
    const tops = ADD_ON_STEPS[1].options.filter(o => selections.toppings.includes(o.id)).map(o => o.label);
    return tops.length ? `Toppings: ${tops.join(', ')}` : 'No toppings';
  };

  const handleAdd = () => {
    onAdd({
      ...item,
      name:  buildName(),
      note:  buildNote(),
      price: basePrice,
    }, 1);
  };

  const goBack = () => {
    if (stepIdx === 0) setStepIdx(-1);
    else setStepIdx(i => i - 1);
  };

  return (
    <div className="byo-overlay" onClick={onClose}>
      <div className="byo-modal" onClick={e => e.stopPropagation()}>

        {/* ── Hero image (shows selected base) ── */}
        <div className="byo-hero" style={heroImg ? { backgroundImage: `url(${heroImg})` } : {}}>
          <div className="byo-hero-overlay" />
          <button className="byo-close byo-close-hero" onClick={onClose}><X size={20} /></button>
          {selectedBase && (
            <div className="byo-hero-label">
              <span className="byo-hero-base-name">{selectedBase.label}</span>
              <span className="byo-hero-price">Starting at ${selectedBase.price.toFixed(2)}</span>
            </div>
          )}
          {!selectedBase && (
            <div className="byo-hero-prompt">
              <span>Build Your Own</span>
              <span className="byo-hero-prompt-sub">Pick a base to get started</span>
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        <div className="byo-progress-bar">
          <div className="byo-progress-fill" style={{ width: `${(isBasePicker ? 1 : displayStep) / totalSteps * 100}%` }} />
        </div>

        {/* ── Header ── */}
        <div className="byo-header">
          <div>
            <p className="byo-step-label">Step {isBasePicker ? 1 : displayStep} of {totalSteps}</p>
            <h2 className="byo-title">{isBasePicker ? 'Choose Your Base' : step.title}</h2>
            <p className="byo-sub">{isBasePicker ? 'Select the bread or vessel for your meal' : step.subtitle}</p>
          </div>
        </div>

        {/* ── Options ── */}
        {isBasePicker ? (
          <div className="byo-bases byo-options">
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
                  <span className="byo-check"><Check size={14} /></span>
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
                  onClick={() => step.type === 'multi' ? toggleMulti(opt.id) : selectSingle(opt.id)}
                >
                  <span className="byo-emoji">{opt.emoji}</span>
                  <span className="byo-opt-label">{opt.label}</span>
                  {opt.desc && <span className="byo-opt-desc">{opt.desc}</span>}
                  {selected && <span className="byo-check"><Check size={14} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="byo-footer">
          {!isBasePicker && (
            <button className="byo-btn byo-btn-back" onClick={goBack}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="byo-btn byo-btn-add" onClick={handleAdd} disabled={!canAdvance}>
              <ShoppingBag size={16} /> Add to Cart — ${basePrice.toFixed(2)}
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
