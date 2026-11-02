/**
 * @file Servicio de estados de los mensajes
 * @description Enviado (✓), entregado (✓✓) y visto (✓✓ azul).
 *
 * Cada integrante de una conversación guarda dos punteros en user_conversations:
 *   - last_delivered_message_id: hasta qué mensaje le llegó a su teléfono/navegador
 *   - last_read_message_id: hasta qué mensaje vio con el chat abierto
 * Solo avanzan, nunca retroceden. El estado de cada mensaje se calcula en el cliente
 * comparando su ID con los punteros de los demás integrantes (en un grupo, de todos).
 *
 * Cada cambio se avisa a la sala de la conversación con 'receipts_updated'.
 */

const { Op } = require('sequelize');
const { models } = require('../models');
const logger = require('../utils/logger');
const { userRoom } = require('../utils/socketRooms');

/**
 * Avanza un puntero solo si el nuevo ID es mayor (UPDATE condicional: sin carreras).
 * @returns {Promise<boolean>} true si cambió
 */
const advance = async (field, userId, conversationId, messageId, extra = {}) => {
  if (!messageId) return false;
  const [count] = await models.UserConversation.update(
    { [field]: messageId, ...extra },
    {
      where: {
        user_id: userId,
        conversation_id: conversationId,
        left_at: null,
        [Op.or]: [{ [field]: null }, { [field]: { [Op.lt]: messageId } }],
      },
    }
  );
  return count > 0;
};

const emitReceipts = async (io, userId, conversationId) => {
  if (!io) return;
  const membership = await models.UserConversation.findOne({
    where: { user_id: userId, conversation_id: conversationId },
    attributes: ['user_id', 'last_delivered_message_id', 'last_read_message_id'],
  });
  if (!membership) return;
  io.to(String(conversationId)).emit('receipts_updated', {
    conversationId: Number(conversationId),
    receipt: membership.toJSON(),
  });
};

/**
 * Los mensajes hasta messageId llegaron al dispositivo del usuario
 */
const markDelivered = async (io, userId, conversationId, messageId) => {
  if (await advance('last_delivered_message_id', userId, conversationId, messageId)) {
    await emitReceipts(io, userId, conversationId);
  }
};

/**
 * El usuario vio los mensajes hasta messageId (también quedan entregados)
 */
const markRead = async (io, userId, conversationId, messageId) => {
  const delivered = await advance('last_delivered_message_id', userId, conversationId, messageId);
  const read = await advance('last_read_message_id', userId, conversationId, messageId, { unread_count: 0 });
  if (delivered || read) await emitReceipts(io, userId, conversationId);
};

/**
 * El usuario vio todo lo que hay en la conversación (abrió el chat o volvió a la app con el chat abierto)
 */
const markConversationRead = async (io, userId, conversationId) => {
  const conversation = await models.Conversation.findByPk(conversationId, { attributes: ['last_message_id'] });
  await markRead(io, userId, conversationId, conversation?.last_message_id);
};

/**
 * Al conectarse, le llegan todos los mensajes pendientes de sus conversaciones
 */
const markAllDeliveredOnConnect = async (io, userId) => {
  const memberships = await models.UserConversation.findAll({
    where: { user_id: userId, left_at: null },
    attributes: ['conversation_id'],
    include: [{ model: models.Conversation, as: 'conversation', attributes: ['last_message_id'] }],
  });
  for (const membership of memberships) {
    await markDelivered(io, userId, membership.conversation_id, membership.conversation?.last_message_id);
  }
};

/**
 * Un mensaje nuevo: a quien tiene la app abierta ya le llegó; a quien además tiene
 * ese chat abierto y a la vista, ya lo vio.
 */
const onNewMessage = async ({ io, message }) => {
  if (!io) return;
  const conversationId = message.conversation_id;
  const members = await models.UserConversation.findAll({
    where: { conversation_id: conversationId, left_at: null },
    attributes: ['user_id'],
  });

  for (const { user_id: userId } of members) {
    if (Number(userId) === Number(message.sender_id)) continue;

    const sockets = await io.in(userRoom(userId)).fetchSockets();
    if (!sockets.length) continue;

    const viewing = sockets.some(socket =>
      socket.rooms.has(String(conversationId)) && socket.data.visible !== false
    );
    if (viewing) {
      await markRead(io, userId, conversationId, message.id);
    } else {
      await markDelivered(io, userId, conversationId, message.id);
    }
  }
};

/**
 * Igual que onNewMessage, sin demorar ni hacer fallar el envío del mensaje
 */
const onNewMessageInBackground = (params) => {
  setImmediate(() => {
    onNewMessage(params).catch(error =>
      logger.warn(`⚠️ Error al actualizar estados de mensajes: ${error.message}`)
    );
  });
};

/**
 * Punteros de los integrantes activos, para calcular el estado de cada mensaje al cargar el chat
 * @returns {Promise<Array<{user_id, last_delivered_message_id, last_read_message_id}>>}
 */
const getReceipts = async (conversationId) => {
  const members = await models.UserConversation.findAll({
    where: { conversation_id: conversationId, left_at: null },
    attributes: ['user_id', 'last_delivered_message_id', 'last_read_message_id'],
  });
  return members.map(member => member.toJSON());
};

module.exports = {
  markDelivered,
  markRead,
  markConversationRead,
  markAllDeliveredOnConnect,
  onNewMessage,
  onNewMessageInBackground,
  getReceipts,
};
