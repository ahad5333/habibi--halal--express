import React, { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function PayPalButton({ amount, orderNumber, onSuccess, onError }) {
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  // Load PayPal SDK script once
  useEffect(() => {
    if (!CLIENT_ID || CLIENT_ID === 'REPLACE_ME') {
      setLoaded(false);
      return;
    }
    if (window.paypal) { setSdkReady(true); return; }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => console.error('[PayPal] SDK failed to load');
    document.body.appendChild(script);

    return () => { /* leave script tag — PayPal requires it to persist */ };
  }, []);

  // Render buttons once SDK is ready
  useEffect(() => {
    if (!sdkReady || !containerRef.current || !window.paypal) return;
    containerRef.current.innerHTML = '';

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      createOrder: (_data, actions) =>
        actions.order.create({
          purchase_units: [{
            amount: { value: parseFloat(amount).toFixed(2) },
            description: `Habibi Halal Express — Order ${orderNumber}`,
          }],
        }),
      onApprove: async (data) => {
        try {
          const res = await fetch(`${API_BASE}/api/payments/paypal/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID, orderNumber }),
          });
          const result = await res.json();
          if (!res.ok || !result.success) throw new Error(result.message || 'Capture failed');
          onSuccess({ id: result.captureID, orderID: data.orderID, status: 'COMPLETED' });
        } catch (err) {
          onError(err.message || 'PayPal capture failed.');
        }
      },
      onError: (err) => onError(err?.message || 'PayPal payment failed.'),
      onCancel: () => onError('PayPal payment was cancelled.'),
    }).render(containerRef.current);

    setLoaded(true);
  }, [sdkReady, amount, orderNumber]); // eslint-disable-line

  if (!CLIENT_ID || CLIENT_ID === 'REPLACE_ME') {
    return (
      <div className="paypal-unconfigured">
        <p>⚙ PayPal not configured — add <code>VITE_PAYPAL_CLIENT_ID</code> to <code>.env</code></p>
        <button
          className="btn btn-primary mt-2"
          onClick={() => onSuccess({ id: 'PAYPAL_MOCK_' + Date.now(), status: 'COMPLETED', mock: true })}
        >
          Simulate PayPal (Dev)
        </button>
      </div>
    );
  }

  return (
    <div className="paypal-btn-wrap">
      {!loaded && <div className="paypal-loading">Loading PayPal…</div>}
      <div ref={containerRef} />
    </div>
  );
}
