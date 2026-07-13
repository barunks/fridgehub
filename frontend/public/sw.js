/// <reference lib="webworker" />

const CACHE_NAME = 'familyhub-v1'
const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.json']

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self))

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => sw.skipWaiting())
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => sw.clients.claim())
  )
})

sw.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // API requests may contain authenticated family data; never cache them.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response('{"error":{"detail":"Offline","code":"offline"}}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
    )
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg'))) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    }).catch(() => caches.match('/index.html'))
  )
})
