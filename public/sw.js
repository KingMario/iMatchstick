const CACHE_NAME = "imatchstick-pwa-__BUILD_ID__";
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./hurrah.mp3",
  "./matchsticks/empty_h.png",
  "./matchsticks/empty_v.png",
  "./matchsticks/stick_h.png",
  "./matchsticks/stick_s.gif",
  "./matchsticks/stick_v.png",
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
