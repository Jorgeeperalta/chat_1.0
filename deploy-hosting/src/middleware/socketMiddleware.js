/**
 * @file Middleware de Socket.io
 * @description Middleware para autenticación y manejo de eventos WebSocket
 * @author Arquitecto de Software Senior
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { models } = require('../models');
const translationService = require('../services/translationService');
const storageService = require('../services/storageService');

// Extensión del archivo según el tipo MIME del audio grabado
const AUDIO_EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
};

/**
 * @typedef {Object} SocketWithUser
 * @property {number} userId - ID del usuario
 * @property {Object} user - Usuario
 * @property {string} sessionId - ID de la sesión
 */

/**
 * Autentica un socket usando el token JWT
 * @param {Object} socket - Socket
 * @param {Function} next - Next function
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Obtener token del query string o headers
    let token = socket.handshake.query.token || socket.handshake.headers.authorization;
    
    if (!token) {
      return next(new Error('Token de autenticación no proporcionado'));
    }

    // Eliminar prefijo 'Bearer '
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    // Verificar token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
      }, (error, decoded) => {
        if (error) reject(error);
        else resolve(decoded);
      });
    });

    // Verificar que el usuario existe
    const user = await models.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user || !user.is_active) {
      return next(new Error('Usuario no válido'));
    }

    // Guardar información en el socket
    socket.userId = user.id;
    socket.user = user.toJSON();
    socket.sessionId = socket.handshake.query.sessionId || null;

    // Guardar sesión de usuario
    if (socket.sessionId) {
      await models.UserSession.upsertSession(
        user.id,
        socket.sessionId,
        {
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          socketId: socket.id,
        }
      );
    }

    logger.info(`✅ Socket autenticado: ${socket.id} (User: ${user.id})`);
    next();
  } catch (error) {
    logger.error(`❌ Error de autenticación en socket: ${error.message}`);
    next(new Error('Token de autenticación inválido'));
  }
};

/**
 * Maneja el evento 'join' (unirse a una conversación)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del evento
 */
const handleJoin = async (socket, data, acknowledge) => {
  let joinAcknowledged = false;
  try {
    const { conversationId } = data;

    if (!conversationId) {
      throw new Error('conversationId es requerido');
    }

    // Verificar que el usuario es miembro de la conversación
    const isMember = await models.UserConversation.isMember(
      socket.userId,
      conversationId
    );

    if (!isMember) {
      throw new Error('No eres miembro de esta conversación');
    }

    // Unirse a la sala de Socket.io
    const conversationRoom = String(conversationId);
    await socket.join(conversationRoom);
    acknowledge?.({ success: true, conversationId });
    joinAcknowledged = true;
    logger.info(`📡 Socket ${socket.id} unido a sala ${conversationRoom}`);

    // Actualizar socket_id en la relación usuario-conversación
    await models.UserConversation.update(
      { last_read_message_id: null },
      { where: { user_id: socket.userId, conversation_id: conversationId } }
    );

    // Notificar a otros usuarios
    socket.to(conversationRoom).emit('user_joined', {
      userId: socket.userId,
      username: socket.user.username,
      conversationId,
    });

    // Devolver las conversaciones del usuario
    const { conversations } = await models.Conversation.findUserConversations(
      socket.userId,
      { limit: 100 }
    );

    socket.emit('joined', {
      success: true,
      conversationId,
      conversations,
    });

    logger.info(`👥 Usuario ${socket.userId} se unió a la conversación ${conversationId}`);
  } catch (error) {
    logger.error(`❌ Error al unir usuario ${socket.userId} a conversación ${data.conversationId}:`, error.message);
    if (!joinAcknowledged) {
      socket.emit('join_error', { error: error.message });
      acknowledge?.({ error: error.message });
    }
  }
};

/**
 * Maneja el evento 'leave' (abandonar una conversación)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del evento
 */
const handleLeave = async (socket, data) => {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      throw new Error('conversationId es requerido');
    }

    // Salir de la sala de Socket.io
    const conversationRoom = String(conversationId);
    socket.leave(conversationRoom);

    // Notificar a otros usuarios
    socket.to(conversationRoom).emit('user_left', {
      userId: socket.userId,
      username: socket.user.username,
      conversationId,
    });

    logger.info(`👋 Usuario ${socket.userId} abandonó la conversación ${conversationId}`);
  } catch (error) {
    logger.error(`❌ Error al abandonar conversación ${data.conversationId}:`, error.message);
  }
};

