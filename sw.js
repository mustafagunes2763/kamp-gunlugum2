// sw.js - Kamp Günlüğü Service Worker (Offline + Bildirim)

const CACHE_NAME = 'kamp-v1';
const OFFLINE_URL = 'index-11.html';

// Cache'lenecek dosyalar
const urlsToCache = [
  '/',
  '/index-11.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/theme-change@2.0.2/index.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ============================================
// 1. KURULUM
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Yükleniyor...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Dosyalar cache\'leniyor...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Kurulum tamam!');
        return self.skipWaiting();
      })
  );
});

// ============================================
// 2. AKTİFLEŞME
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Aktif!');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Aktifleşti, claim ediliyor...');
      return self.clients.claim();
    })
  );
});

// ============================================
// 3. İSTEKLERİ YAKALA (OFFLINE DESTEK)
// ============================================
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                try {
                  cache.put(event.request, responseToCache);
                } catch (e) {}
              });
            }
            return response;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('Offline - Bağlantı yok', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// ============================================
// 4. BİLDİRİM GÖNDERME (MESAJ AL)
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    const { title, body, icon } = event.data;
    
    self.registration.showNotification(title, {
      body: body,
      icon: icon || 'icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'kampgunlugu_' + Date.now()
    })
    .then(() => {
      console.log('[SW] ✅ Bildirim gönderildi:', title);
    })
    .catch((err) => {
      console.error('[SW] ❌ Bildirim hatası:', err);
    });
  }
});

// ============================================
// 5. BİLDİRİME TIKLANINCA
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Bildirime tıklandı!');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
