import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './StripeCardForm.css';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_KEY && !STRIPE_KEY.includes('REPLACE') ? loadStripe(STRIPE_KEY) : null;

const APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#E5B64E',
    colorBackground: '#0f0f0f',
    colorText: '#ffffff',
    colorDanger: '#f87171',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #2a2a2a', padding: '12px 14px' },
    '.Input:focus': { borderColor: 'rgba(229,182,78,0.5)', boxShadow: 'none' },
    '.Label': { color: '#888', fontSize: '12px', marginBottom: '6px' },
  },
};

function PaymentFormInner({ onSuccess, onError, disabled }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setProcessing(false);
    if (error) {
      onError(error.message);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent);
    } else {
      onError(`Unexpected payment status: ${paymentIntent?.status}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-card-form">
      <div className="stripe-card-wrap">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button
        type="submit"
        className="stripe-pay-btn"
        disabled={disabled || processing || !stripe}
      >
        {processing ? 'Processing…' : 'Confirm & Pay'}
      </button>
    </form>
  );
}

export default function StripeCardForm({ clientSecret, onSuccess, onError, disabled }) {
  // Real PaymentElement — Stripe configured + real client secret
  if (stripePromise && clientSecret && !clientSecret.includes('mock')) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
        <PaymentFormInner onSuccess={onSuccess} onError={onError} disabled={disabled} />
      </Elements>
    );
  }

  // Mock: Stripe key missing OR backend returned mock secret
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clientSecret?.includes('mock')) {
          onSuccess({ id: clientSecret, status: 'succeeded' });
        } else {
          onError('Stripe not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in .env.');
        }
      }}
      className="stripe-card-form"
    >
      <div className="stripe-mock-note">
        {clientSecret?.includes('mock')
          ? '⚙ Stripe (dev mode) — click below to simulate payment'
          : '⚙ Stripe not configured — add VITE_STRIPE_PUBLISHABLE_KEY to .env'}
      </div>
      {!clientSecret?.includes('mock') && (
        <div className="stripe-card-mock-inputs">
          <input readOnly placeholder="4242 4242 4242 4242" className="stripe-mock-input" />
          <div className="stripe-mock-row">
            <input readOnly placeholder="MM / YY" className="stripe-mock-input" />
            <input readOnly placeholder="CVC" className="stripe-mock-input" />
          </div>
        </div>
      )}
      <button type="submit" className="stripe-pay-btn" disabled={disabled}>
        {clientSecret?.includes('mock') ? 'Confirm & Pay (Dev)' : 'Confirm & Pay (Mock)'}
      </button>
    </form>
  );
}
