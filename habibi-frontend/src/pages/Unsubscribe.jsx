import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

const s = {
  wrap: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
    padding: '1rem',
  },
  card: {
    maxWidth: 440,
    width: '100%',
    padding: '2.5rem 2rem',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    textAlign: 'center',
    color: '#f1f1f1',
  },
  logo: {
    fontSize: '0.68rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#E5B64E',
    marginBottom: '1.5rem',
  },
  spinner: {
    width: 44, height: 44,
    border: '3px solid rgba(229,182,78,0.15)',
    borderTopColor: '#E5B64E',
    borderRadius: '50%',
    animation: 'spin 0.75s linear infinite',
    margin: '0 auto 1.5rem',
  },
  home: {
    display: 'inline-block',
    marginTop: '1.5rem',
    color: '#E5B64E',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
};

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token  = params.get('token');
  const success = params.get('success');
  const errorParam = params.get('error');

  const [status, setStatus]   = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Redirected back from backend with result already resolved
    if (success === '1') { setStatus('success'); return; }
    if (errorParam) {
      const msgs = {
        missing_token: 'This link is incomplete. Please use the full link from your email.',
        invalid_token: 'This link is invalid or has already been used.',
        server_error:  'Something went wrong on our end. Please try again later.',
      };
      setMessage(msgs[errorParam] || 'An error occurred.');
      setStatus('error');
      return;
    }

    // Token present — call the API directly
    if (!token) {
      setMessage('No unsubscribe token found. Please use the link from your email.');
      setStatus('error');
      return;
    }

    fetch(`${API}/api/contact/unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Unsubscribe failed.');
        setStatus('success');
      })
      .catch(err => {
        setMessage(err.message || 'Something went wrong. Please try again later.');
        setStatus('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={s.wrap}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.card}>
        <p style={s.logo}>Habibi Halal Express</p>

        {status === 'loading' && (
          <>
            <div style={s.spinner} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              Processing your request…
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>✅</div>
            <h1 style={{ color: '#E5B64E', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
              You're unsubscribed
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontSize: '0.92rem', margin: 0 }}>
              You've been removed from the Habibi Halal Express mailing list.
              You won't receive any further marketing emails from us.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: '1rem' }}>
              Changed your mind? You can re-subscribe any time from our website.
            </p>
            <Link to="/" style={s.home}>← Back to Habibi</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>❌</div>
            <h1 style={{ color: '#ef4444', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
              Link not valid
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontSize: '0.92rem', margin: 0 }}>
              {message}
            </p>
            <Link to="/" style={s.home}>← Back to Habibi</Link>
          </>
        )}
      </div>
    </div>
  );
}
