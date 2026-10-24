/**
 * @file Rutas de Usuarios
 * @description Rutas para manejo de usuarios
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');
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

/**
 * @route GET /api/users
 * @description Lista usuarios activos para iniciar conversaciones
 * @access Privado
 */
router.get('/', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 100;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const users = await models.User.findAll({
      where: { is_active: true },
      attributes: [
        'id',
        'username',
        'first_name',
        'last_name',
        'avatar_url',
        'status',
        'native_language_id',
        'preferred_language_id',
      ],
      order: [['username', 'ASC']],
      limit,
    });

    res.json({
      success: true,
      users: users.filter(user => user.id !== req.userId),
    });
  } catch (error) {
    logger.error(`❌ Error al listar usuarios: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/users/search
 * @description Busca usuarios por nombre de usuario o email
 * @access Privado
 */
router.get(
  '/search',
  authMiddleware.verifyToken,
  [
    body('query').trim().notEmpty().withMessage('La consulta de búsqueda es obligatoria'),
    body('limit').optional().isInt({ min: 1, max: 50 }).withMessage('El límite debe ser entre 1 y 50'),
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

      const { query, limit = 10 } = req.query;

      // Excluir al usuario actual de los resultados
      const users = await models.User.search(query, limit);
      const filteredUsers = users.filter(user => user.id !== req.userId);

      res.json({
        success: true,
        users: filteredUsers,
      });
    } catch (error) {
      logger.error(`❌ Error al buscar usuarios: ${error.message}`);
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
