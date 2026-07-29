import React, { useEffect, useState, useRef } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import './OfflinePayModal.css';

export default function OfflinePayModal({ method, amount, orderNumber, onConfirm, onClose }) {
  const [info, setInfo] = useState({ zelle: {}, cashapp: {} });
  const [copied, setCopied] = useState('');
  const [reference, setReference] = useState('');
  const modalRef = useRef(null);

  useEffect(() => {
    paymentsAPI.offlineInfo().then(setInfo).catch(() => {});
  }, []);

  // Dialog semantics: this had none previously -- no focus trap, no Escape
  // to close, no focus restore, so a keyboard user tabbing through it could
  // tab straight out from behind the overlay into the page underneath.
  // Move focus in on open, restore it to whatever triggered the modal on
  // close (the "Continue"/payment-method button), close on Escape, and trap
  // Tab/Shift+Tab so focus cycles within the dialog instead of escaping it.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    modalRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const isZelle = method === 'zelle';
  const isCash = method === 'cashapp';

  const handle = isZelle
    ? (info.zelle?.email || 'payments@habibihe.com')
    : isCash
      ? (info.cashapp?.cashtag || '$HabibiHalal')
      : '';

  const title = isZelle ? 'Pay via Zelle' : isCash ? 'Pay via Cash App' : 'Cash on Delivery';
  const icon  = isZelle ? '💙' : isCash ? '💚' : '💵';

  return (
    <div className="opm-overlay" onClick={onClose}>
      <div
        className="opm-modal"
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="opm-title"
        tabIndex={-1}
      >
        <button className="opm-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="opm-header">
          {typeof icon === 'string' && icon.startsWith('/') ? (
            <img src={icon} alt={title} className="opm-brand-img" onError={e => e.target.style.display='none'} />
          ) : (
            <span className="opm-brand-emoji">{icon}</span>
          )}
          <h2 className="opm-title" id="opm-title">{title}</h2>
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
                aria-label={`Copy ${isZelle ? 'email' : 'CashTag'}`}
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
                aria-label="Copy order number"
              >
                {copied === 'memo' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="opm-steps">
              <p className="opm-steps-title">How it works:</p>
              <ol className="opm-steps-list">
                <li>Send <strong>${parseFloat(amount).toFixed(2)}</strong> to the {isZelle ? 'email' : 'CashTag'} above</li>
                <li>Include your order number <strong>{orderNumber}</strong> in the note</li>
                <li>Enter the confirmation number {isZelle ? 'Zelle' : 'Cash App'} showed you after sending, below</li>
                <li>Click &ldquo;I&rsquo;ve Sent Payment&rdquo; below — we&rsquo;ll confirm and start your order</li>
              </ol>
            </div>

            <label className="opm-ref-label" htmlFor="opm-ref-input">
              {isZelle ? 'Zelle' : 'Cash App'} confirmation number (required)
            </label>
            <input
              id="opm-ref-input"
              className="opm-ref-input"
              type="text"
              placeholder="e.g. confirmation ID, or last 4 digits of the transaction"
              value={reference}
              onChange={e => setReference(e.target.value)}
              maxLength={100}
            />
          </>
        )}

        {method === 'cash' && (
          <div className="opm-cash-note">
            <p className="opm-instruction">Your order will be confirmed immediately.</p>
            <p className="opm-instruction muted">Please have <strong>${parseFloat(amount).toFixed(2)}</strong> ready in cash upon delivery.</p>
          </div>
        )}

        <button
          className="opm-confirm-btn"
          onClick={() => onConfirm(reference.trim())}
          disabled={(isZelle || isCash) && !reference.trim()}
        >
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
