import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { savedPaymentsAPI } from '../services/api';

const SQUARE_JS = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox:    'https://sandbox.web.squarecdn.com/v1/square.js',
};

// Square's card element is a small hosted iframe -- it does its own PCI-safe
// tokenization, so unlike AuthNetForm.jsx's plain <input>s, we don't get
// full control over every pixel.
//
// This box is deliberately LIGHT-themed, not matched to the site's dark
// theme, even though everything else on this page is dark. Reason: when a
// customer's browser autofills a saved card into this field, the browser
// forces its OWN background color on the input (a pale white/blue) that
// Square's style API has no hook to override -- confirmed against Square's
// official CardOptions/CardClassSelectors reference, which only exposes
// focus/error/placeholder selectors, nothing for autofill state. White text
// on our normal dark background would go invisible the instant that forced
// pale background appears. Starting the box light-themed means the
// browser's forced autofill color is already close to what we chose on
// purpose, so autofill never creates a sudden unreadable state.
const SQUARE_CARD_STYLE = {
  input: {
    color:            '#1a1a1a',
    fontSize:         '14px',
    fontFamily:       'inherit',
    backgroundColor:  '#ffffff',
  },
  'input::placeholder': { color: 'rgba(0,0,0,0.35)' },
  '.input-container': {
    borderColor:  'rgba(0,0,0,0.15)',
    borderRadius: '8px',
    borderWidth:  '1px',
  },
  '.input-container.is-focus': { borderColor: '#E5B64E' },
  '.input-container.is-error': { borderColor: '#ff5252' },
  '.message-text': { color: '#c0392b' },
  '.message-icon': { color: '#c0392b' },
};

export default function SquareCardForm({ config, amount, orderNumber, customerName, customerPhone, reason, note, showSaveOption, onSuccess, onError, endpoint = '/api/payments/card/charge', extraFields = {} }) {
  const [cardName,   setCardName]   = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [saveCard,   setSaveCard]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardReady,  setCardReady]  = useState(false);
  // Blurred by default -- protects against someone reading the card number
  // off the screen (shoulder-surfing) in a public place. Square's hosted
  // iframe has no built-in character-masking option (checked their SDK
  // reference, same conclusion as the autofill-color investigation), so
  // this is a CSS blur on the iframe element itself rather than real
  // masking -- it doesn't block typing, only visibility, and the customer
  // can toggle it off to double check what they typed before paying.
  const [cardHidden, setCardHidden] = useState(true);
  const cardRef      = useRef(null);   // the mounted Square `card` element instance
  const containerRef = useRef(null);
  const mountedRef    = useRef(false); // StrictMode/re-render guard, one mount per config
  // tokenize() can take a while (it's also where a 3D Secure challenge
  // happens) -- if the customer switches to a different payment method
  // while it's still pending, this component unmounts, but the in-flight
  // promise still resolves and would otherwise call onError on the parent
  // and re-show an error the customer already moved past. Guards the two
  // async continuations below (after tokenize() and after the charge
  // fetch); the synchronous validation errors above don't need it since
  // they fire in the same tick as the click, before any unmount could
  // happen.
  const unmountedRef  = useRef(false);
  useEffect(() => () => { unmountedRef.current = true; }, []);

  useEffect(() => {
    if (!config?.applicationId || !config?.locationId || mountedRef.current) return;
    mountedRef.current = true;

    const src = SQUARE_JS[config.environment] || SQUARE_JS.production;
    const existing = document.getElementById('square-web-payments-js');

    const initCard = async () => {
      try {
        const payments = window.Square.payments(config.applicationId, config.locationId);
        // `postalCode: false` used to be here to suppress Square's own
        // built-in ZIP prompt (this form collects billing ZIP itself,
        // separately styled to match AuthNetForm's layout) -- but the real
        // Square SDK doesn't support a boolean postalCode option at all. It
        // expects postalCode to be a string (a prefill value) or omitted
        // entirely; passing false threw "InvalidOptionError: Invalid type
        // 'postalCode'... Expected 'string'" INSIDE this try/catch on every
        // single card form load, silently surfacing as "Failed to load
        // payment form" with no indication the real cause was a bad option,
        // not a network/config problem. Square decides on its own whether
        // to show an internal postal-code prompt based on the card's
        // issuing country -- there's no documented way to force it off, so
        // just omit the option instead of passing an invalid value.
        const card = await payments.card({
          style: SQUARE_CARD_STYLE,
        });
        await card.attach(containerRef.current);
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        // The user-facing message is deliberately generic, but log the real
        // cause -- an invalid options bug here previously took real
        // investigation to root-cause specifically because the console
        // never showed anything beyond the generic message.
        console.error('[SquareCardForm] card init failed:', err?.name, err?.message);
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
      // Square's tokenize() validates whatever object you pass it as a full
      // "verificationDetails" payload -- passing billingContact alone (the
      // old code) triggered "verificationDetails.intent is required", then
      // (once fixed) the same for customerInitiated/sellerKeyedIn, then
      // amount/currencyCode -- confirmed against the real production SDK by
      // adding fields one at a time until zero verificationDetails errors
      // remained. intent 'CHARGE' (not STORE) because this call charges the
      // card; customerInitiated/sellerKeyedIn reflect that the customer is
      // typing their own card into this checkout page, not staff keying one
      // in on their behalf.
      const result = await cardRef.current.tokenize({
        billingContact: { postalCode: billingZip.trim(), givenName: cardName || undefined },
        intent: 'CHARGE',
        customerInitiated: true,
        sellerKeyedIn: false,
        amount: parseFloat(amount || 0).toFixed(2),
        currencyCode: 'USD',
      });
      if (unmountedRef.current) return; // customer already switched away
      if (result.status !== 'OK') {
        const msg = result.errors?.[0]?.message || 'Card error. Check your details.';
        onError?.(msg);
        setProcessing(false);
        return;
      }

      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res  = await fetch(`${BASE}${endpoint}`, {
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
          ...extraFields,
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

      // Always fires, even if the customer has since switched to a
      // different payment method -- real money already moved by this point
      // (the charge fetch above succeeded), so the order must still be
      // saved regardless of what the UI currently shows. Full response
      // passed as a second arg for callers (e.g. gift card purchase) that
      // need more than the transaction id -- existing callers just ignore it.
      onSuccess?.(data.transactionId, data);
    } catch (err) {
      // Unlike the tokenize()-stage guard above, this catch only runs
      // after a real charge attempt was sent -- if it failed/declined, no
      // money moved, so it's safe to just log it instead of surfacing a
      // confusing error for a payment method the customer already left.
      if (unmountedRef.current) {
        console.error('[SquareCardForm] charge failed after customer switched payment methods:', err.message);
      } else {
        onError?.(err.message || 'Payment failed. Please try again.');
      }
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
        <div className="card-details-label-row">
          <label>Card Details</label>
          <button
            type="button"
            className="card-privacy-toggle"
            onClick={() => setCardHidden(h => !h)}
            aria-label={cardHidden ? 'Show card details' : 'Hide card details'}
          >
            {cardHidden ? <><Eye size={13}/> Show</> : <><EyeOff size={13}/> Hide</>}
          </button>
        </div>
        {/* Square mounts its own hosted (iframe) fields into this container --
            the outer box is our own styling so it reads as part of the page. */}
        <div className={`authnet-input square-card-container${cardHidden ? ' card-privacy-blur' : ''}`} ref={containerRef} />
        {cardHidden && <p className="card-privacy-note">Blurred for privacy — tap "Show" to check what you typed.</p>}
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
