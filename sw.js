const CACHE_NAME = 'examitop-store-v2';

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Naya SW aate hi purane ko hata dega
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([
            '/',
            '/index.html',
            '/css/exam_v2.css' // Nayi CSS file ka naam
        ]))
    );
});

self.addEventListener('activate', (e) => {
    // Purane kachre (caches) ko delete karne ka logic
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Smart Fetch: Pehle internet se nayi file laane ki koshish karega
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Agar internet chal raha hai toh nayi file cache me update kar dega
                const resClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
                return response;
            })
            .catch(() => {
                // Agar internet band hai toh purani saved file dikhayega
                return caches.match(e.request);
            })
    );
});