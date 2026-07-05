import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, CheckCircle, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, User, Clock, Package,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './CashLog.css';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return `$${parseFloat(n || 0).toFixed(2)}`;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Hand-in modal ──────────────────────────────────────────────────
function HandinModal({ driver, onConfirm, onClose }) {
  const [amount, setAmount]     = useState(driver.outstanding.toFixed(2));
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const submit = async () => {
    if (!amount || isNaN(parseFloat(amount))) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      await onConfirm({
        driver_id:    driver.driver_id,
        driver_name:  driver.driver_name,
        amount:       parseFloat(amount),
        order_count:  driver.confirmed_count,
        confirmed_by: 'Manager',
        notes,
      });
      onClose();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="cl-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={e => e.stopPropagation()}>
        <h3 className="cl-modal-title">Confirm Cash Hand-In</h3>
        <p className="cl-modal-sub">
          <User size={13}/> {driver.driver_name} · {driver.confirmed_count} order{driver.confirmed_count !== 1 ? 's' : ''}
        </p>

        <label className="cl-label">Amount received ($)</label>
        <input
          className="cl-input"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <label className="cl-label">Notes (optional)</label>
        <input
          className="cl-input"
          placeholder="e.g. Short by $2 — driver explained…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {error && <p className="cl-err">{error}</p>}

        <div className="cl-modal-btns">
          <button className="cl-btn cl-btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Saving…' : <><CheckCircle size={15}/> Confirm Receipt</>}
          </button>
          <button className="cl-btn cl-btn-muted" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Driver summary row ─────────────────────────────────────────────
function DriverRow({ driver, onHandin }) {
  const [open, setOpen] = useState(false);
  const settled = driver.outstanding <= 0;

  return (
    <div className={`cl-driver-card ${settled ? 'cl-settled' : 'cl-outstanding'}`}>
      <div className="cl-driver-hdr" onClick={() => setOpen(v => !v)}>
        <div className="cl-driver-left">
          <div className="cl-driver-avatar">{(driver.driver_name || '?').charAt(0).toUpperCase()}</div>
          <div>
            <p className="cl-driver-name">{driver.driver_name}</p>
            <p className="cl-driver-meta">
              {driver.confirmed_count} order{driver.confirmed_count !== 1 ? 's' : ''} confirmed
              {driver.orders.length > driver.confirmed_count && (
                <span className="cl-warn-pill">
                  {driver.orders.length - driver.confirmed_count} unconfirmed
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="cl-driver-right">
          <div className="cl-amount-block">
            <p className="cl-amount-label">Collected</p>
            <p className="cl-amount">{fmt(driver.total_collected)}</p>
          </div>
          <div className="cl-amount-block">
            <p className="cl-amount-label">Handed In</p>
            <p className={`cl-amount ${driver.total_handed_in > 0 ? 'cl-green' : 'cl-muted'}`}>
              {fmt(driver.total_handed_in)}
            </p>
          </div>
          <div className="cl-amount-block">
            <p className="cl-amount-label">Outstanding</p>
            <p className={`cl-amount cl-amount-lg ${settled ? 'cl-green' : 'cl-red'}`}>
              {settled ? '✓ Clear' : fmt(driver.outstanding)}
            </p>
          </div>
          <div className="cl-driver-actions">
            {!settled && driver.total_collected > 0 && (
              <button
                className="cl-btn cl-btn-primary cl-btn-sm"
                onClick={e => { e.stopPropagation(); onHandin(driver); }}
              >
                <DollarSign size={13}/> Mark Received
              </button>
            )}
            <button className="cl-chevron" onClick={() => setOpen(v => !v)}>
              {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="cl-orders-table">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount</th>
                <th>Cash Confirmed</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {driver.orders.map(o => (
                <tr key={o.id} className={o.cash_collected_at ? '' : 'cl-row-warn'}>
                  <td>{o.order_number}</td>
                  <td>{fmt(o.order_total)}</td>
                  <td>
                    {o.cash_collected_at
                      ? <span className="cl-pill-green"><CheckCircle size={11}/> Confirmed</span>
                      : <span className="cl-pill-warn"><AlertTriangle size={11}/> Not confirmed</span>
                    }
                  </td>
                  <td>{fmtTime(o.cash_collected_at || o.delivered_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {driver.handins.length > 0 && (
            <div className="cl-handins-section">
              <p className="cl-handins-title">Hand-ins recorded today</p>
              {driver.handins.map(h => (
                <div key={h.id} className="cl-handin-row">
                  <CheckCircle size={13} className="cl-green-icon"/>
                  <span>{fmt(h.amount)} received at {fmtTime(h.created_at)}</span>
                  {h.confirmed_by && <span className="cl-muted"> · by {h.confirmed_by}</span>}
                  {h.notes && <span className="cl-muted"> · "{h.notes}"</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function CashLog() {
  const [date, setDate]           = useState(todayStr());
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [handinTarget, setHandinTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await adminAPI.getCashReport(date);
      setReport(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleHandin = async (body) => {
    await adminAPI.recordCashHandin(body);
    await load();
  };

  const totalCollected = report?.drivers.reduce((s, d) => s + d.total_collected, 0) || 0;
  const totalHandedIn  = report?.drivers.reduce((s, d) => s + d.total_handed_in, 0)  || 0;
  const totalOutstanding = Math.max(0, totalCollected - totalHandedIn);
  const unconfirmedCount = report?.deliveries.filter(d => !d.cash_collected_at).length || 0;

  return (
    <div className="cl-root">
      <div className="cl-page-hdr">
        <div>
          <h1 className="cl-title"><DollarSign size={22}/> COD Cash Log</h1>
          <p className="cl-subtitle">Track every cash delivery — from door to deposit</p>
        </div>
        <div className="cl-hdr-right">
          <input
            type="date"
            className="cl-date-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <button className="cl-btn cl-btn-muted" onClick={load} disabled={loading}>
            <RefreshCw size={14}/> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="cl-summary-row">
        <div className="cl-summary-card">
          <p className="cl-summary-label">Total Collected</p>
          <p className="cl-summary-amt cl-green">{fmt(totalCollected)}</p>
          <p className="cl-summary-sub">{report?.drivers.reduce((s,d) => s + d.confirmed_count, 0) || 0} orders confirmed</p>
        </div>
        <div className="cl-summary-card">
          <p className="cl-summary-label">Handed In</p>
          <p className="cl-summary-amt cl-green">{fmt(totalHandedIn)}</p>
          <p className="cl-summary-sub">{report?.handins.length || 0} hand-in records</p>
        </div>
        <div className={`cl-summary-card ${totalOutstanding > 0 ? 'cl-card-warn' : ''}`}>
          <p className="cl-summary-label">Outstanding</p>
          <p className={`cl-summary-amt ${totalOutstanding > 0 ? 'cl-red' : 'cl-green'}`}>
            {totalOutstanding > 0 ? fmt(totalOutstanding) : '✓ All Clear'}
          </p>
          <p className="cl-summary-sub">
            {totalOutstanding > 0 ? 'Cash not yet received by store' : 'All cash accounted for'}
          </p>
        </div>
        {unconfirmedCount > 0 && (
          <div className="cl-summary-card cl-card-alert">
            <p className="cl-summary-label">Unconfirmed</p>
            <p className="cl-summary-amt cl-orange">{unconfirmedCount}</p>
            <p className="cl-summary-sub">Deliveries with no cash confirmation from driver</p>
          </div>
        )}
      </div>

      {error && <div className="cl-error"><AlertTriangle size={16}/> {error}</div>}

      {!loading && report && report.drivers.length === 0 && (
        <div className="cl-empty">
          <Package size={40}/>
          <p>No COD deliveries on {date}</p>
        </div>
      )}

      <div className="cl-drivers-list">
        {report?.drivers.map(driver => (
          <DriverRow
            key={driver.driver_id || driver.driver_name}
            driver={driver}
            onHandin={setHandinTarget}
          />
        ))}
      </div>

      {handinTarget && (
        <HandinModal
          driver={handinTarget}
          onConfirm={handleHandin}
          onClose={() => setHandinTarget(null)}
        />
      )}
    </div>
  );
}
