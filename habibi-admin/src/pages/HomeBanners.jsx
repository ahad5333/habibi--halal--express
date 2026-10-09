// Home Banners -- the poster carousel at the top of the app's Home screen.
// Upload a poster, choose what tapping it opens, optionally give it a start
// and end time (New York time) so a sale's posters go up and come down on
// their own. Backend: bannersController.js (admin only).
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Eye, EyeOff } from 'lucide-react';
import { adminAPI } from '../services/api';
import './HomeBanners.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const img = u => (!u ? '' : u.startsWith('http') || u.startsWith('blob:') ? u : `${BASE}${u}`);

// The app's menu tabs a banner can open (habibi-mobile menuData CATEGORIES).
const CATEGORIES = ['Breakfast', 'Platter', 'Sandwich', 'Bergers', 'Tacos', 'Habibi Specials', 'Extras', 'Drinks', 'Family Tray', 'Build Your Own'];
const LINKS = [
  { v: 'none', label: 'Nothing (picture only)' },
  { v: 'offer', label: 'An offer code' },
  { v: 'category', label: 'A menu category' },
  { v: 'item', label: 'A menu item' },
  { v: 'url', label: 'A web link' },
];
const EMPTY = { title: '', link_type: 'none', link_value: '', starts_at: '', ends_at: '', sort_order: 0, is_active: true };

