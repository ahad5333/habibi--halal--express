import React, { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, X, Check, RefreshCw, AlertTriangle, History } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Inventory.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const BLANK = { name: '', category: 'General', current_stock: '', unit: 'unit', low_stock_threshold: '10', cost_per_unit: '', supplier: '', notes: '' };

const CATEGORIES = ['General', 'Meat', 'Produce', 'Dairy', 'Bread', 'Spices', 'Beverages', 'Packaging', 'Cleaning'];

export default function Inventory() {
  const [items, setItems]         = useState([]);
  const [log, setLog]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('items'); // 'items' | 'log'
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [restock, setRestock]     = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [inv, lg] = await Promise.all([adminAPI.getInventory(), adminAPI.getRestockLog()]);
      setItems(inv);
      setLog(lg);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(BLANK); setModal('add'); };
  const openEdit = (i) => { setForm({ ...i, current_stock: String(i.current_stock), low_stock_threshold: String(i.low_stock_threshold), cost_per_unit: String(i.cost_per_unit || '') }); setModal(i); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, current_stock: parseFloat(form.current_stock)||0, low_stock_threshold: parseFloat(form.low_stock_threshold)||10, cost_per_unit: parseFloat(form.cost_per_unit)||0 };
      if (modal === 'add') await adminAPI.createInventoryItem(payload);
      else await adminAPI.updateInventoryItem(modal.id, payload);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const doRestock = async () => {
    if (!restockQty || parseFloat(restockQty) <= 0) return;
    setSaving(true);
    try {
      await adminAPI.restockItem(restock.id, { quantity: parseFloat(restockQty), note: restockNote });
      setRestock(null); setRestockQty(''); setRestockNote('');
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm('Delete this inventory item?')) return;
    await adminAPI.deleteInventoryItem(id);
    load();
  };

  const cats = ['all', ...new Set(items.map(i => i.category))];
  const lowStock = items.filter(i => parseFloat(i.current_stock) <= parseFloat(i.low_stock_threshold));
  const displayed = filterCat === 'all' ? items : items.filter(i => i.category === filterCat);

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">{items.length} items · {lowStock.length} low stock</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14}/></button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add Item</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="inv-alert">
          <AlertTriangle size={16} />
          <span><strong>{lowStock.length}</strong> item{lowStock.length!==1?'s':''} at or below low-stock threshold: {lowStock.map(i => i.name).join(', ')}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="inv-tabs">
        <button className={`inv-tab ${tab==='items'?'active':''}`} onClick={() => setTab('items')}><Package size={14}/> Items</button>
        <button className={`inv-tab ${tab==='log'?'active':''}`} onClick={() => setTab('log')}><History size={14}/> Restock Log</button>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : tab === 'items' ? (
        <div className="card">
          <div className="inv-toolbar">
            <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
              {cats.map(c => (
                <button key={c} className={`inv-cat-btn ${filterCat===c?'active':''}`} onClick={() => setFilterCat(c)}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>
          {displayed.length === 0 ? (
            <div className="empty"><Package size={32}/><p>No items</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Stock</th><th>Threshold</th><th>Unit Cost</th><th>Supplier</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {displayed.map(i => {
                    const isLow = parseFloat(i.current_stock) <= parseFloat(i.low_stock_threshold);
                    return (
                      <tr key={i.id}>
                        <td style={{fontWeight:600}}>{i.name}</td>
                        <td><span className="badge badge-muted">{i.category}</span></td>
                        <td>
                          <span className={`inv-stock ${isLow ? 'low' : ''}`}>
                            {isLow && <AlertTriangle size={12}/>}
                            {parseFloat(i.current_stock).toFixed(1)} {i.unit}
                          </span>
                        </td>
                        <td className="text-muted">{i.low_stock_threshold} {i.unit}</td>
                        <td className="text-muted">{i.cost_per_unit > 0 ? `$${parseFloat(i.cost_per_unit).toFixed(2)}` : '—'}</td>
                        <td className="text-muted">{i.supplier || '—'}</td>
                        <td>
                          <div style={{display:'flex',gap:'0.4rem'}}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setRestock(i)} title="Restock"><RefreshCw size={12}/></button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(i)}><Pencil size={13}/></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(i.id)}><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {log.length === 0 ? (
            <div className="empty"><History size={32}/><p>No restock events yet</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Item</th><th>Qty Added</th><th>Note</th><th>By</th></tr></thead>
                <tbody>
                  {log.map(l => (
                    <tr key={l.id}>
                      <td className="text-muted" style={{fontSize:'0.78rem',whiteSpace:'nowrap'}}>
                        {fmtDateTime(l.created_at, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{fontWeight:500}}>{l.item_name}</td>
                      <td className="text-success">+{l.quantity} {l.unit}</td>
                      <td className="text-muted">{l.note || '—'}</td>
                      <td className="text-muted">{l.created_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">{modal === 'add' ? 'Add Inventory Item' : 'Edit Item'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="inv-form-grid">
                <div className="field">
                  <label>Item Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. Chicken Breast" />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select className="input select" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Current Stock</label>
                  <input className="input" type="number" min="0" value={form.current_stock} onChange={e => setForm({...form,current_stock:e.target.value})} placeholder="0" />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <input className="input" value={form.unit} onChange={e => setForm({...form,unit:e.target.value})} placeholder="lbs / kg / unit / oz" />
                </div>
                <div className="field">
                  <label>Low Stock Alert</label>
                  <input className="input" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({...form,low_stock_threshold:e.target.value})} />
                </div>
                <div className="field">
                  <label>Cost per Unit ($)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={e => setForm({...form,cost_per_unit:e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div className="field">
                <label>Supplier</label>
                <input className="input" value={form.supplier} onChange={e => setForm({...form,supplier:e.target.value})} placeholder="Supplier name" />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea className="input textarea" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.name.trim()}>
                {saving ? <div className="spinner"/> : <><Check size={14}/> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restock && (
        <div className="modal-overlay" onClick={() => setRestock(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Restock — {restock.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setRestock(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{marginBottom:'0.75rem'}}>Current: <strong>{restock.current_stock} {restock.unit}</strong></p>
              <div className="field">
                <label>Quantity to Add *</label>
                <input className="input" type="number" min="0.01" step="0.1" value={restockQty} onChange={e => setRestockQty(e.target.value)} placeholder="e.g. 50" />
              </div>
              <div className="field">
                <label>Note</label>
                <input className="input" value={restockNote} onChange={e => setRestockNote(e.target.value)} placeholder="e.g. Weekly delivery" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRestock(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRestock} disabled={saving||!restockQty}>
                {saving ? <div className="spinner"/> : 'Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
