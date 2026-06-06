import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Minus, Plus, AlertCircle, ChevronRight } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import './MenuItemPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const fallbackImg = (id, idx = 0) =>
  `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;

const MenuItemPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isLoggedIn } = useAuth();

  const [item,       setItem]       = useState(null);
  const [modifiers,  setModifiers]  = useState({ choice_groups: [], addon_groups: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  /* selections */
  const [choiceSel, setChoiceSel]   = useState({});   // { groupId: optionId }
  const [addonSel,  setAddonSel]    = useState({});   // { optionId: qty }
  const [note,      setNote]        = useState('');
  const [qty,       setQty]         = useState(1);
  const [isFav,     setIsFav]       = useState(false);
  const [added,     setAdded]       = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      menuAPI.getById(id),
      menuAPI.getModifiers(id),
      menuAPI.getAll(),
    ])
      .then(([itemData, mods, allItems]) => {
        const arr = Array.isArray(allItems)
          ? allItems
          : (allItems?.menus || allItems?.items || []);

        setItem(itemData);
        setModifiers(mods || { choice_groups: [], addon_groups: [] });

        /* auto-select defaults */
        const defaults = {};
        (mods?.choice_groups || []).forEach(cg => {
          const def = cg.options?.find(o => o.is_default);
          defaults[cg.id] = def ? def.id : (cg.options?.[0]?.id ?? null);
        });
        setChoiceSel(defaults);

        /* suggestions: same category first, then popular, exclude self */
        const itemId = itemData?.id ?? parseInt(id);
        const cat    = (itemData?.category || '').toLowerCase();
        const same   = arr.filter(i => i.id !== itemId && (i.category || '').toLowerCase() === cat);
        const others = arr.filter(i => i.id !== itemId && (i.category || '').toLowerCase() !== cat);
        setSuggestions([...same, ...others].slice(0, 6));
      })
      .catch(() => setError('Item not found'))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── price calculation ── */
  const basePrice = parseFloat(item?.price || 0);

  let choiceExtra = 0;
  (modifiers.choice_groups || []).forEach(cg => {
    const opt = cg.options?.find(o => o.id === choiceSel[cg.id]);
    if (opt) choiceExtra += parseFloat(opt.extra_price || 0);
  });

  const addonExtra = Object.entries(addonSel).reduce((sum, [optId, q]) => {
    let price = 0;
    (modifiers.addon_groups || []).forEach(ag => {
      const opt = ag.options?.find(o => o.id === parseInt(optId));
      if (opt) price = parseFloat(opt.price || 0);
    });
    return sum + price * q;
  }, 0);

  const unitPrice = basePrice + choiceExtra + addonExtra;
  const total     = unitPrice * qty;

  /* ── add to cart ── */
  const handleAdd = () => {
    const choiceNote = (modifiers.choice_groups || [])
      .map(cg => {
        const opt = cg.options?.find(o => o.id === choiceSel[cg.id]);
        return opt ? `${cg.title}: ${opt.title}` : null;
      })
      .filter(Boolean)
      .join(' | ');

    const addonNote = Object.entries(addonSel)
      .filter(([, q]) => q > 0)
      .map(([optId, q]) => {
        let label = '';
        (modifiers.addon_groups || []).forEach(ag => {
          const opt = ag.options?.find(o => o.id === parseInt(optId));
          if (opt) label = q > 1 ? `${opt.title} ×${q}` : opt.title;
        });
        return label;
      })
      .filter(Boolean)
      .join(', ');

    const fullNote = [choiceNote, addonNote, note].filter(Boolean).join('\n');

    addItem({
      id:    item.id,
      name:  item.name || item.title,
      price: unitPrice,
      img:   item.image || item.image_url || fallbackImg(item.id),
      tag:   item.category || 'Item',
      note:  fullNote,
      qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  /* ── addon helpers ── */
  const toggleAddon = optId => {
    setAddonSel(prev => {
      if (prev[optId]) { const n = { ...prev }; delete n[optId]; return n; }
      return { ...prev, [optId]: 1 };
    });
  };

  const adjustAddonQty = (optId, delta) => {
    setAddonSel(prev => {
      const next = (prev[optId] || 0) + delta;
      if (next <= 0) { const n = { ...prev }; delete n[optId]; return n; }
      return { ...prev, [optId]: next };
    });
  };

  /* ── required check ── */
  const missingRequired = (modifiers.choice_groups || []).some(
    cg => !choiceSel[cg.id]
  );

  /* ── loading / error screens ── */
  if (loading) return (
    <div className="mip-loading">
      <div className="mip-spinner" />
      <p>Loading...</p>
    </div>
  );

  if (error || !item) return (
    <div className="mip-error">
      <AlertCircle size={48} />
      <p>Item not found</p>
      <Link to="/menu" className="mip-err-back">← Back to Menu</Link>
    </div>
  );

  const imgSrc = item.image || item.image_url || fallbackImg(item.id);

  return (
    <div className="mip-page">
      <SEO
        title={`${item.name || item.title} | Habibi Halal Express`}
        description={item.description || `Order ${item.name} from Habibi Halal Express — 100% Halal, fresh daily.`}
      />

      {/* ══════════ HERO IMAGE ══════════ */}
      <div className="mip-hero">
        <img
          src={imgSrc}
          alt={item.name}
          className="mip-hero-img"
          onError={e => { e.target.src = fallbackImg(item.id); }}
        />
        <div className="mip-hero-grad" />

        <button className="mip-back-btn" onClick={() => navigate('/menu')}>
          <ArrowLeft size={16} />
          <span>Menu</span>
        </button>

        {isLoggedIn && (
          <button
            className={`mip-fav-btn${isFav ? ' active' : ''}`}
            onClick={() => setIsFav(f => !f)}
            aria-label="Save to favorites"
          >
            <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        )}

        <img
          src="/images/hero/halal-certified.png"
          alt="Halal Certified"
          className="mip-halal-stamp"
        />
      </div>

      {/* ══════════ SCROLLABLE BODY ══════════ */}
      <div className="mip-body">

        {/* ── Item header ── */}
        <div className="mip-item-header">
          <div className="mip-item-header-left">
            {item.category && (
              <span className="mip-cat-pill">{item.category}</span>
            )}
            <h1 className="mip-item-name">{item.name || item.title}</h1>
            {item.description && (
              <p className="mip-item-desc">{item.description}</p>
            )}
          </div>
          <div className="mip-item-price">${basePrice.toFixed(2)}</div>
        </div>

        {/* ── Choice Groups (radio — required) ── */}
        {(modifiers.choice_groups || []).map(cg => (
          <div key={cg.id} className="mip-section">
            <div className="mip-section-hd">
              <h2 className="mip-section-title">{cg.title}</h2>
              <span className="mip-pill mip-pill--req">Required · Choose 1</span>
            </div>
            <div className="mip-option-list">
              {(cg.options || []).map(opt => {
                const sel    = choiceSel[cg.id] === opt.id;
                const extra  = parseFloat(opt.extra_price || 0);
                const price  = basePrice + extra;
                return (
                  <div
                    key={opt.id}
                    className={`mip-option-row${sel ? ' mip-option-row--sel' : ''}`}
                    onClick={() => setChoiceSel(p => ({ ...p, [cg.id]: opt.id }))}
                    role="radio"
                    aria-checked={sel}
                  >
                    <div className={`mip-radio${sel ? ' mip-radio--on' : ''}`} />
                    <span className="mip-opt-name">{opt.title}</span>
                    <span className="mip-opt-price">${price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Addon Groups (checkbox + qty — optional) ── */}
        {(modifiers.addon_groups || []).map(ag => (
          <div key={ag.id} className="mip-section">
            <div className="mip-section-hd">
              <h2 className="mip-section-title">{ag.title}</h2>
              <span className="mip-pill mip-pill--opt">Optional</span>
            </div>
            <div className="mip-option-list">
              {(ag.options || []).map(opt => {
                const checked = !!addonSel[opt.id];
                const aqty   = addonSel[opt.id] || 0;
                return (
                  <div
                    key={opt.id}
                    className={`mip-addon-row${checked ? ' mip-addon-row--sel' : ''}`}
                  >
                    <div
                      className="mip-addon-left"
                      onClick={() => toggleAddon(opt.id)}
                      role="checkbox"
                      aria-checked={checked}
                    >
                      <div className={`mip-checkbox${checked ? ' mip-checkbox--on' : ''}`}>
                        {checked && '✓'}
                      </div>
                      <span className="mip-opt-name">{opt.title}</span>
                    </div>
                    <div className="mip-addon-right">
                      {checked ? (
                        <div className="mip-addon-stepper">
                          <button onClick={e => { e.stopPropagation(); adjustAddonQty(opt.id, -1); }}>
                            <Minus size={10} />
                          </button>
                          <span>{aqty}</span>
                          <button onClick={e => { e.stopPropagation(); adjustAddonQty(opt.id, 1); }}>
                            <Plus size={10} />
                          </button>
                        </div>
                      ) : (
                        <span className="mip-addon-price">
                          +${parseFloat(opt.price || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Special Notes ── */}
        <div className="mip-section">
          <div className="mip-section-hd">
            <h2 className="mip-section-title">Special Instructions</h2>
            <span className="mip-pill mip-pill--opt">Optional</span>
          </div>
          <textarea
            className="mip-notes"
            placeholder="No onions, extra pickles, well done, sauce on the side..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <p className="mip-notes-count">{note.length}/300</p>
        </div>

        {/* ── Suggestions ── */}
        {suggestions.length > 0 && (
          <div className="mip-suggestions">
            <div className="mip-sugg-hd">
              <h2 className="mip-sugg-title">You Might Also Like</h2>
              <Link to="/menu" className="mip-sugg-all">
                See All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="mip-sugg-track">
              {suggestions.map((s, idx) => (
                <Link
                  key={s.id}
                  to={`/menu/${s.id}`}
                  className="mip-sugg-card"
                >
                  <img
                    src={s.image || s.image_url || fallbackImg(s.id, idx)}
                    alt={s.name}
                    className="mip-sugg-img"
                    onError={e => { e.target.src = fallbackImg(s.id, idx); }}
                  />
                  <div className="mip-sugg-info">
                    <p className="mip-sugg-name">{s.name || s.title}</p>
                    <p className="mip-sugg-price">${parseFloat(s.price || 0).toFixed(2)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mip-footer-spacer" />
      </div>

      {/* ══════════ STICKY FOOTER ══════════ */}
      <div className="mip-sticky">
        <div className="mip-qty-row">
          <button
            className="mip-qty-btn"
            onClick={() => setQty(q => Math.max(1, q - 1))}
          >
            <Minus size={15} />
          </button>
          <span className="mip-qty-val">{qty}</span>
          <button className="mip-qty-btn" onClick={() => setQty(q => q + 1)}>
            <Plus size={15} />
          </button>
        </div>
        <button
          className={`mip-add-btn${added ? ' mip-add-btn--done' : ''}${missingRequired ? ' mip-add-btn--disabled' : ''}`}
          onClick={handleAdd}
          disabled={missingRequired}
        >
          {added
            ? '✓ Added to Cart!'
            : `Add to Cart — $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default MenuItemPage;
