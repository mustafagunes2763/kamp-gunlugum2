// Kamp Defteri — Service Worker (bildirimler)
// Bu dosya index.html ile AYNI klasörde olmalı.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Sayfadan gelen mesajla bildirim göster (eski sürümlerle uyumluluk için)
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

// Bildirime dokununca uygulamayı aç / öne getir
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
