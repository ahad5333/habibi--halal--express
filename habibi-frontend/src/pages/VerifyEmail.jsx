import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in this link.');
      return;
    }
    authAPI.verifyEmail(token)
      .then(data => {
        // Save JWT + user just like a login
        if (data.token) {
          localStorage.setItem('habibi_token', data.token);
          localStorage.setItem('habibi_user', JSON.stringify(data.user || {}));
        }
        setStatus('success');
        // Hard redirect so AuthContext re-initializes with the new token
        setTimeout(() => { window.location.href = '/'; }, 2500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may have expired.');
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle = {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
  };
  const cardStyle = {
    maxWidth: 440,
    width: '100%',
    margin: '1rem',
    padding: '2.5rem',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    textAlign: 'center',
    color: '#f1f1f1',
  };

  if (status === 'verifying') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(229,182,78,0.2)', borderTopColor: '#E5B64E', borderRadius: '50%', animation: 'spin 0.75s linear infinite', margin: '0 auto 1.5rem' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Verifying your email…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (status === 'success') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ color: '#E5B64E', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Email Verified!</h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '1.5rem' }}>
          Your account is now active. Redirecting you to the homepage…
        </p>
        <Link to="/" style={{ color: '#E5B64E', textDecoration: 'none', fontWeight: 600 }}>Go now →</Link>
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
        <h2 style={{ color: '#ef4444', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Verification Failed</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>{message}</p>
        <Link to="/signup" style={{ background: '#E5B64E', color: '#0a0a0a', padding: '0.75rem 1.5rem', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>Sign Up Again</Link>
      </div>
    </div>
  );
}
