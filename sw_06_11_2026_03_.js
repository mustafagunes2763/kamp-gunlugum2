// Kamp Defteri — Service Worker (offline mod + bildirimler)
// Bu dosya index.html ile AYNI klasörde olmalı.
// Kodu değiştirdiğinde SHELL_VERSION'ı artırırsan eski önbellek temizlenir.

const SHELL_VERSION = 'kamp-shell-v1';
const IMG_CACHE = 'kamp-img-v1';
const IMG_LIMIT = 150; // en fazla bu kadar fotoğraf telefonda tutulur

// Uygulamanın internetsiz açılması için gereken dış kütüphaneler
const PRECACHE_URLS = [
  './',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Sadece bu adreslerden gelen dosyalar önbelleğe alınır.
// Firebase'in veri/giriş istekleri (firestore.googleapis.com vb.) ASLA önbelleğe alınmaz.
const ASSET_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const IMG_HOSTS = ['i.ibb.co'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION);
    // Biri başarısız olsa bile diğerleri önbelleğe alınsın
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* internet yoksa sonra çalışırken tamamlanır */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_VERSION, IMG_CACHE];
    for (const key of await caches.keys()) {
      if (!keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

// Sayfanın kendisi: önce internet (güncel sürüm), 4 sn'de cevap yoksa telefondaki kopya
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_VERSION);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res && res.ok) cache.put('./', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('./')) || (await cache.match(request, { ignoreSearch: true })) ||
      new Response('<h1 style="font-family:sans-serif">📴 İnternet yok</h1><p>Uygulamayı bir kez internetle açman gerekiyor.</p>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// Kütüphaneler: telefondaki kopyayı hemen ver, arka planda tazele
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_VERSION);
  const cached = await cache.match(request, { ignoreVary: true });
  const network = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

// Fotoğraflar: bir kez görülen fotoğraf telefonda kalır
async function cacheFirstImage(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(request, res.clone());
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - IMG_LIMIT; i++) await cache.delete(keys[i]);
    }
    return res;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(handleNavigation(request));
  } else if (ASSET_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (IMG_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstImage(request));
  } else if (url.origin === self.location.origin && !url.pathname.endsWith('/sw.js')) {
    event.respondWith(staleWhileRevalidate(request)); // manifest.json, icon.png vb.
  }
  // Diğer her şey (Firebase veri istekleri, ImgBB yükleme vb.) normal internetten gider
});

// --- BİLDİRİMLER ---
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SEND_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(data.title || 'Kamp Defteri', {
        body: data.body || '',
        tag: data.tag || data.title || 'kamp',
        renotify: true,
        vibrate: [200, 100, 200]
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scopeUrl = self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(scopeUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(scopeUrl);
    })
  );
});
