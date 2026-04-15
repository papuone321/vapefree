const CACHE_NAME = 'novape-v1';
const ASSETS = [
  './no_vape_completo.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ── INSTALL: cachea los assets al instalar ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.filter(a => !a.endsWith('.png')));
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: elimina caches viejos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: responde desde cache si está disponible ──
   Estrategia: Cache First para assets, Network First para el resto */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Solo maneja requests del mismo origen */
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        /* Devuelve cache y actualiza en background (stale-while-revalidate) */
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached;
      }

      /* No está en cache: fetch normal, guarda si es exitoso */
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        /* Offline y no en cache: devuelve la app principal */
        if (event.request.destination === 'document') {
          return caches.match('./no_vape_completo.html');
        }
      });
    })
  );
});

/* ── SYNC EN BACKGROUND (futuro) ──
   Cuando haya conexión después de estar offline,
   se puede usar Background Sync para sincronizar datos */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-novape') {
    console.log('[SW] Background sync triggered');
  }
});

/* ── NOTIFICACIONES PUSH (futuro) ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'No Vape';
  const options = {
    body: data.body || '¡Sigue así! Cada día sin vapear cuenta.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './no_vape_completo.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './no_vape_completo.html')
  );
});
