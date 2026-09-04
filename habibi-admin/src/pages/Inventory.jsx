import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Pencil, Trash2, X, Check, RefreshCw, AlertTriangle, History, Link, Download } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Inventory.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const BLANK = { name: '', category: 'General', current_stock: '', unit: 'unit', low_stock_threshold: '10', cost_per_unit: '', supplier: '', notes: '', menu_item_id: '' };

const CATEGORIES = ['General', 'Meat', 'Produce', 'Dairy', 'Bread', 'Spices', 'Beverages', 'Packaging', 'Cleaning'];

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export default function Inventory() {
  const [items, setItems]         = useState([]);
  const [menus, setMenus]         = useState([]);
  const [log, setLog]             = useState([]);
  const [orderLog, setOrderLog]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('items'); // 'items' | 'log' | 'orderlog'
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [restock, setRestock]     = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [loadErr, setLoadErr]     = useState('');
  const [search, setSearch]       = useState('');
  const [waitlistCounts, setWaitlistCounts] = useState({}); // { [menu_item_id]: count }

  const load = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [inv, lg, orderLg, menuList, waitlist] = await Promise.all([
        adminAPI.getInventory(),
        adminAPI.getRestockLog(),
        adminAPI.getOrderLog(),
        adminAPI.menus(),
        adminAPI.getWaitlistCounts().catch(() => []), // informational only — never blocks the page
      ]);
      setItems(inv);
      setLog(lg);
      setOrderLog(orderLg);
      setMenus(Array.isArray(menuList) ? menuList : []);
      setWaitlistCounts(Object.fromEntries((waitlist || []).map(w => [w.menu_item_id, w.count])));
    } catch (e) {
      setLoadErr(e.message || 'Failed to load inventory.');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(BLANK); setModal('add'); };
  const openEdit = (i) => {
    setForm({
      ...i,
      current_stock: String(i.current_stock),
      low_stock_threshold: String(i.low_stock_threshold),
      cost_per_unit: String(i.cost_per_unit || ''),
      menu_item_id: i.menu_item_id ? String(i.menu_item_id) : '',
    });
    setModal(i);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        current_stock: parseFloat(form.current_stock) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 10,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        menu_item_id: form.menu_item_id ? parseInt(form.menu_item_id) : null,
      };
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
  const outOfStock = items.filter(i => parseFloat(i.current_stock) <= 0 && i.menu_item_id);
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(i => filterCat === 'all' || i.category === filterCat)
      .filter(i => !q || i.name.toLowerCase().includes(q) || (i.supplier || '').toLowerCase().includes(q) || (i.menu_item_name || '').toLowerCase().includes(q));
  }, [items, filterCat, search]);

  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Stock', 'Unit', 'Low Stock Threshold', 'Unit Cost', 'Supplier', 'Linked Menu Item', 'Notes'];
    const rows = displayed.map(i => [
      i.name, i.category, i.current_stock, i.unit, i.low_stock_threshold,
      i.cost_per_unit || '', i.supplier || '', i.menu_item_name || '', i.notes || '',
    ]);
    downloadCsv(`habibi-inventory-${Date.now()}.csv`, headers, rows);
  };

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">{items.length} items · {lowStock.length} low stock{outOfStock.length > 0 ? ` · ${outOfStock.length} auto sold-out` : ''}</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14}/> Export CSV</button>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14}/></button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add Item</button>
        </div>
      </div>

      {loadErr && (
        <div className="inv-alert" style={{background:'var(--danger-light,#fee2e2)',color:'var(--danger,#dc2626)'}}>
          <AlertTriangle size={16} />
          <span>{loadErr}</span>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto'}} onClick={load}>Retry</button>
        </div>
      )}

      {/* Out of stock auto-sync notice */}
      {outOfStock.length > 0 && (
        <div className="inv-alert" style={{background:'rgba(239,68,68,0.1)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}}>
          <AlertTriangle size={16} />
          <span><strong>{outOfStock.length}</strong> linked menu item{outOfStock.length!==1?'s':''} auto-marked <strong>Sold Out</strong> (stock = 0): {outOfStock.map(i => i.menu_item_name || i.name).join(', ')}</span>
        </div>
      )}

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
        <button className={`inv-tab ${tab==='orderlog'?'active':''}`} onClick={() => setTab('orderlog')}><History size={14}/> Order Activity</button>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : tab === 'items' ? (
        <div className="card">
          <div className="inv-toolbar">
            <input
              className="input"
              placeholder="Search name, supplier, menu item…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{maxWidth:280}}
            />
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
                  <tr><th>Item</th><th>Category</th><th>Stock</th><th>Threshold</th><th>Unit Cost</th><th>Linked Menu Item</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {displayed.map(i => {
                    const isLow = parseFloat(i.current_stock) <= parseFloat(i.low_stock_threshold);
                    const isOut = parseFloat(i.current_stock) <= 0 && i.menu_item_id;
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
                        <td>
                          {i.menu_item_name ? (
                            <span className="inv-linked-badge" title="Auto sold-out when stock hits 0">
                              <Link size={11} />
                              {i.menu_item_name}
                              {isOut && <span className="inv-soldout-pill">Sold Out</span>}
                              {isOut && waitlistCounts[i.menu_item_id] > 0 && (
                                <span className="inv-waitlist-pill" title="Customers waiting to be notified when this is restocked">
                                  {waitlistCounts[i.menu_item_id]} waiting
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted" style={{fontSize:'0.75rem'}}>—</span>
                          )}
                        </td>
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
      ) : tab === 'log' ? (
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
      ) : (
        <div className="card">
          {orderLog.length === 0 ? (
            <div className="empty"><History size={32}/><p>No order activity yet</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Item</th><th>Order #</th><th>Qty Change</th><th>Reason</th></tr></thead>
                <tbody>
                  {orderLog.map(l => {
                    const qty = parseFloat(l.quantity_change);
                    const reasonLabel = l.reason === 'order' ? 'Order placed'
                      : l.reason === 'cancel_restock' ? 'Order cancelled'
                      : l.reason === 'refund_restock' ? 'Order refunded'
                      : l.reason;
                    return (
                      <tr key={l.id}>
                        <td className="text-muted" style={{fontSize:'0.78rem',whiteSpace:'nowrap'}}>
                          {fmtDateTime(l.created_at, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={{fontWeight:500}}>{l.item_name}</td>
                        <td className="text-muted" style={{fontSize:'0.78rem'}}>{l.order_number || '—'}</td>
                        <td className={qty < 0 ? 'text-error' : 'text-success'}>
                          {qty > 0 ? '+' : ''}{qty} {l.unit}
                        </td>
                        <td className="text-muted">{reasonLabel}</td>
                      </tr>
                    );
                  })}
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
                <label>Linked Menu Item <span className="text-muted" style={{fontSize:'0.72rem',fontWeight:400}}>— auto marks Sold Out when stock hits 0</span></label>
                <select className="input select" value={form.menu_item_id} onChange={e => setForm({...form, menu_item_id: e.target.value})}>
                  <option value="">— None (no auto-sync) —</option>
                  {menus.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.title}</option>
                  ))}
                </select>
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
              {restock.menu_item_id && (
                <p className="text-muted" style={{marginBottom:'0.75rem',fontSize:'0.8rem'}}>
                  <Link size={11} style={{verticalAlign:'middle',marginRight:4}}/>
                  Linked to <strong>{restock.menu_item_name || 'menu item'}</strong> — will auto-mark <strong>Available</strong> after restocking.
                </p>
              )}
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
