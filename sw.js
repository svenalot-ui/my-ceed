// Offline shell: stale-while-revalidate for our own files. User data lives in IndexedDB, never here.
const CACHE = 'myceed-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  ...['app', 'util', 'db', 'store', 'calc', 'consts', 'icons', 'ui', 'photos', 'charts', 'ocr', 'mechanic', 'demo', 'dataio'].map((n) => `js/${n}.js`),
  ...['common', 'home', 'journal', 'detail', 'entryForm', 'issues', 'stats', 'settings', 'mechanicView'].map((n) => `js/views/${n}.js`)];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
