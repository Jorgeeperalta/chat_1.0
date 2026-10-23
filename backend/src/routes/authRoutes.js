/**
 * @file Rutas de Autenticación
 * @description Rutas para registro, login, logout y recuperación de contraseña
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const config = require('../config');
const logger = require('../utils/logger');
const { models } = require('../models');
const { generateToken, generateRefreshToken } = require('../middleware/authMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route POST /api/auth/register
 * @description Registra un nuevo usuario
 * @access Público
 */
router.post(
  '/register',
  [
    body('username')
      .trim()
      .notEmpty().withMessage('El nombre de usuario es obligatorio')
      .isLength({ min: 3, max: 50 }).withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
    body('email')
      .trim()
      .notEmpty().withMessage('El correo electrónico es obligatorio')
      .isEmail().withMessage('El correo electrónico no es válido'),
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
      .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('first_name')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('El nombre debe tener máximo 100 caracteres'),
    body('last_name')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('El apellido debe tener máximo 100 caracteres'),
    body('native_language_id')
      .isInt().withMessage('El idioma nativo es obligatorio')
      .custom(async (value) => {
        const language = await models.Language.findByPk(value);
        if (!language) {
          throw new Error('Idioma no válido');
        }
        return true;
      }),
    body('preferred_language_id')
      .optional()
      .isInt()
      .custom(async (value) => {
        if (value) {
          const language = await models.Language.findByPk(value);
          if (!language) {
            throw new Error('Idioma preferido no válido');
          }
        }
        return true;
      }),
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

      const {
        username,
        email,
        password,
        first_name,
        last_name,
        native_language_id,
        preferred_language_id,
      } = req.body;

      // Verificar si el usuario ya existe
      const existingUserByEmail = await models.User.findByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'El correo electrónico ya está en uso',
        });
      }

      const existingUserByUsername = await models.User.findByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'El nombre de usuario ya está en uso',
        });
      }

      // Crear el usuario
      const user = await models.User.create({
        username,
        email,
        password_hash: password,
        first_name: first_name || null,
        last_name: last_name || null,
        native_language_id,
        preferred_language_id: preferred_language_id || null,
      });

      // Crear preferencias por defecto
      await models.UserPreference.create({ user_id: user.id });

      // Generar tokens
      const accessToken = generateToken({ userId: user.id });
      const refreshToken = generateRefreshToken({ userId: user.id });

      logger.info(`👤 Nuevo usuario registrado: ${username} (ID: ${user.id})`);

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          native_language_id: user.native_language_id,
          preferred_language_id: user.preferred_language_id,
          status: user.status,
          created_at: user.created_at,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
          refreshExpiresIn: config.jwt.refreshExpiresIn,
        },
      });
    } catch (error) {
      logger.error(`❌ Error en registro: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/login
 * @description Inicia sesión
 * @access Público
 */
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Correo electrónico no válido'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria'),
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

      const { email, password } = req.body;

      // Buscar usuario
      const user = await models.User.findByEmail(email);

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Credenciales inválidas',
        });
      }

      // Verificar contraseña
      const isPasswordValid = await user.verifyPassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Credenciales inválidas',
        });
      }

      // Verificar si el usuario está activo
      if (!user.is_active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cuenta desactivada',
        });
      }

      // Actualizar estado a online
      await user.update({ status: 'online', last_seen_at: new Date() });

      // Generar tokens
      const accessToken = generateToken({ userId: user.id });
      const refreshToken = generateRefreshToken({ userId: user.id });

      logger.info(`🔐 Usuario ${user.username} inició sesión (ID: ${user.id})`);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          native_language_id: user.native_language_id,
          preferred_language_id: user.preferred_language_id,
          status: 'online',
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
          refreshExpiresIn: config.jwt.refreshExpiresIn,
        },
      });
    } catch (error) {
      logger.error(`❌ Error en login: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/logout
 * @description Cierra la sesión
 * @access Privado
 */
router.post('/logout', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    // Actualizar estado a offline
    await models.User.update(
      { status: 'offline', last_seen_at: new Date() },
      { where: { id: req.userId } }
    );

    // Expirar sesiones
    await models.UserSession.expireUserSessions(req.userId);

    logger.info(`🔚 Usuario ${req.user.username} cerró sesión (ID: ${req.userId})`);

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    logger.error(`❌ Error en logout: ${error.message}`);
    next(error);
  }
});

