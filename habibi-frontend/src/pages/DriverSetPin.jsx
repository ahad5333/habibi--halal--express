import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

export default function DriverSetPin() {
  const [params] = useSearchParams();
  const driverId = params.get('id');
  const token    = params.get('token');

  const [step, setStep]       = useState('set');   // 'set' | 'confirm' | 'done' | 'error'
  const [pin, setPin]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [name, setName]       = useState('');

  const active = step === 'set' ? pin : confirm;
  const setActive = step === 'set' ? setPin : setConfirm;

  const handleKey = (digit) => {
    if (active.length < 4) setActive(v => v + digit);
  };
  const handleDel = () => setActive(v => v.slice(0, -1));

  const handleNext = async () => {
    if (step === 'set') {
      if (pin.length !== 4) return;
      setConfirm('');
      setError('');
      setStep('confirm');
      return;
    }
    if (confirm !== pin) {
      setError('PINs do not match. Try again.');
      setConfirm('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API}/api/dispatch/driver/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Driver-Token': token },
        body: JSON.stringify({ driver_id: driverId, pin, confirm_pin: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Setup failed.');
      setName(data.name || '');
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('set');
      setPin('');
      setConfirm('');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page:  { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '1rem' },
    card:  { width: '100%', maxWidth: 360, background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2rem 1.5rem', color: '#f1f1f1', textAlign: 'center' },
    title: { fontSize: '1.3rem', fontWeight: 700, color: '#E5B64E', marginBottom: '0.4rem' },
    sub:   { fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: '1.5rem' },
    dots:  { display: 'flex', justifyContent: 'center', gap: '0.75rem', margin: '0.75rem 0 1.25rem' },
    dot:   (filled) => ({ width: 18, height: 18, borderRadius: '50%', background: filled ? '#E5B64E' : 'rgba(255,255,255,0.15)', border: filled ? 'none' : '1px solid rgba(255,255,255,0.25)', transition: 'background 0.15s' }),
    grid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' },
    key:   { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', fontSize: '1.3rem', fontWeight: 600, color: '#fff', cursor: 'pointer', userSelect: 'none', transition: 'background 0.12s' },
    del:   { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '1rem', fontSize: '1rem', color: '#f87171', cursor: 'pointer', userSelect: 'none' },
    btn:   { width: '100%', background: '#E5B64E', color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: '0.25rem' },
    back:  { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.75rem', display: 'block', width: '100%' },
    error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.65rem 1rem', color: '#f87171', fontSize: '0.82rem', marginBottom: '1rem' },
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  if (!driverId || !token) return (
    <div style={s.page}><div style={s.card}>
      <p style={{ color: '#f87171', marginBottom: '1rem' }}>Invalid setup link. Please ask your admin to resend it.</p>
      <Link to="/driver/login" style={{ color: '#E5B64E', fontSize: '0.9rem' }}>Go to Driver Login →</Link>
    </div></div>
  );

  if (step === 'done') return (
    <div style={s.page}><div style={s.card}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
      <p style={s.title}>PIN Set!</p>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
        {name ? `Welcome, ${name}! ` : ''}You can now log in anytime using your phone number and this PIN.
      </p>
      <Link to="/driver/login" style={{ display: 'block', background: '#E5B64E', color: '#0a0a0a', borderRadius: 10, padding: '0.9rem', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
        Go to Driver Login →
      </Link>
    </div></div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ marginBottom: '1rem' }}>
          <img src="/images/logos/logo-badge.webp" alt="Habibi" style={{ width: 52, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
        </div>
        <p style={s.title}>{step === 'set' ? 'Set Your PIN' : 'Confirm PIN'}</p>
        <p style={s.sub}>{step === 'set' ? 'Choose a 4-digit PIN to log in' : 'Enter your PIN again to confirm'}</p>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.dots}>
          {[0,1,2,3].map(i => <div key={i} style={s.dot(i < active.length)} />)}
        </div>

        <div style={s.grid}>
          {KEYS.map((k, i) => {
            if (k === '') return <div key={i} />;
            if (k === '⌫') return <div key={i} style={s.del} onClick={handleDel}>{k}</div>;
            return <div key={i} style={s.key} onClick={() => handleKey(k)}>{k}</div>;
          })}
        </div>

        <button
          style={{ ...s.btn, opacity: loading || active.length < 4 ? 0.6 : 1 }}
          onClick={handleNext}
          disabled={loading || active.length < 4}
        >
          {loading ? 'Saving…' : step === 'set' ? 'Next →' : 'Set PIN'}
        </button>

        {step === 'confirm' && (
          <button style={s.back} onClick={() => { setStep('set'); setPin(''); setConfirm(''); setError(''); }}>
            ← Change PIN
          </button>
        )}
      </div>
    </div>
  );
}
