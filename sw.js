const CACHE = 'shikaku-v2';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/generator.js',
  './js/solver.js',
  './js/state.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for everything: try the network, update cache, fall back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache same-origin successful responses for the shell.
        const url = new URL(req.url);
        if (
          res &&
          res.status === 200 &&
          url.origin === self.location.origin
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
