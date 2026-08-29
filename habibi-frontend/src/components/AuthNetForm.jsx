import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Lock } from 'lucide-react';
import { savedPaymentsAPI } from '../services/api';

const ACCEPT_JS = {
  production: 'https://js.authorize.net/v1/Accept.js',
  sandbox:    'https://jstest.authorize.net/v1/Accept.js',
};

// Prefix ranges per network spec (IIN ranges) -- order matters, Amex/Discover
// prefixes are more specific than the broad Mastercard/Visa ones.
const CARD_BRANDS = [
  { id: 'amex',       label: 'AMEX',       color: '#2E77BC', test: /^3[47]/ },
  { id: 'discover',   label: 'DISCOVER',   color: '#FF6000', test: /^(6011|65|64[4-9]|622(12[6-9]|1[3-9]\d|[2-8]\d{2}|91[0-9]|92[0-5]))/ },
  { id: 'mastercard', label: 'MASTERCARD', color: '#EB001B', test: /^(5[1-5]|2(2[2-9][1-9]|[3-6]\d\d|7[01]\d|720))/ },
  { id: 'visa',       label: 'VISA',       color: '#1A1F71', test: /^4/ },
];
function detectCardBrand(rawNumber) {
  const digits = rawNumber.replace(/\D/g, '');
  if (digits.length < 2) return null;
  return CARD_BRANDS.find(b => b.test.test(digits)) || null;
}

export default function AuthNetForm({ config, amount, orderNumber, customerName, customerPhone, reason, note, showSaveOption, onSuccess, onError }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth,   setExpMonth]   = useState('');
  const [expYear,    setExpYear]    = useState('');
  const [cvv,        setCvv]        = useState('');
  const [cardName,   setCardName]   = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [saveCard,   setSaveCard]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const scriptRef = useRef(null);
  const cardBrand = detectCardBrand(cardNumber);
  // See SquareCardForm.jsx's unmountedRef for why this exists -- prevents a
  // stale error from an abandoned card attempt reappearing after the
  // customer has already switched to a different payment method.
  const unmountedRef = useRef(false);
  useEffect(() => () => { unmountedRef.current = true; }, []);

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
    if (!billingZip || billingZip.trim().length < 5) { onError?.('Enter your billing ZIP code.'); return; }
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
      if (unmountedRef.current) return; // customer already switched away
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
            customerName,
            customerPhone,
            billingZip: billingZip.trim(),
            reason,
            note,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Payment declined.');
        }

        // Best-effort: vault the card from this now-completed transaction if
        // the customer opted in. Never let a save failure affect the order
        // itself -- the charge already succeeded, so onSuccess fires either way.
        if (showSaveOption && saveCard) {
          savedPaymentsAPI.saveFromTransaction({
            transactionId: data.transactionId,
            brand:  cardBrand?.id || null,
            last4:  rawCard.slice(-4),
            expiry: `${expMonth.padStart(2, '0')}/${expYear.length === 2 ? `20${expYear}` : expYear}`,
          }).catch(err => console.error('[SavedCard] Could not save card for next time:', err.message));
        }

        // Always fires even if the customer has since switched payment
        // methods -- see SquareCardForm.jsx's identical comment for why.
        onSuccess?.(data.transactionId);
      } catch (err) {
        if (unmountedRef.current) {
          console.error('[AuthNetForm] charge failed after customer switched payment methods:', err.message);
        } else {
          onError?.(err.message || 'Payment failed. Please try again.');
        }
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
      {/* Deliberately processor-agnostic — see SquareCardForm.jsx for why. */}
      <div className="authnet-secure-badge">
        <Lock size={12}/> Secure &amp; Encrypted
      </div>

      <div className="authnet-field">
        <label htmlFor="an-card-name">Cardholder Name</label>
        <input
          id="an-card-name"
          className="authnet-input"
          placeholder="Name on card"
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      <div className="authnet-field">
        <label htmlFor="an-card-number">Card Number</label>
        <div className="authnet-card-row">
          <CreditCard size={15} className="authnet-card-icon"/>
          <input
            id="an-card-number"
            className={`authnet-input authnet-card-input${cardBrand ? ' authnet-card-input--branded' : ''}`}
            placeholder="1234 5678 9012 3456"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={19}
          />
          {cardBrand && (
            <span className="authnet-card-brand" style={{ color: cardBrand.color }}>{cardBrand.label}</span>
          )}
        </div>
      </div>

      <div className="authnet-field">
        <label htmlFor="an-billing-zip">Billing ZIP Code</label>
        <input
          id="an-billing-zip"
          className="authnet-input"
          placeholder="10458"
          value={billingZip}
          onChange={e => setBillingZip(e.target.value.replace(/[^\d-]/g,'').slice(0,10))}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
        />
      </div>

      <div className="authnet-row">
        <div className="authnet-field">
          <label htmlFor="an-exp-month">Expiry Month</label>
          <input
            id="an-exp-month"
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
          <label htmlFor="an-exp-year">Expiry Year</label>
          <input
            id="an-exp-year"
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
          <label htmlFor="an-cvv">CVV</label>
          <input
            id="an-cvv"
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
