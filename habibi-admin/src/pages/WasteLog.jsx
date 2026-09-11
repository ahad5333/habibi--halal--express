import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, X, RefreshCw } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Reports.css';
import './WasteLog.css';

// Food thrown away -- logged by kitchen staff from their PIN screen or here --
// and what it cost. Costs come from the dish costs (Reports → Menu
// Profitability) and ingredient costs (Inventory); entries without one are
// counted separately rather than guessed.

const RANGES = [7, 30, 90];
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const qtyText = (q, unit) => `${parseFloat(q)} ${unit === 'portion' && parseFloat(q) !== 1 ? 'portions' : unit}`;
const when = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function LogWasteModal({ onClose, onSaved }) {
  const [opts, setOpts] = useState(null);
  const [kind, setKind] = useState('dish');
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [f, setF] = useState({ quantity: '1', reason: '', location_id: '', note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { adminAPI.wasteOptions().then(o => { setOpts(o); setF(p => ({ ...p, location_id: o.locations[0]?.id ? String(o.locations[0].id) : '' })); }).catch(e => setErr(e.message)); }, []);

  const list = kind === 'dish' ? opts?.dishes : opts?.ingredients;
  const shown = useMemo(() => (list || []).filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 200), [list, search]);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!itemId) return setErr(`Choose ${kind === 'dish' ? 'a dish' : 'an ingredient'}.`);
    if (!f.reason) return setErr('Choose a reason.');
    setBusy(true);
    try {
      await adminAPI.logWaste({
        [kind === 'dish' ? 'menu_item_id' : 'inventory_item_id']: parseInt(itemId, 10),
        quantity: parseFloat(f.quantity), reason: f.reason, note: f.note, location_id: f.location_id || null,
      });
      onSaved();
    } catch (e2) {
      setErr(e2.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">Log waste</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {!opts ? <p className="text-muted">{err || 'Loading…'}</p> : (
          <form onSubmit={save}>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[['dish', 'Dish'], ['ingredient', 'Ingredient']].map(([k, l]) => (
                  <button type="button" key={k} className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => { setKind(k); setItemId(''); setSearch(''); }}>{l}</button>
                ))}
              </div>
              <div className="field">
                <label>{kind === 'dish' ? 'Dish' : 'Ingredient'}</label>
                <input className="input" placeholder="Type to filter" value={search} onChange={e => setSearch(e.target.value)} />
                <select className="input select" size={6} value={itemId} onChange={e => setItemId(e.target.value)}>
                  {shown.map(i => <option key={i.id} value={i.id}>{i.name}{kind === 'ingredient' ? ` (${i.unit})` : ''}</option>)}
                </select>
                {kind === 'ingredient' && opts.ingredients.length === 0 && (
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>No ingredients yet — add them on the Inventory page.</span>
                )}
              </div>
              <div className="waste-form-row">
                <div className="field">
                  <label>Quantity</label>
                  <input className="input" type="number" min="0.01" step="0.01" value={f.quantity} onChange={set('quantity')} />
                </div>
                <div className="field">
                  <label>Reason</label>
                  <select className="input select" value={f.reason} onChange={set('reason')}>
                    <option value="">Choose…</option>
                    {opts.reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="waste-form-row">
                <div className="field">
                  <label>Store</label>
                  <select className="input select" value={f.location_id} onChange={set('location_id')}>
                    <option value="">Not specified</option>
                    {opts.locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Note</label>
                  <input className="input" maxLength={300} value={f.note} onChange={set('note')} placeholder="Optional" />
                </div>
              </div>
              {err && <div className="waste-err">⚠ {err}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Log waste'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function WasteLog() {
  const [days, setDays] = useState(30);
  const [locations, setLocations] = useState([]);
  const [loc, setLoc] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLog, setShowLog] = useState(false);

  useEffect(() => { adminAPI.wasteOptions().then(o => setLocations(o.locations || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await adminAPI.wasteReport(days, loc)); }
    catch (e) { setError(e.message || 'Could not load the waste log.'); }
    finally { setLoading(false); }
  }, [days, loc]);
  useEffect(() => { load(); }, [load]);

  const remove = async (w) => {
    if (!window.confirm(`Delete this entry (${qtyText(w.quantity, w.unit)} × ${w.item_name})? Any stock it removed is put back.`)) return;
    try { await adminAPI.deleteWaste(w.id); load(); } catch (e) { alert(e.message); }
  };

  const s = data?.summary;
  const reasonLabel = (r) => data?.reasons?.[r] || r;
  const maxReason = Math.max(...(data?.by_reason || []).map(r => r.cost || r.entries), 1);
  const dayMetric = s && s.total_cost > 0 ? 'cost' : 'entries';
  const maxDay = Math.max(...(data?.by_day || []).map(d => d[dayMetric]), 1);

  return (
    <div>
      <div className="page-hdr">
        <div>
          <p className="page-title"><Trash2 size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Waste Log</p>
          <p className="page-sub">Food thrown away — logged by kitchen staff or here — and what it cost</p>
        </div>
        <div className="waste-controls">
          {RANGES.map(r => (
            <button key={r} className={`btn btn-sm ${days === r ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDays(r)}>{r} days</button>
          ))}
          {locations.length > 1 && (
            <select className="input select waste-loc" value={loc} onChange={e => setLoc(e.target.value)} aria-label="Store">
              <option value="">All stores</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
          <button className="btn btn-sm btn-ghost" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowLog(true)}><Plus size={14} /> Log waste</button>
        </div>
      </div>

      {error && <div className="card waste-err" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && !data ? (
        <div className="card"><div className="empty" style={{ minHeight: 200 }}><div className="spinner" /></div></div>
      ) : data && s.entries === 0 ? (
        <div className="card">
          <div className="empty" style={{ minHeight: 220 }}>
            <Trash2 size={34} />
            <p style={{ maxWidth: 440 }}>
              No waste logged in the last {days} days. Kitchen staff log it from the <strong>Waste</strong> button
              on their order screen, or use <strong>Log waste</strong> above.
            </p>
          </div>
        </div>
      ) : data && (
        <>
          <div className="rpt-stat-grid">
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Waste cost</p>
              <p className="rpt-stat-value" style={{ color: s.total_cost ? '#dc2626' : undefined }}>{money(s.total_cost)}</p>
              <p className="rpt-stat-sub">In the last {days} days</p>
            </div></div>
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Entries</p>
              <p className="rpt-stat-value">{s.entries}</p>
              <p className="rpt-stat-sub">Times food was thrown away</p>
            </div></div>
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Without a cost</p>
              <p className="rpt-stat-value">{s.without_cost}</p>
              <p className="rpt-stat-sub">
                {s.without_cost ? 'Not in the total — set dish costs (Reports) and ingredient costs (Inventory)' : 'Every entry has a cost'}
              </p>
            </div></div>
          </div>

          <div className="waste-columns">
            <div className="card waste-section">
              <p className="waste-title">Why it was thrown away</p>
              <div className="waste-bars">
                {data.by_reason.map(r => (
                  <div key={r.reason} className="waste-bar-row">
                    <span className="waste-bar-label">{reasonLabel(r.reason)}</span>
                    <span className="waste-bar-track"><span className="waste-bar-fill" style={{ width: `${((r.cost || r.entries) / maxReason) * 100}%` }} /></span>
                    <span className="waste-bar-num">{r.cost ? money(r.cost) : `${r.entries}×`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card waste-section">
              <p className="waste-title">Per day ({dayMetric === 'cost' ? 'cost' : 'entries'})</p>
              <div className="waste-days" role="img" aria-label={`Waste ${dayMetric} per day`}>
                {data.by_day.map(d => (
                  <div key={d.day} className="waste-day" title={`${d.day}: ${dayMetric === 'cost' ? money(d.cost) : d.entries + ' entries'}`}>
                    <span className="waste-day-bar" style={{ height: `${(d[dayMetric] / maxDay) * 100}%` }} />
                    <span className="waste-day-label">{d.day.slice(5).replace('-', '/')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card waste-section">
            <p className="waste-title">Most wasted</p>
            <div className="table-wrap">
              <table className="table waste-table">
                <thead><tr><th>Item</th><th>Type</th><th style={{ textAlign: 'right' }}>Quantity</th><th style={{ textAlign: 'right' }}>Times</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead>
                <tbody>
                  {data.by_item.map(i => (
                    <tr key={`${i.item_kind}-${i.item_name}-${i.unit}`}>
                      <td style={{ fontWeight: 600 }}>{i.item_name}</td>
                      <td className="text-muted">{i.item_kind === 'dish' ? 'Dish' : 'Ingredient'}</td>
                      <td style={{ textAlign: 'right' }}>{qtyText(i.quantity, i.unit)}</td>
                      <td style={{ textAlign: 'right' }}>{i.entries}</td>
                      <td style={{ textAlign: 'right' }}>{i.missing_cost && !i.cost ? <span className="text-muted">no cost set</span> : money(i.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card waste-section">
            <p className="waste-title">All entries</p>
            <div className="table-wrap">
              <table className="table waste-table">
                <thead><tr><th>When</th><th>Item</th><th>Quantity</th><th>Reason</th><th>Store</th><th>Logged by</th><th style={{ textAlign: 'right' }}>Cost</th><th /></tr></thead>
                <tbody>
                  {data.entries.map(w => (
                    <tr key={w.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{when(w.created_at)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{w.item_name}</div>
                        {w.note && <div className="text-muted" style={{ fontSize: '0.74rem' }}>{w.note}</div>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{qtyText(w.quantity, w.unit)}</td>
                      <td><span className="badge badge-muted">{reasonLabel(w.reason)}</span></td>
                      <td className="text-muted">{w.location || '—'}</td>
                      <td className="text-muted">{w.logged_by_name || (w.logged_by_type === 'admin' ? 'Admin' : 'Staff')}</td>
                      <td style={{ textAlign: 'right' }}>{w.total_cost === null ? <span className="text-muted">—</span> : money(w.total_cost)}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => remove(w)} title="Delete entry"><X size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showLog && <LogWasteModal onClose={() => setShowLog(false)} onSaved={() => { setShowLog(false); load(); }} />}
    </div>
  );
}
