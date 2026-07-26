import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Pencil, Trash2, X, Upload, ToggleLeft, ToggleRight, FileSpreadsheet, Check } from 'lucide-react';
import { adminAPI } from '../services/api';
import './MenuBuilder.css';

const API   = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const BLANK = { name: '', description: '', category: '', price: '', price_tier_2: '', price_tier_3: '', min_quantity: '1', unit: 'case', is_active: true, image: null };
const UNITS = ['case', 'dozen', 'tray', 'bag', 'lb', 'kg', 'each', 'box'];

function imgSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API}${url}`;
}

// Matches a spreadsheet's header row to our fields regardless of exact wording/casing —
// client-provided catalogs won't reliably use our internal column names.
const HEADER_ALIASES = {
  name:         ['name', 'productname', 'product', 'item', 'itemname', 'title'],
  description:  ['description', 'desc', 'details', 'notes'],
  category:     ['category', 'cat', 'type'],
  price:        ['price', 'tier1price', 'tier1', 'standardprice', 'baseprice', 'wholesaleprice'],
  price_tier_2: ['pricetier2', 'tier2price', 'tier2', 'silverprice', 'bulkprice'],
  price_tier_3: ['pricetier3', 'tier3price', 'tier3', 'goldprice', 'vipprice'],
  min_quantity: ['minquantity', 'minqty', 'minimumquantity', 'moq', 'minimumorder'],
  unit:         ['unit', 'uom', 'units', 'packaging'],
};
const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseSpreadsheetRows(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const normalized = headers.map(normalizeHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx !== -1) map[field] = headers[idx];
  }

  const val = (row, field) => (map[field] !== undefined && row[map[field]] !== undefined) ? String(row[map[field]]).trim() : '';

  return rows
    .map(r => ({
      name: val(r, 'name'),
      description: val(r, 'description'),
      category: val(r, 'category'),
      price: val(r, 'price'),
      price_tier_2: val(r, 'price_tier_2'),
      price_tier_3: val(r, 'price_tier_3'),
      min_quantity: val(r, 'min_quantity'),
      unit: val(r, 'unit'),
    }))
    .filter(r => r.name);
}

/* ── Add / Edit Modal ────────────────────────────────────────────── */
function CatalogModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item ? {
    name: item.name || '', description: item.description || '',
    category: item.category || '', price: item.price || '',
    price_tier_2: item.price_tier_2 || '', price_tier_3: item.price_tier_3 || '',
    min_quantity: item.min_quantity || '1', unit: item.unit || 'case',
    is_active: item.is_active !== false, image: null,
  } : { ...BLANK });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
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
      fd.append('name',         form.name);
      fd.append('description',  form.description);
      fd.append('category',     form.category);
      fd.append('price',        form.price);
      fd.append('price_tier_2', form.price_tier_2 || '');
      fd.append('price_tier_3', form.price_tier_3 || '');
      fd.append('min_quantity', form.min_quantity || 1);
      fd.append('unit',         form.unit);
      fd.append('is_active',    form.is_active);
      if (form.image) fd.append('image', form.image);
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
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{item ? 'Edit Wholesale Product' : 'Add Wholesale Product'}</h3>
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
                <label>Product Name *</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lamb Shoulder Rack" required />
              </div>
              <div className="field">
                <label>Category</label>
                <input className="input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Meats, Platters…" />
              </div>
            </div>

            <div className="field">
              <label>Description</label>
              <textarea className="input textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief product description" />
            </div>

            <div className="mb-row">
              <div className="field">
                <label>Tier 1 Price * <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>(standard)</span></label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} required />
              </div>
              <div className="field">
                <label>Tier 2 Price <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>(bulk)</span></label>
                <input type="number" min="0" step="0.01" className="input" placeholder="optional" value={form.price_tier_2} onChange={e => set('price_tier_2', e.target.value)} />
              </div>
              <div className="field">
                <label>Tier 3 Price <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>(VIP)</span></label>
                <input type="number" min="0" step="0.01" className="input" placeholder="optional" value={form.price_tier_3} onChange={e => set('price_tier_3', e.target.value)} />
              </div>
            </div>

            <div className="mb-row">
              <div className="field">
                <label>Min Quantity</label>
                <input type="number" min="1" className="input" value={form.min_quantity} onChange={e => set('min_quantity', e.target.value)} />
              </div>
              <div className="field">
                <label>Unit</label>
                <select className="input select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-toggle-row">
              <span>Available to partners</span>
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
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (item ? 'Save Changes' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function BusinessMenuAdmin() {
  const [items, setItems]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState(null); // null | 'add' | item object

  // Bulk import from a client-provided spreadsheet
  const [bulkModal, setBulkModal]         = useState(false);
  const [bulkRows, setBulkRows]           = useState([]);
  const [bulkFileName, setBulkFileName]   = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoad(true);
    try { setItems(await adminAPI.getBusinessMenus()); }
    catch (_) {}
    finally { setLoad(false); }
  };
  useEffect(() => { load(); }, []);

  const openBulk = () => { setBulkRows([]); setBulkFileName(''); setBulkResult(null); setBulkModal(true); };

  const handleBulkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        setBulkRows(parseSpreadsheetRows(wb));
      } catch (err) {
        alert('Could not read this file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const runBulkImport = async () => {
    const valid = bulkRows.filter(r => r.name && r.price);
    if (valid.length === 0) return;
    setBulkImporting(true);
    try {
      const result = await adminAPI.bulkImportBusinessMenus(valid);
      setBulkResult(result);
      setBulkRows([]);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const handleSave = async (fd, id) => {
    if (id) {
      const updated = await adminAPI.updateBusinessMenu(id, fd);
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } else {
      const created = await adminAPI.createBusinessMenu(fd);
      setItems(prev => [created, ...prev]);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteBusinessMenu(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) { alert(e.message); }
  };

  const visible = items.filter(i =>
    !search || (i.name + (i.category || '') + (i.description || '')).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Wholesale Catalog</h1>
          <p className="page-sub">{items.length} products · Partner-only pricing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={openBulk}>
            <Upload size={15} /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
        <input
          className="input"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="empty card">
          <p>{search ? 'No products match your search.' : 'No wholesale products yet. Add your first product.'}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Tier 1</th>
                  <th>Tier 2</th>
                  <th>Tier 3</th>
                  <th>Min Qty</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(item => (
                  <tr key={item.id}>
                    <td>
                      {item.image_url ? (
                        <img
                          src={imgSrc(item.image_url)}
                          alt={item.name}
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, background: 'var(--color-surface-2)', borderRadius: 6 }} />
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                      {item.description && (
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-muted">{item.category || '—'}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      ${parseFloat(item.price || 0).toFixed(2)}/{item.unit || 'ea'}
                    </td>
                    <td className="text-muted">
                      {item.price_tier_2 ? `$${parseFloat(item.price_tier_2).toFixed(2)}` : '—'}
                    </td>
                    <td className="text-muted">
                      {item.price_tier_3 ? `$${parseFloat(item.price_tier_3).toFixed(2)}` : '—'}
                    </td>
                    <td className="text-muted">{item.min_quantity || 1}</td>
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {item.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(item)}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item.id, item.name)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <CatalogModal
          item={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {bulkModal && (
        <div className="modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h3 className="modal-title">Bulk Import Wholesale Products</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {bulkResult ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    ✓ {bulkResult.created_count} product{bulkResult.created_count !== 1 ? 's' : ''} added
                  </p>
                  {bulkResult.skipped_count > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--color-danger, #e5484d)', marginBottom: '0.4rem' }}>
                        {bulkResult.skipped_count} skipped
                      </p>
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>Name</th><th>Reason</th></tr></thead>
                          <tbody>
                            {bulkResult.skipped.map((s, i) => (
                              <tr key={i}>
                                <td>{s.name || '—'}</td>
                                <td className="text-muted">{s.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Upload an Excel (.xlsx/.xls) or CSV file. Column headers are matched
                    automatically regardless of exact wording — e.g. <code>Product Name</code>,
                    <code> Price</code>, <code>Tier 2 Price</code>, <code>Category</code>,{' '}
                    <code>Min Qty</code>, <code>Unit</code>. Only <code>name</code> and{' '}
                    <code>price</code> are required per row.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleBulkFile}
                  />
                  <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet size={14} /> {bulkFileName || 'Choose spreadsheet…'}
                  </button>

                  {bulkRows.length > 0 && (
                    <div className="table-wrap" style={{ marginTop: '1rem', maxHeight: 300, overflowY: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr><th>Name</th><th>Category</th><th>Price</th><th>Tier 2</th><th>Tier 3</th><th>Min Qty</th><th>Unit</th></tr>
                        </thead>
                        <tbody>
                          {bulkRows.map((r, i) => (
                            <tr key={i} style={!r.price ? { opacity: 0.5 } : undefined}>
                              <td>{r.name}</td>
                              <td>{r.category || '—'}</td>
                              <td>{r.price || <em>missing price</em>}</td>
                              <td>{r.price_tier_2 || '—'}</td>
                              <td>{r.price_tier_3 || '—'}</td>
                              <td>{r.min_quantity || 1}</td>
                              <td>{r.unit || 'case'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {bulkResult ? (
                <button className="btn btn-primary" onClick={() => setBulkModal(false)}>Done</button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={runBulkImport}
                    disabled={bulkImporting || bulkRows.filter(r => r.name && r.price).length === 0}
                  >
                    {bulkImporting
                      ? <div className="spinner" />
                      : <><Check size={14} /> Import {bulkRows.filter(r => r.name && r.price).length || ''} Products</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