/**
 * @route POST /api/auth/refresh
 * @description Refresca el token de acceso
 * @access Público
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token es obligatorio',
      });
    }

    try {
      const tokens = await authMiddleware.refreshTokens(refreshToken);

      res.json({
        success: true,
        tokens,
      });
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token inválido o expirado',
      });
    }
  } catch (error) {
    logger.error(`❌ Error al refrescar token: ${error.message}`);
    next(error);
  }
});

/**
 * @route POST /api/auth/verify-email
 * @description Verifica el correo electrónico (placeholder para implementación futura)
 * @access Público
 */
router.post('/verify-email', async (req, res) => {
  // Implementación para verificación de email
  res.json({
    success: true,
    message: 'Verificación de email no implementada aún',
  });
});

/**
 * @route POST /api/auth/forgot-password
 * @description Solicita restablecer contraseña (placeholder para implementación futura)
 * @access Público
 */
router.post('/forgot-password', async (req, res) => {
  // Implementación para recuperación de contraseña
  res.json({
    success: true,
    message: 'Recuperación de contraseña no implementada aún',
  });
});

/**
 * @route POST /api/auth/reset-password
 * @description Restablece la contraseña (placeholder para implementación futura)
 * @access Público
 */
router.post('/reset-password', async (req, res) => {
  // Implementación para reset de contraseña
  res.json({
    success: true,
    message: 'Reset de contraseña no implementado aún',
  });
});

/**
 * @route GET /api/auth/me
 * @description Obtiene los datos del usuario autenticado
 * @access Privado
 */
router.get('/me', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const user = await models.User.findByPk(req.userId, {
      attributes: { exclude: ['password_hash'] },
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
        {
          model: models.UserPreference,
          as: 'preferences',
        },
      ],
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`❌ Error al obtener datos del usuario: ${error.message}`);
    next(error);
  }
});

/**
 * @route PATCH /api/auth/me
 * @description Actualiza los datos del usuario autenticado
 * @access Privado
 */
router.patch(
  '/me',
  authMiddleware.verifyToken,
  [
    body('first_name').optional().trim().isLength({ max: 100 }),
    body('last_name').optional().trim().isLength({ max: 100 }),
    body('bio').optional().isLength({ max: 500 }),
    body('preferred_language_id').optional().isInt(),
    body('native_language_id').optional().isInt(),
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

      const updates = { ...req.body };

      // Si se actualiza el idioma nativo, verificar que existe
      if (updates.native_language_id) {
        const language = await models.Language.findByPk(updates.native_language_id);
        if (!language) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Idioma nativo no válido',
          });
        }
      }

      // Si se actualiza el idioma preferido, verificar que existe
      if (updates.preferred_language_id) {
        const language = await models.Language.findByPk(updates.preferred_language_id);
        if (!language) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Idioma preferido no válido',
          });
        }
      }

      // Actualizar usuario
      const user = await models.User.findByPk(req.userId);
      await user.update(updates);

      // Obtener usuario actualizado
      const updatedUser = await models.User.findByPk(req.userId, {
        attributes: { exclude: ['password_hash'] },
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

      res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      logger.error(`❌ Error al actualizar usuario: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route PATCH /api/auth/change-password
 * @description Cambia la contraseña del usuario autenticado
 * @access Privado
 */
router.patch(
  '/change-password',
  authMiddleware.verifyToken,
  [
    body('current_password').notEmpty().withMessage('La contraseña actual es obligatoria'),
    body('new_password').notEmpty().isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
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

      const { current_password, new_password } = req.body;

      // Verificar contraseña actual
      const user = await models.User.findByPk(req.userId);
      const isPasswordValid = await user.verifyPassword(current_password);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'La contraseña actual no es correcta',
        });
      }

      // Actualizar contraseña
      await user.update({ password_hash: new_password });

      res.json({
        success: true,
        message: 'Contraseña cambiada correctamente',
      });
    } catch (error) {
      logger.error(`❌ Error al cambiar contraseña: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