/**
 * Maneja el evento 'text_message' (mensaje de texto)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del mensaje
 * @param {Object} io - Instancia de Socket.io
 */
const handleTextMessage = async (socket, data, io, acknowledge) => {
  try {
    const { conversationId, content, languageCode, clientMessageId } = data;

    if (!conversationId || !content) {
      throw new Error('conversationId y content son requeridos');
    }

    // Verificar que el usuario es miembro de la conversación
    const isMember = await models.UserConversation.isMember(
      socket.userId,
      conversationId
    );

    if (!isMember) {
      throw new Error('No eres miembro de esta conversación');
    }

    // Obtener el idioma nativo del usuario
    const user = await models.User.findByPk(socket.userId, {
      include: [{ model: models.Language, as: 'nativeLanguage' }],
    });

    const originalLanguageCode = languageCode || (user?.nativeLanguage?.code || 'es');
    const originalLanguage = await models.Language.findByCode(originalLanguageCode);

    // Crear el mensaje
    const message = await models.Message.createTextMessage({
      conversationId,
      senderId: socket.userId,
      content,
      originalLanguageId: originalLanguage?.id,
      translationStatus: 'pending',
    });

    // Obtener los participantes de la conversación
    const participants = await models.UserConversation.findAll({
      where: { conversation_id: conversationId },
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'username', 'preferred_language_id', 'native_language_id'],
        },
      ],
    });

    const fullMessage = await models.Message.findByIdWithDetails(message.id);
    for (const participant of participants) {
      if (participant.user.id !== socket.userId) {
        await models.UserConversation.incrementUnreadCount(participant.user.id, conversationId);
      }
    }

    io.to(String(conversationId)).emit('new_text_message', {
      message: fullMessage,
      clientMessageId,
      sender: {
        id: socket.userId,
        username: socket.user.username,
        avatar: socket.user.avatar_url,
      },
      conversationId,
    });
    socket.emit('message_sent', { success: true, messageId: message.id, clientMessageId, conversationId });
    acknowledge?.({ success: true, messageId: message.id, clientMessageId });

    logger.info(`💬 Mensaje de texto enviado por ${socket.userId} en ${conversationId}`);

    // Procesar traducciones para cada participante
    for (const participant of participants) {
      if (participant.user.id === socket.userId) continue; // Saltar el remitente

      const targetLanguageId = participant.user.preferred_language_id || participant.user.native_language_id;
      const targetLanguage = await models.Language.findByPk(targetLanguageId);

      if (!targetLanguage) {
        logger.warn(`⚠️ No se encontró idioma de destino para usuario ${participant.user.id}`);
        continue;
      }

      if (originalLanguage?.id !== targetLanguage.id) {
        // Traducir el mensaje
        try {
          const result = await translationService.translate(
            content,
            originalLanguageCode,
            targetLanguage.code,
            { useCache: true }
          );

          // Actualizar mensaje con traducción
          if (result.translatedText) {
            // En una implementación completa, se guardaría la traducción por receptor
            // Por ahora, actualizamos el mensaje principal con la primera traducción
            if (message.translated_content === null) {
              await message.update({
                translated_content: result.translatedText,
                target_language_id: targetLanguage.id,
                translation_status: 'completed',
                mistral_model: result.model,
                mistral_prompt_tokens: result.promptTokens,
                mistral_completion_tokens: result.completionTokens,
                mistral_response_time_ms: result.responseTimeMs,
              });
              logger.info(`🌐 Mensaje ${message.id} traducido a ${targetLanguage.code}`);
              io.to(String(conversationId)).emit('message_translation_updated', {
                messageId: message.id,
                conversationId,
                translatedContent: result.translatedText,
                targetLanguageId: targetLanguage.id,
                translationStatus: 'completed',
              });
            }
          }
        } catch (translationError) {
          logger.warn(`⚠️ Error al traducir para usuario ${participant.user.id}:`, translationError.message);
        }
      } else {
        logger.info(`ℹ️ No se requiere traducción del mensaje ${message.id}: idioma de destino ${targetLanguage.code} coincide con el origen`);
      }
    }

  } catch (error) {
    logger.error(`❌ Error al procesar mensaje de texto: ${error.message}`);
    socket.emit('message_error', { error: error.message });
    acknowledge?.({ error: error.message });
  }
};

