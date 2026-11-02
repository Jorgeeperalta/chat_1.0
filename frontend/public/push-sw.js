/**
 * Notificaciones push: se carga dentro del service worker generado por vite-plugin-pwa
 * (workbox.importScripts en vite.config.js). Corre aunque la app esté cerrada.
 */

// Textos en el idioma del teléfono (los mismos idiomas que la app)
const TEXTS = {
  es: { newMessage: 'Tienes un mensaje nuevo', audio: 'Mensaje de voz', image: 'Foto', video: 'Video', file: 'Archivo' },
  en: { newMessage: 'You have a new message', audio: 'Voice message', image: 'Photo', video: 'Video', file: 'File' },
  pt: { newMessage: 'Você tem uma nova mensagem', audio: 'Mensagem de voz', image: 'Foto', video: 'Vídeo', file: 'Arquivo' },
  fr: { newMessage: 'Vous avez un nouveau message', audio: 'Message vocal', image: 'Photo', video: 'Vidéo', file: 'Fichier' },
  de: { newMessage: 'Du hast eine neue Nachricht', audio: 'Sprachnachricht', image: 'Foto', video: 'Video', file: 'Datei' },
  it: { newMessage: 'Hai un nuovo messaggio', audio: 'Messaggio vocale', image: 'Foto', video: 'Video', file: 'File' },
};
const ICONS = { audio: '🎤', image: '📷', video: '🎥', file: '📎' };
const text = (key) => {
  const language = String(self.navigator?.language || 'en').toLowerCase().split('-')[0];
  return (TEXTS[language] || TEXTS.en)[key];
};

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Converxar';
  // Voz, foto, video o archivo: se nombra en el idioma del teléfono (y se suma el texto, si tiene)
  const media = ICONS[data.kind] && `${ICONS[data.kind]} ${data.caption || text(data.kind)}`;
  const body = media ? `${data.sender ? `${data.sender}: ` : ''}${media}` : data.body;
  const options = {
    body: body || text('newMessage'),
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    tag: data.tag || 'converxar',
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
