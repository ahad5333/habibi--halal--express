import React, { useState, useEffect } from 'react';
import { Plus, X, Gift, Ban, History } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Coupons.css';
import { fmtDateShort, fmtDateTime } from '../utils/date.js';

const EMPTY = { amount: '', purchaser_name: '', purchaser_email: '', message: '' };

function IssueModal({ onClose, onIssue }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('A positive amount is required.'); return; }
    setSaving(true); setError('');
    try {
      await onIssue(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue gift card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">Issue Gift Card</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="menu-error">⚠ {error}</div>}
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              Creates a real, redeemable gift card with no purchase charge attached — for customer-service comps and manual issuance.
            </p>
            <div className="coupon-row">
              <div className="field">
                <label>Amount ($) *</label>
                <input type="number" min="0.01" step="0.01" className="input" placeholder="25.00" value={form.amount} onChange={e => set('amount', e.target.value)} required />
              </div>
              <div className="field">
                <label>Recipient Name</label>
                <input className="input" placeholder="Customer name" value={form.purchaser_name} onChange={e => set('purchaser_name', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Recipient Email <span style={{ color: 'var(--color-text-dim)' }}>(optional — if given, the code is emailed automatically)</span></label>
              <input type="email" className="input" placeholder="customer@example.com" value={form.purchaser_email} onChange={e => set('purchaser_email', e.target.value)} />
            </div>
            <div className="field">
              <label>Message <span style={{ color: 'var(--color-text-dim)' }}>(optional)</span></label>
              <input className="input" placeholder="Sorry for the trouble — enjoy a meal on us!" value={form.message} onChange={e => set('message', e.target.value)} maxLength={300} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Issue Gift Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransactionsModal({ card, onClose }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.giftCardTransactions(card.id)
      .then(d => setTxns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [card.id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">{card.code} — Transaction History</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : txns.length === 0 ? (
            <div className="empty"><History size={28} /><p>No transactions yet</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Amount</th><th>Order</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id}>
                      <td style={{ textTransform: 'capitalize' }}>{t.type.replace('_', ' ')}</td>
                      <td style={{ fontWeight: 600, color: t.type === 'purchase' || t.type === 'admin_issue' ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {t.type === 'purchase' || t.type === 'admin_issue' ? '+' : '−'}${parseFloat(t.amount).toFixed(2)}
                      </td>
                      <td className="mono text-muted">{t.order_number || '—'}</td>
                      <td className="text-muted" style={{ fontSize: '0.72rem' }}>{fmtDateTime(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GiftCards() {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [txnCard, setTxnCard] = useState(null);

  useEffect(() => {
    adminAPI.giftCards()
      .then(d => setCards(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const handleIssue = async (form) => {
    await adminAPI.issueGiftCard(form);
    const refreshed = await adminAPI.giftCards();
    setCards(Array.isArray(refreshed) ? refreshed : []);
  };

  const handleVoid = async (id) => {
    if (!window.confirm('Void this gift card? Its remaining balance can no longer be redeemed.')) return;
    try {
      await adminAPI.voidGiftCard(id);
      setCards(prev => prev.map(c => c.id === id ? { ...c, status: 'void' } : c));
    } catch (e) {
      alert('Failed to void gift card: ' + e.message);
    }
  };

  const totalOutstanding = cards.filter(c => c.status === 'active').reduce((s, c) => s + parseFloat(c.balance || 0), 0);

  return (
    <div className="coupons-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Gift Cards</p>
          <p className="page-sub">{cards.length} cards · ${totalOutstanding.toFixed(2)} outstanding balance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Issue Gift Card</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : cards.length === 0 ? (
          <div className="empty"><Gift size={36} /><p>No gift cards yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Purchaser</th>
                  <th>Initial Value</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cards.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontWeight: 600, letterSpacing: '0.05em' }}>{c.code}</td>
                    <td>
                      {c.purchaser_name || '—'}
                      {c.purchaser_email && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{c.purchaser_email}</div>}
                    </td>
                    <td className="text-muted">${parseFloat(c.initial_value).toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>${parseFloat(c.balance).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {c.status === 'active' ? 'Active' : 'Void'}
                      </span>
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.72rem' }}>{fmtDateShort(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => setTxnCard(c)} title="Transaction history">
                          <History size={14} />
                        </button>
                        {c.status === 'active' && (
                          <button className="btn btn-danger btn-icon" onClick={() => handleVoid(c.id)} title="Void">
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <IssueModal onClose={() => setModal(false)} onIssue={handleIssue} />}
      {txnCard && <TransactionsModal card={txnCard} onClose={() => setTxnCard(null)} />}
    </div>
  );
}