const nyNice = s => (s ? new Date(`${s}:00`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

function status(b) {
  if (!b.is_active) return { cls: 'off', text: 'Off' };
  if (b.live_now) return { cls: 'live', text: b.ends_at ? `Live · ends ${nyNice(b.ends_at)}` : 'Live now' };
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T').slice(0, 16);
  if (b.starts_at && b.starts_at > now) return { cls: 'soon', text: `Starts ${nyNice(b.starts_at)}` };
  return { cls: 'off', text: 'Ended' };
}

export default function HomeBanners() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [offers, setOffers] = useState([]);
  const [items, setItems] = useState([]);
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    adminAPI.getBanners().then(d => setRows(Array.isArray(d) ? d : [])).catch(e => setError(e.message || 'Could not load banners')).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetch(`${BASE}/api/offers`).then(r => r.json()).then(d => setOffers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${BASE}/api/menus`).then(r => r.json()).then(d => setItems(Array.isArray(d) ? [...d].sort((a, b) => a.name.localeCompare(b.name)) : [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openNew = () => { setEditing(null); setForm(EMPTY); setFile(null); setPreview(''); setError(''); setModal(true); };
  const openEdit = b => {
    setEditing(b);
    setForm({ title: b.title, link_type: b.link_type, link_value: b.link_value || '', starts_at: b.starts_at || '', ends_at: b.ends_at || '', sort_order: b.sort_order || 0, is_active: b.is_active });
    setFile(null); setPreview(img(b.image_url)); setError(''); setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); };
  const pick = e => { const f = e.target.files[0]; if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); };

  const save = async () => {
    if (!form.title.trim()) return setError('Give the banner a name');
    if (!editing && !file) return setError('Upload a poster image');
    if (form.link_type !== 'none' && !String(form.link_value).trim()) return setError('Choose what the banner opens');
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, k === 'link_value' && form.link_type === 'none' ? '' : v));
      if (file) fd.append('image', file);
      if (editing) await adminAPI.updateBanner(editing.id, fd); else await adminAPI.createBanner(fd);
      close(); load();
    } catch (e) { setError(e.message || 'Could not save'); } finally { setSaving(false); }
  };

  const toggle = async b => {
    const fd = new FormData(); fd.append('is_active', String(!b.is_active));
    try { await adminAPI.updateBanner(b.id, fd); load(); } catch (e) { setError(e.message); }
  };
  const del = async b => {
    if (!confirm(`Delete the banner "${b.title}"?`)) return;
    try { await adminAPI.deleteBanner(b.id); load(); } catch (e) { setError(e.message); }
  };

  const linkText = b => {
    if (b.link_type === 'offer') return `Saves code ${b.link_value}`;
    if (b.link_type === 'category') return `Opens ${b.link_value}`;
    if (b.link_type === 'item') return `Opens ${items.find(i => String(i.id) === String(b.link_value))?.name || `item #${b.link_value}`}`;
    if (b.link_type === 'url') return `Opens ${b.link_value}`;
    return 'Picture only';
  };
  const liveCount = rows.filter(b => b.live_now).length;

  return (
    <div className="hb-page">
      <div className="hb-header">
        <div>
          <h1 className="hb-title">Home Banners</h1>
          <p className="hb-sub">Posters that slide across the top of the app's Home screen. Give a sale's posters a start and end time and they go up and come down on their own. Best with 3–5 live at once; the app shows up to 6.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Banner</button>
      </div>

      {error && !modal && <div className="hb-error">{error}</div>}
      {!loading && rows.length > 0 && <p className="hb-count">{liveCount} live in the app right now</p>}

      {loading ? <div className="hb-muted">Loading banners...</div> : (
        <div className="hb-list">
          {rows.length === 0 && <p className="hb-muted">No banners yet. While there are none, the app simply doesn't show the carousel.</p>}
          {rows.map(b => {
            const st = status(b);
            return (
              <div key={b.id} className={`hb-row${st.cls === 'off' ? ' hb-row--off' : ''}`}>
                <div className="hb-thumb"><img src={img(b.image_url)} alt={b.title} /></div>
                <div className="hb-info">
                  <div className="hb-row-top"><span className={`hb-pill hb-pill--${st.cls}`}>{st.text}</span><span className="hb-order">#{b.sort_order}</span></div>
                  <h3 className="hb-row-title">{b.title}</h3>
                  <p className="hb-row-sub">{linkText(b)}</p>
                </div>
                <div className="hb-actions">
                  <button className="btn btn-ghost btn-icon" onClick={() => toggle(b)} title={b.is_active ? 'Switch off' : 'Switch on'}>{b.is_active ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                  <button className="btn btn-ghost btn-icon" onClick={() => openEdit(b)} title="Edit"><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-icon" onClick={() => del(b)} title="Delete"><Trash2 size={14} color="var(--color-error)" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="hb-overlay" onClick={close}>
          <div className="hb-modal" onClick={e => e.stopPropagation()}>
            <div className="hb-modal-hdr">
              <h2>{editing ? 'Edit Banner' : 'New Banner'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={18} /></button>
            </div>
            <div className="hb-modal-body">
              {error && <div className="hb-error">{error}</div>}

              <div className="field">
                <label className="label">Poster *</label>
                <div className="hb-drop" onClick={() => fileRef.current?.click()}>
                  {preview ? <img src={preview} alt="Poster preview" /> : (
                    <><Upload size={24} style={{ opacity: 0.4 }} /><span>Click to upload the poster</span></>
                  )}
                </div>
                <p className="hb-hint">Wide poster, about 1200 × 520 px (JPG, PNG or WebP, up to 5 MB). Keep words big and short. The phone shows it with rounded corners, and the edges can be cropped slightly.</p>
                <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={pick} />
              </div>

              <div className="field">
                <label className="label">Name *</label>
                <input className="input" maxLength={120} placeholder="e.g. Free delivery weekend" value={form.title} onChange={e => set('title', e.target.value)} />
                <p className="hb-hint">For you, and read aloud to blind customers by their phone. Describe what the poster says.</p>
              </div>

              <div className="hb-grid">
                <div className="field">
                  <label className="label">When tapped, open</label>
                  <select className="input" value={form.link_type} onChange={e => { set('link_type', e.target.value); set('link_value', ''); }}>
                    {LINKS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  {form.link_type === 'offer' && (<>
                    <label className="label">Offer code</label>
                    <input className="input" list="hb-offers" placeholder="e.g. FREESHIP" value={form.link_value} onChange={e => set('link_value', e.target.value.toUpperCase())} />
                    <datalist id="hb-offers">{offers.map(o => <option key={o.code} value={o.code}>{o.title}</option>)}</datalist>
                  </>)}
                  {form.link_type === 'category' && (<>
                    <label className="label">Category</label>
                    <select className="input" value={form.link_value} onChange={e => set('link_value', e.target.value)}>
                      <option value="">Choose…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </>)}
                  {form.link_type === 'item' && (<>
                    <label className="label">Menu item</label>
                    <select className="input" value={form.link_value} onChange={e => set('link_value', e.target.value)}>
                      <option value="">Choose…</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} (${Number(i.price).toFixed(2)})</option>)}
                    </select>
                  </>)}
                  {form.link_type === 'url' && (<>
                    <label className="label">Link</label>
                    <input className="input" placeholder="https://" value={form.link_value} onChange={e => set('link_value', e.target.value)} />
                  </>)}
                </div>
              </div>

              <div className="hb-grid">
                <div className="field">
                  <label className="label">Starts (New York time)</label>
                  <input className="input" type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Ends (New York time)</label>
                  <input className="input" type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} />
                </div>
              </div>
              <p className="hb-hint" style={{ marginTop: '-0.4rem' }}>Leave both empty to show it until you switch it off.</p>

              <div className="hb-grid">
                <div className="field">
                  <label className="label">Order</label>
                  <input className="input" type="number" min="0" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)} />
                  <p className="hb-hint">Lower numbers come first.</p>
                </div>
                <div className="field">
                  <label className="label">Showing</label>
                  <button type="button" className={`hb-toggle${form.is_active ? ' on' : ''}`} onClick={() => set('is_active', !form.is_active)}>
                    {form.is_active ? <><Eye size={14} /> On</> : <><EyeOff size={14} /> Off</>}
                  </button>
                </div>
              </div>
            </div>
            <div className="hb-modal-footer">
              <button className="btn btn-secondary" onClick={close}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Banner'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
