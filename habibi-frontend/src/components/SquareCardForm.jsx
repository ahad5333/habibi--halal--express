import React, { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { savedPaymentsAPI } from '../services/api';

const SQUARE_JS = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox:    'https://sandbox.web.squarecdn.com/v1/square.js',
};

// Square's card element is a small hosted iframe -- it does its own PCI-safe
// tokenization, so unlike AuthNetForm.jsx's plain <input>s, we don't get
// full control over every pixel. This is the closest match to the site's
// dark theme + gold focus accent that Square's supported style hooks allow
// (see the payments plan's PCI/styling tradeoff note for why).
const SQUARE_CARD_STYLE = {
  input: {
    color:            '#ffffff',
    fontSize:         '14px',
    fontFamily:       'inherit',
    backgroundColor:  'transparent',
  },
  'input::placeholder': { color: 'rgba(255,255,255,0.25)' },
  '.input-container': {
    borderColor:  'rgba(255,255,255,0.12)',
    borderRadius: '8px',
    borderWidth:  '1px',
  },
  '.input-container.is-focus': { borderColor: '#E5B64E' },
  '.input-container.is-error': { borderColor: '#ff5252' },
  '.message-text': { color: '#ff5252' },
  '.message-icon': { color: '#ff5252' },
};

export default function SquareCardForm({ config, amount, orderNumber, customerName, customerPhone, reason, note, showSaveOption, onSuccess, onError }) {
  const [cardName,   setCardName]   = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [saveCard,   setSaveCard]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardReady,  setCardReady]  = useState(false);
  const cardRef      = useRef(null);   // the mounted Square `card` element instance
  const containerRef = useRef(null);
  const mountedRef    = useRef(false); // StrictMode/re-render guard, one mount per config

  useEffect(() => {
    if (!config?.applicationId || !config?.locationId || mountedRef.current) return;
    mountedRef.current = true;

    const src = SQUARE_JS[config.environment] || SQUARE_JS.production;
    const existing = document.getElementById('square-web-payments-js');

    const initCard = async () => {
      try {
        const payments = window.Square.payments(config.applicationId, config.locationId);
        const card = await payments.card({
          style: SQUARE_CARD_STYLE,
          // We collect billing ZIP ourselves in a separately-styled field
          // (matches AuthNetForm's layout) rather than Square's built-in one.
          postalCode: false,
        });
        await card.attach(containerRef.current);
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        onError?.('Failed to load payment form. Please refresh.');
      }
    };

    if (existing && window.Square) {
      initCard();
    } else {
      const script = document.createElement('script');
      script.id  = 'square-web-payments-js';
      script.src = src;
      script.async = true;
      script.onload  = initCard;
      script.onerror = () => onError?.('Failed to load payment form. Please refresh.');
      document.head.appendChild(script);
    }

    return () => { cardRef.current?.destroy?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.applicationId, config?.locationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing || !cardReady) return;

    if (!billingZip || billingZip.trim().length < 5) { onError?.('Enter your billing ZIP code.'); return; }
    if (!config?.applicationId || !config?.locationId) {
      onError?.('Payment processor not configured. Contact support.'); return;
    }

    setProcessing(true);

    try {
      const result = await cardRef.current.tokenize({
        billingContact: { postalCode: billingZip.trim(), givenName: cardName || undefined },
      });
      if (result.status !== 'OK') {
        const msg = result.errors?.[0]?.message || 'Card error. Check your details.';
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

      // Best-effort: vault the card if the customer opted in. Square's
      // tokens are single-use just like Accept.js's opaque data, so the
      // token that just paid for the order can't also be used to save the
      // card -- tokenize a second time (the card element is still mounted)
      // to get a fresh one for vaulting. Never let a save failure affect
      // the order itself -- the charge already succeeded either way.
      if (showSaveOption && saveCard) {
        cardRef.current.tokenize().then(saveResult => {
          if (saveResult.status !== 'OK') return;
          const cardDetails = saveResult.details?.card || {};
          return savedPaymentsAPI.saveFromTransaction({
            provider:    'square',
            sourceToken: saveResult.token,
            brand:       cardDetails.brand ? cardDetails.brand.toLowerCase() : null,
            last4:       cardDetails.last4 || null,
            expiry:      (cardDetails.expMonth && cardDetails.expYear)
                           ? `${String(cardDetails.expMonth).padStart(2, '0')}/${cardDetails.expYear}`
                           : null,
          });
        }).catch(err => console.error('[SavedCard] Could not save card for next time:', err.message));
      }

      onSuccess?.(data.transactionId);
    } catch (err) {
      onError?.(err.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (!config?.applicationId) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
        ⚙ Payment processor not configured.
      </div>
    );
  }

  return (
    <form className="authnet-form" onSubmit={handleSubmit} noValidate>
      {/* Deliberately processor-agnostic -- the admin can switch which
          merchant account is live at any time, and the client's explicit
          requirement is that the customer never notices which one it is. */}
      <div className="authnet-secure-badge">
        <Lock size={12}/> Secure &amp; Encrypted
      </div>

      <div className="authnet-field">
        <label htmlFor="sq-card-name">Cardholder Name</label>
        <input
          id="sq-card-name"
          className="authnet-input"
          placeholder="Name on card"
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      <div className="authnet-field">
        <label>Card Details</label>
        {/* Square mounts its own hosted (iframe) fields into this container --
            the outer box is our own styling so it reads as part of the page. */}
        <div className="authnet-input square-card-container" ref={containerRef} />
      </div>

      <div className="authnet-field">
        <label htmlFor="sq-billing-zip">Billing ZIP Code</label>
        <input
          id="sq-billing-zip"
          className="authnet-input"
          placeholder="10458"
          value={billingZip}
          onChange={e => setBillingZip(e.target.value.replace(/[^\d-]/g,'').slice(0,10))}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
        />
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
