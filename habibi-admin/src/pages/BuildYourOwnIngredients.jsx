import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Upload, ToggleLeft, ToggleRight, ImageOff, EyeOff, Eye, UtensilsCrossed, Soup } from 'lucide-react';
import { adminAPI } from '../services/api';
import './MenuBuilder.css';

const API      = import.meta.env.VITE_API_URL      || 'http://localhost:5001';
const FRONTEND = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174';

function imgSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/images/')) return `${FRONTEND}${url}`;
  return `${API}${url}`;
}

const BYO_TAB_LABELS = {
  base: 'Bases', cheese: 'Cheese', veg: 'Veggies & Fillings', protein: 'Proteins', sauce: 'Sauces',
  bowl_base: 'Bowl Bases', bowl_topping: 'Bowl Toppings',
  bowl_protein: 'Bowl Proteins', bowl_sauce: 'Bowl Sauces',
};
// Which category tabs belong to which customer-facing page. The Bowl page
// has its own small curated protein/sauce list (bowl_protein/bowl_sauce) —
// separate from the full 19/8 list /customize uses — since the bowl preview
// card is meant to stay compact, not show every sandwich protein.
const BYO_PAGES = [
  { id: 'customize', label: 'Customize Page', icon: UtensilsCrossed, tabs: ['base', 'cheese', 'veg', 'protein', 'sauce'] },
  { id: 'bowl',      label: 'BYO Bowl Page',  icon: Soup,            tabs: ['bowl_base', 'bowl_protein', 'bowl_topping', 'bowl_sauce'] },
];
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
                <label>Key * <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(unique, lowercase, no spaces — e.g. "shrimp")</span></label>
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
                  <label>Family <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(controls ingredient layout/sizing on this base)</span></label>
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
                  <label>Quantity Type <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(controls the quantity selector shown to customers)</span></label>
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

            {(category === 'cheese' || category === 'veg' || category === 'sauce' || category === 'bowl_base' || category === 'bowl_topping' || category === 'bowl_protein' || category === 'bowl_sauce') && (
              <div className="field">
                <label>Emoji <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(shown alongside the image)</span></label>
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

export default function BuildYourOwnIngredients() {
  const [byoData, setByoData]       = useState({ base: [], cheese: [], veg: [], protein: [], sauce: [], bowl_base: [], bowl_topping: [] });
  const [byoLoading, setByoLoading] = useState(true);
  const [byoPage, setByoPage]       = useState('customize'); // 'customize' | 'bowl'
  const [byoTab, setByoTab]         = useState('base');
  const [byoModal, setByoModal]     = useState(null); // null | 'add' | item
  const [byoDeleting, setByoDeleting] = useState(null);
  const [toast, setToast]           = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const activePage = BYO_PAGES.find(p => p.id === byoPage);
  const selectPage = (pageId) => {
    setByoPage(pageId);
    setByoTab(BYO_PAGES.find(p => p.id === pageId).tabs[0]);
  };

  const fetchByo = async () => {
    setByoLoading(true);
    try { setByoData(await adminAPI.getByoIngredients()); }
    catch (_) {}
    finally { setByoLoading(false); }
  };

  useEffect(() => { fetchByo(); }, []);

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

  return (
    <div className="mb-page">
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--color-danger, #ef4444)', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}
      <div className="page-hdr">
        <div>
          <p className="page-title">Build Your Own</p>
          <p className="page-sub">Bases, cheese, veggies, proteins & sauces used by the Custom Order builder and Build Your Own Bowl preview</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {BYO_PAGES.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                className={`btn btn-sm ${byoPage === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => selectPage(p.id)}
                title={`Show items used on the ${p.label}`}
              >
                <Icon size={14}/> {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-loc-avail-panel">
        <div className="mb-cats" style={{marginBottom:'1rem'}}>
          {activePage.tabs.map(t => (
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

      {byoModal && (
        <ByoIngredientModal
          item={byoModal === 'add' ? null : byoModal}
          category={byoTab}
          onClose={() => setByoModal(null)}
          onSave={handleByoSave}
        />
      )}
    </div>
  );
}
