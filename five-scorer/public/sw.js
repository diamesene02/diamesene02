// Minimal Service Worker for Five Scorer.
//
// Goals:
//   - The app shell loads on Android even with no WiFi.
//   - Icons/static chunks never re-hit the network unnecessarily.
//   - API mutations DO hit the network (the sync worker handles retries).
//   - API reads fall back to cache when offline so history/scorers still
//     render something.
//
// Strategy summary:
//   - Navigation (HTML):   network-first, cache fallback to "/"  (app shell)
//   - Next static chunks:  cache-first (they're content-hashed)
//   - Icons + manifest:    cache-first
//   - /api/*:              network-first, cache fallback for GET only
//
// Bump CACHE_VERSION when you want to evict the old cache (e.g. you changed
// this SW or the shell pages substantially).

const CACHE_VERSION = "v1";
const SHELL_CACHE = `fs-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fs-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic — if any URL fails we bail and try again next install.
      await cache.addAll(SHELL_ASSETS).catch(() => {
        // Best-effort: don't block install if e.g. "/" is protected
        // behind the PIN middleware the first time.
      });
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isNextStatic(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isIconOrManifest(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirstForPage(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Last-resort app shell
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response("Hors ligne", { status: 503 });
  }
}

async function networkFirstForApiGet(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin.
  if (url.origin !== self.location.origin) return;

  // Never cache/handle non-GET. Mutations go to the network, and when offline
  // the client code never issues them (the sync worker is the one that does).
  if (req.method !== "GET") return;

  if (isNextStatic(url) || isIconOrManifest(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstForApiGet(req));
    return;
  }

  // Page navigations + everything else.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirstForPage(req));
    return;
  }
});
