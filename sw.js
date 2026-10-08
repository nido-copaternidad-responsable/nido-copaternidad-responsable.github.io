/* Nido · service worker: abre al instante con la copia guardada y la actualiza en segundo plano */
const V = 'nido-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
async function avisar() {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ type: 'nueva-version' }));
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; /* Firebase, fuentes y demás pasan directo */
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    const red = fetch(r).then(res => {
      if (res && res.ok) {
        const cp = res.clone();
        caches.open(V).then(c => c.put(r, cp));
        const nuevo = res.headers.get('etag') || res.headers.get('last-modified');
        const viejo = hit && (hit.headers.get('etag') || hit.headers.get('last-modified'));
        if (hit && nuevo && viejo && nuevo !== viejo && (r.mode === 'navigate' || /index\.html$|\/$/.test(u.pathname))) avisar();
      }
      return res;
    }).catch(() => hit || caches.match('./index.html'));
    if (r.mode === 'navigate' || /index\.html$|\/$/.test(u.pathname)) {
      /* la página: primero la versión nueva (hasta 2,5 s); si no hay red, la guardada */
      return Promise.race([red, new Promise(ok => setTimeout(() => ok(hit), 2500))]).then(x => x || hit || red);
    }
    return hit || red;
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data || {}).tab;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs[0];
    if (c) { c.focus(); if (tab) c.postMessage({ type: 'abrir', tab }); return; }
    return self.clients.openWindow('./');
  }));
});
