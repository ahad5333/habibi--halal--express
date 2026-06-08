import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, RefreshCw, ExternalLink, AlertCircle,
  CheckCircle, XCircle, Clock, Package, Phone, MapPin
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './RoadieDeliveries.css';

const STATE_MAP = {
  pending:    { cls: 'rd-badge-warn',    label: 'Pending' },
  available:  { cls: 'rd-badge-info',    label: 'Available' },
  assigned:   { cls: 'rd-badge-info',    label: 'Agent Assigned' },
  picked_up:  { cls: 'rd-badge-primary', label: 'Picked Up' },
  delivered:  { cls: 'rd-badge-success', label: 'Delivered' },
  cancelled:  { cls: 'rd-badge-muted',   label: 'Cancelled' },
  returned:   { cls: 'rd-badge-error',   label: 'Returned' },
};

function StatusBadge({ state }) {
  const s = STATE_MAP[state] || { cls: 'rd-badge-muted', label: state || 'Unknown' };
  return <span className={`rd-badge ${s.cls}`}>{s.label}</span>;
}

function ShipmentCard({ shipment, onCancel }) {
  const canCancel = !['delivered', 'cancelled', 'returned'].includes(shipment.state);
  const eta = shipment.estimated_dropoff_time
    ? new Date(shipment.estimated_dropoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rd-card">
      <div className="rd-card-hdr">
        <div>
          <p className="rd-order-num">#{shipment.order_number}</p>
          <p className="rd-placed">{new Date(shipment.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <StatusBadge state={shipment.state} />
      </div>

      <div className="rd-card-body">
        {shipment.customer_name && (
          <div className="rd-info-row"><Package size={12}/> {shipment.customer_name}</div>
        )}
        {shipment.delivery_address && (
          <div className="rd-info-row"><MapPin size={12}/> {shipment.delivery_address}</div>
        )}
        {shipment.agent_name && (
          <div className="rd-agent">
            <div className="rd-info-row"><Truck size={12}/> Agent: {shipment.agent_name}</div>
            {shipment.agent_phone && (
              <a href={`tel:${shipment.agent_phone}`} className="rd-info-row rd-phone">
                <Phone size={12}/> {shipment.agent_phone}
              </a>
            )}
            {eta && <div className="rd-info-row"><Clock size={12}/> ETA: {eta}</div>}
          </div>
        )}
      </div>

      <div className="rd-card-footer">
        <span className="rd-total">${parseFloat(shipment.total || 0).toFixed(2)}</span>
        <div className="rd-actions">
          {shipment.tracking_number && (
            <a
              className="rd-btn-sm rd-btn-outline"
              href={`https://www.roadie.com/track/${shipment.tracking_number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12}/> Track
            </a>
          )}
          {canCancel && (
            <button className="rd-btn-sm rd-btn-cancel" onClick={() => onCancel(shipment.roadie_id)}>
              <XCircle size={12}/> Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EstimateWidget() {
  const [addr, setAddr]     = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const getEstimate = async () => {
    if (!addr.trim()) return;
    setLoading(true); setResult(null);
    try {
      const data = await adminAPI.getRoadieEstimate(addr);
      setResult(data);
    } catch { setResult({ error: 'Could not get estimate' }); }
    setLoading(false);
  };

  return (
    <div className="rd-estimate">
      <h4>Price Estimate</h4>
      <div className="rd-estimate-row">
        <input
          className="rd-input"
          placeholder="Customer delivery address"
          value={addr}
          onChange={e => setAddr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && getEstimate()}
        />
        <button className="rd-btn-primary" onClick={getEstimate} disabled={loading}>
          {loading ? 'Checking…' : 'Estimate'}
        </button>
      </div>
      {result && !result.error && (
        <p className="rd-estimate-result">
          <CheckCircle size={13}/> Est. price: <strong>${((result.price || 0) / 100).toFixed(2)}</strong>
          {result.estimated_pickup_time && <> · Pickup: {new Date(result.estimated_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
        </p>
      )}
      {result?.error && <p className="rd-estimate-error"><AlertCircle size={13}/> {result.error}</p>}
    </div>
  );
}

export default function RoadieDeliveries() {
  const [shipments, setShipments] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  const load = useCallback(async () => {
    try {
      const data = await adminAPI.getRoadieShipments();
      setShipments(Array.isArray(data.shipments) ? data.shipments : []);
      setConfigured(data.configured !== false);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const handleCancel = async (roadieId) => {
    if (!window.confirm('Cancel this Roadie shipment?')) return;
    try {
      await adminAPI.cancelRoadieShipment(roadieId);
      load();
    } catch (err) {
      alert('Cancel failed: ' + err.message);
    }
  };

  const DONE_STATES = ['delivered', 'cancelled', 'returned'];
  const active = shipments.filter(s => !DONE_STATES.includes(s.state));
  const done   = shipments.filter(s =>  DONE_STATES.includes(s.state));
  const shown  = filter === 'active' ? active : done;

  const deliveredCount = done.filter(s => s.state === 'delivered').length;

  return (
    <div className="rd-page">
      <div className="rd-topbar">
        <div>
          <h1 className="rd-title">Roadie Deliveries</h1>
          <p className="rd-sub">Long-distance courier · 30–350 mile radius</p>
        </div>
        <button className="rd-btn-outline" onClick={load}><RefreshCw size={14}/> Refresh</button>
      </div>

      {!configured && (
        <div className="rd-notice">
          <AlertCircle size={16}/>
          <div>
            <strong>Roadie not configured.</strong> Add <code>ROADIE_API_KEY</code> to your .env file, then register your webhook:
            <code className="rd-webhook-url">{window.location.origin.replace(':5174', ':5001')}/api/roadie/webhook</code>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="rd-stats-row">
        {[
          { label: 'Active',    val: active.length,      icon: <Truck size={16}/> },
          { label: 'Delivered', val: deliveredCount,     icon: <CheckCircle size={16}/> },
          { label: 'Total',     val: shipments.length,   icon: <Package size={16}/> },
        ].map(s => (
          <div key={s.label} className="rd-stat-card">
            {s.icon}
            <div>
              <p className="rd-stat-val">{s.val}</p>
              <p className="rd-stat-label">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <EstimateWidget />

      {/* Filter tabs */}
      <div className="rd-tabs">
        <button className={`rd-tab ${filter==='active'?'active':''}`} onClick={() => setFilter('active')}>
          Active {active.length > 0 && <span className="rd-tab-badge">{active.length}</span>}
        </button>
        <button className={`rd-tab ${filter==='done'?'active':''}`} onClick={() => setFilter('done')}>
          Completed / Cancelled
        </button>
      </div>

      {loading ? (
        <div className="rd-loading"><div className="rd-spinner"/></div>
      ) : shown.length === 0 ? (
        <div className="rd-empty">
          <Truck size={40}/>
          <p>{filter === 'active' ? 'No active Roadie shipments.' : 'No completed shipments yet.'}</p>
          <p className="rd-empty-sub">Roadie shipments auto-dispatch for orders between 30–350 miles.</p>
        </div>
      ) : (
        <div className="rd-grid">
          {shown.map(s => <ShipmentCard key={s.id} shipment={s} onCancel={handleCancel} />)}
        </div>
      )}
    </div>
  );
}
