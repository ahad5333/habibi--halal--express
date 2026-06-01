import React, { useEffect, useState, useRef } from 'react';
import { QrCode, Plus, Trash2, ToggleLeft, ToggleRight, Printer, Copy, Check, UtensilsCrossed } from 'lucide-react';
import './TableManager.css';

const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const FRONT_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

// ── Tiny pure-JS QR matrix renderer ─────────────────────────────────────────
// Uses the qrcode-svg approach: calls backend /qr endpoint which returns URL,
// then we render as an <img> that shows a QR via the Google Charts API fallback.
// This avoids any npm package — we just embed the URL and display it visually.
function QRDisplay({ url, size = 180 }) {
  // Encode url into a Google Charts QR code image URL (public API, no key required)
  // Using data URI approach: we render a canvas-based QR or fallback to a known source.
  const chartUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(url)}&choe=UTF-8`;
  return (
    <img
      src={chartUrl}
      alt="QR Code"
      width={size}
      height={size}
      className="tm-qr-img"
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

export default function TableManager() {
  const token = localStorage.getItem('habibi_admin_token');
  const [tables, setTables]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newName, setNewName]     = useState('');
  const [adding, setAdding]       = useState(false);
  const [qrModal, setQrModal]     = useState(null); // { table }
  const [copied, setCopied]       = useState('');
  const printRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dine-in/tables`, { headers: authHeaders });
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/dine-in/tables`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ table_name: newName.trim() }),
      });
      if (res.ok) {
        setNewName('');
        await load();
      }
    } catch (_) {}
    setAdding(false);
  };

  const handleToggle = async (table) => {
    try {
      await fetch(`${API_BASE}/api/dine-in/tables/${table.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ is_active: !table.is_active }),
      });
      await load();
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table? QR codes for it will stop working.')) return;
    try {
      await fetch(`${API_BASE}/api/dine-in/tables/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      await load();
    } catch (_) {}
  };

  const tableUrl = (t) => `${FRONT_URL}/dine-in/${t.qr_slug}`;

  const handleCopy = async (url, id) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch (_) {}
  };

  const handlePrint = () => {
    if (!qrModal) return;
    const url = tableUrl(qrModal);
    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(`
      <html><head><title>QR — ${qrModal.table_name}</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 22px; margin: 16px 0 4px; }
        p  { font-size: 13px; color: #666; margin: 0; }
        img { margin: 0 auto 12px; display: block; }
      </style></head>
      <body>
        <img src="https://chart.googleapis.com/chart?cht=qr&chs=260x260&chl=${encodeURIComponent(url)}&choe=UTF-8" width="260" height="260" />
        <h1>${qrModal.table_name}</h1>
        <p>Scan to order · Habibi Halal Express</p>
        <script>window.onload=()=>window.print();<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="tm-page">
      <div className="tm-header">
        <div>
          <h1 className="tm-title">Dine-In Tables</h1>
          <p className="tm-sub">Manage tables and generate QR codes for scan-to-order</p>
        </div>
        <a
          href={`${FRONT_URL.replace('5173','5173')}/kitchen`}
          target="_blank"
          rel="noreferrer"
          className="tm-kitchen-link"
        >
          <UtensilsCrossed size={15} />
          Kitchen Display
        </a>
      </div>

      {/* Add table */}
      <div className="tm-add-row">
        <input
          className="tm-input"
          type="text"
          placeholder="e.g. Table 1, Booth A, Patio 3..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="tm-add-btn" onClick={handleAdd} disabled={adding || !newName.trim()}>
          <Plus size={16} />
          {adding ? 'Adding…' : 'Add Table'}
        </button>
      </div>

      {/* Table list */}
      {loading ? (
        <div className="tm-loading"><div className="tm-spinner" /></div>
      ) : tables.length === 0 ? (
        <div className="tm-empty">
          <QrCode size={48} strokeWidth={1} />
          <p>No tables yet</p>
          <span>Add your first table above to generate a QR code</span>
        </div>
      ) : (
        <div className="tm-grid">
          {tables.map(t => (
            <div key={t.id} className={`tm-card ${!t.is_active ? 'inactive' : ''}`}>
              <div className="tm-card-top">
                <div>
                  <p className="tm-card-name">{t.table_name}</p>
                  <span className={`tm-status-badge ${t.is_active ? 'active' : 'off'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="tm-card-actions">
                  <button
                    className="tm-icon-btn"
                    title={t.is_active ? 'Deactivate' : 'Activate'}
                    onClick={() => handleToggle(t)}
                  >
                    {t.is_active ? <ToggleRight size={18} className="tm-toggle-on" /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    className="tm-icon-btn danger"
                    title="Delete table"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* QR preview */}
              <div className="tm-qr-wrap" onClick={() => setQrModal(t)}>
                <QRDisplay url={tableUrl(t)} size={120} />
                <p className="tm-qr-hint">Click to enlarge & print</p>
              </div>

              {/* URL copy */}
              <div className="tm-url-row">
                <span className="tm-url-text">{tableUrl(t)}</span>
                <button
                  className="tm-copy-btn"
                  onClick={() => handleCopy(tableUrl(t), t.id)}
                  title="Copy URL"
                >
                  {copied === t.id ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="tm-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="tm-modal" onClick={e => e.stopPropagation()}>
            <p className="tm-modal-title">{qrModal.table_name}</p>
            <QRDisplay url={tableUrl(qrModal)} size={240} />
            <p className="tm-modal-url">{tableUrl(qrModal)}</p>
            <div className="tm-modal-actions">
              <button
                className="tm-modal-copy"
                onClick={() => handleCopy(tableUrl(qrModal), 'modal')}
              >
                {copied === 'modal' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy URL</>}
              </button>
              <button className="tm-modal-print" onClick={handlePrint}>
                <Printer size={14} />
                Print QR
              </button>
            </div>
            <button className="tm-modal-close" onClick={() => setQrModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
