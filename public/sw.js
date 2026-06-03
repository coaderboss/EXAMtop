// public/sw.js
const CACHE_NAME = 'examitop-next-v1'; // Naya version taaki purana cache delete ho jaye

const urlsToCache = [
  '/',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force new Service Worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName); // Purana kachra saaf
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First strategy (Next.js ke liye best hai)
self.addEventListener('fetch', event => {
  // Ignore API calls or external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then(response => {
        if (response) {
          return response;
        }
        // Agar offline hai aur page nahi mila, toh root return karo
        if (event.request.mode === 'navigate') {
            return caches.match('/');
        }
      });
    })
  );
});