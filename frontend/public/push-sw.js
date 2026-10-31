/**
 * Notificaciones push: se carga dentro del service worker generado por vite-plugin-pwa
 * (workbox.importScripts en vite.config.js). Corre aunque la app esté cerrada.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Converxa';
  const options = {
    body: data.body || 'Tienes un mensaje nuevo',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    tag: data.tag || 'converxa',
    // Aunque reemplace a la notificación anterior del mismo chat, vuelve a sonar y vibrar
    renotify: true,
    silent: data.silent === true,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || '/home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: abrir (o enfocar) la app en ese chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/home', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appWindow = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (appWindow) {
      // La app abre el chat con su router (sin recargar): ver services/pushNotifications.js
      appWindow.postMessage({ type: 'open-url', url });
      await appWindow.focus();
      return;
    }
    await self.clients.openWindow(url);
  })());
});