/**
 * Maneja el evento 'audio_message' (mensaje de audio)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del mensaje
 * @param {Object} io - Instancia de Socket.io
 */
const handleAudioMessage = async (socket, data, io, acknowledge) => {
  try {
    const { conversationId, audioBase64, duration, languageCode, clientMessageId } = data;

    if (!conversationId || !audioBase64) {
      throw new Error('conversationId y audioBase64 son requeridos');
    }

    // Verificar que el usuario es miembro de la conversación
    const isMember = await models.UserConversation.isMember(
      socket.userId,
      conversationId
    );

    if (!isMember) {
      throw new Error('No eres miembro de esta conversación');
    }

    // Decodificar el audio base64
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length === 0) {
      throw new Error('El audio está vacío');
    }

    // Los navegadores envían p. ej. "audio/webm;codecs=opus": se valida el tipo base
    const mimeType = String(data.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const extension = AUDIO_EXTENSIONS[mimeType] || 'webm';

    // Guardar el archivo de audio
    const audioFile = await storageService.saveAudioFile(
      audioBuffer,
      `audio_${Date.now()}.${extension}`,
      mimeType
    );

    // Todavía no hay servicio de transcripción: el audio se guarda sin texto
    // (y por lo tanto no hay nada que traducir).
    const transcriptionLanguage = await models.Language.findByCode(languageCode || 'es');
    const durationSeconds = Math.max(0, Math.round(Number(duration) || 0));

    // Crear el mensaje
    const message = await models.Message.createAudioMessage({
      conversationId,
      senderId: socket.userId,
      audioUrl: audioFile.url,
      audioDuration: durationSeconds,
      audioTranscription: null,
      audioTranscriptionLanguageId: transcriptionLanguage?.id,
      originalLanguageId: transcriptionLanguage?.id,
    });

    // Obtener los participantes
    const participants = await models.UserConversation.findAll({
      where: { conversation_id: conversationId },
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'username'],
        },
      ],
    });

    // Obtener el mensaje con detalles
    const fullMessage = await models.Message.findByIdWithDetails(message.id);

    // Incrementar contador de no leídos
    for (const participant of participants) {
      if (participant.user.id !== socket.userId) {
        await models.UserConversation.incrementUnreadCount(
          participant.user.id,
          conversationId
        );
      }
    }

    // Enviar mensaje a todos los participantes
    io.to(String(conversationId)).emit('new_audio_message', {
      message: fullMessage,
      clientMessageId,
      sender: {
        id: socket.userId,
        username: socket.user.username,
        avatar: socket.user.avatar_url,
      },
      conversationId,
    });

    // Confirmar al remitente
    socket.emit('message_sent', {
      success: true,
      messageId: message.id,
      clientMessageId,
      conversationId,
      audioUrl: audioFile.url,
    });
    acknowledge?.({ success: true, messageId: message.id, clientMessageId, audioUrl: audioFile.url });

    logger.info(`🎤 Mensaje de audio enviado por ${socket.userId} en ${conversationId}`);
  } catch (error) {
    logger.error(`❌ Error al procesar mensaje de audio: ${error.message}`);
    socket.emit('message_error', { error: error.message });
    acknowledge?.({ error: error.message });
  }
};

/**
 * Maneja el evento 'message_read' (mensaje leído)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del evento
 * @param {Object} io - Instancia de Socket.io
 */
