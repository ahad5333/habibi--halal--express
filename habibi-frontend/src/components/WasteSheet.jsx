import React, { useEffect, useMemo, useState } from 'react';
import { X, Trash2, Search, Minus, Plus, Undo2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const LOCATION_KEY = 'habibi_waste_location'; // this device's store, remembered

// "Log waste" from the staff order screen: a dish or an ingredient, how many,
// why. A few taps, so it actually gets used during a shift. The server lowers
// stock the same way an order does; recent entries can be undone for a few
// minutes if they were a mistake.
export default function WasteSheet({ headers, onClose }) {
  const [opts, setOpts] = useState(null);
  const [kind, setKind] = useState('dish');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState(() => { try { return localStorage.getItem(LOCATION_KEY) || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }
  const [mine, setMine] = useState([]);

  const call = async (path, init = {}) => {
    const res = await fetch(`${API_BASE}/api/staff${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...headers, ...(init.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  };
  const loadMine = () => call('/waste/mine').then(setMine).catch(() => {});

  useEffect(() => {
    call('/waste/options')
      .then(o => {
        setOpts(o);
        if (!location && o.locations?.length) setLocation(String(o.locations[0].id));
      })
      .catch(e => setMsg({ ok: false, text: e.message }));
    loadMine();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = kind === 'dish' ? opts?.dishes : opts?.ingredients;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list || []).filter(i => !q || i.name.toLowerCase().includes(q)).slice(0, 40);
  }, [list, query]);

  const unit = picked ? (kind === 'dish' ? (qty === 1 ? 'portion' : 'portions') : picked.unit) : '';
  const step = kind === 'dish' ? 1 : 0.5;

  const reset = () => { setPicked(null); setQty(1); setReason(''); setNote(''); setQuery(''); };

  const submit = async () => {
    if (!picked || !reason || busy) return;
    setBusy(true); setMsg(null);
    try {
      try { localStorage.setItem(LOCATION_KEY, location); } catch { /* ignore */ }
      await call('/waste', {
        method: 'POST',
        body: JSON.stringify({
          [kind === 'dish' ? 'menu_item_id' : 'inventory_item_id']: picked.id,
          quantity: qty, reason, note, location_id: location || null,
        }),
      });
      const label = opts.reasons.find(r => r.value === reason)?.label;
      setMsg({ ok: true, text: `Logged ${qty} × ${picked.name} (${label}).` });
      reset();
      loadMine();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const undo = async (id) => {
    try { await call(`/waste/${id}`, { method: 'DELETE' }); loadMine(); setMsg({ ok: true, text: 'Entry undone — stock put back.' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="kd-history-overlay" onClick={onClose}>
      <div className="kd-waste" onClick={e => e.stopPropagation()} role="dialog" aria-label="Log waste">
        <div className="kd-history-hdr">
          <span><Trash2 size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Log waste</span>
          <button className="kd-manual-refresh" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>

        {!opts ? (
          <p className="kd-waste-muted">{msg?.text || 'Loading…'}</p>
        ) : (
          <div className="kd-waste-body">
            {!picked ? (
              <>
                <div className="kd-waste-tabs" role="tablist">
                  {[['dish', 'Dish'], ['ingredient', 'Ingredient']].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''}
                            onClick={() => { setKind(k); setQuery(''); }}>{l}</button>
                  ))}
                </div>
                <div className="kd-waste-search">
                  <Search size={14} />
                  <input autoFocus placeholder={kind === 'dish' ? 'Find a dish' : 'Find an ingredient'}
                         value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <ul className="kd-waste-list">
                  {matches.map(i => (
                    <li key={i.id}>
                      <button onClick={() => { setPicked(i); setQty(1); }}>
                        <span>{i.name}</span>
                        <small>{kind === 'ingredient' ? i.unit : i.category}</small>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className="kd-waste-muted">
                      {kind === 'ingredient' && !opts.ingredients.length
                        ? 'No ingredients set up yet — add them in CPanel → Inventory.'
                        : 'Nothing matches.'}
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <>
                <div className="kd-waste-picked">
                  <strong>{picked.name}</strong>
                  <button className="kd-history-btn" onClick={() => setPicked(null)}>Change</button>
                </div>

                <div className="kd-waste-qty">
                  <button onClick={() => setQty(q => Math.max(step, Math.round((q - step) * 10) / 10))} aria-label="Less"><Minus size={16} /></button>
                  <input type="number" min={step} step={step} inputMode="decimal" value={qty}
                         onChange={e => setQty(Math.max(0, parseFloat(e.target.value) || 0))} />
                  <button onClick={() => setQty(q => Math.round((q + step) * 10) / 10)} aria-label="More"><Plus size={16} /></button>
                  <span className="kd-waste-unit">{unit}</span>
                </div>

                <p className="kd-waste-label">Why?</p>
                <div className="kd-waste-reasons">
                  {opts.reasons.map(r => (
                    <button key={r.value} className={reason === r.value ? 'on' : ''} onClick={() => setReason(r.value)}>{r.label}</button>
                  ))}
                </div>

                <div className="kd-waste-row">
                  {opts.locations.length > 1 && (
                    <select value={location} onChange={e => setLocation(e.target.value)} aria-label="Store">
                      {opts.locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  )}
                  <input placeholder="Note (optional)" maxLength={300} value={note} onChange={e => setNote(e.target.value)} />
                </div>

                <button className="kd-waste-submit" disabled={!reason || !(qty > 0) || busy} onClick={submit}>
                  {busy ? 'Saving…' : `Log ${qty} ${unit}`}
                </button>
              </>
            )}

            {msg && <p className={`kd-waste-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}

            {mine.length > 0 && (
              <div className="kd-waste-mine">
                <p className="kd-waste-label">Your last 24 hours</p>
                <ul>
                  {mine.map(w => (
                    <li key={w.id}>
                      <span>{parseFloat(w.quantity)} × {w.item_name}</span>
                      <small>{new Date(w.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                      {w.can_undo && (
                        <button className="kd-history-btn" onClick={() => undo(w.id)}><Undo2 size={12} /> Undo</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
