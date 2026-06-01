import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, ChevronRight } from 'lucide-react';
import './MenuItemModal.css';

const BYO_STEPS = [
  {
    id: 'base',
    label: 'Choose Your Base',
    required: true,
    type: 'radio',
    options: ['Rice', 'Salad', 'Rice & Salad', 'Pita Bread', 'Wrap'],
  },
  {
    id: 'protein',
    label: 'Choose Your Protein',
    required: true,
    type: 'radio',
    options: ['Chicken', 'Lamb', 'Beef', 'Shrimp (+$2)', 'Falafel', 'Mixed Grill (+$3)'],
  },
  {
    id: 'toppings',
    label: 'Choose Toppings',
    required: false,
    type: 'checkbox',
    options: ['Lettuce', 'Tomato', 'Cucumber', 'Red Onion', 'Pickles', 'Jalapeños', 'Olives', 'Feta Cheese (+$1)'],
  },
  {
    id: 'sauce',
    label: 'Choose Your Sauce',
    required: true,
    type: 'checkbox',
    options: ['White Sauce', 'Hot Sauce', 'Tahini', 'Garlic Paste', 'Tzatziki', 'Harissa (+$0.50)'],
  },
];

function isBYO(item) {
  return (item.category || '').toLowerCase().includes('build your own');
}

