// TravelMate Service Worker v2.0
const CACHE_NAME = 'travelmate-v6';

// Auto-detect base path from SW location
// GitHub Pages: /TravelMate/sw.js  → BASE = /TravelMate/
// Custom domain: /sw.js            → BASE = /
const BASE = self.location.pathname.replace(/sw\.js$/, '');

// Only cache files we KNOW exist locally
const ASSETS = [
  BASE,                        // root path → serves index.html
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'sw.js'
  // logo.png is a remote GitHub URL — not cached locally
];

// Install — fetch and cache each asset, skip any that 404
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(
      ASSETS.map(async url => {
        try {
          const res = await fetch(url, {cache: 'reload'});
          if (res.ok) await cache.put(url, res);
          else console.log('[SW] Skipped (not ok):', url, res.status);
        } catch(err) {
          console.log('[SW] Skipped (fetch failed):', url);
        }
      })
    );
  })());
  self.skipWaiting();
});

// Activate — wipe old caches
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Fetch — network-first for external, cache-first for local
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  const isExternal = url.hostname !== self.location.hostname;

  // External requests (Firebase, EmailJS, fonts, CDN) → always network, never intercept
  if (isExternal) return;

  e.respondWith((async () => {
    // Try cache first
    const cached = await caches.match(e.request);
    if (cached) return cached;

    // Try network
    try {
      const res = await fetch(e.request);
      if (res && res.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch {
      // Offline fallback — serve index.html for page navigations
      if (e.request.mode === 'navigate') {
        const fallback = await caches.match(BASE + 'index.html');
        if (fallback) return fallback;
      }
      return new Response('Offline', {status: 503});
    }
  })());
});
