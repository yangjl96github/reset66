// Reset66 service worker: cache-first for same-origin static assets.
// IMPORTANT: bump CACHE_VERSION whenever PRECACHE contents change.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `reset66-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/version.js',
  './src/store.js',
  './src/persist.js',
  './src/logic/dates.js',
  './src/logic/progress.js',
  './src/logic/streak.js',
  './src/logic/xp.js',
  './src/logic/state.js',
  './src/logic/seed.js',
  './src/logic/schema.js',
  './src/logic/backup.js',
  './src/ui/dom.js',
  './src/ui/format.js',
  './src/ui/habit-form.js',
  './src/ui/onboarding.js',
  './src/ui/today.js',
  './src/ui/habits.js',
  './src/ui/settings.js',
  './src/ui/backup.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Bypass the HTTP cache: hosts like GitHub Pages send max-age=600, and a stale copy
      // stored under the new cache name would mix old and new files.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('reset66-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', cache: CACHE_NAME });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin requests

  // Navigations: serve the cached app shell so the app opens offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
