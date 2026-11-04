// Keeps the app itself on the device, so the page opens again with no signal.
// Rule: ask the internet first (so a new version always wins). If that fails or is slow, use the copy on the device.
// It never touches the database or the send-message functions: those are handled by the app's own save-and-send queue.
const VERSION = 'msr-app-v1';
const FILES = [
  '/index.html', '/css/styles.css',
  '/vendor/supabase.js', '/vendor/qrcode.js', '/vendor/jsbarcode.min.js', '/vendor/jsqr.js',
  '/js/config.js', '/js/db.js', '/js/util.js', '/js/localdb.js', '/js/messages.js', '/js/ui.js',
  '/js/pages-customer.js', '/js/pages-staff.js', '/js/pages-admin.js', '/js/pages-join.js', '/js/pages-auth.js', '/js/pages-demo.js',
  '/js/live-core.js', '/js/live-customer.js', '/js/live-desk.js', '/js/live-shop.js', '/js/live-admin.js', '/js/live-offline.js', '/js/main.js',
  '/img/fruitbowl-logo-white.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('slow')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;
  const nav = req.mode === 'navigate';
  const key = nav ? '/index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await withTimeout(fetch(nav ? req : req), 4000);
      if (res && res.ok) { cache.put(nav ? '/index.html' : req, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
