import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// See habibi-frontend/src/main.jsx for the full explanation -- reload once
// on a genuinely-missing lazy-loaded chunk instead of showing a broken
// screen, guarded so a truly broken deploy can't reload-loop forever.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'habibi_admin_preload_reload_once';
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch (_) { /* private mode etc -- reload anyway, just without the guard */ }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
