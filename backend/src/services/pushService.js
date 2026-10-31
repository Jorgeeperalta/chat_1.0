/**
 * @file Servicio de notificaciones push (Web Push)
 * @description Avisa de los mensajes nuevos a los teléfonos/navegadores que no tienen la app
 * a la vista (cerrada, en segundo plano o con la pantalla bloqueada). El sistema operativo
 * muestra la notificación con su sonido y vibración aunque la app no esté abierta.
 */

const webpush = require('web-push');
const config = require('../config');
const { models } = require('../models');
const logger = require('../utils/logger');
const { userRoom } = require('../utils/socketRooms');

const MAX_BODY_LENGTH = 120;

// Claves mal copiadas no deben impedir que arranque la app: solo se desactivan las notificaciones
let enabled = false;

if (config.push.publicKey && config.push.privateKey) {
  try {
    webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
    enabled = true;
  } catch (error) {
    logger.error(`❌ Notificaciones push desactivadas: claves VAPID inválidas en el .env (${error.message})`);
  }
} else {
  logger.warn('⚠️ Notificaciones push desactivadas: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el .env');
}

const isEnabled = () => enabled;

const getPublicKey = () => (enabled ? config.push.publicKey : null);

const displayName = (user) =>
  `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Alguien';

const messagePreview = (message) => {
  if (message.message_type === 'audio') return '🎤 Mensaje de voz';
  const text = String(message.content || '').replace(/\s+/g, ' ').trim();
  return text.length > MAX_BODY_LENGTH ? `${text.slice(0, MAX_BODY_LENGTH - 1)}…` : text;
};

/**
 * ¿Tiene el usuario la app a la vista? Entonces ya ve el mensaje y no hace falta push.
 * Cada pestaña/app informa con el evento 'visibility' si está visible; un socket que
 * todavía no informó se considera visible.
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const isAppVisible = async (io, userId) => {
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.some(socket => socket.data.visible !== false);
};

/**
 * Envía una notificación a todos los dispositivos de un usuario.
 * Borra las suscripciones que el navegador dio de baja (respuestas 404/410).
 */
const sendToUser = async (userId, payload) => {
  const subscriptions = await models.PushSubscription.findAll({ where: { user_id: userId } });

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60, urgency: 'high' }
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await subscription.destroy();
      } else {
        logger.warn(`⚠️ No se pudo enviar push al usuario ${userId}: ${error.statusCode || ''} ${error.message}`);
      }
    }
  }));
};

/**
 * Avisa de un mensaje nuevo a los integrantes de la conversación que no tienen la app a la vista.
 * No avisa al remitente, a quien salió del chat ni a quien lo silenció.
 * @param {Object} params
 * @param {import('socket.io').Server} params.io
 * @param {Object} params.message - Mensaje recién creado
 */
const notifyNewMessage = async ({ io, message }) => {
  if (!enabled) return;

  const conversationId = message.conversation_id;
  const [conversation, sender, members] = await Promise.all([
    models.Conversation.findByPk(conversationId, { attributes: ['id', 'type', 'name'] }),
    models.User.findByPk(message.sender_id, { attributes: ['id', 'username', 'first_name', 'last_name'] }),
    models.UserConversation.findAll({
      where: { conversation_id: conversationId, left_at: null, is_muted: false },
      attributes: ['user_id'],
    }),
  ]);
  if (!conversation) return;

  const senderName = displayName(sender);
  const preview = messagePreview(message);
  const isGroup = conversation.type === 'group';

  const recipientIds = members
    .map(member => member.user_id)
    .filter(userId => Number(userId) !== Number(message.sender_id));

  for (const userId of recipientIds) {
    if (await isAppVisible(io, userId)) continue;

    const preferences = await models.UserPreference.findOne({
      where: { user_id: userId },
      attributes: ['notification_sound', 'notification_vibration'],
    });

    await sendToUser(userId, {
      title: isGroup ? conversation.name : senderName,
      body: isGroup ? `${senderName}: ${preview}` : preview,
      // Una notificación por chat: los mensajes nuevos reemplazan a la anterior (y vuelven a sonar)
      tag: `conversation-${conversationId}`,
      url: `/chat/${conversationId}`,
      conversationId,
      silent: preferences?.notification_sound === false,
      vibrate: preferences?.notification_vibration === false ? [] : [200, 100, 200],
    });
  }
};

/**
 * Igual que notifyNewMessage, pero sin esperar ni propagar errores: el envío del mensaje
 * no debe fallar ni demorarse por las notificaciones.
 */
const notifyNewMessageInBackground = (params) => {
  setImmediate(() => {
    notifyNewMessage(params).catch(error =>
      logger.warn(`⚠️ Error al enviar notificaciones push: ${error.message}`)
    );
  });
};

module.exports = {
  isEnabled,
  getPublicKey,
  notifyNewMessage,
  notifyNewMessageInBackground,
};
