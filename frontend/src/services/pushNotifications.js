/**
 * @file Notificaciones push
 * @description Suscribe este teléfono/navegador a las notificaciones push del servidor, para
 * recibir los mensajes nuevos (con sonido y vibración) aunque la app esté cerrada.
 * El manejo de la notificación en sí está en public/push-sw.js (service worker).
 */

import api from '@/services/api';

// En desarrollo no hay service worker: no esperar para siempre a que esté listo
const SERVICE_WORKER_TIMEOUT_MS = 10000;

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/**
 * En iPhone/iPad las notificaciones push solo funcionan con la app agregada a la pantalla de inicio
 */
export const needsInstallForPush = () => {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return isIos && !isStandalone;
};

/** @returns {'granted'|'denied'|'default'|'unsupported'} */
export const getPushPermission = () => (isPushSupported() ? Notification.permission : 'unsupported');

const getRegistration = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker no disponible')), SERVICE_WORKER_TIMEOUT_MS)),
]);

const base64UrlToUint8Array = (base64Url) => {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
};

const sameKey = (buffer, key) => {
  if (!buffer) return false;
  const current = new Uint8Array(buffer);
  return current.length === key.length && current.every((byte, index) => byte === key[index]);
};

/**
 * Crea (o reutiliza) la suscripción de este dispositivo y la registra en el servidor.
 * Solo funciona si el permiso ya fue concedido.
 * @returns {Promise<boolean>} true si quedó activa
 */
export const syncPushSubscription = async () => {
  if (getPushPermission() !== 'granted') return false;

  const { data } = await api.get('/api/push/public-key');
  if (!data.publicKey) return false; // el servidor no tiene push configurado

  const key = base64UrlToUint8Array(data.publicKey);
  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();

  // Si cambiaron las claves del servidor, la suscripción vieja ya no sirve
  if (subscription && !sameKey(subscription.options?.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
  }

  await api.post('/api/push/subscribe', subscription.toJSON());
  return true;
};

/**
 * Pide permiso al usuario y activa las notificaciones. Debe llamarse desde un toque/clic
 * (iPhone no muestra el pedido de permiso de otra forma).
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export const enablePushNotifications = async () => {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await syncPushSubscription();
  return permission;
};

/**
 * Deja de recibir notificaciones en este dispositivo (p. ej. al cerrar sesión).
 * Debe llamarse con la sesión todavía activa, para avisarle al servidor.
 */
export const disablePushNotifications = async () => {
  if (!isPushSupported()) return;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  } catch (error) {
    console.warn('No se pudieron desactivar las notificaciones push:', error);
  }
};

/**
 * Al tocar una notificación con la app abierta, el service worker pide abrir el chat
 * @param {import('vue-router').Router} router
 */
export const listenForNotificationClicks = (router) => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'open-url') return;
    const url = new URL(event.data.url, window.location.origin);
    if (url.origin === window.location.origin) router.push(url.pathname + url.search);
  });
};
