const CACHE_NAME = "imatchstick-pwa-__BUILD_ID__";
const APP_SHELL = [
  "./",
  "./manifest.webmanifest?v=b8307a0197bc",
  "./splash.png",
  "./icons/apple-touch-icon.png?v=b1b6f8fdf668",
  "./icons/icon-192.png?v=428202c66386",
  "./icons/icon-512.png?v=c33d4ddfe9d5",
  "./icons/favicon-16.png?v=36ca601da2a9",
  "./icons/favicon-32.png?v=0a7aa922a96b",
  "./icons/favicon-48.png?v=8e4d857d9034",
  "./icons/favicon.ico?v=1f17e484b41f",
  "./icons/icon-maskable-512.png?v=922c9a38d081",
  "./hurrah.mp3",
  "./matchsticks/empty_h.png",
  "./matchsticks/empty_v.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
  if (event.data?.type === "BUILD_ID")
    event.ports[0]?.postMessage("__BUILD_ID__");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("imatchstick-pwa-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.endsWith("/version.json")
  )
    return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./"));
    }),
  );
});
