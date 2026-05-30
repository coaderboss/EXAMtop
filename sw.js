// Is naam ko ab kabhi change karne ki zarurat nahi hai
const CACHE_NAME = 'examitop-smart-cache';

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Naya SW aate hi turant activate ho jaye
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); // Turant control le le
    // Purane jitne bhi versioned caches the (v1, v2, v3, v4, v5) unko kachre se hata do
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    
    // 1. API aur Database ko kabhi cache mat karo (Hamesha Live Data)
    if (url.includes('firestore.googleapis.com') || url.includes('/api/') || url.includes('identitytoolkit') || url.includes('opentdb.com')) {
        return; 
    }

    // 2. STALE-WHILE-REVALIDATE STRATEGY (The Magic Auto-Update)
    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((cachedResponse) => {
                
                // Background me chupchaap Vercel se latest file laane ka process start karo
                const fetchPromise = fetch(e.request).then((networkResponse) => {
                    // Agar nayi file sahi-salamat mil gayi, toh cache ko silently update kar do
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Agar internet band hai (Offline Mode), toh kuch mat karo, errors hide rakho
                });

                // MAIN LOGIC: 
                // Agar cache me purani file padi hai, toh TURANT de do (Fast Loading).
                // Agar cache khali hai (first time), toh network aane ka wait karo.
                // Background me naya update 'fetchPromise' khud handle kar lega.
                return cachedResponse || fetchPromise;
            });
        })
    );
});