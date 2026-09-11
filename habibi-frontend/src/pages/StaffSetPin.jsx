import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import usePageFavicon from '../utils/usePageFavicon';
import './StaffLogin.css';

const API = import.meta.env.VITE_API_URL || '';

export default function StaffSetPin() {
  const [params] = useSearchParams();
  const staffId = params.get('id');
  const token   = params.get('token');

  usePageFavicon('/images/icons/tab-staff.png');

  const [step, setStep]       = useState('set');   // 'set' | 'confirm' | 'done'
  const [pin, setPin]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [shake, setShake]     = useState(false);
  const [name, setName]       = useState('');

  const active = step === 'set' ? pin : confirm;

  const fail = useCallback((msg, resetAll) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
    if (resetAll) { setPin(''); setConfirm(''); setStep('set'); }
    else setConfirm('');
  }, []);

  const submit = useCallback(async (confirmValue) => {
    const code = confirmValue ?? confirm;
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/staff/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Staff-Id': staffId, 'X-Staff-Token': token },
        body: JSON.stringify({ staff_id: staffId, pin, confirm_pin: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Setup failed.');
      setName(data.name || '');
      setStep('done');
    } catch (err) {
      fail(err.message, true);
    } finally {
      setLoading(false);
    }
  }, [confirm, pin, loading, staffId, token, fail]);

  // Fourth digit advances the step, matching the login page -- no reaching for
  // a separate button between entering the PIN and confirming it.
  const pushDigit = useCallback((d) => {
    if (loading) return;
    setError('');
    if (step === 'set') {
      setPin(prev => {
        if (prev.length >= 4) return prev;
        const next = prev + d;
        if (next.length === 4) setTimeout(() => setStep('confirm'), 140);
        return next;
      });
    } else {
      setConfirm(prev => {
        if (prev.length >= 4) return prev;
        const next = prev + d;
        if (next.length === 4) {
          setTimeout(() => {
            if (next !== pin) fail('Those PINs don’t match. Start again.', true);
            else submit(next);
          }, 140);
        }
        return next;
      });
    }
  }, [step, loading, pin, submit, fail]);

  const popDigit = useCallback(() => {
    if (step === 'set') setPin(p => p.slice(0, -1));
    else setConfirm(p => p.slice(0, -1));
  }, [step]);

  // Physical keyboard, same as the login page.
  useEffect(() => {
    if (step === 'done') return undefined;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); pushDigit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); popDigit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushDigit, popDigit, step]);

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'ghost', '0', 'back'];

  if (!staffId || !token) return (
    <div className="sl-page">
      <div className="sl-card" style={{ textAlign: 'center' }}>
        <div className="sl-setpin-icon">⚠️</div>
        <h1 className="sl-title">Invalid setup link</h1>
        <p className="sl-sub" style={{ marginBottom: '1.25rem' }}>
          This link is incomplete or has already been used. Ask your manager to send you a new one.
        </p>
        <Link className="sl-submit" style={{ display: 'block', textDecoration: 'none' }} to="/staff/login">
          Go to Staff Login
        </Link>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div className="sl-page">
      <div className="sl-card" style={{ textAlign: 'center' }}>
        <div className="sl-setpin-icon">✅</div>
        <h1 className="sl-title">PIN set</h1>
        <p className="sl-sub" style={{ marginBottom: '1.5rem' }}>
          {name ? `You're all set, ${name}. ` : ''}Sign in any time with your phone number and this PIN.
        </p>
        <Link className="sl-submit" style={{ display: 'block', textDecoration: 'none' }} to="/staff/login">
          Go to Staff Login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="sl-page">
      <div className="sl-card">
        <div className="sl-head">
          <img
            src="/images/logos/logo-badge.webp"
            alt=""
            className="sl-logo"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="sl-title">{step === 'set' ? 'Choose your PIN' : 'Confirm your PIN'}</h1>
          <p className="sl-sub">
            {step === 'set'
              ? 'Pick a 4-digit PIN you’ll use to sign in'
              : 'Enter the same 4 digits again'}
          </p>

          <div className="sl-steps" aria-hidden="true">
            <span className={`sl-step${step === 'set' ? ' on' : ' done'}`} />
            <span className={`sl-step${step === 'confirm' ? ' on' : ''}`} />
          </div>
        </div>

        <div className={`sl-dots${shake ? ' shake' : ''}`} role="status" aria-live="polite"
             aria-label={`${active.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={`sl-dot${i < active.length ? ' filled' : ''}`} />
          ))}
        </div>

        <div className="sl-pad">
          {KEYS.map((k, i) => {
            if (k === 'ghost') return <div key={i} className="sl-key sl-key--ghost" aria-hidden="true" />;
            if (k === 'back') {
              return (
                <button key={i} type="button" className="sl-key sl-key--back"
                        onClick={popDigit} disabled={loading || active.length === 0}
                        aria-label="Delete last digit">⌫</button>
              );
            }
            return (
              <button key={i} type="button" className="sl-key"
                      onClick={() => pushDigit(k)} disabled={loading || active.length >= 4}
                      aria-label={`Digit ${k}`}>{k}</button>
            );
          })}
        </div>

        <p className={`sl-msg${error ? ' err' : ''}`} role="alert">
          {error || (loading ? 'Saving…' : '')}
        </p>

        {step === 'confirm' && !loading && (
          <button
            type="button"
            className="sl-switch"
            style={{ display: 'block', margin: '0 auto' }}
            onClick={() => { setStep('set'); setPin(''); setConfirm(''); setError(''); }}
          >
            ← Pick a different PIN
          </button>
        )}

        <p className="sl-hint">Keep this PIN private — it signs you in to the order queue.</p>
      </div>
    </div>
  );
}
