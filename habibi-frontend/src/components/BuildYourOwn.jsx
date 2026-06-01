import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, ShoppingBag } from 'lucide-react';
import './BuildYourOwn.css';

const STEPS = [
  {
    id: 'base',
    title: 'Choose Your Base',
    subtitle: 'What goes under everything?',
    type: 'single',
    options: [
      { id: 'rice',       label: 'White Rice',       emoji: '🍚', desc: 'Fragrant basmati' },
      { id: 'salad',      label: 'Garden Salad',     emoji: '🥗', desc: 'Fresh greens & veggies' },
      { id: 'rice-salad', label: 'Rice + Salad',     emoji: '🍱', desc: 'Half and half' },
      { id: 'pita',       label: 'Pita Bread',       emoji: '🫓', desc: 'Warm & fluffy' },
    ],
  },
  {
    id: 'protein',
    title: 'Choose Your Protein',
    subtitle: 'Freshly prepared, halal certified',
    type: 'single',
    options: [
      { id: 'chicken',     label: 'Chicken',          emoji: '🍗', desc: 'Marinated grilled chicken' },
      { id: 'lamb-gyro',   label: 'Lamb Gyro',        emoji: '🥩', desc: 'Slow-roasted gyro meat' },
      { id: 'mixed',       label: 'Mixed (Both)',     emoji: '🍖', desc: 'Chicken + Lamb gyro' },
      { id: 'falafel',     label: 'Falafel',          emoji: '🧆', desc: 'Crispy chickpea fritters' },
    ],
  },
  {
    id: 'toppings',
    title: 'Add Your Toppings',
    subtitle: 'Select all that apply',
    type: 'multi',
    options: [
      { id: 'lettuce',   label: 'Lettuce',     emoji: '🥬' },
      { id: 'tomatoes',  label: 'Tomatoes',    emoji: '🍅' },
      { id: 'onions',    label: 'Onions',      emoji: '🧅' },
      { id: 'pickles',   label: 'Pickles',     emoji: '🥒' },
      { id: 'peppers',   label: 'Hot Peppers', emoji: '🌶️' },
      { id: 'hummus',    label: 'Hummus',      emoji: '🥣' },
    ],
  },
  {
    id: 'sauce',
    title: 'Choose Your Sauce',
    subtitle: 'The finishing touch',
    type: 'single',
    options: [
      { id: 'white',   label: 'White Sauce',   emoji: '🤍', desc: 'Creamy & garlicky' },
      { id: 'hot',     label: 'Hot Sauce',     emoji: '🔥', desc: 'Spicy harissa blend' },
      { id: 'both',    label: 'Both',          emoji: '✨', desc: 'Best of both worlds' },
      { id: 'none',    label: 'No Sauce',      emoji: '⬜', desc: 'Plain & simple' },
    ],
  },
];

export default function BuildYourOwn({ item, onClose, onAdd, initialSelections = {} }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState({ toppings: [], ...initialSelections });

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  const current = step.type === 'multi' ? selections.toppings : selections[step.id];

  const selectSingle = (optId) => setSelections(s => ({ ...s, [step.id]: optId }));

  const toggleMulti = (optId) => {
    setSelections(s => {
      const arr = s.toppings;
      return { ...s, toppings: arr.includes(optId) ? arr.filter(x => x !== optId) : [...arr, optId] };
    });
  };

  const canAdvance = step.type === 'multi' || !!selections[step.id];

  const buildName = () => {
    const base    = STEPS[0].options.find(o => o.id === selections.base)?.label || '';
    const protein = STEPS[1].options.find(o => o.id === selections.protein)?.label || '';
    const sauce   = STEPS[3].options.find(o => o.id === selections.sauce)?.label || '';
    return `BYO: ${protein} / ${base} / ${sauce}`;
  };

  const buildNote = () => {
    const tops = STEPS[2].options.filter(o => selections.toppings.includes(o.id)).map(o => o.label);
    return tops.length ? `Toppings: ${tops.join(', ')}` : 'No toppings';
  };

  const handleAdd = () => {
    onAdd({
      ...item,
      name: buildName(),
      note: buildNote(),
    }, 1);
  };

  return (
    <div className="byo-overlay" onClick={onClose}>
      <div className="byo-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="byo-header">
          <div>
            <p className="byo-step-label">Step {stepIdx + 1} of {STEPS.length}</p>
            <h2 className="byo-title">{step.title}</h2>
            <p className="byo-sub">{step.subtitle}</p>
          </div>
          <button className="byo-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Progress bar */}
        <div className="byo-progress-bar">
          <div className="byo-progress-fill" style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        {/* Options grid */}
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

        {/* Footer navigation */}
        <div className="byo-footer">
          {!isFirst && (
            <button className="byo-btn byo-btn-back" onClick={() => setStepIdx(i => i - 1)}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="byo-btn byo-btn-add" onClick={handleAdd} disabled={!canAdvance}>
              <ShoppingBag size={16} /> Add to Cart — ${parseFloat(item?.price || 0).toFixed(2)}
            </button>
          ) : (
            <button className="byo-btn byo-btn-next" onClick={() => setStepIdx(i => i + 1)} disabled={!canAdvance}>
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
