/**
 * @file Rutas de Videollamadas
 * @description
 *  POST  /api/rooms              crea (o reutiliza) la sala de una conversación y avisa a los demás
 *  POST  /api/livekit/token      token de acceso a una sala (solo integrantes de la conversación)
 *  PATCH /api/user/preferences   idioma de los subtítulos (es/en/fr/it/de/zh)
 * Las tres se montan con authMiddleware.verifyToken (ver index.js).
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');
const { models } = require('../models');
const livekitService = require('../services/livekitService');
const pushService = require('../services/pushService');
const { userRoom } = require('../utils/socketRooms');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ error: 'Validation Error', details: errors.array() });
  return false;
};

const requireLivekit = (req, res, next) => {
  if (!livekitService.isConfigured()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Las videollamadas no están configuradas en el servidor',
    });
  }
  next();
};

const notMember = (res) => res.status(403).json({
  error: 'Forbidden',
  message: 'No eres integrante de esta conversación',
});

// ---------------------------------------------------------------------------
// POST /api/rooms
// ---------------------------------------------------------------------------
const roomsRouter = express.Router();

/**
 * @route POST /api/rooms
 * @description Crea la sala de la conversación (si no existía), despacha el agente de subtítulos
 * y avisa a los demás integrantes que hay una videollamada (Socket.io y push).
 * Body: conversationId, record (opcional: grabar, solo si hay almacenamiento configurado),
 * notify (opcional, por defecto true: avisar a los demás)
 */
roomsRouter.post(
  '/',
  requireLivekit,
  [
    body('conversationId').isInt({ min: 1 }).toInt(),
    body('record').optional().isBoolean().toBoolean(),
    // false al sumarse a una llamada en curso: no vuelve a sonarle a nadie
    body('notify').optional().isBoolean().toBoolean(),
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { conversationId, record = false, notify = true } = req.body;

      if (!(await models.UserConversation.isMember(req.userId, conversationId))) return notMember(res);

      if (record && !livekitService.isRecordingConfigured()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'La grabación no está configurada en el servidor',
        });
      }

      const roomName = livekitService.roomNameFor(conversationId);
      const room = await livekitService.ensureRoom(roomName, { record });

      // Avisar a los demás: en la app (si está abierta) y por push (si no)
      const [conversation, members] = await Promise.all([
        models.Conversation.findByPk(conversationId, { attributes: ['id', 'type', 'name'] }),
        models.UserConversation.findAll({
          where: { conversation_id: conversationId, left_at: null },
          attributes: ['user_id'],
        }),
      ]);
      const caller = req.user;
      const recipientIds = members.map(m => m.user_id).filter(id => Number(id) !== Number(req.userId));
      const io = req.app.get('io');
      const invite = {
        conversationId,
        roomName,
        conversationType: conversation?.type,
        conversationName: conversation?.name || null,
        caller: {
          id: caller.id,
          username: caller.username,
          first_name: caller.first_name,
          last_name: caller.last_name,
          avatar_url: caller.avatar_url,
        },
      };
      if (notify) for (const userId of recipientIds) io?.to(userRoom(userId)).emit('call_started', invite);
      if (notify && conversation) {
        pushService.notifyIncomingCallInBackground({ io, caller, conversation, recipientIds });
      }

      logger.info(`📹 Videollamada en ${roomName} iniciada por el usuario ${req.userId}`);
      res.status(201).json({ success: true, ...room });
    } catch (error) {
      logger.error(`❌ Error al crear la sala de videollamada: ${error.message}`);
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/livekit/token
// ---------------------------------------------------------------------------
const livekitRouter = express.Router();

/**
 * @route POST /api/livekit/token
 * @description Token para entrar a una sala. Solo para integrantes de la conversación de la sala.
 * Body: roomName ("conv-<id>")
 */
livekitRouter.post(
  '/token',
  requireLivekit,
  [body('roomName').isString().notEmpty()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { roomName } = req.body;

      const conversationId = livekitService.conversationIdFromRoom(roomName);
      if (!conversationId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Sala no válida' });
      }
      if (!(await models.UserConversation.isMember(req.userId, conversationId))) return notMember(res);

      const user = await models.User.findByPk(req.userId, {
        attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url', 'subtitle_language'],
        include: [{ model: models.Language, as: 'preferredLanguage', attributes: ['code'] }],
      });

      res.json({
        success: true,
        url: config.livekit.url,
        token: await livekitService.createAccessToken(user, roomName),
        identity: `user-${user.id}`,
        subtitleLanguage: livekitService.subtitleLanguageOf(user),
      });
    } catch (error) {
      logger.error(`❌ Error al generar el token de videollamada: ${error.message}`);
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/user/preferences
// ---------------------------------------------------------------------------
const userRouter = express.Router();

/**
 * @route PATCH /api/user/preferences
 * @description Idioma de los subtítulos de las videollamadas. Body: subtitle_language
 */
userRouter.patch(
  '/preferences',
  [body('subtitle_language').isIn(livekitService.SUBTITLE_LANGUAGES)],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      await models.User.update(
        { subtitle_language: req.body.subtitle_language },
        { where: { id: req.userId } }
      );
      res.json({ success: true, subtitle_language: req.body.subtitle_language });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = { roomsRouter, livekitRouter, userRouter };
