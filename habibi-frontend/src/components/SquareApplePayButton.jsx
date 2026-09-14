import React, { useEffect, useRef, useState } from 'react';
import { loadSquareSdk } from '../utils/squareSdk';
import './SquareApplePayButton.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
// Who the customer is paying, as Apple Pay's sheet shows it. Square also sends
// this label to Apple as the merchant name, so it can't be a word like "Total".
// Same brand name SEO.jsx and businessSchema.js use.
const MERCHANT_LABEL = 'Habibi Halal Express';

// Apple Pay only exists in Safari on Apple devices that have a card in Wallet.
function deviceCanUseApplePay() {
  try {
    return !!(window.ApplePaySession && window.ApplePaySession.canMakePayments());
  } catch {
    return false;
  }
}

// Square rejects this when the domain isn't verified for Apple Pay in the
// Square dashboard, or when the browser can't do Apple Pay at all.
async function createApplePay(config, amount) {
  const Square = await loadSquareSdk(config.environment);
  const payments = Square.payments(config.applicationId, config.locationId);
  const paymentRequest = payments.paymentRequest({
    countryCode:  'US',
    currencyCode: 'USD',
    total: { amount: parseFloat(amount || 0).toFixed(2), label: MERCHANT_LABEL },
  });
  return payments.applePay(paymentRequest);
}

// Whether to offer Apple Pay at all. Checked once the card config is known,
// and only on devices that can use it, so no one else loads Square early.
// Stays false until Square confirms, which keeps the option hidden until the
// domain is verified -- it appears by itself afterwards, no deploy needed.
export function useSquareApplePayAvailable(config) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (config?.provider !== 'square' || !config.applicationId || !config.locationId || !deviceCanUseApplePay()) {
      setAvailable(false);
      return undefined;
    }
    let cancelled = false;
    createApplePay(config, 1)
      .then(applePay => {
        if (!cancelled) setAvailable(true);
        try { applePay?.destroy?.(); } catch { /* the probe instance is disposable */ }
      })
      .catch(err => {
        console.warn('[ApplePay] not offered:', err?.name, err?.message);
        if (!cancelled) setAvailable(false);
      });
    return () => { cancelled = true; };
  }, [config?.provider, config?.applicationId, config?.locationId, config?.environment]);

  return available;
}

export default function SquareApplePayButton({ config, amount, orderNumber, onSuccess, onError }) {
  const applePayRef  = useRef(null);
  const [ready, setReady]           = useState(false);
  const [processing, setProcessing] = useState(false);
  // Same guard as SquareCardForm: a payment that finishes after the customer
  // switched methods must not throw an error at a screen they already left.
  // Reset on mount, or StrictMode's mount-unmount-mount leaves it stuck true
  // and every payment stops silently right after the Apple Pay sheet.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    createApplePay(config, amount)
      .then(applePay => {
        if (cancelled) { try { applePay?.destroy?.(); } catch { /* already gone */ } return; }
        applePayRef.current = applePay;
        setReady(true);
      })
      .catch(err => {
        console.error('[ApplePay] setup failed:', err?.name, err?.message);
        if (!cancelled) onError?.('Apple Pay isn’t available right now. Please choose another way to pay.');
      });
    return () => {
      cancelled = true;
      try { applePayRef.current?.destroy?.(); } catch { /* already gone */ }
      applePayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.applicationId, config?.locationId, amount]);

  const handleClick = async () => {
    if (!ready || processing || !applePayRef.current) return;
    setProcessing(true);
    try {
      // Opens the Apple Pay sheet. Safari only allows that directly from the
      // tap, so nothing may be awaited before this call.
      const result = await applePayRef.current.tokenize();
      if (unmountedRef.current) return;
      if (result.status !== 'OK') {
        // Closing the sheet comes back as 'Cancel' -- not an error to show.
        if (result.status !== 'Cancel') {
          onError?.(result.errors?.[0]?.message || 'Apple Pay didn’t go through. Please try again.');
        }
        setProcessing(false);
        return;
      }

      // The server charges the staged order's own total, never this amount.
      const res  = await fetch(`${API_BASE}/api/payments/card/charge`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sourceId: result.token, amount, orderNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Payment declined.');

      // Fires even if the customer has since switched methods: the money moved.
      onSuccess?.(data.transactionId, data);
    } catch (err) {
      if (unmountedRef.current) {
        console.error('[ApplePay] charge failed after customer switched payment methods:', err.message);
      } else {
        onError?.(err.message || 'Apple Pay payment failed. Please try again.');
      }
      setProcessing(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
  };

  return (
    <div className="sq-applepay-wrap">
      {/* Apple requires its own button; Safari draws it from the CSS. */}
      <div
        className="sq-applepay-btn"
        role="button"
        tabIndex={ready && !processing ? 0 : -1}
        aria-label="Pay with Apple Pay"
        aria-disabled={!ready || processing}
        lang="en"
        onClick={handleClick}
        onKeyDown={onKeyDown}
      />
      {!ready && <p className="sq-applepay-note">Loading Apple Pay…</p>}
      {processing && <p className="sq-applepay-note">Processing your payment…</p>}
    </div>
  );
}
