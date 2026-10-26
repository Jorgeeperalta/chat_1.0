/**
 * @file Rutas de Usuarios
 * @description Rutas para manejo de usuarios
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { body, validationResult, param, query } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const { models } = require('../models');
const logger = require('../utils/logger');
const storageService = require('../services/storageService');
const multer = require('multer');

// Configurar multer para manejo de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storageService.localConfig.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...storageService.localConfig.allowedImageTypes,
      ...storageService.localConfig.allowedAudioTypes,
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
  },
});

// Datos públicos de un usuario (nunca email, password_hash ni datos internos)
const PUBLIC_USER_ATTRIBUTES = [
  'id',
  'username',
  'first_name',
  'last_name',
  'avatar_url',
  'status',
  'last_seen_at',
  'native_language_id',
  'preferred_language_id',
];

/**
 * @route GET /api/users
 * @description Agenda del usuario: solo sus contactos (con quienes comparte algún chat).
 * No lista a todos los usuarios de la app.
 * @access Privado
 */
router.get('/', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const contactIds = await models.UserConversation.findContactIds(req.userId);
    const users = contactIds.length === 0 ? [] : await models.User.findAll({
      where: { id: { [Op.in]: contactIds }, is_active: true },
      attributes: PUBLIC_USER_ATTRIBUTES,
      order: [['username', 'ASC']],
    });

    res.json({ success: true, users });
  } catch (error) {
    logger.error(`❌ Error al listar contactos: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/users/search?username=ana
 * @description Busca un usuario por su nombre de usuario EXACTO, para agregarlo a la agenda.
 * Coincidencia exacta a propósito: no permite recorrer la lista de usuarios de la app.
 * @access Privado
 */
router.get(
  '/search',
  authMiddleware.verifyToken,
  [
    query('username')
      .customSanitizer(value => String(value || '').trim().replace(/^@/, ''))
      .isLength({ min: 3, max: 50 }).withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres'),
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

      const user = await models.User.findOne({
        where: {
          username: req.query.username,
          is_active: true,
          id: { [Op.ne]: req.userId },
        },
        attributes: PUBLIC_USER_ATTRIBUTES,
      });

      const contactIds = user ? await models.UserConversation.findContactIds(req.userId) : [];

      res.json({
        success: true,
        user: user ? { ...user.toJSON(), is_contact: contactIds.includes(user.id) } : null,
      });
    } catch (error) {
      logger.error(`❌ Error al buscar usuario: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/users/:userId
 * @description Obtiene los datos de un usuario
 * @access Privado
 */
router.get(
  '/:userId',
  authMiddleware.verifyToken,
  [param('userId').isInt().withMessage('El ID del usuario debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { userId } = req.params;

      // Solo uno mismo o sus contactos: no se puede consultar a cualquier usuario por id
      if (Number(userId) !== Number(req.userId)) {
        const contactIds = await models.UserConversation.findContactIds(req.userId);
        if (!contactIds.includes(Number(userId))) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Usuario no encontrado',
          });
        }
      }

      const user = await models.User.findByPk(userId, {
        attributes: { exclude: ['password_hash', 'email'] },
        include: [
          {
            model: models.Language,
            as: 'nativeLanguage',
            attributes: ['id', 'code', 'name', 'native_name'],
          },
          {
            model: models.Language,
            as: 'preferredLanguage',
            attributes: ['id', 'code', 'name', 'native_name'],
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Usuario no encontrado',
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route PATCH /api/users/:userId
 * @description Actualiza los datos de un usuario
 * @access Privado (solo administrador o propietario)
 */
router.patch(
  '/:userId',
  authMiddleware.verifyToken,
  authMiddleware.verifyOwner('userId'),
  [
    param('userId').isInt().withMessage('El ID del usuario debe ser un número'),
    body('first_name').optional().trim().isLength({ max: 100 }),
    body('last_name').optional().trim().isLength({ max: 100 }),
    body('bio').optional().isLength({ max: 500 }),
    body('is_active').optional().isBoolean(),
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

      const { userId } = req.params;
      const updates = { ...req.body };

      const user = await models.User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Usuario no encontrado',
        });
      }

      await user.update(updates);

      const updatedUser = await models.User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] },
      });

      res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      logger.error(`❌ Error al actualizar usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route PATCH /api/users/:userId/avatar
 * @description Actualiza el avatar de un usuario
 * @access Privado (solo propietario)
 */
router.patch(
  '/:userId/avatar',
  authMiddleware.verifyToken,
  authMiddleware.verifyOwner('userId'),
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionó ningún archivo',
        });
      }

      const { userId } = req.params;
      const { mimetype } = req.file;

      // Validar tipo MIME
      if (!storageService.validateMimeType(mimetype, storageService.localConfig.allowedImageTypes)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tipo de archivo no permitido para avatar',
        });
      }

      // Guardar archivo
      const avatarFile = await storageService.saveImageFile(
        req.file.buffer,
        req.file.originalname,
        mimetype
      );

      // Actualizar usuario
      const user = await models.User.findByPk(userId);
      
      // Eliminar avatar anterior si existe
      if (user.avatar_url) {
        await storageService.deleteFile(user.avatar_url);
      }

      await user.update({ avatar_url: avatarFile.url });

      res.json({
        success: true,
        avatarUrl: avatarFile.url,
      });
    } catch (error) {
      logger.error(`❌ Error al actualizar avatar del usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/users/:userId/preferences
 * @description Actualiza las preferencias de un usuario
 * @access Privado (solo propietario)
 */
router.post(
  '/:userId/preferences',
  authMiddleware.verifyToken,
  authMiddleware.verifyOwner('userId'),
  [
    param('userId').isInt().withMessage('El ID del usuario debe ser un número'),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('notification_sound').optional().isBoolean(),
    body('notification_vibration').optional().isBoolean(),
    body('auto_translate_messages').optional().isBoolean(),
    body('show_original_message').optional().isBoolean(),
    body('audio_quality').optional().isIn(['low', 'medium', 'high']),
    body('play_audio_automatically').optional().isBoolean(),
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

      const { userId } = req.params;
      const preferences = req.body;

      const updatedPreferences = await models.UserPreference.updateForUser(
        userId,
        preferences
      );

      res.json({
        success: true,
        preferences: updatedPreferences,
      });
    } catch (error) {
      logger.error(`❌ Error al actualizar preferencias del usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/users/:userId/preferences
 * @description Obtiene las preferencias de un usuario
 * @access Privado (solo propietario o administrador)
 */
router.get(
  '/:userId/preferences',
  authMiddleware.verifyToken,
  [param('userId').isInt().withMessage('El ID del usuario debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { userId } = req.params;

      // Verificar permisos
      if (req.userId !== parseInt(userId, 10) && !req.user.is_admin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permisos para acceder a estas preferencias',
        });
      }

      const preferences = await models.UserPreference.getOrCreate(userId);

      res.json({
        success: true,
        preferences,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener preferencias del usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/users/:userId/conversations
 * @description Obtiene las conversaciones de un usuario
 * @access Privado (solo propietario)
 */
router.get(
  '/:userId/conversations',
  authMiddleware.verifyToken,
  authMiddleware.verifyOwner('userId'),
  [
    param('userId').isInt().withMessage('El ID del usuario debe ser un número'),
    body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    body('offset').optional().isInt({ min: 0 }).withMessage('El offset debe ser mayor o igual a 0'),
    body('type').optional().isIn(['private', 'group']),
    body('search').optional().isString(),
    body('archived').optional().isBoolean(),
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

      const { userId } = req.params;
      const { limit = 20, offset = 0, type, search, archived = false } = req.query;

      const { conversations, total } = await models.Conversation.findUserConversations(
        userId,
        { limit: parseInt(limit, 10), offset: parseInt(offset, 10), type, search, archived }
      );

      res.json({
        success: true,
        conversations,
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
    } catch (error) {
      logger.error(`❌ Error al obtener conversaciones del usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/users/:userId/status
 * @description Obtiene el estado online/offline de un usuario
 * @access Privado
 */
router.get(
  '/:userId/status',
  authMiddleware.verifyToken,
  [param('userId').isInt().withMessage('El ID del usuario debe ser un número')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array(),
        });
      }

      const { userId } = req.params;

      const user = await models.User.findByPk(userId, {
        attributes: ['id', 'username', 'status', 'last_seen_at'],
      });

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Usuario no encontrado',
        });
      }

      res.json({
        success: true,
        userId: user.id,
        username: user.username,
        status: user.status,
        lastSeenAt: user.last_seen_at,
      });
    } catch (error) {
      logger.error(`❌ Error al obtener estado del usuario ${req.params.userId}: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
