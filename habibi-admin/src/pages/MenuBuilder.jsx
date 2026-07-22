import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Upload, ToggleLeft, ToggleRight, ImageOff, EyeOff, Eye, MapPin } from 'lucide-react';
import { adminAPI } from '../services/api';
import './MenuBuilder.css';

const API      = import.meta.env.VITE_API_URL      || 'http://localhost:5001';
const FRONTEND = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174';
const ALL_CATEGORIES = [
  'Breakfast','Platter','Sandwich','Bergers','Tacos','Habibi Specials',
  'Extras','Drinks','Family Tray','Build Your Own','Build Your Own Sandwich',
];

const EMPTY_FORM = { name: '', description: '', price: '', partner_price: '', categories: [], notes: '', is_active: true, is_spicy: false, is_vegetarian: false, is_gluten_free: false, is_featured: false, image: null, choices: [], addons: [], addons_max: '', temperature: 'hot', exclude_global_addons: false, quota_required: '', sort_order: 0 };

function parseJsonSafe(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) || []; } catch { return []; }
}

function imgSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  // Static frontend images (/images/menu/...) live on the frontend domain
  if (url.startsWith('/images/')) return `${FRONTEND}${url}`;
  // Admin-uploaded files (/uploads/...) live on the backend domain
  return `${API}${url}`;
}

