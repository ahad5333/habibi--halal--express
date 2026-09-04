import React, { useState, useEffect } from 'react';
import { Gift, Lock, Zap, Receipt, CheckCircle, DollarSign, Mail } from 'lucide-react';
import AuthNetForm from '../components/AuthNetForm';
import '../components/AuthNetForm.css';
import SquareCardForm from '../components/SquareCardForm';
import '../components/SquareCardForm.css';
import CloverCardForm from '../components/CloverCardForm';
import '../components/CloverCardForm.css';
import './Payment.css';

const PRESET_AMOUNTS = [25, 50, 75, 100, 150];

const BuyGiftCard = () => {
  const [amount, setAmount]           = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [purchaserName, setPurchaserName]   = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [message, setMessage]         = useState('');
  const [formError, setFormError]     = useState('');
  const [preparing, setPreparing]     = useState(false);
  const [intentReady, setIntentReady] = useState(false);
  const [activeCardConfig, setActiveCardConfig] = useState(null);
  const [result, setResult]           = useState(null); // { code, amount }

  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  const effectiveAmount = usingCustom ? (parseFloat(customAmount) || 0) : amount;

  const handlePreparePayment = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!effectiveAmount || effectiveAmount <= 0) {
      setFormError('Please choose or enter a valid amount.'); return;
    }
    if (!purchaserName.trim()) { setFormError('Please enter your name.'); return; }
    if (!purchaserEmail.trim() || !/^\S+@\S+\.\S+$/.test(purchaserEmail.trim())) {
      setFormError('Please enter a valid email — this is where your gift card code will be sent.'); return;
    }
    setPreparing(true);
    try {
      const res = await fetch(`${BASE}/api/payments/card/config`);
      const data = await res.json();
      if (!res.ok || !data.provider) throw new Error(data.error || 'Payment setup failed.');
      setActiveCardConfig(data);
      setIntentReady(true);
    } catch (err) {
      setFormError(err.message || 'Payment is currently unavailable. Please try again later.');
    } finally {
      setPreparing(false);
    }
  };

  const handlePurchaseSuccess = (_transactionId, data) => {
    setResult({ code: data?.code, amount: data?.amount ?? effectiveAmount });
  };

  const extraFields = {
    purchaser_name:  purchaserName.trim(),
    purchaser_email: purchaserEmail.trim(),
    message:         message.trim(),
  };

  const resetForm = () => {
    setResult(null);
    setIntentReady(false);
    setActiveCardConfig(null);
    setAmount(50);
    setCustomAmount('');
    setUsingCustom(false);
    setPurchaserName('');
    setPurchaserEmail('');
    setMessage('');
  };

  return (
    <div className="payment-page">
      <section className="pay-hero">
        <div className="pay-hero-overlay" />
        <div className="container pay-hero-content">
          <p className="pay-eyebrow">GIFT CARDS</p>
          <h1 className="pay-hero-title">
            Give the Gift of <span className="text-primary">Habibi Halal Express</span>
          </h1>
          <p className="pay-hero-sub">
            Buy a digital gift card — delivered instantly by email, redeemable on any order.
          </p>
          <div className="pay-hero-tags">
            <span className="pay-tag"><Lock size={12} /> Secure &amp; Encrypted</span>
            <span className="pay-tag"><Zap size={12} /> Instant Delivery</span>
            <span className="pay-tag"><Gift size={12} /> Never Expires</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container pay-container">
          {result ? (
            <div className="pay-success">
              <div className="pay-success-icon"><CheckCircle size={48} /></div>
              <h2 className="pay-success-title">Gift Card Purchased!</h2>
              <p className="pay-success-sub">
                A <strong className="text-primary">${parseFloat(result.amount || 0).toFixed(2)}</strong> gift card has been sent to{' '}
                <strong>{purchaserEmail}</strong>.
              </p>
              {result.code && (
                <div className="pay-success-ref">
                  <Receipt size={14} />
                  <span>Gift Card Code: <strong>{result.code}</strong></span>
                </div>
              )}
              <p className="pay-success-email">Save this code — it can be redeemed at checkout on any future order.</p>
              <div className="pay-success-btns">
                <button className="btn btn-outline" onClick={resetForm}>Buy Another Gift Card</button>
                <a href="/menu" className="btn btn-primary">Order Now</a>
              </div>
            </div>
          ) : (
            <div className="pay-layout">
              <div className="pay-card pay-form">
                <div className="pay-card-hdr">
                  <div className="pay-card-icon"><Gift size={22} /></div>
                  <div>
                    <h3 className="pay-card-title">Choose an Amount</h3>
                    <p className="pay-card-desc">Pick a preset amount or enter your own.</p>
                  </div>
                </div>

                {formError && <div className="pay-error">⚠ {formError}</div>}

                {!intentReady ? (
                  <form onSubmit={handlePreparePayment}>
                    <div className="pay-group">
                      <label>AMOUNT</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        {PRESET_AMOUNTS.map(a => (
                          <button
                            type="button"
                            key={a}
                            className={`btn ${!usingCustom && amount === a ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => { setUsingCustom(false); setAmount(a); }}
                          >
                            ${a}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`btn ${usingCustom ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                          onClick={() => setUsingCustom(true)}
                        >
                          Custom
                        </button>
                      </div>
                      {usingCustom && (
                        <div className="pay-amount-wrap">
                          <DollarSign size={14} className="pay-amount-icon" />
                          <input
                            type="number" min="1" step="0.01"
                            className="pay-input pay-amount-input"
                            placeholder="0.00"
                            value={customAmount}
                            onChange={e => setCustomAmount(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="pay-row two-col">
                      <div className="pay-group">
                        <label>YOUR NAME <span className="req">*</span></label>
                        <input className="pay-input" placeholder="Full name" value={purchaserName} onChange={e => setPurchaserName(e.target.value)} required />
                      </div>
                      <div className="pay-group">
                        <label>YOUR EMAIL <span className="req">*</span></label>
                        <div className="pay-amount-wrap">
                          <Mail size={14} className="pay-amount-icon" />
                          <input type="email" className="pay-input pay-amount-input" placeholder="you@example.com" value={purchaserEmail} onChange={e => setPurchaserEmail(e.target.value)} required />
                        </div>
                      </div>
                    </div>

                    <div className="pay-group">
                      <label>GIFT MESSAGE (optional)</label>
                      <input className="pay-input" placeholder="Enjoy a meal on us!" value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} />
                    </div>

                    <div className="pay-actions">
                      <button type="submit" className="btn btn-primary pay-pay-btn" disabled={preparing}>
                        {preparing ? 'Preparing…' : 'Continue to Payment →'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                      Purchasing a <strong style={{ color: 'var(--color-primary)' }}>${effectiveAmount.toFixed(2)}</strong> gift card
                    </p>
                    {activeCardConfig?.provider === 'authorize_net' && (
                      <AuthNetForm
                        config={activeCardConfig}
                        amount={effectiveAmount}
                        endpoint="/api/gift-cards/purchase"
                        extraFields={extraFields}
                        showSaveOption={false}
                        onSuccess={handlePurchaseSuccess}
                        onError={(msg) => setFormError(msg || 'Payment failed.')}
                      />
                    )}
                    {activeCardConfig?.provider === 'square' && (
                      <SquareCardForm
                        config={activeCardConfig}
                        amount={effectiveAmount}
                        endpoint="/api/gift-cards/purchase"
                        extraFields={extraFields}
                        showSaveOption={false}
                        onSuccess={handlePurchaseSuccess}
                        onError={(msg) => setFormError(msg || 'Payment failed.')}
                      />
                    )}
                    {activeCardConfig?.provider === 'clover' && (
                      <CloverCardForm
                        config={activeCardConfig}
                        amount={effectiveAmount}
                        endpoint="/api/gift-cards/purchase"
                        extraFields={extraFields}
                        showSaveOption={false}
                        onSuccess={handlePurchaseSuccess}
                        onError={(msg) => setFormError(msg || 'Payment failed.')}
                      />
                    )}
                    <button type="button" className="btn btn-outline" style={{ marginTop: '0.75rem', width: '100%' }} onClick={() => setIntentReady(false)}>
                      ← Change amount
                    </button>
                  </>
                )}
              </div>

              <div className="pay-summary">
                <p className="pay-summary-label">GIFT CARD SUMMARY</p>
                <div className="pay-summary-total">
                  <span>Amount</span>
                  <span className="pay-summary-amount">${effectiveAmount.toFixed(2)}</span>
                </div>
                {purchaserEmail && (
                  <div className="pay-summary-order">
                    <div className="pay-summary-row">
                      <span>Delivered to</span>
                      <span className="pay-summary-val">{purchaserEmail}</span>
                    </div>
                  </div>
                )}
                <div className="pay-summary-accept">
                  <p>We accept:</p>
                  <div className="pay-accept-logos">
                    <span className="pay-accept-chip visa">VISA</span>
                    <span className="pay-accept-chip mc">MC</span>
                    <span className="pay-accept-chip amex">AMEX</span>
                    <span className="pay-accept-chip disc">DISC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BuyGiftCard;
