/*
 * Playref offline worker. The build fills in VERSION and PRECACHE (see vite.config.ts).
 * - The app itself (page, code, styles, logo, icons) is saved on the first visit, so
 *   Imposter and the common UNO fights open with no signal.
 * - Fonts are hosted with the app, so they are saved too.
 * - /api is never cached: AI questions, feedback and reports always need the network.
 * - Playref-voice clips (/voice/) are saved the first time they play, in their own cache that
 *   app updates keep (a clip's name changes whenever its words do).
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `playref-shell-${VERSION}`;
const VOICE = 'playref-voice-v1';
/** On a weak signal, wait this long for a fresh page before using the saved one. */
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('playref-') && k !== SHELL && k !== VOICE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Fresh page when the network answers in time; otherwise the saved copy. */
async function page(request) {
  const cache = await caches.open(SHELL);
  const fresh = fetch(request).then((res) => {
    if (res.ok) cache.put('/', res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS));
  try {
    const res = await Promise.race([fresh, timeout]);
    if (res) return res;
  } catch {
    // Offline: fall through to the saved page.
  }
  return (await cache.match('/')) || fresh;
}

async function savedFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

/** Voice clips: saved copy first; only full (200) replies are saved, never partial (206) ones. */
async function voiceClip(request) {
  const cache = await caches.open(VOICE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request.url);
  if (res.status === 200) cache.put(request.url, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') return event.respondWith(page(request));
    if (url.pathname.startsWith('/voice/') && !PRECACHE.includes(url.pathname)) return event.respondWith(voiceClip(request));
    if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) return event.respondWith(savedFirst(request, SHELL));
    return event.respondWith(networkFirst(request));
  }
});
