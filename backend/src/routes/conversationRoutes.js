/**
 * @file Rutas de Conversaciones
 * @description Rutas para manejo de conversaciones
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const { models } = require('../models');
const logger = require('../utils/logger');
const storageService = require('../services/storageService');
const { userRoom } = require('../utils/socketRooms');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storageService.localConfig.maxFileSizeMB * 1024 * 1024,
  },
});

/**
 * @route POST /api/conversations
 * @description Crea una nueva conversación
 * @access Privado
 */
router.post(
  '/',
  authMiddleware.verifyToken,
  [
    body('name').optional().trim().isLength({ max: 255 }),
    body('type').isIn(['private', 'group']).withMessage('El tipo debe ser private o group'),
    body('description').optional().isLength({ max: 500 }),
    body('name').if(body('type').equals('group')).trim().notEmpty().withMessage('El grupo necesita un nombre'),
    body('participant_ids').if(body('type').equals('group')).isArray({ min: 1, max: 255 }).withMessage('Agrega al menos 1 participante al grupo'),
    body('participant_ids.*').isInt({ min: 1 }).withMessage('Los IDs de participantes deben ser números').toInt(),
    body('participant_ids').if(body('type').equals('private')).isArray({ min: 1, max: 1 }).withMessage('Se requiere exactamente 1 participante para una conversación privada'),
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

      const { name, type, description } = req.body;

      // Sin repetidos y con el usuario actual incluido
      const participant_ids = [...new Set([...req.body.participant_ids, req.userId])];

      // Verificar que todos los participantes existen
      const users = await models.User.findByIds(participant_ids);
      if (users.length !== participant_ids.length) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Uno o más participantes no existen',
        });
      }

      let conversation;

      if (type === 'private' && participant_ids.length === 2) {
        // Crear conversación privada
        const otherUserId = participant_ids.find(id => id !== req.userId);
        conversation = await models.Conversation.createPrivate(
          req.userId,
          otherUserId
        );
      } else if (type === 'group') {
        // Crear conversación grupal
        conversation = await models.Conversation.create({
          name: name || `Grupo de ${users.map(u => u.username).join(', ')}`,
          type,
          created_by: req.userId,
          description,
        });

        // Agregar participantes
        await models.UserConversation.bulkCreate(
          participant_ids.map(userId => ({
            user_id: userId,
            conversation_id: conversation.id,
            role: userId === req.userId ? 'admin' : 'member',
          }))
        );
      } else {
        throw new Error('Configuración de conversación inválida');
      }

      // Obtener conversación con participantes
      const fullConversation = await models.Conversation.findByIdWithParticipants(conversation.id);

      // El grupo aparece al instante en la lista de chats de los demás integrantes
      if (type === 'group') {
        const io = req.app.get('io');
        for (const userId of participant_ids) {
          if (userId !== req.userId) {
            io?.to(userRoom(userId)).emit('conversation_created', { conversation: fullConversation });
          }
        }
      }

      res.status(201).json({
        success: true,
        conversation: fullConversation,
      });
    } catch (error) {
      logger.error(`❌ Error al crear conversación: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/conversations/:conversationId
 * @description Obtiene una conversación por ID
 * @access Privado (miembro de la conversación)
 */
router.get(
  '/:conversationId',
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

      const conversation = await models.Conversation.findByIdWithParticipants(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      res.json({
        success: true,
        conversation,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route PATCH /api/conversations/:conversationId
 * @description Actualiza una conversación
 * @access Privado (administrador de la conversación)
 */
router.patch(
  '/:conversationId',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationRole(['admin', 'moderator']),
  upload.single('avatar'),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('name').optional().trim().isLength({ max: 255 }),
    body('description').optional().isLength({ max: 500 }),
    body('is_archived').optional().isBoolean(),
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
      const updates = { ...req.body };

      const conversation = await models.Conversation.findByPk(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      // Manejar avatar
      if (req.file) {
        const { mimetype } = req.file;

        if (!storageService.validateMimeType(mimetype, storageService.localConfig.allowedImageTypes)) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Tipo de archivo no permitido para avatar',
          });
        }

        const avatarFile = await storageService.saveImageFile(
          req.file.buffer,
          req.file.originalname,
          mimetype
        );

        // Eliminar avatar anterior
        if (conversation.avatar_url) {
          await storageService.deleteFile(conversation.avatar_url);
        }

        updates.avatar_url = avatarFile.url;
      }

      await conversation.update(updates);

      const updatedConversation = await models.Conversation.findByIdWithParticipants(conversationId);

      res.json({
        success: true,
        conversation: updatedConversation,
      });
    } catch (error) {
      logger.error(`❌ Error al actualizar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route DELETE /api/conversations/:conversationId
 * @description Elimina una conversación (solo el creador)
 * @access Privado (creador de la conversación)
 */
router.delete(
  '/:conversationId',
  authMiddleware.verifyToken,
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

      const conversation = await models.Conversation.findByPk(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      // Verificar que el usuario es el creador
      if (conversation.created_by !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Solo el creador puede eliminar esta conversación',
        });
      }

      // Eliminar conversación (Sequelize se encargará de las relaciones en cascada)
      await conversation.destroy();

      res.json({
        success: true,
        message: 'Conversación eliminada correctamente',
      });
    } catch (error) {
      logger.error(`❌ Error al eliminar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/leave
 * @description Abandona una conversación
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/leave',
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

      // Actualizar fecha de salida
      await models.UserConversation.update(
        { left_at: new Date() },
        { where: { user_id: req.userId, conversation_id: conversationId } }
      );

      res.json({
        success: true,
        message: 'Has abandonado la conversación correctamente',
      });
    } catch (error) {
      logger.error(`❌ Error al abandonar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/archive
 * @description Archiva/desarchiva una conversación
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/archive',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('is_archived').isBoolean().withMessage('is_archived debe ser un booleano'),
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
      const { is_archived } = req.body;

      const conversation = await models.Conversation.toggleArchive(
        conversationId,
        req.userId,
        is_archived
      );

      res.json({
        success: true,
        conversation,
      });
    } catch (error) {
      logger.error(`❌ Error al archivar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/pin
 * @description Fija/desfija una conversación
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/pin',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('is_pinned').isBoolean().withMessage('is_pinned debe ser un booleano'),
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
      const { is_pinned } = req.body;

      await models.UserConversation.togglePin(
        req.userId,
        conversationId,
        is_pinned
      );

      res.json({
        success: true,
        message: `Conversación ${is_pinned ? 'fijada' : 'desfijada'} correctamente`,
      });
    } catch (error) {
      logger.error(`❌ Error al fijar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/mute
 * @description Silencia/activa notificaciones de una conversación
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/mute',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationMember(),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('is_muted').isBoolean().withMessage('is_muted debe ser un booleano'),
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
      const { is_muted } = req.body;

      await models.UserConversation.toggleMute(
        req.userId,
        conversationId,
        is_muted
      );

      res.json({
        success: true,
        message: `Notificaciones ${is_muted ? 'silenciadas' : 'activadas'} para esta conversación`,
      });
    } catch (error) {
      logger.error(`❌ Error al silenciar conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/read
 * @description Marca todos los mensajes como leídos
 * @access Privado (miembro de la conversación)
 */
router.post(
  '/:conversationId/read',
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
      logger.error(`❌ Error al marcar mensajes como leídos en conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/participants
 * @description Agrega participantes a una conversación grupal
 * @access Privado (administrador de la conversación)
 */
router.post(
  '/:conversationId/participants',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationRole(['admin']),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('user_ids').isArray({ min: 1, max: 255 }).withMessage('Se requiere al menos un ID de usuario'),
    body('user_ids.*').isInt({ min: 1 }).withMessage('Los IDs de usuarios deben ser números').toInt(),
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

      const conversationId = Number(req.params.conversationId);
      const user_ids = [...new Set(req.body.user_ids)];

      const conversation = await models.Conversation.findByPk(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      if (conversation.type !== 'group') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Solo se pueden agregar integrantes a un grupo',
        });
      }

      // Verificar que los usuarios existen
      const users = await models.User.findByIds(user_ids);
      if (users.length !== user_ids.length) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Uno o más usuarios no existen',
        });
      }

      // Nuevos integrantes, o que vuelven después de haber salido / sido eliminados
      const memberships = await models.UserConversation.findAll({
        where: { conversation_id: conversationId, user_id: user_ids },
      });
      const membershipByUser = new Map(memberships.map(m => [m.user_id, m]));

      const addedUserIds = [];
      for (const userId of user_ids) {
        const membership = membershipByUser.get(userId);
        if (!membership) {
          await models.UserConversation.create({ user_id: userId, conversation_id: conversationId, role: 'member' });
          addedUserIds.push(userId);
        } else if (membership.left_at) {
          await membership.update({ left_at: null, role: 'member', joined_at: new Date(), unread_count: 0 });
          addedUserIds.push(userId);
        }
      }

      const updatedConversation = await models.Conversation.findByIdWithParticipants(conversationId);

      if (addedUserIds.length > 0) {
        const io = req.app.get('io');
        // El grupo aparece en la lista de chats de los agregados
        for (const userId of addedUserIds) {
          io?.to(userRoom(userId)).emit('conversation_created', { conversation: updatedConversation });
        }
        io?.to(String(conversationId)).emit('participants_updated', { conversationId, conversation: updatedConversation });
      }

      res.json({
        success: true,
        conversation: updatedConversation,
        addedCount: addedUserIds.length,
      });
    } catch (error) {
      logger.error(`❌ Error al agregar participantes a conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route DELETE /api/conversations/:conversationId/participants/:userId
 * @description Elimina un participante de una conversación grupal
 * @access Privado (administrador de la conversación)
 */
router.delete(
  '/:conversationId/participants/:userId',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationRole(['admin']),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    param('userId').isInt().withMessage('El ID del usuario debe ser un número'),
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

      const conversationId = Number(req.params.conversationId);
      const userId = Number(req.params.userId);

      const conversation = await models.Conversation.findByPk(conversationId);
      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      if (conversation.type !== 'group') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Solo se pueden eliminar integrantes de un grupo',
        });
      }

      if (userId === req.userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Para salir del grupo usa la opción "Salir del grupo"',
        });
      }

      // No permitir eliminar al creador
      if (conversation.created_by === userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se puede eliminar al creador del grupo',
        });
      }

      // Verificar que el usuario a eliminar sigue en el grupo
      const participant = await models.UserConversation.findUserConversation(
        userId,
        conversationId
      );

      if (!participant || participant.left_at) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'El usuario no es participante de esta conversación',
        });
      }

      // Eliminar participante (marcar como salido)
      await participant.update({ left_at: new Date() });

      const updatedConversation = await models.Conversation.findByIdWithParticipants(conversationId);

      // Deja de recibir los mensajes del grupo en vivo, y el chat desaparece de su lista
      const io = req.app.get('io');
      io?.in(userRoom(userId)).socketsLeave(String(conversationId));
      io?.to(userRoom(userId)).emit('removed_from_conversation', { conversationId });
      io?.to(String(conversationId)).emit('participants_updated', { conversationId, conversation: updatedConversation });

      res.json({
        success: true,
        message: 'Participante eliminado correctamente',
        conversation: updatedConversation,
      });
    } catch (error) {
      logger.error(`❌ Error al eliminar participante de conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/conversations/:conversationId/role
 * @description Cambia el rol de un participante
 * @access Privado (administrador de la conversación)
 */
router.post(
  '/:conversationId/role',
  authMiddleware.verifyToken,
  authMiddleware.verifyConversationRole(['admin']),
  [
    param('conversationId').isInt().withMessage('El ID de la conversación debe ser un número'),
    body('user_id').isInt().withMessage('El ID del usuario debe ser un número'),
    body('role').isIn(['admin', 'member', 'moderator']).withMessage('Rol inválido'),
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
      const { user_id, role } = req.body;

      const conversation = await models.Conversation.findByPk(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversación no encontrada',
        });
      }

      // No permitir cambiar el rol del creador
      if (conversation.created_by === user_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se puede cambiar el rol del creador de la conversación',
        });
      }

      await models.UserConversation.update(
        { role },
        { where: { user_id, conversation_id: conversationId } }
      );

      res.json({
        success: true,
        message: 'Rol actualizado correctamente',
      });
    } catch (error) {
      logger.error(`❌ Error al cambiar rol en conversación ${req.params.conversationId}: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
