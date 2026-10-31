/* 4AB NET service worker — safe, conservative caching.
 *
 * Rules:
 * - Never cache API responses, admin pages, checkout, cart, or order pages.
 * - Never cache responses marked private/no-store or requests with credentials
 *   that touch sensitive areas.
 * - Navigation falls back to /offline when the network is unavailable.
 * - Static assets use cache-first with a background refresh.
 */

const VERSION = "4abnet-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/logo.svg",
];

const NEVER_CACHE = [
  "/api/",
  "/admin/",
  "/orders/",
  "/checkout",
  "/cart",
  "/_next/data/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isNeverCache(url) {
  // Admin, cart, checkout and order pages are locale-prefixed ("/ar/admin/...").
  // Strip a leading locale segment so the deny list also covers them.
  const path = url.pathname.replace(/^\/(ar|en|tr)(?=\/)/, "");
  return NEVER_CACHE.some((prefix) => path.startsWith(prefix));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/uploads/") ||
    /\.(?:css|js|woff2|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)
  );
}

function isCacheable(response) {
  if (!response || !response.ok) return false;
  const control = (response.headers.get("cache-control") || "").toLowerCase();
  if (control.includes("no-store") || control.includes("private")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCache(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (isCacheable(response)) cache.put(request, response.clone()).catch(() => undefined);
            return response;
          })
          .catch(() => null);
        if (cached) return cached;
        const response = await network;
        return response || new Response("", { status: 504, statusText: "Offline" });
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const response = await fetch(request);
          if (isCacheable(response)) {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return (
            offline ||
            new Response("<!doctype html><title>Offline</title><p>You are offline.</p>", {
              headers: { "content-type": "text/html; charset=utf-8" },
              status: 503,
            })
          );
        }
      })(),
    );
  }
});
