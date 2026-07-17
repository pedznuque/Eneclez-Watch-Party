const CACHE_NAME = "eneclez-watch-party-mobile-v1";
const CACHE_URLS = [
    "/mobile",
    "/mobile/room",
    "/mobile/manifest.webmanifest",
    "/css/style.css",
    "/css/room.css",
    "/js/app.js",
    "/js/room.js",
    "/youtube-player.html"
];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS)));
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
