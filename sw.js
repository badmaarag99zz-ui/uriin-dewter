const CACHE_NAME = "uriin-dewter-v2";

const FILES_TO_CACHE = [
"/",
"/index.html",
"/manifest.json",
"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", event => {
event.waitUntil(
caches.open(CACHE_NAME).then(cache => {
return cache.addAll(FILES_TO_CACHE);
})
);

```
self.skipWaiting();
```

});

self.addEventListener("activate", event => {
event.waitUntil(
caches.keys().then(keys => {
return Promise.all(
keys
.filter(key => key !== CACHE_NAME)
.map(key => caches.delete(key))
);
})
);

```
self.clients.claim();
```

});

self.addEventListener("fetch", event => {

```
if (event.request.method !== "GET") {
    return;
}

event.respondWith(
    caches.match(event.request).then(cachedResponse => {

        if (cachedResponse) {
            return cachedResponse;
        }

        return fetch(event.request)
            .then(response => {

                if (
                    response &&
                    response.status === 200 &&
                    response.type !== "opaque"
                ) {
                    const responseClone =
                        response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(
                                event.request,
                                responseClone
                            );
                        });
                }

                return response;

            })
            .catch(() => {

                return caches.match("/index.html");

            });

    })
);
```

});
