import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageFavicon from '../utils/usePageFavicon';
import './StaffLogin.css';

const API = import.meta.env.VITE_API_URL || '';
const PHONE_KEY = 'habibi_staff_phone';

// (718) 555-0100 as you type. Staff read their own number back to check it,
// so it's formatted rather than left as a raw digit run.
function formatPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function maskPhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  return d.length >= 4 ? `••• ••• ${d.slice(-4)}` : d;
}

export default function StaffLogin() {
  const navigate = useNavigate();
  usePageFavicon('/images/icons/serving.png');

  // Staff sign in on the same device every shift, so the number is remembered
  // and they land straight on the PIN pad. "Not you?" clears it.
  const [remembered, setRemembered] = useState(() => {
    try { return localStorage.getItem(PHONE_KEY) || ''; } catch (_) { return ''; }
  });
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [shake, setShake]     = useState(false);
  const phoneRef = useRef(null);

  const activePhone = remembered || phone;
  const phoneReady = activePhone.replace(/\D/g, '').length >= 10;

  useEffect(() => {
    if (!remembered) phoneRef.current?.focus();
  }, [remembered]);

  const submit = useCallback(async (pinValue) => {
    const code = pinValue ?? pin;
    if (loading) return;
    if (!phoneReady) {
      setError('Enter your phone number first.');
      phoneRef.current?.focus();
      return;
    }
    if (code.length !== 4) { setError('Enter your 4-digit PIN.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activePhone, pin: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed.');

      localStorage.setItem('habibi_staff_session', JSON.stringify({
        staff_id: String(data.staff_id),
        token: data.token,
        name: data.name || '',
        role: data.role || '',
      }));
      try { localStorage.setItem(PHONE_KEY, activePhone); } catch (_) {}
      navigate('/staff');
    } catch (err) {
      setError(err.message);
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setLoading(false);
    }
  }, [pin, loading, phoneReady, activePhone, navigate]);

  // Entering the fourth digit signs in. Reaching for a separate button after
  // the pad is finished is the kind of friction that adds up over a shift.
  const pushDigit = useCallback((d) => {
    setPin(prev => {
      if (prev.length >= 4 || loading) return prev;
      const next = prev + d;
      if (next.length === 4) setTimeout(() => submit(next), 120);
      return next;
    });
    setError('');
  }, [loading, submit]);

  const popDigit = useCallback(() => setPin(p => p.slice(0, -1)), []);

  // Physical keyboard: these terminals often have one, and the page previously
  // ignored it entirely — the PIN could only be entered by clicking.
  useEffect(() => {
    const onKey = (e) => {
      if (document.activeElement === phoneRef.current) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); pushDigit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); popDigit(); }
      else if (e.key === 'Enter' && pin.length === 4) { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushDigit, popDigit, submit, pin.length]);

  const forgetPhone = () => {
    try { localStorage.removeItem(PHONE_KEY); } catch (_) {}
    setRemembered('');
    setPhone('');
    setPin('');
    setError('');
  };

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'ghost', '0', 'back'];

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
          <h1 className="sl-title">Staff Login</h1>
          <p className="sl-sub">Habibi Halal Express · Order Queue</p>

          {remembered && (
            <div className="sl-welcome">
              <span className="sl-welcome-phone">{maskPhone(remembered)}</span>
              <button type="button" className="sl-switch" onClick={forgetPhone}>
                Not you?
              </button>
            </div>
          )}
        </div>

        {!remembered && (
          <>
            <label className="sl-label" htmlFor="sl-phone">Phone number</label>
            <input
              id="sl-phone"
              ref={phoneRef}
              className="sl-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(718) 555-0100"
              value={formatPhone(phone)}
              onChange={e => { setPhone(e.target.value); setError(''); }}
              disabled={loading}
            />
          </>
        )}

        <div className={`sl-dots${shake ? ' shake' : ''}`} role="status" aria-live="polite"
             aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={`sl-dot${i < pin.length ? ' filled' : ''}`} />
          ))}
        </div>

        <div className="sl-pad">
          {KEYS.map((k, i) => {
            if (k === 'ghost') return <div key={i} className="sl-key sl-key--ghost" aria-hidden="true" />;
            if (k === 'back') {
              return (
                <button
                  key={i} type="button" className="sl-key sl-key--back"
                  onClick={popDigit} disabled={loading || pin.length === 0}
                  aria-label="Delete last digit"
                >⌫</button>
              );
            }
            return (
              <button
                key={i} type="button" className="sl-key"
                onClick={() => pushDigit(k)} disabled={loading || pin.length >= 4}
                aria-label={`Digit ${k}`}
              >{k}</button>
            );
          })}
        </div>

        <button
          type="button"
          className="sl-submit"
          onClick={() => submit()}
          disabled={loading || pin.length < 4}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className={`sl-msg${error ? ' err' : ''}`} role="alert">{error}</p>

        <p className="sl-hint">First time? Ask your manager to text you a setup link.</p>
      </div>
    </div>
  );
}
