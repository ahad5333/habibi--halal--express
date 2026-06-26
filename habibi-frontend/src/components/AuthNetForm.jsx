import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Lock } from 'lucide-react';

const ACCEPT_JS = {
  production: 'https://js.authorize.net/v1/Accept.js',
  sandbox:    'https://jstest.authorize.net/v1/Accept.js',
};

export default function AuthNetForm({ config, amount, orderNumber, onSuccess, onError }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth,   setExpMonth]   = useState('');
  const [expYear,    setExpYear]    = useState('');
  const [cvv,        setCvv]        = useState('');
  const [cardName,   setCardName]   = useState('');
  const [processing, setProcessing] = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const scriptRef = useRef(null);

  // Load Accept.js from Authorize.net CDN
  useEffect(() => {
    if (!config?.apiLoginId) return;
    const src = ACCEPT_JS[config.environment] || ACCEPT_JS.production;
    const existing = document.getElementById('authnet-accept-js');
    if (existing) { setLoaded(true); return; }

    const script = document.createElement('script');
    script.id  = 'authnet-accept-js';
    script.src = src;
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => onError?.('Failed to load payment form. Please refresh.');
    document.head.appendChild(script);
    scriptRef.current = script;
  }, [config]);

  const formatCardNumber = (val) =>
    val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;

    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 15) { onError?.('Enter a valid card number.'); return; }
    if (!expMonth || !expYear) { onError?.('Enter card expiry date.'); return; }
    if (!cvv || cvv.length < 3) { onError?.('Enter a valid CVV.'); return; }
    if (!config?.apiLoginId || !config?.clientKey) {
      onError?.('Payment processor not configured. Contact support.'); return;
    }
    if (!window.Accept) { onError?.('Payment form not ready. Please wait a moment and try again.'); return; }

    setProcessing(true);

    const secureData = {
      authData: {
        clientKey:   config.clientKey,
        apiLoginID:  config.apiLoginId,
      },
      cardData: {
        cardNumber:  rawCard,
        month:       expMonth.padStart(2, '0'),
        year:        expYear.length === 2 ? `20${expYear}` : expYear,
        cardCode:    cvv,
        fullName:    cardName,
      },
    };

    window.Accept.dispatchData(secureData, async (response) => {
      if (response.messages.resultCode === 'Error') {
        const msg = response.messages.message?.[0]?.text || 'Card error. Check your details.';
        onError?.(msg);
        setProcessing(false);
        return;
      }

      // Send opaqueData to our backend to charge
      try {
        const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const res  = await fetch(`${BASE}/api/payments/authnet/charge`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            opaqueData:  response.opaqueData,
            amount,
            orderNumber,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Payment declined.');
        }
        onSuccess?.(data.transactionId);
      } catch (err) {
        onError?.(err.message || 'Payment failed. Please try again.');
        setProcessing(false);
      }
    });
  };

  if (!config?.apiLoginId) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
        ⚙ Payment processor not configured.
      </div>
    );
  }

  return (
    <form className="authnet-form" onSubmit={handleSubmit} noValidate>
      <div className="authnet-secure-badge">
        <Lock size={12}/> Secured by Authorize.net
      </div>

      <div className="authnet-field">
        <label>Cardholder Name</label>
        <input
          className="authnet-input"
          placeholder="Name on card"
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      <div className="authnet-field">
        <label>Card Number</label>
        <div className="authnet-card-row">
          <CreditCard size={15} className="authnet-card-icon"/>
          <input
            className="authnet-input authnet-card-input"
            placeholder="1234 5678 9012 3456"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={19}
          />
        </div>
      </div>

      <div className="authnet-row">
        <div className="authnet-field">
          <label>Expiry Month</label>
          <input
            className="authnet-input"
            placeholder="MM"
            value={expMonth}
            onChange={e => setExpMonth(e.target.value.replace(/\D/g,'').slice(0,2))}
            inputMode="numeric"
            maxLength={2}
            autoComplete="cc-exp-month"
          />
        </div>
        <div className="authnet-field">
          <label>Expiry Year</label>
          <input
            className="authnet-input"
            placeholder="YYYY"
            value={expYear}
            onChange={e => setExpYear(e.target.value.replace(/\D/g,'').slice(0,4))}
            inputMode="numeric"
            maxLength={4}
            autoComplete="cc-exp-year"
          />
        </div>
        <div className="authnet-field">
          <label>CVV</label>
          <input
            className="authnet-input"
            placeholder="123"
            value={cvv}
            onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}
            inputMode="numeric"
            maxLength={4}
            autoComplete="cc-csc"
            type="password"
          />
        </div>
      </div>

      <button
        type="submit"
        className="authnet-submit-btn"
        disabled={processing || !loaded}
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
