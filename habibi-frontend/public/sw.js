/* Habibi Halal Express — app service worker.
 *
 * Exists for two reasons: installability ("Add to Home Screen" requires a
 * fetch handler, and firebase-messaging-sw.js has none), and a usable offline
 * screen instead of the browser's dinosaur.
 *
 * DELIBERATELY CONSERVATIVE. A service worker on a restaurant site can do real
 * damage by being clever, so this one only touches two things:
 *
 *   1. /assets/*  — Vite's content-hashed bundles. The filename changes on
 *      every rebuild, so these are immutable and safe to serve cache-first.
 *   2. navigations — network-first. index.html must NEVER be served from cache:
 *      it is what points at the current hashed bundles, and a stale copy would
 *      request chunks that no longer exist. main.jsx already handles that case
 *      via 'vite:preloadError', and this must not create more of them.
 *
 * Everything else — /api/*, /images/*, fonts, anything cross-origin — is left
 * entirely alone and goes straight to the network. Order status, delivery
 * quotes and menu availability are live data; caching any of it would show
 * customers something that isn't true.
 *
 * Cache version: bump CACHE_VERSION to evict everything on next activate.
 */

const CACHE_VERSION = 'v1';
const ASSET_CACHE = `habibi-assets-${CACHE_VERSION}`;
const SHELL_CACHE = `habibi-shell-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // a missing offline page must not block install
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('habibi-') && k !== ASSET_CACHE && k !== SHELL_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Let the page tell a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever touch our own GETs.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never involve the SW in live data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // ── Navigations: network-first, offline page as the fallback ──────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(r => r || new Response(
          '<h1>Offline</h1><p>Please check your connection.</p>',
          { headers: { 'Content-Type': 'text/html' }, status: 503 }
        ))
      )
    );
    return;
  }

  // ── Hashed build assets: cache-first, they never change under a given name ─
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(hit => {
        if (hit) return hit;
        return fetch(request).then(res => {
          // Only cache a real success; an opaque or error response would
          // poison the cache for a file that is supposed to be immutable.
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else: straight to the network, no SW involvement.
});
