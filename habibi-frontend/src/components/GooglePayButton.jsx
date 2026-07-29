import React, { useEffect, useRef, useState } from 'react';
import { paypalConfigured, loadPayPalSdk } from '../utils/paypalSdk';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const GPAY_SCRIPT_ID = 'google-pay-js';

// PayPal is the only live processor right now (Authorize.net has no real
// account yet, and PayPal itself is sandbox-only -- see project memory).
// Flip to 'PRODUCTION' once real PayPal credentials go live.
const GPAY_ENVIRONMENT = 'TEST';

function loadGooglePayJs() {
  return new Promise((resolve, reject) => {
    if (window.google?.payments?.api) { resolve(); return; }
    const existing = document.getElementById(GPAY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = GPAY_SCRIPT_ID;
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Pay script failed to load'));
    document.body.appendChild(script);
  });
}

export default function GooglePayButton({ amount, orderNumber, onSuccess, onError, onValidate }) {
  const containerRef = useRef(null);
  // null = still checking eligibility, true/false once known. Google Pay is a
  // device/browser capability, not a merchant-toggled setting like the other
  // methods -- render nothing (not an error state) when the customer's
  // browser/device can't actually do it, same as any other unsupported
  // payment method would just not appear.
  const [eligible, setEligible] = useState(null);
  const gpayRef = useRef(null); // { paypalGooglePay, config, paymentsClient }

  useEffect(() => {
    if (!paypalConfigured()) { setEligible(false); return; }
    let cancelled = false;

    (async () => {
      try {
        await Promise.all([loadPayPalSdk(), loadGooglePayJs()]);
        if (cancelled) return;
        if (!window.paypal?.Googlepay || !window.google?.payments?.api) {
          setEligible(false);
          return;
        }

        const paypalGooglePay = window.paypal.Googlepay();
        const config = await paypalGooglePay.config();
        const paymentsClient = new window.google.payments.api.PaymentsClient({ environment: GPAY_ENVIRONMENT });

        const isReadyToPay = await paymentsClient.isReadyToPay({
          apiVersion: config.apiVersion,
          apiVersionMinor: config.apiVersionMinor,
          allowedPaymentMethods: config.allowedPaymentMethods,
        });
        if (cancelled) return;

        gpayRef.current = { paypalGooglePay, config, paymentsClient };
        setEligible(!!isReadyToPay.result);
      } catch (err) {
        console.error('[GooglePay] setup failed', err);
        if (!cancelled) setEligible(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleClick = async () => {
    if (onValidate && !onValidate()) return;
    const { paypalGooglePay, config, paymentsClient } = gpayRef.current || {};
    if (!paypalGooglePay || !paymentsClient) return;

    try {
      // Order is created server-side (not via the SDK's client-side
      // actions.order.create, which only exists inside a paypal.Buttons()
      // flow) -- reuses the same endpoint the mobile app's PayPal WebView
      // flow already goes through.
      const createRes = await fetch(`${API_BASE}/api/payments/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, order_number: orderNumber }),
      });
      const created = await createRes.json();
      if (!created.orderID) throw new Error('Could not start Google Pay payment.');

      const paymentData = await paymentsClient.loadPaymentData({
        apiVersion: config.apiVersion,
        apiVersionMinor: config.apiVersionMinor,
        allowedPaymentMethods: config.allowedPaymentMethods,
        transactionInfo: {
          currencyCode: 'USD',
          totalPriceStatus: 'FINAL',
          totalPrice: parseFloat(amount).toFixed(2),
        },
        merchantInfo: config.merchantInfo,
      });

      await paypalGooglePay.confirmOrder({
        orderId: created.orderID,
        paymentMethodData: paymentData.paymentMethodData,
      });

      // Same capture endpoint the regular PayPal button uses -- capture is
      // agnostic to how the order was approved.
      const captureRes = await fetch(`${API_BASE}/api/payments/paypal/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: created.orderID, orderNumber }),
      });
      const result = await captureRes.json();
      if (!captureRes.ok || !result.success) throw new Error(result.message || 'Capture failed');
      onSuccess({ id: result.captureID, orderID: created.orderID, status: 'COMPLETED' });
    } catch (err) {
      // User closing the Google Pay sheet without paying isn't a real error
      if (err?.statusCode === 'CANCELED') return;
      onError(err.message || 'Google Pay payment failed.');
    }
  };

  useEffect(() => {
    if (eligible !== true || !containerRef.current || !gpayRef.current?.paymentsClient) return;
    containerRef.current.innerHTML = '';
    const button = gpayRef.current.paymentsClient.createButton({
      onClick: handleClick,
      buttonType: 'pay',
      buttonSizeMode: 'fill',
    });
    containerRef.current.appendChild(button);
  }, [eligible]); // eslint-disable-line

  if (eligible === false) return null;
  if (eligible === null) return <div className="paypal-loading">Loading Google Pay…</div>;

  return (
    <div className="paypal-btn-wrap">
      <div ref={containerRef} />
    </div>
  );
}
