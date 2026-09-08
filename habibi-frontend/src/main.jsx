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