const handleMessageRead = async (socket, data, io) => {
  try {
    const { conversationId, messageId } = data;

    if (!conversationId || !messageId) {
      throw new Error('conversationId y messageId son requeridos');
    }

    // Verificar que el usuario es miembro de la conversación
    const isMember = await models.UserConversation.isMember(
      socket.userId,
      conversationId
    );

    if (!isMember) {
      throw new Error('No eres miembro de esta conversación');
    }

    // Actualizar el último mensaje leído
    await models.UserConversation.updateLastReadMessage(
      socket.userId,
      conversationId,
      messageId
    );

    // Marcar el mensaje como leído
    await models.Message.markAsRead(messageId);

    // Notificar al remitente
    const message = await models.Message.findByPk(messageId);
    if (message) {
      socket.to(message.sender_id.toString()).emit('message_read_receipt', {
        messageId,
        conversationId,
        readerId: socket.userId,
        readerUsername: socket.user.username,
      });
    }

    logger.info(`👀 Mensaje ${messageId} marcado como leído por ${socket.userId}`);
  } catch (error) {
    logger.error(`❌ Error al marcar mensaje como leído:`, error.message);
  }
};

/**
 * Maneja el evento 'message_delivered' (mensaje entregado)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del evento
 */
const handleMessageDelivered = async (socket, data) => {
  try {
    const { messageId } = data;

    if (!messageId) {
      throw new Error('messageId es requerido');
    }

    await models.Message.markAsDelivered(messageId);

    logger.info(`✅ Mensaje ${messageId} marcado como entregado`);
  } catch (error) {
    logger.error(`❌ Error al marcar mensaje como entregado:`, error.message);
  }
};

/**
 * Maneja el evento 'disconnect' (desconexión del socket)
 * @param {Object} socket - Socket
 * @param {Object} io - Instancia de Socket.io
 */
const handleDisconnect = async (socket, io) => {
  try {
    logger.info(`⚡ Socket desconectado: ${socket.id} (User: ${socket.userId || 'N/A'})`);

    // Actualizar estado del usuario a offline
    if (socket.userId) {
      await models.User.update(
        { status: 'offline', last_seen_at: new Date() },
        { where: { id: socket.userId } }
      );

      // Eliminar la sesión
      if (socket.sessionId) {
        await models.UserSession.expireSession(socket.sessionId);
      }

      // Notificar a todos los contactos del usuario
      const conversations = await models.Conversation.findUserConversations(
        socket.userId,
        { limit: 100 }
      );

      for (const conversation of conversations.conversations) {
        io.to(conversation.id.toString()).emit('user_status_changed', {
          userId: socket.userId,
          status: 'offline',
          lastSeenAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    logger.error(`❌ Error al manejar desconexión: ${error.message}`, {
      stack: error.stack,
      socketId: socket.id,
      userId: socket.userId,
    });
  }
};

/**
 * Maneja el evento 'user_status_changed' (cambio de estado del usuario)
 * @param {Object} socket - Socket
 * @param {Object} data - Datos del evento
 * @param {Object} io - Instancia de Socket.io
 */
const handleUserStatusChanged = async (socket, data, io) => {
  try {
    const { status } = data;

    if (!status) {
      throw new Error('status es requerido');
    }

    // Validar status
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) {
      throw new Error('Estado inválido');
    }

    // Actualizar estado del usuario
    await models.User.update(
      { status },
      { where: { id: socket.userId } }
    );

    // Notificar a todos los contactos
    const conversations = await models.Conversation.findUserConversations(
      socket.userId,
      { limit: 100 }
    );

    for (const conversation of conversations.conversations) {
      socket.to(conversation.id.toString()).emit('user_status_changed', {
        userId: socket.userId,
        status,
      });
    }

    logger.info(`🔄 Usuario ${socket.userId} cambió estado a ${status}`);
  } catch (error) {
    logger.error(`❌ Error al cambiar estado del usuario:`, error.message);
    socket.emit('status_change_error', { error: error.message });
  }
};

/**
 * Obtiene los usuarios online de una conversación
 * @param {number} conversationId - ID de la conversación
 * @returns {Promise<number[]>} Array de IDs de usuarios online
 */
const getOnlineUsersInConversation = async (conversationId) => {
  const participants = await models.UserConversation.findAll({
    where: { conversation_id: conversationId },
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'status'],
      },
    ],
  });

  return participants
    .filter(p => p.user.status === 'online')
    .map(p => p.user.id);
};

module.exports = {
  authenticateSocket,
  handleJoin,
  handleLeave,
  handleTextMessage,
  handleAudioMessage,
  handleMessageRead,
  handleMessageDelivered,
  handleDisconnect,
  handleUserStatusChanged,
  getOnlineUsersInConversation,
};
