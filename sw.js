// BballData offline mode. The app's files are kept on the device. With a signal, the newest version is
// fetched first (waiting at most a few seconds, so a weak gym signal never blocks the app); without a
// signal, the kept copy opens. Only this site's own files are handled: Google, YouTube and everything
// else go to the network untouched.
const BUILD = 'b5c4fe6f82f4';
const CACHE = 'bballdata-' + BUILD;
const FILES = ['index.html', 'connect.html', 'addon.js', 'qrcode.js', 'manifest.webmanifest',
  'club-192.png', 'club-512.png', 'club-maskable-512.png', 'apple-touch-icon.png', 'favicon.svg', 'favicon-32.png'];
const WAIT_MS = 4000;

const scope = () => new URL(self.registration.scope);
const keyFor = (url) => {
  const u = new URL(url);
  u.search = ''; u.hash = '';
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  return u.href;
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((f) => new Request(new URL(f, scope()).href, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('bballdata-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope().pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;

  const key = keyFor(req.url);
  // the network copy, kept for next time when it arrives (even if the kept copy was shown meanwhile)
  let keeping = Promise.resolve();
  const fresh = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      keeping = caches.open(CACHE).then((c) => c.put(key, copy));
    }
    return res;
  });
  event.waitUntil(fresh.then(() => keeping).catch(() => undefined));

  event.respondWith((async () => {
    const kept = await caches.match(key);
    if (!kept) return fresh;
    const late = new Promise((resolve) => setTimeout(() => resolve(kept), WAIT_MS));
    try {
      const res = await Promise.race([fresh, late]);
      return res.ok ? res : kept;
    } catch {
      return kept;
    }
  })());
});
