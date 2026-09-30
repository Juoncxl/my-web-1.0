/* CXL Studio service worker.
 *
 * - Pages: network first, falling back to the last cached app shell offline.
 * - Built assets (/assets/*, hashed) and icons: cache first.
 * - Public Work reads (POST /api/cxl/google with a public action) and public
 *   media: network first / cache first so recently viewed Works open offline.
 * Owner/private data is never stored: only public read actions and
 * scope=public media are cached.
 */
const VERSION = 'cxl-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const DATA_CACHE = `${VERSION}-data`;
const MEDIA_CACHE = `${VERSION}-media`;
const MEDIA_LIMIT = 150;
const DATA_LIMIT = 60;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map(key => cache.delete(key)));
}

async function networkFirst(request, cacheName, cacheKey = request, limit) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
      if (limit) trimCache(cacheName, limit);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    if (limit) trimCache(cacheName, limit);
  }
  return response;
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

function isPublicRead(body) {
  if (!body || typeof body.action !== 'string') return false;
  if (body.action.startsWith('public.')) return true;
  const options = Array.isArray(body.args) ? body.args[0] : null;
  return body.action === 'works.fetch' && Boolean(options && options.publicOnly === true && !options.currentUserId && !options.userId);
}

async function hashText(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function handleGoogleRead(request) {
  const text = await request.clone().text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON: pass through */ }
  if (!isPublicRead(body)) return fetch(request);
  const cacheKey = new Request(`/__cxl-sw/public-read/${await hashText(text)}`);
  return networkFirst(request, DATA_CACHE, cacheKey, DATA_LIMIT);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.origin === self.location.origin && request.method === 'POST' && url.pathname === '/api/cxl/google') {
    event.respondWith(handleGoogleRead(request));
    return;
  }
  if (request.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/') || SHELL_URLS.includes(url.pathname)) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
      return;
    }
    if (url.pathname === '/api/cxl/public-works' || url.pathname.startsWith('/api/cxl/public-work')) {
      event.respondWith(networkFirst(request, DATA_CACHE, request, DATA_LIMIT));
      return;
    }
    if (url.pathname === '/api/cxl/media' && url.searchParams.get('scope') === 'public') {
      event.respondWith(cacheFirst(request, MEDIA_CACHE, MEDIA_LIMIT));
    }
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
