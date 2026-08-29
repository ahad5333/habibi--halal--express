import React, { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';

const CLOVER_JS = {
  production: 'https://checkout.clover.com/sdk.js',
  sandbox:    'https://checkout.sandbox.dev.clover.com/sdk.js',
};

// Clover's documented style hooks are narrower than Square's (just `body`
// and `input`, no confirmed focus/invalid states) -- this is the verified
// subset, not a guess. Same PCI/styling tradeoff as SquareCardForm: near-
// identical to the site's theme, not pixel-identical, because real card
// data lives inside Clover's own hosted iframes.
const CLOVER_ELEMENT_STYLE = {
  body:  { fontFamily: 'inherit', fontSize: '14px' },
  input: { fontFamily: 'inherit', fontSize: '14px', color: '#ffffff' },
};

export default function CloverCardForm({ config, amount, orderNumber, customerName, customerPhone, reason, note, showSaveOption, onSuccess, onError }) {
  const [cardName,   setCardName]   = useState('');
  const [saveCard,   setSaveCard]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardReady,  setCardReady]  = useState(false);
  const cloverRef     = useRef(null); // the `new Clover(...)` instance
  const mountedRef     = useRef(false);
  const numberContainerRef = useRef(null);
  const dateContainerRef   = useRef(null);
  const cvvContainerRef    = useRef(null);
  const zipContainerRef    = useRef(null);

  useEffect(() => {
    if (!config?.publicToken || !config?.merchantId || mountedRef.current) return;
    mountedRef.current = true;

    const src = CLOVER_JS[config.environment] || CLOVER_JS.production;
    const existing = document.getElementById('clover-sdk-js');

    const initCard = () => {
      try {
        const clover = new window.Clover(config.publicToken, { merchantId: config.merchantId });
        const elements = clover.elements();
        elements.create('CARD_NUMBER', CLOVER_ELEMENT_STYLE).mount(numberContainerRef.current);
        elements.create('CARD_DATE', CLOVER_ELEMENT_STYLE).mount(dateContainerRef.current);
        elements.create('CARD_CVV', CLOVER_ELEMENT_STYLE).mount(cvvContainerRef.current);
        elements.create('CARD_POSTAL_CODE', CLOVER_ELEMENT_STYLE).mount(zipContainerRef.current);
        cloverRef.current = clover;
        setCardReady(true);
      } catch (err) {
        onError?.('Failed to load payment form. Please refresh.');
      }
    };

    if (existing && window.Clover) {
      initCard();
    } else {
      const script = document.createElement('script');
      script.id  = 'clover-sdk-js';
      script.src = src;
      script.async = true;
      script.onload  = initCard;
      script.onerror = () => onError?.('Failed to load payment form. Please refresh.');
      document.head.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.publicToken, config?.merchantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing || !cardReady) return;

    if (!config?.publicToken || !config?.merchantId) {
      onError?.('Payment processor not configured. Contact support.'); return;
    }

    setProcessing(true);

    try {
      const result = await cloverRef.current.createToken();
      if (result.errors) {
        const msg = Object.values(result.errors)[0] || 'Card error. Check your details.';
        onError?.(msg);
        setProcessing(false);
        return;
      }

      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res  = await fetch(`${BASE}/api/payments/card/charge`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sourceId: result.token,
          amount,
          orderNumber,
          customerName,
          customerPhone,
          reason,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Payment declined.');
      }

      // Card-on-file saving comes in a later phase -- showSaveOption/saveCard
      // are accepted here (same prop contract as the other card forms) but not yet wired.
      onSuccess?.(data.transactionId);
    } catch (err) {
      onError?.(err.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (!config?.publicToken) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
        ⚙ Payment processor not configured.
      </div>
    );
  }

  return (
    <form className="authnet-form" onSubmit={handleSubmit} noValidate>
      {/* Deliberately processor-agnostic -- see SquareCardForm.jsx for why. */}
      <div className="authnet-secure-badge">
        <Lock size={12}/> Secure &amp; Encrypted
      </div>

      <div className="authnet-field">
        <label htmlFor="cv-card-name">Cardholder Name</label>
        <input
          id="cv-card-name"
          className="authnet-input"
          placeholder="Name on card"
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      <div className="authnet-field">
        <label>Card Number</label>
        {/* Clover mounts its own hosted (iframe) fields into these
            containers -- the outer boxes are our own styling. */}
        <div className="authnet-input clover-card-container" ref={numberContainerRef} />
      </div>

      <div className="authnet-row">
        <div className="authnet-field">
          <label>Expiry</label>
          <div className="authnet-input clover-card-container" ref={dateContainerRef} />
        </div>
        <div className="authnet-field">
          <label>CVV</label>
          <div className="authnet-input clover-card-container" ref={cvvContainerRef} />
        </div>
        <div className="authnet-field">
          <label>ZIP Code</label>
          <div className="authnet-input clover-card-container" ref={zipContainerRef} />
        </div>
      </div>

      {showSaveOption && (
        <label className="authnet-save-row">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={e => setSaveCard(e.target.checked)}
          />
          Save this card for faster checkout next time
        </label>
      )}

      <button
        type="submit"
        className="authnet-submit-btn"
        disabled={processing || !cardReady}
      >
        {processing ? (
          <span className="authnet-spinner"/>
        ) : (
          <><Lock size={14}/> Pay ${parseFloat(amount || 0).toFixed(2)}</>
        )}
      </button>

      <p className="authnet-disclaimer">
        Your card details are encrypted and never stored on our servers.
      </p>
    </form>
  );
}
