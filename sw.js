const CACHE_NAME = "uriin-dewter-v3";

const FILES_TO_CACHE = [
    "/",
    "/index.html",
    "/manifest.json"
];

// Install
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys
                        .filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {
                        if (
                            networkResponse &&
                            networkResponse.status === 200
                        ) {
                            const responseClone = networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(
                                        event.request,
                                        responseClone
                                    );
                                });
                        }

                        return networkResponse;
                    });
            })
            .catch(() => {
                return caches.match("/index.html");
            })
    );
});
