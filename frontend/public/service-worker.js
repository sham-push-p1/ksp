const CACHE_NAME = "ksp-crime-intelligence-v1";

// App shell assets to cache immediately on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/ksp_emblem.png",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css",
];

// ─── Install: pre-cache the app shell ─────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing KSP PWA Service Worker…");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[SW] Failed to cache:", url, err)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating and cleaning old caches…");
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first for API, cache-first for assets ─────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API calls and external auth requests
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname === "localhost" && url.port === "3001" ||
    event.request.method !== "GET"
  ) {
    return; // Let it fall through to the network normally
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache hit — return immediately, refresh in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, networkResponse.clone())
              );
            }
            return networkResponse;
          })
          .catch(() => {}); // Silently fail background refresh
        return cachedResponse;
      }

      // Cache miss — fetch from network and cache the result
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, responseToCache)
          );
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback — return the cached index.html for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

// ─── Background sync placeholder for future audit log sync ────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-audit-logs") {
    console.log("[SW] Background sync triggered: audit logs");
    // Future: flush any queued offline audit entries to /api/audit-log
  }
});
