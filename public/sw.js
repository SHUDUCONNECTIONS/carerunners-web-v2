// Care Runners service worker.
//  - Pages: always from the network (they're personalised and need a login).
//    If the device is offline, show /offline instead of the browser's error.
//  - Static files (icons, logo, built JS/CSS/fonts): cached for speed.
//  - Everything else (API calls, payments, Firebase, Google Maps, Peach) is
//    never touched, so money and live data always go straight to the network.
// Bump VERSION to force every device to refresh its caches.
const VERSION = "v3"
const STATIC_CACHE = `carerunners-static-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/carerunnerlogo.png"]

// In local development file names aren't hashed, so caching built files would
// serve stale code. Only cache them in production.
const isLocal = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith("carerunners-") && k !== STATIC_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // third parties go straight to the network
  if (url.pathname.startsWith("/api/")) return

  // Page navigations: network first, offline page if there's no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    )
    return
  }

  if (isLocal) return

  // Built assets are content-hashed, so they can be cached forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Icons, logo and other images: serve the cached copy, refresh in the background.
  if (request.destination === "image" || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => hit)
  return hit || refresh
}

// ── Push alerts (Firebase Cloud Messaging) ────────────────────────────────────
// The server sends data-only messages ({ title, body, link, tag }), so every browser shows the same notification.
self.addEventListener("push", (event) => {
  let data = {}
  try {
    // FCM delivers data-only messages as { data: {...} }; accept a flat object too.
    const payload = event.data ? event.data.json() : {}
    data = payload.data || payload
  } catch {
    return
  }
  if (!data.title) return
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { link: data.link || "/" },
      // Urgent alerts (a cancelled trip) stay on screen until dismissed and buzz hard. The sound is the phone's own
      // notification sound: web pages can't pick a custom one.
      ...(data.urgent ? { requireInteraction: true, renotify: !!data.tag, vibrate: [300, 150, 300, 150, 600] } : { vibrate: [200] }),
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.link || "/", self.location.origin)
  // Only ever open our own pages, whatever the message says.
  const link = target.origin === self.location.origin ? target.href : self.location.origin
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of windows) {
        if (client.url === link && "focus" in client) return client.focus()
      }
      const existing = windows[0]
      if (existing && "navigate" in existing) {
        await existing.navigate(link)
        return existing.focus()
      }
      return self.clients.openWindow(link)
    })()
  )
})
