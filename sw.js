// sw.js - Kamp Günlüğü Service Worker (Offline Destek)

const CACHE_NAME = 'kamp-v1';
const OFFLINE_URL = 'index-11.html'; // Senin ana dosyanın adı bu!

// Cache'lenecek dosyalar (internet olsa da olmasa da çalışmasını istediklerin)
const urlsToCache = [
  '/',
  '/index-11.html',
  '/manifest.json',
  // Fontlar ve kütüphaneler (internet olsa da cache'den alsın diye)
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/theme-change@2.0.2/index.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// 1. KURULUM: Dosyaları cache'le
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Cache açıldı, dosyalar kaydediliyor...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Kurulum tamam, beklemeyi bırak!');
        return self.skipWaiting(); // Hemen aktif ol
      })
  );
});

// 2. AKTİFLEŞME: Eski cache'leri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Şimdi aktif!');
      return self.clients.claim();
    })
  );
});

// 3. İSTEKLERİ YAKALA: Önce cache'e bak, yoksa internetten al
self.addEventListener('fetch', (event) => {
  // Sadece GET isteklerini işle
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache'de varsa oradan ver (SÜPER HIZLI!)
        if (response) {
          return response;
        }

        // Cache'de yoksa internetten al ve cache'le
        return fetch(event.request)
          .then((response) => {
            // Başarılı yanıtı cache'le
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  try {
                    cache.put(event.request, responseToCache);
                  } catch (e) {
                    // Bazı dosyalar cache'lenemez (örnek: videolar)
                  }
                });
            }
            return response;
          })
          .catch(() => {
            // İnternet yok ve cache'de yoksa offline sayfası göster
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


// sw.js - Service Worker

self.addEventListener('install', (event) => {
  console.log('[SW] Yükleniyor...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Aktif!');
  event.waitUntil(clients.claim());
});

// 📢 BİLDİRİM GÖNDERME FONKSİYONU
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

// Bildirime tıklanınca
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
