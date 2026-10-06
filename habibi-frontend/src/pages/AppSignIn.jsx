import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Google / Apple sign-in for the mobile app (habibi-mobile LoginScreen).
// The app has no Firebase / OAuth setup of its own, so it opens this page in
// the phone's secure browser sheet (like PayPal). The page signs in exactly as
// the website's Login does, then sends the 1-hour Firebase ID token back to
// the app, which exchanges it at /api/auth/social like the website.
//
// Safety:
// - only returns to the app's own scheme (habibi://) or, for testing, an
//   Expo Go app link -- never to an arbitrary website;
// - the token goes in the URL #fragment, which is never sent to any server;
// - this page talks to no server itself.
// Expo Go (development only) is allowed only on a private home/office network
// address -- an Expo Go link to any public host could hand the token to
// someone else's project.
const ALLOWED_RETURN = /^(habibi:\/\/|exp:\/\/(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(:\d+)?\/--\/)[^\s#]*$/i;

export default function AppSignIn() {
  const [params] = useSearchParams();
  const provider = params.get('provider') === 'apple' ? 'apple' : 'google';
  const ret = params.get('return') || '';
  const okReturn = ALLOWED_RETURN.test(ret);
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [error, setError] = useState('');

  const sendBack = (fragment) => { window.location.replace(`${ret}#${fragment}`); };

  const makeProvider = async () => {
    if (provider === 'google') {
      const { GoogleAuthProvider } = await import('firebase/auth');
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      return p;
    }
    const { OAuthProvider } = await import('firebase/auth');
    const p = new OAuthProvider('apple.com');
    p.addScope('email');
    p.addScope('name');
    return p;
  };

  const finish = async (user) => {
    const idToken = await user.getIdToken();
    sendBack(`id_token=${encodeURIComponent(idToken)}`);
  };

  // Coming back from the redirect fallback.
  useEffect(() => {
    if (!okReturn) return;
    (async () => {
      try {
        const { isFirebaseConfigured, getFirebaseAuth } = await import('../utils/firebase');
        if (!isFirebaseConfigured()) return;
        const { getRedirectResult } = await import('firebase/auth');
        const res = await getRedirectResult(await getFirebaseAuth());
        if (res?.user) { setStatus('working'); await finish(res.user); }
      } catch (e) {
        setStatus('error'); setError(e?.message || 'Sign-in failed. Please try again.');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setStatus('working'); setError('');
    try {
      const { isFirebaseConfigured, getFirebaseAuth } = await import('../utils/firebase');
      if (!isFirebaseConfigured()) throw new Error('Sign-in is not available right now.');
      const auth = await getFirebaseAuth();
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      const p = await makeProvider();
      try {
        const res = await signInWithPopup(auth, p);
        await finish(res.user);
      } catch (e) {
        // Some phone browser sheets block pop-ups: use a full-page redirect instead.
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, p);
          return;
        }
        throw e;
      }
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') { setStatus('idle'); return; }
      setStatus('error'); setError(e?.message || 'Sign-in failed. Please try again.');
    }
  };

  const label = provider === 'apple' ? 'Continue with Apple' : 'Continue with Google';
  const wrap = { minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px', textAlign: 'center' };
  const btn = { width: '100%', maxWidth: 360, height: 54, borderRadius: 14, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    background: provider === 'apple' ? '#fff' : '#F97316', color: provider === 'apple' ? '#000' : '#fff' };

  if (!okReturn) {
    return <div style={wrap}><h1 style={{ fontSize: 22 }}>Open this from the Habibi app</h1><p style={{ opacity: 0.7 }}>This sign-in page only works when started from the Habibi Halal Express app.</p></div>;
  }
  return (
    <div style={wrap}>
      <img src="/images/logos/logo-sm.webp" alt="" width="72" height="72" style={{ borderRadius: 36 }} />
      <h1 style={{ fontSize: 24, margin: 0 }}>Sign in to Habibi</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>You'll go straight back to the app.</p>
      <button style={{ ...btn, opacity: status === 'working' ? 0.6 : 1 }} onClick={start} disabled={status === 'working'}>
        {status === 'working' ? 'Signing in…' : label}
      </button>
      {status === 'error' && <p style={{ color: '#f87171', maxWidth: 360 }}>{error}</p>}
      <button style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 14, cursor: 'pointer' }} onClick={() => sendBack('cancelled=1')}>Back to the app</button>
    </div>
  );
}
