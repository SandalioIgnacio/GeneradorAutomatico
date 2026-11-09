/* JeaDas.Insights · Service Worker. Solo guarda la carcasa estática para abrir sin red; nunca toca las llamadas al servidor (POST). */
const CACHE = 'jdi-v2-1';
const SHELL = ['./', 'css/app.css', 'css/splash.css', 'js/app.js', 'favicon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then((resp) => { if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return resp; }).catch(() => caches.match(r).then((m) => m || caches.match('./'))));
});
