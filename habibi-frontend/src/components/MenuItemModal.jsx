import React, { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, Heart, Star, Flame } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './MenuItemModal.css';

const fallbackImg = (id, idx = 0) => `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;
const toWebp = url =>
  url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

export default function MenuItemModal({ itemId, onClose }) {
  const { addItem } = useCart();
  const { isLoggedIn } = useAuth();

  const [item,      setItem]      = useState(null);
  const [modifiers, setModifiers] = useState({ choice_groups: [], addon_groups: [] });
  const [loading,   setLoading]   = useState(true);

  const [choiceSel, setChoiceSel] = useState({});
  const [addonSel,  setAddonSel]  = useState({});
  const [note,      setNote]      = useState('');
  const [qty,       setQty]       = useState(1);
  const [isFav,     setIsFav]     = useState(false);
  const [added,     setAdded]     = useState(false);

  /* ── Load item + modifiers ── */
  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    setChoiceSel({}); setAddonSel({}); setNote(''); setQty(1); setAdded(false);

    Promise.all([menuAPI.getById(itemId), menuAPI.getModifiers(itemId)])
      .then(([itemData, mods]) => {
        setItem(itemData);
        const safeMods = mods || { choice_groups: [], addon_groups: [] };
        setModifiers(safeMods);
        const defaults = {};
        (safeMods.choice_groups || []).forEach(cg => {
          const def = cg.options?.find(o => o.is_default);
          defaults[cg.id] = def?.id ?? cg.options?.[0]?.id ?? null;
        });
        setChoiceSel(defaults);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      favoritesAPI.getAll()
        .then(data => {
          const ids = Array.isArray(data) ? data.map(f => f.menu_item_id) : [];
          setIsFav(ids.includes(parseInt(itemId)));
        })
        .catch(() => {});
    }
  }, [itemId, isLoggedIn]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ── Escape to close ── */
  const handleKey = useCallback(e => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  /* ── Price calculation ── */
  const basePrice  = parseFloat(item?.price || 0);
  const cleanName  = (item?.name || item?.title || '').replace(/\s*\(.*$/, '').trim();
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

  /* ── Addon helpers ── */
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

  const toggleFav = async () => {
    if (!isLoggedIn) return;
    const next = !isFav;
    setIsFav(next);
    try { next ? await favoritesAPI.add(item.id) : await favoritesAPI.remove(item.id); }
    catch { setIsFav(!next); }
  };

  /* ── Add to cart ── */
  const handleAdd = () => {
    const choiceNote = (modifiers.choice_groups || [])
      .map(cg => {
        const opt = cg.options?.find(o => o.id === choiceSel[cg.id]);
        return opt ? `${cg.title}: ${opt.title}` : null;
      }).filter(Boolean).join(' | ');
    const addonNote = Object.entries(addonSel)
      .filter(([, q]) => q > 0)
      .map(([optId, q]) => {
        let label = '';
        (modifiers.addon_groups || []).forEach(ag => {
          const opt = ag.options?.find(o => o.id === parseInt(optId));
          if (opt) label = q > 1 ? `${opt.title} ×${q}` : opt.title;
        });
        return label;
      }).filter(Boolean).join(', ');
    const fullNote = [choiceNote, addonNote, note].filter(Boolean).join('\n');
    addItem({
      id:    item.id,
      name:  cleanName,
      price: unitPrice,
      img:   item.image || item.image_url || fallbackImg(item.id),
      tag:   item.category || 'Item',
      note:  fullNote,
      qty,
    });
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1400);
  };

  const missingRequired = (modifiers.choice_groups || []).some(cg => !choiceSel[cg.id]);

  return (
    <div className="mim-overlay" onClick={onClose}>
      <div className="mim-modal" onClick={e => e.stopPropagation()}>

        <button className="mim-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* ════════ TWO-COLUMN LAYOUT ════════ */}
        <div className="mim-cols">

          {/* LEFT — large item image */}
          <div className="mim-col-left">
            {loading ? (
              <div className="mim-img-skeleton" />
            ) : (
              <>
                <img
                  src={toWebp(item?.image || item?.image_url || fallbackImg(item?.id))}
                  alt={cleanName}
                  className="mim-img"
                  onError={e => { e.target.src = fallbackImg(item?.id); }}
                />
                <div className="mim-img-grad" />

                <div className="mim-img-top">
                  <img
                    src="/images/hero/halal-certified.png"
                    alt="Halal"
                    className="mim-halal-stamp"
                  />
                  {(item?.is_popular || item?.is_featured) && (
                    <span className="mim-top-badge">
                      <Flame size={11} /> #1 Most Liked
                    </span>
                  )}
                </div>

                {isLoggedIn && (
                  <button
                    className={`mim-fav-btn${isFav ? ' active' : ''}`}
                    onClick={toggleFav}
                    aria-label="Save to favourites"
                  >
                    <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* RIGHT — scrollable details + addons */}
          <div className="mim-col-right-wrap">
          <div className="mim-col-right">
            {loading ? (
              <div className="mim-skel-wrap">
                <div className="mim-skel mim-skel--h1" />
                <div className="mim-skel mim-skel--line" />
                <div className="mim-skel mim-skel--line short" />
                <div className="mim-skel mim-skel--block" />
              </div>
            ) : (
              <>
                {/* ── Item header ── */}
                <div className="mim-item-hd">
                  <div className="mim-item-pills">
                    <span className="mim-halal-pill">Halal</span>
                    {item.is_spicy && <span className="mim-spicy-pill">🌶 Spicy</span>}
                  </div>
                  <div className="mim-name-row">
                    <h2 className="mim-name">{cleanName}</h2>
                    <span className="mim-price">${basePrice.toFixed(2)}</span>
                  </div>
                  {item.description && <p className="mim-desc">{item.description}</p>}
                  <div className="mim-stars-row">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={12} fill="#F97316" stroke="#F97316" />
                    ))}
                    <span className="mim-rating-label">4.8 · 170+ ratings</span>
                  </div>
                </div>

                {/* ── Choice groups (radio — required) ── */}
                {(modifiers.choice_groups || []).map(cg => (
                  <div key={cg.id} className="mim-section">
                    <div className="mim-section-hd">
                      <div>
                        <span className="mim-section-title">{cg.title}</span>
                        <p className="mim-section-sub">Select one option</p>
                      </div>
                      <span className="mim-badge mim-badge--req">Required</span>
                    </div>
                    <div className="mim-options-list">
                      {(cg.options || []).map(opt => {
                        const sel   = choiceSel[cg.id] === opt.id;
                        const extra = parseFloat(opt.extra_price || 0);
                        return (
                          <div
                            key={opt.id}
                            className={`mim-opt-row${sel ? ' sel' : ''}`}
                            onClick={() => setChoiceSel(p => ({ ...p, [cg.id]: opt.id }))}
                            role="radio"
                            aria-checked={sel}
                          >
                            <div className={`mim-radio${sel ? ' on' : ''}`} />
                            <span className="mim-opt-name">{opt.title}</span>
                            <span className="mim-opt-price">
                              {extra > 0 ? `+$${extra.toFixed(2)}` : 'Free'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ── Addon groups (checkbox — optional) ── */}
                {(modifiers.addon_groups || []).map(ag => (
                  <div key={ag.id} className="mim-section">
                    <div className="mim-section-hd">
                      <div>
                        <span className="mim-section-title">{ag.title}</span>
                        <p className="mim-section-sub">
                          {ag.max_selections ? `Choose up to ${ag.max_selections}` : 'Add as many as you like'}
                        </p>
                      </div>
                      <span className="mim-badge mim-badge--opt">Optional</span>
                    </div>
                    <div className="mim-options-list">
                      {(ag.options || []).map(opt => {
                        const checked = !!addonSel[opt.id];
                        const aqty   = addonSel[opt.id] || 0;
                        const price  = parseFloat(opt.price || 0);
                        return (
                          <div
                            key={opt.id}
                            className={`mim-addon-row${checked ? ' sel' : ''}`}
                            onClick={() => toggleAddon(opt.id)}
                            role="checkbox"
                            aria-checked={checked}
                          >
                            <div className={`mim-checkbox${checked ? ' on' : ''}`}>
                              {checked && '✓'}
                            </div>
                            <span className="mim-opt-name">{opt.title}</span>
                            <div className="mim-addon-right" onClick={e => e.stopPropagation()}>
                              {checked ? (
                                <div className="mim-stepper">
                                  <button onClick={() => adjustAddonQty(opt.id, -1)}>
                                    <Minus size={10} />
                                  </button>
                                  <span>{aqty}</span>
                                  <button onClick={() => adjustAddonQty(opt.id, 1)}>
                                    <Plus size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="mim-addon-price">
                                  {price === 0 ? 'Free' : `+$${price.toFixed(2)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ── Special Instructions ── */}
                <div className="mim-section">
                  <div className="mim-section-hd">
                    <span className="mim-section-title">Special Instructions</span>
                    <span className="mim-badge mim-badge--opt">Optional</span>
                  </div>
                  <textarea
                    className="mim-notes"
                    placeholder="No onions, extra sauce, well done..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    maxLength={300}
                  />
                </div>

                {/* ── Footer: qty + add to cart ── */}
                <div className="mim-footer">
                  <div className="mim-qty-ctrl">
                    <button className="mim-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>
                      <Minus size={14} />
                    </button>
                    <span className="mim-qty-num">{qty}</span>
                    <button className="mim-qty-btn" onClick={() => setQty(q => q + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    className={`mim-add-btn${added ? ' done' : ''}${missingRequired ? ' off' : ''}`}
                    onClick={handleAdd}
                    disabled={missingRequired || added}
                  >
                    {added ? '✓ Added to Cart!' : `Add to Cart — $${total.toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
          </div>{/* /mim-col-right-wrap */}
        </div>
      </div>
    </div>
  );
}
