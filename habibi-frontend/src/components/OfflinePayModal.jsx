import React, { useEffect, useState, useRef } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { paymentsAPI } from '../services/api';
import './OfflinePayModal.css';

export default function OfflinePayModal({ method, amount, orderNumber, onConfirm, onClose }) {
  const { t } = useTranslation();
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

  // No invented Zelle address. The old fallback told customers to pay an
  // address nobody at Habibi controlled; if nothing is configured the modal
  // now says Zelle is unavailable instead. Zelle can be a phone number or an
  // email, so `handle` is what's shown and `copyValue` is what gets pasted.
  const zelleHandle = info.zelle?.handle || info.zelle?.email || null;
  const zelleIsPhone = info.zelle?.type === 'phone';
  const zelleMissing = isZelle && !zelleHandle;

  const handle = isZelle
    ? zelleHandle
    : isCash
      ? (info.cashapp?.cashtag || '$HabibiHalal')
      : '';
  const copyValue = isZelle ? (info.zelle?.copy || zelleHandle) : handle;
  const zelleMethodWord = zelleIsPhone ? t('offlinePay.phoneNumber') : t('offlinePay.email');

  const title = isZelle ? t('offlinePay.payViaZelle') : isCash ? t('offlinePay.payViaCashApp') : t('offlinePay.cashOnDelivery');
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
        <button className="opm-close" onClick={onClose} aria-label={t('offlinePay.close')}>
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

        {zelleMissing && (
          <p className="opm-instruction" role="alert">{t('offlinePay.zelleUnavailable')}</p>
        )}

        {(isZelle || isCash) && !zelleMissing && (
          <>
            <p className="opm-instruction">
              {(() => {
                const [before, after] = t('offlinePay.sendExactly', { amount: '__AMT__' }).split('__AMT__');
                return <>{before}<strong className="opm-amount">${parseFloat(amount).toFixed(2)}</strong>{after}</>;
              })()}
            </p>

            <div className="opm-handle-row">
              <span className="opm-handle">{handle}</span>
              <button
                className="opm-copy-btn"
                onClick={() => copy(copyValue, 'handle')}
                title={t('offlinePay.copy')}
                aria-label={isZelle
                  ? (zelleIsPhone ? t('offlinePay.copyPhone') : t('offlinePay.copyEmail'))
                  : t('offlinePay.copyCashTag')}
              >
                {copied === 'handle' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <p className="opm-memo-label">{t('offlinePay.includeInMemo')}</p>
            <div className="opm-handle-row opm-memo">
              <span className="opm-handle">{orderNumber}</span>
              <button
                className="opm-copy-btn"
                onClick={() => copy(orderNumber, 'memo')}
                title={t('offlinePay.copyOrderNumber')}
                aria-label={t('offlinePay.copyOrderNumber')}
              >
                {copied === 'memo' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="opm-steps">
              <p className="opm-steps-title">{t('offlinePay.howItWorks')}</p>
              <ol className="opm-steps-list">
                <li>{t('offlinePay.step1', { amount: `$${parseFloat(amount).toFixed(2)}`, method: isZelle ? zelleMethodWord : t('offlinePay.cashTag') })}</li>
                <li>{t('offlinePay.step2Prefix')} <strong>{orderNumber}</strong> {t('offlinePay.step2Suffix')}</li>
                <li>{t('offlinePay.step3', { method: isZelle ? t('offlinePay.zelle') : t('offlinePay.cashApp') })}</li>
                <li>{t('offlinePay.step4')}</li>
              </ol>
            </div>

            <label className="opm-ref-label" htmlFor="opm-ref-input">
              {t('offlinePay.confirmationNumberRequired', { method: isZelle ? t('offlinePay.zelle') : t('offlinePay.cashApp') })}
            </label>
            <input
              id="opm-ref-input"
              className="opm-ref-input"
              type="text"
              placeholder={t('offlinePay.confirmationPlaceholder')}
              value={reference}
              onChange={e => setReference(e.target.value)}
              maxLength={100}
            />
          </>
        )}

        {method === 'cash' && (
          <div className="opm-cash-note">
            <p className="opm-instruction">{t('offlinePay.cashConfirmedImmediately')}</p>
            <p className="opm-instruction muted">
              {(() => {
                const [before, after] = t('offlinePay.cashReadyNote', { amount: '__AMT__' }).split('__AMT__');
                return <>{before}<strong>${parseFloat(amount).toFixed(2)}</strong>{after}</>;
              })()}
            </p>
          </div>
        )}

        <button
          className="opm-confirm-btn"
          onClick={() => onConfirm(reference.trim())}
          disabled={zelleMissing || ((isZelle || isCash) && !reference.trim())}
        >
          {method === 'cash' ? t('offlinePay.placeOrderPayOnDelivery') : t('offlinePay.sentPaymentPlaceOrder')}
        </button>

        <p className="opm-disclaimer">
          {isZelle || isCash
            ? t('offlinePay.pendingVerification')
            : t('offlinePay.exactChangeNote')}
        </p>
      </div>
    </div>
  );
}
