// sw.js - Kamp Günlüğü Service Worker
const CACHE_NAME = 'kamp-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install - Cache dosyaları
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Önbellek açıldı');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('❌ Önbellek hatası:', err))
  );
  self.skipWaiting();
});

// Activate - Eski cache'leri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eski cache silindi:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Offline stratejisi (Cache First)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache'de varsa döndür
        if (response) {
          return response;
        }
        // Yoksa internetten al
        return fetch(event.request)
          .then(response => {
            // Sadece başarılı yanıtları cache'le
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // İnternet yoksa offline sayfası göster
            return caches.match('/offline.html');
          });
      })
  );
});

// Bildirim gönderme (hatırlatıcılar için)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || '/icon.png',
      badge: '/icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: true
    });
  }
});
