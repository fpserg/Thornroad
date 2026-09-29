// Thornroad service worker — offline-first cache for a small, fixed asset set.
const CACHE = 'thornroad-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/engine.js',
  './js/story.js',
  './js/story.ru.js',
  './js/visuals.js',
  './js/scenes.js',
  './fonts/jacquarda-bastarda-9-latin.woff2',
  './fonts/pixelify-sans-latin.woff2',
  './fonts/pixelify-sans-cyrillic.woff2',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try for the freshest files (bypassing the HTTP cache,
// so a new release never mixes with stale pages or scripts), refresh the
// offline copy on success, and fall back to that copy only when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
  );
});
