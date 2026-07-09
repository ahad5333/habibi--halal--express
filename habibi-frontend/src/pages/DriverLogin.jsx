import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

export default function DriverLogin() {
  const navigate = useNavigate();
  const [phone, setPhone]         = useState('');
  const [pin, setPin]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [installPrompt, setInstall] = useState(null);
  const promptRef = useRef(null);

  // PWA: swap to driver-specific manifest and capture install prompt
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const orig = link?.href;
    if (link) link.href = '/driver-manifest.json';

    const handler = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Already installed in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstall(false);
    }

    return () => {
      if (link && orig) link.href = orig;
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') setInstall(false);
  };

  const handleKey = (digit) => {
    if (pin.length < 4) setPin(p => p + digit);
  };
  const handleDel = () => setPin(p => p.slice(0, -1));

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!phone.trim()) { setError('Enter your phone number.'); return; }
    if (pin.length !== 4) { setError('Enter your 4-digit PIN.'); return; }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API}/api/dispatch/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed.');
      localStorage.setItem('habibi_driver_session', JSON.stringify({
        driver_id: String(data.driver_id),
        token: data.token,
        name: data.name || '',
        phone: phone.trim(),
      }));
      navigate('/driver');
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page:    { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '1rem' },
    card:    { width: '100%', maxWidth: 360, background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2rem 1.5rem', color: '#f1f1f1' },
    logo:    { textAlign: 'center', marginBottom: '1.5rem' },
    title:   { fontSize: '1.3rem', fontWeight: 700, color: '#E5B64E', marginBottom: '0.25rem', textAlign: 'center' },
    sub:     { fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '1.5rem' },
    label:   { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', display: 'block' },
    input:   { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.75rem 1rem', color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '1.25rem' },
    dots:    { display: 'flex', justifyContent: 'center', gap: '0.75rem', margin: '0.5rem 0 1.25rem' },
    dot:     (filled) => ({ width: 16, height: 16, borderRadius: '50%', background: filled ? '#E5B64E' : 'rgba(255,255,255,0.15)', border: filled ? 'none' : '1px solid rgba(255,255,255,0.25)', transition: 'background 0.15s' }),
    grid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' },
    key:     { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '1rem', fontSize: '1.3rem', fontWeight: 600, color: '#fff', cursor: 'pointer', textAlign: 'center', userSelect: 'none', transition: 'background 0.12s' },
    del:     { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '1rem', fontSize: '1rem', fontWeight: 600, color: '#f87171', cursor: 'pointer', textAlign: 'center', userSelect: 'none' },
    btn:     { width: '100%', background: '#E5B64E', color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' },
    error:   { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.65rem 1rem', color: '#f87171', fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center' },
    hint:    { textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginTop: '1.25rem' },
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <img src="/images/logos/logo-badge.webp" alt="Habibi" style={{ width: 56, height: 56, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
        </div>
        <p style={s.title}>Driver Login</p>
        <p style={s.sub}>Habibi Halal Express · Delivery App</p>

        {installPrompt && (
          <div style={{ background: 'rgba(229,182,78,0.1)', border: '1px solid rgba(229,182,78,0.3)', borderRadius: 10, padding: '0.6rem 0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📱</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', flex: 1 }}>Install Driver App on your home screen</span>
            <button onClick={handleInstall} style={{ background: '#E5B64E', color: '#0a0a0a', border: 'none', borderRadius: 6, padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Install</button>
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}

        <label style={s.label}>PHONE NUMBER</label>
        <input
          style={s.input}
          type="tel"
          inputMode="tel"
          placeholder="(718) 555-0100"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          disabled={loading}
        />

        <label style={s.label}>4-DIGIT PIN</label>
        <div style={s.dots}>
          {[0,1,2,3].map(i => <div key={i} style={s.dot(i < pin.length)} />)}
        </div>

        <div style={s.grid}>
          {KEYS.map((k, i) => {
            if (k === '') return <div key={i} />;
            if (k === '⌫') return <div key={i} style={s.del} onClick={handleDel}>{k}</div>;
            return <div key={i} style={s.key} onClick={() => handleKey(k)}>{k}</div>;
          })}
        </div>

        <button
          style={{ ...s.btn, opacity: loading || pin.length < 4 ? 0.6 : 1 }}
          onClick={handleLogin}
          disabled={loading || pin.length < 4}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={s.hint}>
          First time? Ask your admin to send your setup link via SMS.
        </p>
      </div>
    </div>
  );
}
