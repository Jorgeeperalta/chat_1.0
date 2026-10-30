/**
 * @file Rutas de Mensajes
 * @description Rutas para manejo de mensajes
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const { models } = require('../models');
const logger = require('../utils/logger');
const translationService = require('../services/translationService');
const messageTranslationService = require('../services/messageTranslationService');
const storageService = require('../services/storageService');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storageService.localConfig.maxFileSizeMB * 1024 * 1024,
  },
});

/**
 * @route GET /api/messages/:conversationId
 * @description Obtiene los mensajes de una conversación
 * @access Privado (miembro de la conversación)
 */
router.get(
  '/:conversationId',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('El offset debe ser mayor o igual a 0'),
    query('before_id').optional().isInt({ min: 1 }).withMessage('before_id debe ser un número positivo'),
    query('after_id').optional().isInt({ min: 1 }).withMessage('after_id debe ser un número positivo'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { conversationId } = req.params;
      const { limit = 50, offset = 0, before_id, after_id } = req.query;

      const { messages, total } = await models.Message.findConversationMessages(
        conversationId,
        {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          beforeId: before_id ? parseInt(before_id, 10) : null,
          afterId: after_id ? parseInt(after_id, 10) : null,
        }
      );

      // Marcar mensajes como entregados
      for (const message of messages) {
        if (message.sender_id !== req.userId && !message.is_delivered) {
          await models.Message.markAsDelivered(message.id);
        }
      }

      // Actualizar el último mensaje leído
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        await models.UserConversation.updateLastReadMessage(
          req.userId,
          conversationId,
          lastMessage.id
        );
      }

      res.json({
        success: true,
        messages,
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
    } catch (error) {
      logger.error(`❌ Error al obtener mensajes de conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/messages/:messageId
 * @description Obtiene un mensaje por ID
 * @access Privado (miembro de la conversación)
 */
router.get(
  '/:messageId',
  authMiddleware.verifyToken,
  [param('messageId').isInt().withMessage('El ID del mensaje debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { messageId } = req.params;

      const message = await models.Message.findByIdWithDetails(messageId);

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Mensaje no encontrado',
        });
      }

      // Verificar que el usuario es miembro de la conversación
      const isMember = await models.UserConversation.isMember(
        req.userId,
        message.conversation.id
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No eres miembro de esta conversación',
        });
      }

      // Marcar como entregado si no lo está
      if (!message.is_delivered) {
        await models.Message.markAsDelivered(messageId);
      }

      // Marcar como leído si no lo está
      if (!message.is_read && message.sender_id !== req.userId) {
        await models.Message.markAsRead(messageId);
        await models.UserConversation.updateLastReadMessage(
          req.userId,
          message.conversation.id,
          messageId
        );
      }

      res.json({
        success: true,
        message,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener mensaje ${req.params.messageId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/messages/:conversationId/text
 * @description Envía un mensaje de texto
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/text',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('content').trim().notEmpty().withMessage('El contenido del mensaje es obligatorio'),
    body('language_code').optional().isString().isLength({ min: 2, max: 10 }),
    body('original_language_id').optional().isInt(),
    body('reply_to_message_id').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { conversationId } = req.params;
      const { content, language_code, original_language_id, reply_to_message_id } = req.body;

      let replyToMessageId;
      try {
        replyToMessageId = await models.Message.resolveReplyTo(reply_to_message_id, conversationId);
      } catch (error) {
        return res.status(400).json({ error: 'Bad Request', message: error.message });
      }

      // Obtener el idioma nativo del usuario
      const user = await models.User.findByPk(req.userId, {
        include: [{ model: models.Language, as: 'nativeLanguage' }],
      });

      const sourceLanguageCode = language_code || (user?.nativeLanguage?.code || 'es');
      const sourceLanguage = await models.Language.findByCode(sourceLanguageCode);

      // Crear el mensaje
      const message = await models.Message.createTextMessage({
        conversationId,
        senderId: req.userId,
        content,
        originalLanguageId: original_language_id || sourceLanguage?.id,
        replyToMessageId,
        translationStatus: 'pending',
      });

      // Obtener los participantes
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

      // Procesar traducciones asíncronamente (no bloquear la respuesta)
      const messageLanguage = original_language_id
        ? await models.Language.findByPk(original_language_id)
        : sourceLanguage;
      setImmediate(() => {
        messageTranslationService.translateForParticipants({
          message,
          content,
          sourceLanguage: messageLanguage,
          participants,
          senderId: req.userId,
          io: req.app.get('io'),
        }).catch(error => logger.warn(`⚠️ Error al traducir el mensaje ${message.id}: ${error.message}`));
      });

      // Obtener el mensaje con detalles
      const fullMessage = await models.Message.findByIdWithDetails(message.id);

      // Incrementar contador de no leídos
      for (const participant of participants) {
        if (participant.user.id !== req.userId) {
          await models.UserConversation.incrementUnreadCount(
            participant.user.id,
            conversationId
          );
        }
      }

      res.status(201).json({
        success: true,
        message: fullMessage,
      });
    } catch (error) {
      logger.error(`❌ Error al enviar mensaje de texto a conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/messages/:conversationId/audio
 * @description Envía un mensaje de audio
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/audio',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  upload.single('audio'),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('duration').optional().isInt({ min: 1 }).withMessage('La duración debe ser un número positivo'),
    body('language_code').optional().isString().isLength({ min: 2, max: 10 }),
  ],
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionó ningún archivo de audio',
        });
      }

      const { conversationId } = req.params;
      const { duration, language_code } = req.body;
      const { mimetype } = req.file;

      // Validar MIME type
      if (!storageService.validateMimeType(mimetype, storageService.localConfig.allowedAudioTypes)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tipo de archivo no permitido para audio',
        });
      }

      // Guardar archivo de audio
      const audioFile = await storageService.saveAudioFile(
        req.file.buffer,
        req.file.originalname,
        mimetype
      );

      // Todavía no hay servicio de transcripción: el audio se guarda sin texto (igual que por Socket.io)
      const transcription = null;
      const transcriptionLanguageCode = language_code || 'es';
      const transcriptionLanguage = await models.Language.findByCode(transcriptionLanguageCode);

      // Crear el mensaje
      const message = await models.Message.createAudioMessage({
        conversationId,
        senderId: req.userId,
        audioUrl: audioFile.url,
        audioDuration: duration || 0,
        audioTranscription: transcription,
        audioTranscriptionLanguageId: transcriptionLanguage?.id,
        originalLanguageId: transcriptionLanguage?.id,
        translationStatus: 'pending',
      });

      // Obtener los participantes
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

      // Procesar traducciones asíncronamente (solo si hay transcripción que traducir)
      if (transcription) {
        setImmediate(() => {
          messageTranslationService.translateForParticipants({
            message,
            content: transcription,
            sourceLanguage: transcriptionLanguage,
            participants,
            senderId: req.userId,
            io: req.app.get('io'),
          }).catch(error => logger.warn(`⚠️ Error al traducir el audio ${message.id}: ${error.message}`));
        });
      }

      // Obtener el mensaje con detalles
      const fullMessage = await models.Message.findByIdWithDetails(message.id);

      // Incrementar contador de no leídos
      for (const participant of participants) {
        if (participant.user.id !== req.userId) {
          await models.UserConversation.incrementUnreadCount(
            participant.user.id,
            conversationId
          );
        }
      }

      res.status(201).json({
        success: true,
        message: fullMessage,
      });
    } catch (error) {
      logger.error(`❌ Error al enviar mensaje de audio a conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/messages/:conversationId/translate
 * @description Traduce un mensaje específico
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/translate',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('message_id').isInt().withMessage('El ID del mensaje debe ser un número'),
    body('target_language_code').isString().isLength({ min: 2, max: 10 }).withMessage('El código del idioma de destino es obligatorio'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { conversationId } = req.params;
      const { message_id, target_language_code } = req.body;

      const message = await models.Message.findByIdWithDetails(message_id);

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Mensaje no encontrado',
        });
      }

      // Obtener idioma de origen
      const sourceLanguageCode = message.originalLanguage?.code || 'es';
      const targetLanguage = await models.Language.findByCode(target_language_code);

      if (!targetLanguage) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Idioma de destino no válido',
        });
      }

      // Traducir
      const result = await translationService.translate(
        message.content || message.audio_transcription,
        sourceLanguageCode,
        target_language_code,
        { useCache: true }
      );

      res.json({
        success: true,
        translation: {
          originalText: message.content || message.audio_transcription,
          translatedText: result.translatedText,
          sourceLanguage: sourceLanguageCode,
          targetLanguage: target_language_code,
          fromCache: result.fromCache,
        },
      });
    } catch (error) {
      logger.error(`❌ Error al traducir mensaje ${req.body.message_id}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route PATCH /api/messages/:messageId
 * @description Edita un mensaje
 * @access Privado (remitente del mensaje)
 */
router.patch(
  '/:messageId',
  authMiddleware.verifyToken,
  [
    param('messageId').isInt().withMessage('El ID del mensaje debe ser un número'),
    body('content').trim().notEmpty().withMessage('El contenido del mensaje es obligatorio'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { messageId } = req.params;
      const { content } = req.body;

      const message = await models.Message.findByPk(messageId);

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Mensaje no encontrado',
        });
      }

      // Verificar que el usuario es el remitente
      if (message.sender_id !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Solo el remitente puede editar este mensaje',
        });
      }

      if (message.is_deleted || message.message_type !== 'text') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Solo se pueden editar mensajes de texto',
        });
      }

      // Sigue siendo miembro (pudo haber salido del grupo)
      const isMember = await models.UserConversation.isMember(req.userId, message.conversation_id);
      if (!isMember) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No eres miembro de esta conversación',
        });
      }

      // Actualizar mensaje
      await message.update({
        content,
        is_edited: true,
        translated_content: null, // Resetear traducción
        target_language_id: null,
        translation_status: 'pending',
      });

      const updatedMessage = await models.Message.findByIdWithDetails(messageId);

      // Avisar en vivo a quienes tienen el chat abierto
      req.app.get('io')?.to(String(message.conversation_id)).emit('message_updated', {
        conversationId: message.conversation_id,
        message: updatedMessage,
      });

      // Re-traducir asíncronamente
      setImmediate(async () => {
        try {
          const participants = await models.UserConversation.findAll({
            where: { conversation_id: message.conversation_id },
            include: [
              {
                model: models.User,
                as: 'user',
                attributes: ['id', 'preferred_language_id', 'native_language_id'],
              },
            ],
          });

          await messageTranslationService.translateForParticipants({
            message,
            content,
            sourceLanguage: await models.Language.findByPk(message.original_language_id),
            participants,
            senderId: req.userId,
            io: req.app.get('io'),
          });
        } catch (error) {
          logger.warn(`⚠️ Error al re-traducir el mensaje ${message.id}: ${error.message}`);
        }
      });

      res.json({
        success: true,
        message: updatedMessage,
      });
    } catch (error) {
      logger.error(`❌ Error al editar mensaje ${req.params.messageId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route DELETE /api/messages/:messageId
 * @description Elimina un mensaje
 * @access Privado (remitente del mensaje o administrador de la conversación)
 */
router.delete(
  '/:messageId',
  authMiddleware.verifyToken,
  [param('messageId').isInt().withMessage('El ID del mensaje debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { messageId } = req.params;

      const message = await models.Message.findByPk(messageId);

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Mensaje no encontrado',
        });
      }

      // Verificar permisos
      const conversation = await models.Conversation.findByPk(message.conversation_id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      // El remitente, o un administrador del grupo. En un chat privado nadie borra
      // los mensajes del otro (antes bastaba con haber creado el chat).
      const membership = await models.UserConversation.findOne({
        where: { user_id: req.userId, conversation_id: message.conversation_id, left_at: null },
      });
      const isSender = message.sender_id === req.userId;
      const isGroupAdmin = conversation.type === 'group' && membership?.role === 'admin';

      if (!membership || (!isSender && !isGroupAdmin)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permisos para eliminar este mensaje',
        });
      }

      // Eliminar mensaje (soft delete)
      await models.Message.softDelete(messageId);

      req.app.get('io')?.to(String(message.conversation_id)).emit('message_deleted', {
        conversationId: message.conversation_id,
        messageId: message.id,
      });

      res.json({
        success: true,
        message: 'Mensaje eliminado correctamente',
      });
    } catch (error) {
      logger.error(`❌ Error al eliminar mensaje ${req.params.messageId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/messages/:messageId/reactions
 * @description Agrega una reacción a un mensaje
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:messageId/reactions',
  authMiddleware.verifyToken,
  [
    param('messageId').isInt().withMessage('El ID del mensaje debe ser un número'),
    body('emoji').isString().withMessage('El emoji es obligatorio'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { messageId } = req.params;
      const { emoji } = req.body;

      const message = await models.Message.findByPk(messageId);

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Mensaje no encontrado',
        });
      }

      // Verificar que el usuario es miembro de la conversación
      const isMember = await models.UserConversation.isMember(
        req.userId,
        message.conversation_id
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No eres miembro de esta conversación',
        });
      }

      // Implementación de reacciones (simplificada)
      // En una implementación completa, se crearía una tabla de reacciones

      res.json({
        success: true,
        message: 'Reacción agregada correctamente',
        reaction: { emoji, userId: req.userId },
      });
    } catch (error) {
      logger.error(`❌ Error al agregar reacción a mensaje ${req.params.messageId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/messages/:conversationId/unread
 * @description Obtiene el número de mensajes no leídos
 * @access Privado (miembro de la conversación)
 */
router.get(
  '/:conversationId/unread',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { conversationId } = req.params;

      const unreadCount = await models.UserConversation.getUnreadCount(
        req.userId,
        conversationId
      );

      res.json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener mensajes no leídos de conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/messages/:conversationId/read-all
 * @description Marca todos los mensajes como leídos
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/read-all',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { conversationId } = req.params;

      // Obtener el último mensaje
      const lastMessage = await models.Message.findOne({
        where: { conversation_id: conversationId },
        order: [['id', 'DESC']],
      });

      if (lastMessage) {
        await models.UserConversation.updateLastReadMessage(
          req.userId,
          conversationId,
          lastMessage.id
        );
      }

      res.json({
        success: true,
        message: 'Todos los mensajes marcados como leídos',
      });
    } catch (error) {
      logger.error(`❌ Error al marcar todos como leídos en conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
