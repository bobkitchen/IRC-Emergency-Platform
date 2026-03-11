const CACHE_NAME = 'ern-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache SPA shell only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything
// Vite content-hashed filenames handle cache busting for JS/CSS.
// Only fall back to cache for SPA navigation (index.html).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, and external services
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname === 'api.anthropic.com') return;
  if (url.hostname === 'openrouter.ai') return;

  // SPA navigation: network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // All other assets: network-first, no caching of stale assets
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
