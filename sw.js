/* Tunemail - service worker
 *
 * Bump CACHE_VERSION on every deploy that changes the precached files below,
 * otherwise returning visitors keep the old shell until the cache is evicted.
 */
const CACHE_VERSION = 'v90';
const CACHE_NAME = `tunemail-${CACHE_VERSION}`;

/* Same-origin shell. Without any one of these the page cannot render, so a
 * single failure fails the whole install and the browser retries later, rather
 * than leaving a half-filled cache behind. */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  // The boot splash paints before anything else, so the mark has to be in the
  // shell rather than fetched at that moment - a cold offline launch would
  // otherwise show the wordmark with a hole beside it.
  './icons/mark-96.png',
  './privacy.html',
  './fonts/bebas-neue-latin.woff2',
  './fonts/bebas-neue-latin-ext.woff2',
  './fonts/dm-sans-latin.woff2',
  './fonts/dm-sans-latin-ext.woff2',
];

/* Cross-origin code the page needs to boot. NOT the same criticality as the
 * shell, despite what this comment used to claim: these come from somebody
 * else's CDN, and letting their bad minute cost us the entire offline cache was
 * the defect. Cached when they arrive, skipped when they do not. */
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

    /* SHELL is all-or-nothing, because a half-filled shell is worse than none.
     * VENDOR is NOT, and that split is the fix: both lists used to be in one
     * Promise.all, so a jsdelivr hiccup threw, the install failed, and NOTHING
     * was cached - not even our own files, which had already arrived. One CDN
     * having a bad minute meant no offline app at all. */
    const shell = await Promise.all(
      SHELL.map(async (url) => {
        const res = await fetch(url, { cache: 'reload', credentials: 'omit' });
        if (!res.ok) throw new Error(`${res.status} for ${url}`);
        return [url, res];
      })
    );
    for (const [url, res] of shell) await put(cache, url, res);

    /* Best effort. A missing vendor file means the runtime handler fetches it
     * on first use, which is what happens today anyway on a cold visit. */
    await Promise.all(
      VENDOR.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'reload', credentials: 'omit' });
          if (res.ok) await put(cache, url, res);
        } catch (e) { /* the shell is already safe; this is a bonus */ }
      })
    );

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
    //
    // The race is the other half of that. Without it this waits on the network
    // for as long as the network cares to take, and the cached shell below is
    // reached only when the request FAILS - never when it merely hangs. That is
    // the exact defect already written up in the portfolio notes for Cinemail:
    // measured there at 1501 ms against 0 ms. A hotel wi-fi that accepts
    // connections and answers nothing is the common case, and it is the one
    // this handler used to be worst at.
    const res = await Promise.race([
      fetch(request, { cache: 'reload' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500)),
    ]);
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
