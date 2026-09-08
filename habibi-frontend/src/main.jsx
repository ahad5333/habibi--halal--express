import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { DineInProvider } from './context/DineInContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';

// A lazy-loaded chunk can fail to fetch if the browser tab has been open
// since before a deploy and the file it wants was already superseded (rare
// now that deploy.sh keeps old builds around for 14 days, but not
// impossible for a very stale tab, or any transient network blip). Vite
// fires this event in exactly that case -- reload once to land on the
// current build instead of showing a broken screen. Guarded with
// sessionStorage so a genuinely broken deploy can't reload-loop forever.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'habibi_preload_reload_once';
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch (_) { /* private mode etc -- reload anyway, just without the guard */ }
  window.location.reload();
});

// App service worker. Registered for two reasons: "Add to Home Screen" needs a
// fetch handler to consider the site installable (firebase-messaging-sw.js has
// none, and only registers once push is enabled anyway), and it gives an
// offline screen instead of the browser's error page.
//
// Registered after load so it never competes with the initial render, and only
// in production -- a SW in front of the dev server causes exactly the kind of
// stale-asset confusion the preloadError handler above exists to clean up.
// sw.js itself deliberately caches only hashed /assets/ and never index.html
// or /api/, so it cannot serve a stale shell or stale order data.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // A new build is live while this tab is open: activate it right away so
      // the next navigation is served by the new worker rather than a stale one.
      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            incoming.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(err => console.warn('[SW] registration failed:', err.message));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <DineInProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </DineInProvider>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
);
