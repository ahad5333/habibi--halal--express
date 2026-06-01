import React, { useState } from 'react';
import { CreditCard, Search, Lock, CheckCircle, DollarSign, Receipt, Zap } from 'lucide-react';
import { ordersAPI, paymentsAPI } from '../services/api';
import StripeCardForm from '../components/StripeCardForm';
import './Payment.css';

const PAYMENT_REASONS = [
  'Outstanding Order Balance',
  'Catering Deposit',
  'Catering Final Payment',
  'Wholesale Invoice',
  'Event Booking',
  'Other',
];

const Payment = () => {
  const [step, setStep] = useState(1); // 1: lookup, 2: pay, 3: done

  /* Step 1 — Order lookup */
  const [orderRef, setOrderRef] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]     = useState('');
  const [foundOrder, setFoundOrder]       = useState(null);

  /* Step 2 — Payment */
  const [payReason, setPayReason]   = useState('');
  const [amount, setAmount]         = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payNote, setPayNote]       = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError]     = useState('');
  const [txRef, setTxRef]           = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [intentReady, setIntentReady]   = useState(false);

  const handleOrderLookup = async (e) => {
    e.preventDefault();
    if (!orderRef.trim()) { setLookupError('Please enter an order number or reference.'); return; }
    setLookupLoading(true);
    setLookupError('');
    try {
      // Try backend lookup first
      const data = await ordersAPI.getById(orderRef.trim());
      setFoundOrder({
        id: data.id || orderRef,
        ref: data.order_number || orderRef,
        customer: data.customer_name || 'Customer',
        total: data.total_amount || 0,
        balance: data.balance_due || data.total_amount || 0,
        status: data.status || 'pending',
      });
      setAmount(String((data.balance_due || data.total_amount || '').toFixed?.(2) ?? ''));
      setStep(2);
    } catch {
      // Demo fallback — accept any ref
      setFoundOrder({ ref: orderRef, customer: 'Customer', balance: 0, status: 'open' });
      setStep(2);
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePreparePayment = async (e) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setPayError('Please enter a valid payment amount.'); return;
    }
    setPayError('');
    setPayLoading(true);
    try {
      const ref = foundOrder?.ref || `QPAY-${Date.now()}`;
      const res = await paymentsAPI.createIntent(amtNum, ref, ['card']);
      setClientSecret(res.clientSecret || '');
      setIntentReady(true);
    } catch (err) {
      setPayError(err.message || 'Failed to initiate payment. Please try again.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleStripeSuccess = (paymentIntent) => {
    setTxRef(paymentIntent?.id || `TX-${Date.now().toString().slice(-8)}`);
    setStep(3);
  };

  const handleStripeError = (msg) => setPayError(msg || 'Payment failed.');

  return (
    <div className="payment-page">

      {/* ── Hero ── */}
      <section className="pay-hero">
        <div className="pay-hero-overlay" />
        <div className="container pay-hero-content">
          <p className="pay-eyebrow">QUICK PAY</p>
          <h1 className="pay-hero-title">
            Just Make a <span className="text-primary">Payment</span>
          </h1>
          <p className="pay-hero-sub">
            Pay an outstanding order balance, catering deposit, or wholesale invoice — no account required.
          </p>
          <div className="pay-hero-tags">
            <span className="pay-tag"><Lock size={12} /> Secure &amp; Encrypted</span>
            <span className="pay-tag"><Zap size={12} /> Instant Processing</span>
            <span className="pay-tag"><Receipt size={12} /> Email Receipt</span>
          </div>
        </div>
      </section>

      {/* ── Steps indicator ── */}
      <div className="pay-steps-bar">
        <div className="container pay-steps">
          {[
            { n: 1, label: 'Find Order' },
            { n: 2, label: 'Enter Payment' },
            { n: 3, label: 'Confirmation' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.n}>
              <div className={`pay-step ${step >= s.n ? 'done' : ''} ${step === s.n ? 'active' : ''}`}>
                <div className="pay-step-num">
                  {step > s.n ? <CheckCircle size={16} /> : s.n}
                </div>
                <span>{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className={`pay-step-line ${step > s.n ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <section className="section">
        <div className="container pay-container">

          {/* STEP 1 — Lookup */}
          {step === 1 && (
            <div className="pay-card">
              <div className="pay-card-hdr">
                <div className="pay-card-icon"><Search size={22} /></div>
                <div>
                  <h3 className="pay-card-title">Find Your Order</h3>
                  <p className="pay-card-desc">Enter your order number, invoice reference, or event booking ID.</p>
                </div>
              </div>

              <form onSubmit={handleOrderLookup} className="pay-form">
                {lookupError && <div className="pay-error">⚠ {lookupError}</div>}
                <div className="pay-group">
                  <label>ORDER / INVOICE REFERENCE</label>
                  <div className="pay-search-row">
                    <input
                      className="pay-input"
                      placeholder="e.g. HAB-1042-A or INV-2025-001"
                      value={orderRef}
                      onChange={e => setOrderRef(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary pay-search-btn" disabled={lookupLoading}>
                      {lookupLoading ? '...' : <><Search size={15} /> Find</>}
                    </button>
                  </div>
                </div>
                <p className="pay-hint">
                  Don't have a reference? <button type="button" className="pay-link" onClick={() => setStep(2)}>Pay a custom amount →</button>
                </p>
              </form>
            </div>
          )}

          {/* STEP 2 — Payment */}
          {step === 2 && (
            <div className="pay-layout">
              {/* Left — form */}
              <div className="pay-card pay-form">
                <div className="pay-card-hdr">
                  <div className="pay-card-icon"><CreditCard size={22} /></div>
                  <div>
                    <h3 className="pay-card-title">Payment Details</h3>
                    <p className="pay-card-desc">All transactions are secured and encrypted by Stripe.</p>
                  </div>
                </div>

                {payError && <div className="pay-error">⚠ {payError}</div>}

                {!intentReady ? (
                  <form onSubmit={handlePreparePayment}>
                    {/* Customer info */}
                    <div className="pay-row two-col">
                      <div className="pay-group">
                        <label>YOUR NAME <span className="req">*</span></label>
                        <input className="pay-input" placeholder="Full name" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                      </div>
                      <div className="pay-group">
                        <label>PHONE (optional)</label>
                        <input type="tel" className="pay-input" placeholder="(718) 555-0100" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                      </div>
                    </div>

                    {/* Amount + reason */}
                    <div className="pay-row two-col">
                      <div className="pay-group">
                        <label>AMOUNT <span className="req">*</span></label>
                        <div className="pay-amount-wrap">
                          <DollarSign size={14} className="pay-amount-icon" />
                          <input
                            type="number" min="0.01" step="0.01"
                            className="pay-input pay-amount-input"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="pay-group">
                        <label>REASON</label>
                        <select className="pay-input pay-select" value={payReason} onChange={e => setPayReason(e.target.value)}>
                          <option value="">Select reason...</option>
                          {PAYMENT_REASONS.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="pay-group">
                      <label>NOTE (optional)</label>
                      <input className="pay-input" placeholder="Any additional details..." value={payNote} onChange={e => setPayNote(e.target.value)} />
                    </div>

                    <div className="pay-actions">
                      <button type="button" className="btn btn-outline" onClick={() => { setStep(1); setFoundOrder(null); }}>
                        ← Back
                      </button>
                      <button type="submit" className="btn btn-primary pay-pay-btn" disabled={payLoading}>
                        {payLoading ? 'Preparing…' : 'Continue to Card →'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p style={{fontSize:'0.85rem',color:'var(--color-text-muted)',marginBottom:'1rem'}}>
                      Paying <strong style={{color:'var(--color-primary)'}}>${parseFloat(amount).toFixed(2)}</strong>
                      {payReason ? ` for ${payReason}` : ''}
                    </p>
                    <StripeCardForm
                      clientSecret={clientSecret}
                      onSuccess={handleStripeSuccess}
                      onError={handleStripeError}
                      disabled={false}
                    />
                    <div className="pay-secure-note" style={{marginTop:'0.75rem'}}>
                      <Lock size={12} />
                      <span>Secured by Stripe — card details never touch our servers.</span>
                    </div>
                    <button type="button" className="btn btn-outline" style={{marginTop:'0.75rem',width:'100%'}} onClick={() => setIntentReady(false)}>
                      ← Change amount
                    </button>
                  </>
                )}
              </div>

              {/* Right — order summary */}
              <div className="pay-summary">
                <p className="pay-summary-label">PAYMENT SUMMARY</p>
                {foundOrder && (
                  <div className="pay-summary-order">
                    <div className="pay-summary-row">
                      <span>Reference</span>
                      <span className="pay-summary-val mono">{foundOrder.ref}</span>
                    </div>
                    {foundOrder.customer && (
                      <div className="pay-summary-row">
                        <span>Customer</span>
                        <span className="pay-summary-val">{foundOrder.customer}</span>
                      </div>
                    )}
                    {foundOrder.balance > 0 && (
                      <div className="pay-summary-row">
                        <span>Balance Due</span>
                        <span className="pay-summary-val gold">${Number(foundOrder.balance).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="pay-summary-total">
                  <span>You're Paying</span>
                  <span className="pay-summary-amount">${parseFloat(amount || 0).toFixed(2)}</span>
                </div>
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

          {/* STEP 3 — Confirmation */}
          {step === 3 && (
            <div className="pay-success">
              <div className="pay-success-icon"><CheckCircle size={48} /></div>
              <h2 className="pay-success-title">Payment Successful!</h2>
              <p className="pay-success-sub">
                Your payment of <strong className="text-primary">${parseFloat(amount || 0).toFixed(2)}</strong> has been processed.
              </p>
              <div className="pay-success-ref">
                <Receipt size={14} />
                <span>Transaction Reference: <strong>{txRef}</strong></span>
              </div>
              <p className="pay-success-email">A receipt has been emailed to the address on file.</p>
              <div className="pay-success-btns">
                <button className="btn btn-outline" onClick={() => { setStep(1); setOrderRef(''); setFoundOrder(null); setAmount(''); setPayReason(''); setPayNote(''); setIntentReady(false); setClientSecret(''); }}>
                  Make Another Payment
                </button>
                <a href="/" className="btn btn-primary">Back to Home</a>
              </div>
            </div>
          )}

        </div>
      </section>

    </div>
  );
};

export default Payment;
