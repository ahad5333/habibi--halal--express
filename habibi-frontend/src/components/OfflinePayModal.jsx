import React, { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import './OfflinePayModal.css';

export default function OfflinePayModal({ method, amount, orderNumber, onConfirm, onClose }) {
  const [info, setInfo] = useState({ zelle: {}, cashapp: {} });
  const [copied, setCopied] = useState('');

  useEffect(() => {
    paymentsAPI.offlineInfo().then(setInfo).catch(() => {});
  }, []);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const isZelle = method === 'zelle';
  const isCash = method === 'cashapp';

  const handle = isZelle
    ? (info.zelle?.email || 'payments@habibihalal.com')
    : isCash
      ? (info.cashapp?.cashtag || '$HabibiHalal')
      : '';

  const title = isZelle ? 'Pay via Zelle' : isCash ? 'Pay via Cash App' : 'Cash on Delivery';
  const icon  = isZelle ? '💙' : isCash ? '💚' : '💵';

  return (
    <div className="opm-overlay" onClick={onClose}>
      <div className="opm-modal" onClick={e => e.stopPropagation()}>
        <button className="opm-close" onClick={onClose}><X size={18} /></button>

        <div className="opm-header">
          {typeof icon === 'string' && icon.startsWith('/') ? (
            <img src={icon} alt={title} className="opm-brand-img" onError={e => e.target.style.display='none'} />
          ) : (
            <span className="opm-brand-emoji">{icon}</span>
          )}
          <h2 className="opm-title">{title}</h2>
        </div>

        {(isZelle || isCash) && (
          <>
            <p className="opm-instruction">
              Send exactly <strong className="opm-amount">${parseFloat(amount).toFixed(2)}</strong> to:
            </p>

            <div className="opm-handle-row">
              <span className="opm-handle">{handle}</span>
              <button
                className="opm-copy-btn"
                onClick={() => copy(handle, 'handle')}
                title="Copy"
              >
                {copied === 'handle' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <p className="opm-memo-label">Include this in the memo / note:</p>
            <div className="opm-handle-row opm-memo">
              <span className="opm-handle">{orderNumber}</span>
              <button
                className="opm-copy-btn"
                onClick={() => copy(orderNumber, 'memo')}
                title="Copy order number"
              >
                {copied === 'memo' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="opm-steps">
              <p className="opm-steps-title">How it works:</p>
              <ol className="opm-steps-list">
                <li>Send <strong>${parseFloat(amount).toFixed(2)}</strong> to the {isZelle ? 'email' : 'CashTag'} above</li>
                <li>Include your order number <strong>{orderNumber}</strong> in the note</li>
                <li>Click &ldquo;I&rsquo;ve Sent Payment&rdquo; below — we&rsquo;ll confirm and start your order</li>
              </ol>
            </div>
          </>
        )}

        {method === 'cash' && (
          <div className="opm-cash-note">
            <p className="opm-instruction">Your order will be confirmed immediately.</p>
            <p className="opm-instruction muted">Please have <strong>${parseFloat(amount).toFixed(2)}</strong> ready in cash upon delivery.</p>
          </div>
        )}

        <button className="opm-confirm-btn" onClick={onConfirm}>
          {method === 'cash' ? 'Place Order — Pay on Delivery' : 'I\'ve Sent Payment — Place Order'}
        </button>

        <p className="opm-disclaimer">
          {isZelle || isCash
            ? 'Your order will be placed in "pending verification" until our team confirms receipt of payment (usually 2–5 minutes).'
            : 'Please have exact change ready for the driver.'}
        </p>
      </div>
    </div>
  );
}