/* ── Add / Edit Modal ─────────────────────────────────────────── */
function MenuModal({ item, categories, onClose, onSave }) {
  const [form, setForm] = useState(item ? {
    name: item.name || '', description: item.description || '',
    price: item.price || '', partner_price: item.partner_price || '',
    categories: Array.isArray(item.categories) && item.categories.length
      ? item.categories
      : (item.category ? [item.category] : []),
    notes: item.notes || '',
    is_active: item.is_active !== false,
    is_spicy: !!item.is_spicy,
    is_vegetarian: !!item.is_vegetarian,
    is_gluten_free: !!item.is_gluten_free,
    is_featured: !!item.is_featured,
    image: null,
    choices:     parseJsonSafe(item.choices),
    addons:      parseJsonSafe(item.addons),
    addons_max:  item.addons_max || '',
    temperature: item.temperature || 'hot',
    exclude_global_addons: item.exclude_global_addons || false,
    quota_required: item.quota_required || '',
    sort_order: item.sort_order ?? 0,
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [preview, setPreview] = useState(imgSrc(item?.image_url) || null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { set('image', f); setPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { setError('Name and price are required.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('partner_price', form.partner_price || form.price);
      fd.append('category', form.categories[0] || '');
      fd.append('categories', JSON.stringify(form.categories));
      fd.append('notes', form.notes);
      fd.append('is_active', form.is_active);
      fd.append('is_spicy', form.is_spicy);
      fd.append('is_vegetarian', form.is_vegetarian);
      fd.append('is_gluten_free', form.is_gluten_free);
      fd.append('is_featured', form.is_featured);
      fd.append('addons_max', form.addons_max || '');
      fd.append('temperature', form.temperature || 'hot');
      fd.append('exclude_global_addons', form.exclude_global_addons ? 'true' : 'false');
      fd.append('quota_required', form.quota_required || '');
      fd.append('sort_order', form.sort_order ?? 0);
      if (form.image) fd.append('image', form.image);
      fd.append('choices', JSON.stringify(form.choices || []));
      fd.append('addons',  JSON.stringify(form.addons  || []));
      await onSave(fd, item?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{item ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="mb-error">⚠ {error}</div>}

            <div className="mb-img-row">
              {preview ? (
                <div className="mb-img-preview">
                  <img src={preview} alt="preview" />
                  <button type="button" className="mb-img-remove" onClick={() => { setPreview(null); set('image', null); }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="mb-img-drop">
                  <Upload size={20} />
                  <span>Upload image</span>
                  <input type="file" accept="image/*" onChange={handleFile} hidden />
                </label>
              )}
            </div>

            <div className="mb-row">
              <div className="field" style={{ flex: 2 }}>
                <label>Item Name *</label>
                <input className="input" placeholder="e.g. Lamb Shawarma Plate" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="field">
                <label>Price *</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} required />
              </div>
              <div className="field">
                <label>Partner Price</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.partner_price} onChange={e => set('partner_price', e.target.value)} />
              </div>
              <div className="field" style={{ width: 80 }}>
                <label title="Lower number = appears first within its category">Sort #</label>
                <input type="number" min="0" step="1" className="input" placeholder="0" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
              </div>
            </div>

            <div className="field">
              <label>Categories <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>(select all that apply)</span></label>
              <div className="mb-cat-checkboxes">
                {ALL_CATEGORIES.map(cat => (
                  <label key={cat} className={`mb-cat-checkbox${form.categories.includes(cat) ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.categories.includes(cat)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...form.categories, cat]
                          : form.categories.filter(c => c !== cat);
                        set('categories', next);
                      }}
                    />
                    {cat}
                  </label>
                ))}
              </div>
              {form.categories.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>Select at least one category</p>
              )}
            </div>

            <div className="field">
              <label>Description</label>
              <textarea className="input textarea" rows={3} placeholder="Short description..." value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="field">
              <label>Notes / Allergen Info</label>
              <input className="input" placeholder="e.g. Contains nuts, gluten-free" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            <div className="mb-toggle-row">
              <span>Available for ordering</span>
              <button type="button" className="mb-toggle-btn" onClick={() => set('is_active', !form.is_active)}>
                {form.is_active
                  ? <ToggleRight size={26} color="var(--color-success)" />
                  : <ToggleLeft size={26} color="var(--color-text-muted)" />}
              </button>
            </div>

            <div className="mb-dietary-row">
              <button type="button" className={`mb-dietary-pill${form.is_spicy ? ' active' : ''}`} onClick={() => set('is_spicy', !form.is_spicy)}>
                🌶️ Spicy
              </button>
              <button type="button" className={`mb-dietary-pill${form.is_vegetarian ? ' active' : ''}`} onClick={() => set('is_vegetarian', !form.is_vegetarian)}>
                🥬 Vegetarian
              </button>
              <button type="button" className={`mb-dietary-pill${form.is_gluten_free ? ' active' : ''}`} onClick={() => set('is_gluten_free', !form.is_gluten_free)}>
                🌾 Gluten Free
              </button>
              <button type="button" className={`mb-dietary-pill${form.is_featured ? ' active' : ''}`} onClick={() => set('is_featured', !form.is_featured)}>
                ⭐ Featured
              </button>
            </div>

            <div className="field">
              <label>Serving Temperature <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, fontSize: '0.78rem' }}>(controls visual effect on menu)</span></label>
              <div className="mb-temp-row">
                {[
                  { val: 'hot',    label: '🔥 Hot',    hint: 'Steam / smoke effect' },
                  { val: 'cold',   label: '🧊 Cold',   hint: 'No effect (e.g. salad)' },
                  { val: 'frozen', label: '❄️ Frozen',  hint: 'Ice crystal effect (drinks)' },
                  { val: 'none',   label: '🚫 None',   hint: 'No effect at all' },
                ].map(({ val, label, hint }) => (
                  <button
                    key={val}
                    type="button"
                    className={`mb-temp-btn${form.temperature === val ? ' active' : ''}`}
                    onClick={() => set('temperature', val)}
                    title={hint}
                  >
                    {label}
                    <span className="mb-temp-hint">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Global Add-ons toggle ── */}
            <div className="mb-toggle-row" style={{ marginTop: '0.75rem' }}>
              <span>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>Exclude Global Add-ons</strong>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                  Turn on for bakery / dessert items — hides Sauces, Make it a Meal!, Add a Drink
                </span>
              </span>
              <button type="button" className="mb-toggle-btn" onClick={() => set('exclude_global_addons', !form.exclude_global_addons)}>
                {form.exclude_global_addons
                  ? <ToggleRight size={26} color="var(--color-primary)" />
                  : <ToggleLeft  size={26} color="var(--color-text-muted)" />}
              </button>
            </div>

            {/* ── Quota Required ── */}
            <div className="mb-toggle-row" style={{ marginTop: '0.75rem', alignItems: 'flex-start', gap: '1rem' }}>
              <span>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>Taco Quota (Pick-N)</strong>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                  For "Dozen of Tacos" — set to 12 so customer must pick exactly that many tacos. Leave blank for normal items.
                </span>
              </span>
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                className="input"
                placeholder="—"
                style={{ width: '5rem', flexShrink: 0 }}
                value={form.quota_required}
                onChange={e => set('quota_required', e.target.value ? parseInt(e.target.value) : '')}
              />
            </div>

            {/* ── Choices (one must be selected) ── */}
            <div className="mb-section">
              <div className="mb-section-hdr">
                <p className="mb-section-title">Choices <span className="mb-section-hint">(customer picks one per group)</span></p>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => set('choices', [...(form.choices||[]), { group: 'Size', required: true, options: [{ name: 'Regular', price: 0 }] }])}>
                  <Plus size={13} /> Add Group
                </button>
              </div>
              {(form.choices||[]).map((grp, gi) => (
                <div key={gi} className="mb-choice-group">
                  <div className="mb-choice-group-hdr">
                    <input className="input mb-group-name" placeholder="Group name (e.g. Size)" value={grp.group}
                      onChange={e => { const c=[...form.choices]; c[gi]={...c[gi],group:e.target.value}; set('choices',c); }} />
                    <label className="mb-required-toggle" title="If required, customer must pick one option from this group">
                      <input type="checkbox" checked={!!grp.required}
                        onChange={e => { const c=[...form.choices]; c[gi]={...c[gi],required:e.target.checked}; set('choices',c); }} />
                      <span>Required</span>
                    </label>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => set('choices', form.choices.filter((_,i)=>i!==gi))}>
                      <Trash2 size={13} color="var(--color-error)" />
                    </button>
                  </div>
                  {grp.options.map((opt, oi) => (
                    <div key={oi} className="mb-option-row">
                      <input className="input mb-opt-name" placeholder="Option name" value={opt.name}
                        onChange={e => { const c=[...form.choices]; c[gi].options[oi]={...opt,name:e.target.value}; set('choices',c); }} />
                      <span className="mb-opt-price-label">+$</span>
                      <input type="number" min="0" step="0.01" className="input mb-opt-price" placeholder="0.00" value={opt.price}
                        onChange={e => { const c=[...form.choices]; c[gi].options[oi]={...opt,price:parseFloat(e.target.value)||0}; set('choices',c); }} />
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => { const c=[...form.choices]; c[gi].options=c[gi].options.filter((_,i)=>i!==oi); set('choices',c); }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:4}}
                    onClick={() => { const c=[...form.choices]; c[gi].options=[...c[gi].options,{name:'',price:0}]; set('choices',c); }}>
                    <Plus size={12} /> Add option
                  </button>
                </div>
              ))}
            </div>

            {/* ── Add-ons (optional, multi-select) ── */}
            <div className="mb-section">
              <div className="mb-section-hdr">
                <p className="mb-section-title">Add-ons <span className="mb-section-hint">(optional, customer can check multiple)</span></p>
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <label className="mb-required-toggle" title="Maximum number of add-ons customer may select (leave blank for unlimited)">
                    <span style={{fontSize:'0.72rem',color:'var(--color-text-muted)'}}>Max select:</span>
                    <input type="number" min="1" className="input mb-opt-price" placeholder="∞"
                      value={form.addons_max || ''}
                      onChange={e => set('addons_max', e.target.value ? +e.target.value : '')}
                      style={{width:'3.5rem'}} />
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => set('addons', [...(form.addons||[]), { name: '', price: 0 }])}>
                    <Plus size={13} /> Add Add-on
                  </button>
                </div>
              </div>
              {(form.addons||[]).map((addon, ai) => (
                <div key={ai} className="mb-option-row">
                  <input className="input mb-opt-name" placeholder="Add-on name (e.g. Extra Sauce)"
                    value={addon.name}
                    onChange={e => { const a=[...form.addons]; a[ai]={...addon,name:e.target.value}; set('addons',a); }} />
                  <span className="mb-opt-price-label">+$</span>
                  <input type="number" min="0" step="0.01" className="input mb-opt-price" placeholder="0.00"
                    value={addon.price}
                    onChange={e => { const a=[...form.addons]; a[ai]={...addon,price:parseFloat(e.target.value)||0}; set('addons',a); }} />
                  <button type="button" className="btn btn-ghost btn-icon"
                    onClick={() => set('addons', form.addons.filter((_,i)=>i!==ai))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (item ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const AVAIL_LABELS = { available: 'Available', sold_out: 'Sold Out', inactive: 'Inactive' };
const AVAIL_BADGE  = { available: 'badge-success', sold_out: 'badge-warning', inactive: 'badge-error' };

/* ── Build-Your-Own Ingredients ──────────────────────────────────
   Backs the customer-facing Custom Order (BYO) builder — bases, cheese,
   veggies, proteins, and sauces are all admin-editable here so the whole
   BYO pricing menu no longer requires a code change to update.        ── */
const BYO_TABS = ['base', 'cheese', 'veg', 'protein', 'sauce', 'bowl_base', 'bowl_topping'];
const BYO_TAB_LABELS = {
  base: 'Bases', cheese: 'Cheese', veg: 'Veggies', protein: 'Proteins', sauce: 'Sauces',
  bowl_base: 'Bowl Bases', bowl_topping: 'Bowl Toppings',
};
const BYO_FAMILY_OPTIONS = ['hero', 'wrap', 'compact', 'standard', 'platter', 'familyTray'];
const BYO_QTY_TYPE_OPTIONS = ['eggs', 'low-extra', 'single-double', 'single-triple'];
const BYO_EMPTY_FORM = { option_key: '', label: '', price: '', emoji: '', qty_type: '', family: '', note: '', sort_order: 0, is_active: true, image: null, rim_image: null };

function ByoIngredientModal({ item, category, onClose, onSave }) {
  const isNew = !item;
  const [form, setForm] = useState(item ? {
    option_key: item.option_key || '',
    label: item.label || '',
    price: item.price ?? '',
    emoji: item.emoji || '',
    qty_type: item.qty_type || '',
    family: item.family || '',
    note: item.note || '',
    sort_order: item.sort_order ?? 0,
    is_active: item.is_active !== false,
    image: null,
    rim_image: null,
  } : { ...BYO_EMPTY_FORM });
  const [preview, setPreview] = useState(imgSrc(item?.image_url) || null);
  const [rimPreview, setRimPreview] = useState(imgSrc(item?.rim_image_url) || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || form.price === '') { setError('Label and price are required.'); return; }
    if (isNew && !form.option_key.trim()) { setError('A unique key is required (e.g. "shrimp", "39a").'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      if (isNew) { fd.append('option_key', form.option_key.trim()); fd.append('category', category); }
      fd.append('label', form.label);
      fd.append('price', form.price);
      fd.append('emoji', form.emoji || '');
      fd.append('sort_order', form.sort_order ?? 0);
      fd.append('is_active', form.is_active);
      if (category === 'base') { fd.append('family', form.family || ''); fd.append('note', form.note || ''); }
      if (category === 'protein') { fd.append('qty_type', form.qty_type || ''); fd.append('note', form.note || ''); }
      if (form.image) fd.append('image', form.image);
      if (form.rim_image) fd.append('rim_image', form.rim_image);
      await onSave(fd, item?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{item ? `Edit ${BYO_TAB_LABELS[category]} Item` : `Add ${BYO_TAB_LABELS[category]} Item`}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="mb-error">⚠ {error}</div>}

            <div className="mb-img-row">
              {preview ? (
                <div className="mb-img-preview">
                  <img src={preview} alt="preview" />
                  <button type="button" className="mb-img-remove" onClick={() => { setPreview(null); set('image', null); }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="mb-img-drop">
                  <Upload size={20} />
                  <span>Upload image</span>
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { set('image', f); setPreview(URL.createObjectURL(f)); } }} hidden />
                </label>
              )}
            </div>

            {isNew && (
              <div className="field">
                <label>Key * <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>(unique, lowercase, no spaces — e.g. "shrimp")</span></label>
                <input className="input" placeholder="e.g. shrimp" value={form.option_key} onChange={e => set('option_key', e.target.value.trim())} required />
              </div>
            )}

            <div className="mb-row">
              <div className="field" style={{ flex: 2 }}>
                <label>Label *</label>
                <input className="input" placeholder="e.g. Shrimp" value={form.label} onChange={e => set('label', e.target.value)} required />
              </div>
              <div className="field">
                <label>Price *</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} required />
              </div>
              <div className="field" style={{ width: 80 }}>
                <label title="Lower number = appears first">Sort #</label>
                <input type="number" min="0" step="1" className="input" placeholder="0" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
              </div>
            </div>

            {category === 'base' && (
              <>
                <div className="field">
                  <label>Family <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>(controls ingredient layout/sizing on this base)</span></label>
                  <select className="input select" value={form.family} onChange={e => set('family', e.target.value)}>
                    <option value="">— none —</option>
                    {BYO_FAMILY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Note</label>
                  <input className="input" placeholder="e.g. Habibi Special Wrap" value={form.note} onChange={e => set('note', e.target.value)} />
                </div>
                <div className="mb-img-row">
                  {rimPreview ? (
                    <div className="mb-img-preview">
                      <img src={rimPreview} alt="rim preview" />
                      <button type="button" className="mb-img-remove" onClick={() => { setRimPreview(null); set('rim_image', null); }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="mb-img-drop">
                      <Upload size={20} />
                      <span>Upload rim overlay (optional)</span>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { set('rim_image', f); setRimPreview(URL.createObjectURL(f)); } }} hidden />
                    </label>
                  )}
                </div>
              </>
            )}

            {category === 'protein' && (
              <>
                <div className="field">
                  <label>Quantity Type <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>(controls the quantity selector shown to customers)</span></label>
                  <select className="input select" value={form.qty_type} onChange={e => set('qty_type', e.target.value)}>
                    <option value="">— none —</option>
                    {BYO_QTY_TYPE_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Note</label>
                  <input className="input" placeholder="e.g. Beef bacon, halal" value={form.note} onChange={e => set('note', e.target.value)} />
                </div>
              </>
            )}

            {(category === 'cheese' || category === 'veg' || category === 'sauce' || category === 'bowl_base' || category === 'bowl_topping') && (
              <div className="field">
                <label>Emoji <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>(shown alongside the image)</span></label>
                <input className="input" placeholder="e.g. 🧅" value={form.emoji} onChange={e => set('emoji', e.target.value)} style={{ width: '5rem' }} />
              </div>
            )}

            <div className="mb-toggle-row">
              <span>Available for ordering</span>
              <button type="button" className="mb-toggle-btn" onClick={() => set('is_active', !form.is_active)}>
                {form.is_active
                  ? <ToggleRight size={26} color="var(--color-success)" />
                  : <ToggleLeft size={26} color="var(--color-text-muted)" />}
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (item ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function MenuBuilder() {
  const [items, setItems]       = useState([]);
  const [search, setSearch]     = useState('');
  const [catFilter, setCat]     = useState('all');
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast]       = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Location availability mode
  const [locView, setLocView]       = useState(false);
  const [locations, setLocations]   = useState([]);
  const [selectedLoc, setSelectedLoc] = useState('');
  const [locAvailMap, setLocAvailMap] = useState({});
  const [savingAvail, setSavingAvail] = useState(null);
  const [locSearch, setLocSearch]   = useState('');
  const [bulkStatus, setBulkStatus] = useState('available');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Build-Your-Own ingredients mode
  const [byoView, setByoView]       = useState(false);
  const [byoData, setByoData]       = useState({ base: [], cheese: [], veg: [], protein: [], sauce: [] });
  const [byoLoading, setByoLoading] = useState(false);
  const [byoTab, setByoTab]         = useState('base');
  const [byoModal, setByoModal]     = useState(null); // null | 'add' | item
  const [byoDeleting, setByoDeleting] = useState(null);

  const fetchByo = async () => {
    setByoLoading(true);
    try { setByoData(await adminAPI.getByoIngredients()); }
    catch (_) {}
    finally { setByoLoading(false); }
  };

  useEffect(() => { if (byoView) fetchByo(); }, [byoView]);

  const handleByoSave = async (fd, id) => {
    if (id) {
      const updated = await adminAPI.updateByoIngredient(id, fd);
      setByoData(prev => ({ ...prev, [byoTab]: prev[byoTab].map(i => i.id === id ? updated : i) }));
    } else {
      const created = await adminAPI.createByoIngredient(fd);
      setByoData(prev => ({ ...prev, [byoTab]: [...prev[byoTab], created] }));
    }
  };

  const handleByoDelete = async (item) => {
    if (!window.confirm(`Delete "${item.label}"? This cannot be undone.`)) return;
    setByoDeleting(item.id);
    try {
      await adminAPI.deleteByoIngredient(item.id);
      setByoData(prev => ({ ...prev, [byoTab]: prev[byoTab].filter(i => i.id !== item.id) }));
    } catch (e) {
      showToast(e.message || 'Delete failed — item was not removed.');
    } finally {
      setByoDeleting(null);
    }
  };

  const handleByoToggleActive = async (item) => {
    try {
      const fd = new FormData();
      fd.append('is_active', !item.is_active);
      const updated = await adminAPI.updateByoIngredient(item.id, fd);
      setByoData(prev => ({ ...prev, [byoTab]: prev[byoTab].map(i => i.id === item.id ? updated : i) }));
    } catch (e) { showToast(e.message || 'Action failed.'); }
  };

  const fetchItems = async () => {
    setLoading(true);
    try { setItems(await adminAPI.menus()); }
    catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    adminAPI.getLocations()
      .then(d => setLocations(Array.isArray(d) ? d.filter(l => l.is_active !== false) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLoc) {
      adminAPI.getLocationMenuAvailability(selectedLoc).then(d => setLocAvailMap(d || {})).catch(() => {});
    } else {
      setLocAvailMap({});
    }
  }, [selectedLoc]);

  const handleSetAvail = async (menuId, status) => {
    setSavingAvail(menuId);
    try {
      await adminAPI.setLocationMenuAvailability({ menu_id: menuId, location_id: parseInt(selectedLoc), status });
      setLocAvailMap(prev => ({ ...prev, [menuId]: status }));
    } catch (e) { showToast(e.message || 'Action failed.'); }
    finally { setSavingAvail(null); }
  };

  const locVisibleItems = items.filter(i =>
    !locSearch || (i.name + (i.category || '')).toLowerCase().includes(locSearch.toLowerCase())
  );

  const handleBulkSetAvail = async () => {
    const ids = locVisibleItems.map(i => i.id);
    if (!ids.length) return;
    if (!window.confirm(`Set ${AVAIL_LABELS[bulkStatus]} for ${ids.length} item${ids.length !== 1 ? 's' : ''} at this location?`)) return;
    setBulkSaving(true);
    try {
      await adminAPI.setBulkLocationMenuAvailability({ location_id: parseInt(selectedLoc), status: bulkStatus, menu_ids: ids });
      setLocAvailMap(prev => { const next = { ...prev }; ids.forEach(id => { next[id] = bulkStatus; }); return next; });
    } catch (e) { showToast(e.message || 'Bulk action failed.'); }
    finally { setBulkSaving(false); }
  };

  const itemCats = (i) => (Array.isArray(i.categories) && i.categories.length ? i.categories : [i.category]).filter(Boolean);

  const categories = ['all', ...new Set(items.flatMap(itemCats))];

  const visible = items
    .filter(i => {
      if (catFilter !== 'all' && !itemCats(i).includes(catFilter)) return false;
      if (search) return (i.name + (i.description || '') + (i.category || '')).toLowerCase().includes(search.toLowerCase());
      return true;
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);

  const handleSave = async (fd, id) => {
    if (id) {
      const updated = await adminAPI.updateMenu(id, fd);
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } else {
      const created = await adminAPI.createMenu(fd);
      setItems(prev => [created, ...prev]);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminAPI.deleteMenu(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      showToast(e.message || 'Delete failed — item was not removed.');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleAvailability = async (item) => {
    const nextVal = !(item.is_available !== false);
    try {
      await adminAPI.toggleMenuAvailability({ ids: [item.id], is_available: nextVal });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: nextVal } : i));
    } catch (e) { showToast(e.message || 'Action failed.'); }
  };

  const handleBulkToggle = async (category, enable) => {
    try {
      await adminAPI.toggleMenuAvailability({ category, is_available: enable });
      setItems(prev => prev.map(i =>
        i.category === category ? { ...i, is_available: enable } : i
      ));
    } catch (e) { showToast(e.message || 'Action failed.'); }
  };

  return (
    <div className="mb-page">
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--color-danger, #ef4444)', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="page-hdr">
        <div>
          <p className="page-title">Menu Builder</p>
          <p className="page-sub">{items.length} items · {categories.length - 1} categories</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <button
            className={`btn btn-sm ${byoView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setByoView(v => !v); setLocView(false); }}
            title="Manage Build-Your-Own ingredients (bases, cheese, veggies, proteins, sauces)"
          >
            <Plus size={13}/> Build Your Own Ingredients
          </button>
          <button
            className={`btn btn-sm ${locView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLocView(v => !v); setByoView(false); }}
            title="Manage per-location item availability"
          >
            <MapPin size={13}/> Location Availability
          </button>
          {!locView && !byoView && catFilter !== 'all' && (
            <>
              <button className="btn btn-secondary btn-sm" title={`Enable all in ${catFilter}`} onClick={() => handleBulkToggle(catFilter, true)}>
                <Eye size={13}/> Enable All
              </button>
              <button className="btn btn-secondary btn-sm" title={`Disable all in ${catFilter}`} onClick={() => handleBulkToggle(catFilter, false)}>
                <EyeOff size={13}/> Disable All
              </button>
            </>
          )}
          {!locView && !byoView && (
            <button className="btn btn-primary" onClick={() => setModal('add')}>
              <Plus size={15} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Build-Your-Own Ingredients Panel */}
      {byoView && (
        <div className="mb-loc-avail-panel">
          <div className="mb-cats" style={{marginBottom:'1rem'}}>
            {BYO_TABS.map(t => (
              <button
                key={t}
                className={`orders-filter-btn${byoTab === t ? ' active' : ''}`}
                onClick={() => setByoTab(t)}
              >
                {BYO_TAB_LABELS[t]} ({byoData[t]?.length || 0})
              </button>
            ))}
            <button className="btn btn-primary btn-sm" style={{marginLeft:'auto'}} onClick={() => setByoModal('add')}>
              <Plus size={13}/> Add {BYO_TAB_LABELS[byoTab].replace(/s$/, '')}
            </button>
          </div>

          {byoLoading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : (byoData[byoTab] || []).length === 0 ? (
            <div className="empty" style={{minHeight:150}}><p>No {BYO_TAB_LABELS[byoTab].toLowerCase()} yet.</p></div>
          ) : (
            <div className="mb-table-wrap">
              <table className="mb-table">
                <thead>
                  <tr>
                    <th style={{width:60}}>Image</th>
                    <th>Label</th>
                    <th style={{width:90}}>Price</th>
                    {byoTab === 'base' && <th>Family</th>}
                    {byoTab === 'protein' && <th>Qty Type</th>}
                    <th style={{width:90}}>Status</th>
                    <th style={{width:130}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {byoData[byoTab].map(item => (
                    <tr key={item.id} className={!item.is_active ? 'mb-row-inactive' : ''}>
                      <td>
                        <div className="mb-thumb">
                          {item.image_url
                            ? <img src={imgSrc(item.image_url)} alt={item.label} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                            : null}
                          <div className="mb-thumb-fallback" style={{ display: item.image_url ? 'none' : 'flex' }}>
                            {item.emoji || <ImageOff size={14} />}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="mb-item-name">{item.label}</p>
                        <p className="mb-item-desc" style={{fontFamily:'monospace',fontSize:'0.7rem'}}>{item.option_key}</p>
                        {item.note && <p className="mb-item-desc">{item.note}</p>}
                      </td>
                      <td className="mb-price">${parseFloat(item.price || 0).toFixed(2)}</td>
                      {byoTab === 'base' && <td className="text-muted" style={{fontSize:'0.78rem'}}>{item.family || '—'}</td>}
                      {byoTab === 'protein' && <td className="text-muted" style={{fontSize:'0.78rem'}}>{item.qty_type || '—'}</td>}
                      <td>
                        <span className={`badge ${item.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="mb-actions">
                          <button
                            className={`btn btn-sm ${item.is_active ? 'btn-secondary' : 'btn-ghost'}`}
                            onClick={() => handleByoToggleActive(item)}
                            title={item.is_active ? 'Mark unavailable' : 'Mark available'}
                          >
                            {item.is_active ? <Eye size={13}/> : <EyeOff size={13}/>}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setByoModal(item)} title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleByoDelete(item)}
                            disabled={byoDeleting === item.id}
                            title="Delete"
                          >
                            {byoDeleting === item.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {byoModal && (
        <ByoIngredientModal
          item={byoModal === 'add' ? null : byoModal}
          category={byoTab}
          onClose={() => setByoModal(null)}
          onSave={handleByoSave}
        />
      )}

      {/* Location Availability Panel */}
      {locView && (
        <div className="mb-loc-avail-panel">
          <div className="mb-loc-avail-hdr">
            <select
              className="input select mb-loc-select"
              value={selectedLoc}
              onChange={e => setSelectedLoc(e.target.value)}
            >
              <option value="">— Select a location —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            <p className="mb-loc-avail-hint">
              {selectedLoc
                ? <>Set availability for each item at this location. Default is <strong>Available</strong>.</>
                : 'Select a location above to manage per-location item availability.'}
            </p>
          </div>
          {selectedLoc && (
            <div className="mb-loc-avail-bulk" style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap',margin:'0 0 0.75rem'}}>
              <input
                className="input mb-search"
                placeholder="Search name, category…"
                value={locSearch}
                onChange={e => setLocSearch(e.target.value)}
                style={{maxWidth:260}}
              />
              <span style={{fontSize:'0.78rem',color:'var(--color-text-muted)'}}>
                Set all {locVisibleItems.length} visible item{locVisibleItems.length !== 1 ? 's' : ''} to:
              </span>
              <select
                className="input select"
                style={{fontSize:'0.78rem',padding:'0.25rem 0.4rem',width:'auto'}}
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
              >
                <option value="available">Available</option>
                <option value="sold_out">Sold Out</option>
                <option value="inactive">Inactive (hidden)</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={handleBulkSetAvail} disabled={bulkSaving || !locVisibleItems.length}>
                {bulkSaving ? <span className="spinner" style={{width:12,height:12}} /> : 'Apply'}
              </button>
            </div>
          )}
          <div className="mb-table-wrap">
            {!selectedLoc ? null : (
              <table className="mb-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th style={{width:170}}>Availability at this location</th>
                  </tr>
                </thead>
                <tbody>
                  {locVisibleItems.map(item => {
                    const current = locAvailMap[item.id] || 'available';
                    return (
                      <tr key={item.id} className={current === 'inactive' ? 'mb-row-inactive' : ''}>
                        <td>
                          <p className="mb-item-name">{item.name}</p>
                          {item.category && <p className="mb-item-desc">{item.category}</p>}
                        </td>
                        <td><span className="mb-cat-pill">{item.category || '—'}</span></td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                            <select
                              className="input select"
                              style={{fontSize:'0.78rem',padding:'0.25rem 0.4rem'}}
                              value={current}
                              onChange={e => handleSetAvail(item.id, e.target.value)}
                              disabled={savingAvail === item.id}
                            >
                              <option value="available">Available</option>
                              <option value="sold_out">Sold Out</option>
                              <option value="inactive">Inactive (hidden)</option>
                            </select>
                            <span className={`badge ${AVAIL_BADGE[current]}`} style={{fontSize:'0.65rem',whiteSpace:'nowrap'}}>
                              {AVAIL_LABELS[current]}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Toolbar — hidden in location availability / BYO ingredients views */}
      {!locView && !byoView && <div className="mb-toolbar">
        <div className="mb-cats">
          {categories.map(c => (
            <button
              key={c}
              className={`orders-filter-btn${catFilter === c ? ' active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
        <input
          className="input mb-search"
          placeholder="Search name, category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>}

      {/* Table — hidden in location availability / BYO ingredients views */}
      {!locView && !byoView && (loading ? (
        <div className="empty"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="empty" style={{ minHeight: 200 }}>
          <p>No items found.{' '}
            <button className="btn-link" onClick={() => setModal('add')}>Add one?</button>
          </p>
        </div>
      ) : (
        <div className="mb-table-wrap">
          <table className="mb-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th style={{ width: 90 }}>Price</th>
                <th style={{ width: 100 }}>Partner</th>
                <th style={{ width: 55 }} title="Sort order within category">#</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.id} className={!item.is_active && !item.is_available ? 'mb-row-inactive' : ''}>
                  <td>
                    <div className="mb-thumb">
                      {item.image_url
                        ? <img src={imgSrc(item.image_url)} alt={item.name} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                        : null}
                      <div className="mb-thumb-fallback" style={{ display: item.image_url ? 'none' : 'flex' }}>
                        <ImageOff size={14} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="mb-item-name">
                      {item.name}
                      {item.quota_required > 0 && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', background: 'rgba(249,115,22,0.18)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '4px', padding: '1px 5px', verticalAlign: 'middle' }}>
                          pick-{item.quota_required}
                        </span>
                      )}
                    </p>
                    {item.description && (
                      <p className="mb-item-desc">{item.description}</p>
                    )}
                  </td>
                  <td>
                    <span className="mb-cat-pill">{item.category || '—'}</span>
                  </td>
                  <td className="mb-price">${parseFloat(item.price || 0).toFixed(2)}</td>
                  <td className="mb-price mb-partner">
                    {item.partner_price ? `$${parseFloat(item.partner_price).toFixed(2)}` : '—'}
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center' }}>{item.sort_order ?? 0}</td>
                  <td>
                    <span className={`badge ${item.is_active !== false && item.is_available !== false ? 'badge-success' : 'badge-danger'}`}>
                      {item.is_active !== false && item.is_available !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="mb-actions">
                      <button
                        className={`btn btn-sm ${item.is_available !== false ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => handleToggleAvailability(item)}
                        title={item.is_available !== false ? 'Mark unavailable' : 'Mark available'}
                      >
                        {item.is_available !== false ? <Eye size={13}/> : <EyeOff size={13}/>}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(item)} title="Edit">
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(item.id, item.name)}
                        disabled={deleting === item.id}
                        title="Delete"
                      >
                        {deleting === item.id
                          ? <span className="spinner" style={{ width: 12, height: 12 }} />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Row count */}
      {!locView && !byoView && !loading && visible.length > 0 && (
        <p className="mb-count">Showing {visible.length} of {items.length} items</p>
      )}

      {/* Modal */}
      {modal && (
        <MenuModal
          item={modal === 'add' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
