self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('examitop-store').then((cache) => cache.addAll([
            '/',
            '/index.html',
            '/css/exam.css'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});