/* ── Build Your Own Step-by-Step Modal ── */
function BYOModal({ item, onClose, onAdd }) {
  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({});
  const [qty, setQty]       = useState(1);
  const [note, setNote]     = useState('');
  const imgSrc = item.image || item.image_url;

  const current = BYO_STEPS[step];
  const isLast  = step === BYO_STEPS.length - 1;
  const canNext = !current.required || (
    current.type === 'radio'    ? !!answers[current.id] :
    current.type === 'checkbox' ? (answers[current.id] || []).length > 0 : true
  );

  const toggleCheckbox = (opt) => {
    setAnswers(prev => {
      const arr = prev[current.id] || [];
      return { ...prev, [current.id]: arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt] };
    });
  };

  const basePrice = parseFloat(item.price || 0);
  const extraCharge = (answers.protein?.includes('+$2)') ? 2 : answers.protein?.includes('+$3)') ? 3 : 0)
    + (answers.toppings || []).filter(t => t.includes('+$')).reduce((a, t) => a + parseFloat(t.match(/\+\$(\d+\.?\d*)/)?.[1] || 0), 0)
    + (answers.sauce || []).filter(s => s.includes('+$')).reduce((a, s) => a + parseFloat(s.match(/\+\$(\d+\.?\d*)/)?.[1] || 0), 0);
  const total = (basePrice + extraCharge) * qty;

  const handleAdd = () => {
    const mods = Object.entries(answers).map(([k, v]) =>
      `${k.charAt(0).toUpperCase() + k.slice(1)}: ${Array.isArray(v) ? v.join(', ') : v}`
    ).join(' | ');
    onAdd({ ...item, note: [mods, note].filter(Boolean).join('\n'), price: basePrice + extraCharge }, qty);
    onClose();
  };

  return (
    <div className="mim-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mim-modal mim-byo">
        <button className="mim-close" onClick={onClose}><X size={18} /></button>

        {/* Progress bar */}
        <div className="mim-byo-progress">
          {BYO_STEPS.map((s, i) => (
            <div key={s.id} className={`mim-byo-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="mim-byo-step-dot">{i < step ? '✓' : i + 1}</span>
              <span className="mim-byo-step-label">{s.label.split(' ')[1]}</span>
            </div>
          ))}
        </div>

        <div className="mim-byo-content">
          {imgSrc && step === 0 && (
            <div className="mim-byo-hero">
              <img src={imgSrc} alt={item.name} />
              <div className="mim-byo-hero-overlay">
                <h2>{item.name}</h2>
                <p className="mim-price">${basePrice.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="mim-section">
            <p className="mim-section-title">
              {current.label}
              {current.required && <span className="mim-required">Required</span>}
            </p>
            <div className="mim-chips">
              {current.options.map(opt => {
                const isSelected = current.type === 'radio'
                  ? answers[current.id] === opt
                  : (answers[current.id] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    className={`mim-chip${isSelected ? ' selected' : ''}`}
                    onClick={() => current.type === 'radio'
                      ? setAnswers(p => ({ ...p, [current.id]: opt }))
                      : toggleCheckbox(opt)
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {isLast && (
            <>
              <div className="mim-section">
                <h3 className="mim-section-title">Special Instructions <span className="mim-optional">Optional</span></h3>
                <textarea
                  className="mim-instructions"
                  placeholder="Any special requests? Allergies? Let us know…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="mim-qty-row">
                <button className="mim-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={14} /></button>
                <span className="mim-qty-val">{qty}</span>
                <button className="mim-qty-btn" onClick={() => setQty(q => q + 1)}><Plus size={14} /></button>
              </div>
            </>
          )}
        </div>

        <div className="mim-footer">
          {step > 0 && (
            <button className="mim-btn-back" onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          {!isLast ? (
            <button className="mim-btn-next" onClick={() => setStep(s => s + 1)} disabled={!canNext}>
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button className="mim-btn-add" onClick={handleAdd} disabled={!canNext}>
              Add to Cart — ${total.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Regular Item Detail Modal ── */
export default function MenuItemModal({ item, onClose, onAdd }) {
  const [qty, setQty]               = useState(1);
  const [selectedChoice, setChoice] = useState('');
  const [selectedAddons, setAddons] = useState([]);

  const imgSrc    = item.image || item.image_url;
  const choices   = Array.isArray(item.choices) ? item.choices : [];
  const addons    = Array.isArray(item.addons)  ? item.addons  : [];
  const basePrice = parseFloat(item.price || 0);

  if (isBYO(item)) return <BYOModal item={item} onClose={onClose} onAdd={onAdd} />;

  const addonTotal = selectedAddons.reduce((sum, name) => {
    const a = addons.find(a => (a.name || a) === name);
    return sum + parseFloat(a?.price || a?.extra_price || 0);
  }, 0);
  const total = (basePrice + addonTotal) * qty;

  const handleAdd = () => {
    onAdd({
      ...item,
      note: [selectedChoice, selectedAddons.join(', ')].filter(Boolean).join(' | '),
      price: basePrice + addonTotal,
    }, qty);
    onClose();
  };

  return (
    <div className="mim-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mim-modal">
        <button className="mim-close" onClick={onClose}><X size={15} /></button>

        {/* Full-width image — fixed aspect ratio so always fully visible */}
        {imgSrc && (
          <div className="mim-img-wrap">
            <img
              src={imgSrc}
              alt={item.name}
              onError={e => { e.target.closest('.mim-img-wrap').style.display = 'none'; }}
            />
            {item.category && <span className="mim-cat-badge">{item.category}</span>}
          </div>
        )}

        <div className="mim-body">
          <div className="mim-header">
            <h2 className="mim-title">{item.name}</h2>
            <span className="mim-price">${basePrice.toFixed(2)}</span>
          </div>

          {choices.length > 0 && (
            <div className="mim-section">
              <p className="mim-section-title">
                Choose One <span className="mim-required">Required</span>
              </p>
              <div className="mim-chips">
                {choices.map((c, i) => {
                  const name  = typeof c === 'string' ? c : c.name;
                  const extra = parseFloat(c.price || c.extra_price || 0);
                  return (
                    <button
                      key={i}
                      className={`mim-chip${selectedChoice === name ? ' selected' : ''}`}
                      onClick={() => setChoice(name)}
                    >
                      {name}{extra > 0 && <em>+${extra.toFixed(2)}</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {addons.length > 0 && (
            <div className="mim-section">
              <p className="mim-section-title">
                Add-ons <span className="mim-optional">Optional</span>
              </p>
              <div className="mim-chips">
                {addons.map((a, i) => {
                  const name  = typeof a === 'string' ? a : a.name;
                  const extra = parseFloat(a.price || a.extra_price || 0);
                  const checked = selectedAddons.includes(name);
                  return (
                    <button
                      key={i}
                      className={`mim-chip${checked ? ' selected' : ''}`}
                      onClick={() => setAddons(prev =>
                        checked ? prev.filter(x => x !== name) : [...prev, name]
                      )}
                    >
                      {name}{extra > 0 && <em>+${extra.toFixed(2)}</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mim-footer">
            <div className="mim-qty-row">
              <button className="mim-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={13} /></button>
              <span className="mim-qty-val">{qty}</span>
              <button className="mim-qty-btn" onClick={() => setQty(q => q + 1)}><Plus size={13} /></button>
            </div>
            <button
              className="mim-btn-add"
              onClick={handleAdd}
              disabled={choices.length > 0 && !selectedChoice}
            >
              Add to Cart — ${total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
