const CACHE_VERSION = 'partyhub-v4';
const STATIC_CACHE = 'partyhub-static-v4';
const FONT_CACHE = 'partyhub-fonts-v1';
const BASE = '/partyhub/';

// Install: skip waiting immediately to take over
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: delete ALL old caches, then claim clients and force reload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
     .then(() => self.clients.matchAll()).then((clients) => {
       clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
     })
  );
});

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Skip Firebase & external API — always network
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebasedatabase.app') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // Google Fonts: Cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Navigation: Network-first, fallback to network only (no stale HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match(BASE + 'index.html')))
    );
    return;
  }

  // Static assets: Network-first with cache fallback
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.open(STATIC_CACHE).then((cache) => cache.match(event.request)))
    );
    return;
  }
});
