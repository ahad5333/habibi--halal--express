/* Habibi Halal Express — app service worker.
 *
 * Exists for two reasons: installability ("Add to Home Screen" requires a
 * fetch handler, and firebase-messaging-sw.js has none), and a usable offline
 * screen instead of the browser's dinosaur.
 *
 * A service worker on a restaurant site can do real damage by being clever, so
 * the rule here is: anything that could show a customer something untrue goes
 * to the network, always. What it handles:
 *
 *   1. /assets/*   — Vite's content-hashed bundles. The filename changes on
 *      every rebuild, so these are immutable and safe cache-first.
 *   2. navigations — network-first, so index.html is never stale while online
 *      (it points at the current hashed bundles). The shell is kept purely as
 *      an OFFLINE fallback, cached on the same visit as the assets it refers
 *      to so the two stay in step.
 *   3. /api/menus  — the catalogue (names, prices, photos). Network-first, so
 *      an online customer always sees current prices; the cache is reached
 *      only when the network genuinely fails.
 *   4. /images/*   — menu photos, cache-first and capped, so an offline menu
 *      isn't a wall of broken images.
 *
 * Left strictly alone: every other /api/ route, /socket.io/, and anything
 * cross-origin. Order status, delivery quotes and — most importantly —
 * /api/menus/location-availability are live data. See isCacheableMenuRequest
 * below for why availability is the one part of the menu never cached.
 *
 * Cache version: bump CACHE_VERSION to evict everything on next activate.
 */

const CACHE_VERSION = 'v3';
const ASSET_CACHE = `habibi-assets-${CACHE_VERSION}`;
const SHELL_CACHE = `habibi-shell-${CACHE_VERSION}`;
const MENU_CACHE  = `habibi-menu-${CACHE_VERSION}`;
const IMAGE_CACHE = `habibi-images-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
// Cache key for the SPA shell (index.html). Stored on every successful
// navigation so it stays in step with the hashed assets cached alongside it.
const SHELL_URL   = '/index.html';

// Menu photos cached on demand so an offline menu isn't a wall of broken
// images. public/images is ~391MB in total, so this is capped and trimmed
// oldest-first rather than allowed to grow without limit.
const MAX_IMAGE_ENTRIES = 160;

// The catalogue: item names, descriptions, prices, photos. Changes rarely.
// Cached so the menu is browsable with no connection.
//
// NOT cached, deliberately: /api/menus/location-availability. That is the
// per-location sold-out data, the one part of the menu that is volatile and
// the one part that would actively mislead if served stale. Offline, the app
// simply doesn't know availability and says so, rather than showing yesterday's
// answer as though it were current. The real guarantee sits on the server:
// order creation selects `WHERE is_available = TRUE FOR UPDATE` and refuses
// with "One or more items just sold out" — so a cart built offline from cached
// data can never actually place an order for something unavailable.
function isCacheableMenuRequest(url) {
  if (!url.pathname.startsWith('/api/menus')) return false;
  if (url.pathname.includes('location-availability')) return false;
  return true;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache keys come back in insertion order, so the oldest are first.
  await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
}

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
      .then(keys => {
        const keep = new Set([ASSET_CACHE, SHELL_CACHE, MENU_CACHE, IMAGE_CACHE]);
        return Promise.all(
          keys.filter(k => k.startsWith('habibi-') && !keep.has(k)).map(k => caches.delete(k))
        );
      })
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

  // ── The menu catalogue: network-first, cache as a fallback ────────────────
  // Network-first (not stale-while-revalidate) on purpose: an online customer
  // must always see current prices, so the cache is only ever reached when the
  // network genuinely fails. The cost is no speed-up online; prices are money,
  // so correctness wins.
  if (isCacheableMenuRequest(url)) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(MENU_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || Response.error()))
    );
    return;
  }

  // Never involve the SW in any other live data — orders, quotes, availability.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // ── Menu photos: cache-first, capped ──────────────────────────────────────
  // Safe to serve from cache because this project's convention is to give a
  // changed image a NEW filename ("-v2", "-fixed") rather than overwrite one
  // in place — the same assumption deploy.sh's path-only image sync relies on.
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(request).then(hit => {
        if (hit) return hit;
        return fetch(request).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(IMAGE_CACHE)
              .then(c => c.put(request, copy))
              .then(() => trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES))
              .catch(() => {});
          }
          return res;
        }).catch(() => hit || Response.error());
      })
    );
    return;
  }

  // ── Navigations: network-first, then the cached app shell, then offline ───
  // Always the network when there is one, so index.html is never stale while
  // online -- it is what points at the current hashed bundles.
  //
  // The shell IS kept as an offline fallback, though, and stored on the same
  // visit as the assets it references, so the two stay consistent: falling
  // straight through to offline.html would mean the app could never boot
  // without a network, which defeats offline menu browsing entirely. If a
  // chunk is genuinely missing, main.jsx's vite:preloadError handler reloads
  // once (sessionStorage-guarded, so it cannot loop).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(SHELL_URL, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(SHELL_URL)
            .then(shell => shell || caches.match(OFFLINE_URL))
            .then(r => r || new Response(
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
