/* Tunemail - service worker
 *
 * Bump CACHE_VERSION on every deploy that changes the precached files below,
 * otherwise returning visitors keep the old shell until the cache is evicted.
 */
const CACHE_VERSION = 'v64';
const CACHE_NAME = `tunemail-${CACHE_VERSION}`;

/* Same-origin shell. Without any one of these the page cannot render, so these
 * go through addAll: if a single request fails the whole install fails and the
 * browser retries later, instead of leaving a half-filled cache behind. */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './privacy.html',
  './fonts/bebas-neue-latin.woff2',
  './fonts/bebas-neue-latin-ext.woff2',
  './fonts/dm-sans-latin.woff2',
  './fonts/dm-sans-latin-ext.woff2',
];

/* Cross-origin code the page needs to boot. Same criticality as the shell. */
const VENDOR = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
];

/* Hosts whose GET responses we keep in the cache as we see them. */
const RUNTIME_HOSTS = new Set([
  'cdn.jsdelivr.net',
]);

/* cache.put refuses a redirected response, and jsdelivr redirects version
 * ranges to a pinned file. Rebuild the response so the body is stored under
 * the URL the page will actually ask for. */
async function put(cache, request, response) {
  if (!response || !response.ok) return false;
  const body = await response.blob();
  await cache.put(request, new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }));
  return true;
}

/* Fetch everything first, put nothing until all of it arrived. This keeps the
 * all-or-nothing property cache.addAll had - a half-filled shell is worse than
 * no shell - while forcing `cache: 'reload'` on every request, which addAll
 * cannot do.
 *
 * That flag is the whole point. GitHub Pages serves index.html with
 * `cache-control: max-age=600`, and the HTTP cache sits UNDERNEATH the service
 * worker: a plain fetch() inside a worker is answered from it without the
 * network being touched at all. So a new worker would install, activate, clear
 * the old caches - and refill them with the same ten-minute-old HTML it was
 * meant to replace. Measured: the page ran build v56 while sw.js was already
 * v57 and the server was serving v57 to curl. */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const fetched = await Promise.all(
      [...SHELL, ...VENDOR].map(async (url) => {
        const res = await fetch(url, { cache: 'reload', credentials: 'omit' });
        if (!res.ok) throw new Error(`${res.status} for ${url}`);
        return [url, res];
      })
    );
    for (const [url, res] of fetched) await put(cache, url, res);
    await self.skipWaiting();
  })());
});

/* So the page can ask which build is actually serving it, instead of that
 * being unanswerable from the outside. */
self.addEventListener('message', (event) => {
  if (event.data === 'version') {
    event.source?.postMessage({ swBuild: CACHE_VERSION });
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => (n.startsWith('music-night-') || n.startsWith('tunemail-')) && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* Serve from cache, and refresh the entry in the background for next time. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request, { ignoreVary: true });

  const network = fetch(request)
    .then(async (res) => {
      await put(cache, request, res.clone());
      return res;
    })
    .catch(() => null);

  if (hit) return hit;

  const res = await network;
  if (res) return res;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

/* The click on the home-screen icon arrives here. Network first so a deployed
 * update shows up immediately, cached shell when there is no network. */
async function navigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // 'reload' skips the HTTP cache on the way out. Without it "network first"
    // is a lie: max-age=600 on the HTML means the browser answers this from its
    // own cache for ten minutes and the network is never reached.
    const res = await fetch(request, { cache: 'reload' });
    if (res.ok) await put(cache, './index.html', res.clone());
    return res;
  } catch (err) {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./')) ||
      new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin || RUNTIME_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  /* Everything else - Supabase, the workers, album art from the streaming
   * CDNs - goes straight to the network untouched. */
});
