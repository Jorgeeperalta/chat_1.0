/**
 * @file Middleware de Autenticación
 * @description Middleware para autenticación JWT
 * @author Arquitecto de Software Senior
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { models } = require('../models');

/**
 * @typedef {Object} AuthRequest
 * @property {string} token - Token JWT
 * @property {Object} user - Usuario autenticado
 * @property {number} userId - ID del usuario
 */

/**
 * Verifica y decodifica el token JWT
 * @param {string} token - Token JWT
 * @returns {Promise<Object>} Payload decodificado
 */
const verifyJwtToken = async (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
    }, (error, decoded) => {
      if (error) {
        logger.error(`❌ Error al verificar token: ${error.message}`);
        reject(error);
      } else {
        resolve(decoded);
      }
    });
  });
};

/**
 * Genera un token JWT
 * @param {Object} payload - Payload del token
 * @param {string} [expiresIn] - Tiempo de expiración
 * @returns {string}
 */
const generateToken = (payload, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn,
    issuer: config.jwt.issuer,
    algorithm: config.jwt.algorithm,
  });
};

/**
 * Genera un refresh token
 * @param {Object} payload - Payload del token
 * @returns {string}
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    algorithm: config.jwt.algorithm,
  });
};

/**
 * Middleware: Verifica el token JWT
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next function
 */
const verifyToken = async (req, res, next) => {
  try {
    // Obtener token del header
    let token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de autenticación no proporcionado',
      });
    }

    // Eliminar prefijo 'Bearer '
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    // Verificar token
    const decoded = await verifyJwtToken(token);

    // Verificar que el usuario existe
    const user = await models.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no encontrado',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cuenta desactivada',
      });
    }

    // Añadir usuario al request
    req.user = user.toJSON();
    req.token = token;
    req.userId = user.id;

    next();
  } catch (error) {
    logger.error(`❌ Error de autenticación: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Token expirado',
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticación inválido',
    });
  }
};

/**
 * Middleware: Verifica el token JWT de forma opcional
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next function
 */
const verifyTokenOptional = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      return next();
    }

    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    const decoded = await verifyJwtToken(token);
    
    const user = await models.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] },
    });

    if (user && user.is_active) {
      req.user = user.toJSON();
      req.token = token;
      req.userId = user.id;
    }

    next();
  } catch {
    next();
  }
};

/**
 * Middleware: Verifica permisos de administrador
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next function
 */
const verifyAdmin = (req, res, next) => {
  // En una implementación real, el usuario tendría un campo is_admin
  // Por ahora, verificamos contra un array de IDs de administradores
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(Number) || [];
  
  if (!req.user || !adminIds.includes(req.user.id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'No tienes permisos de administrador',
    });
  }

  next();
};

/**
 * Middleware: Verifica que el usuario es el propietario del recurso
 * @param {string} paramName - Nombre del parámetro (ej: 'userId', 'conversationId')
 * @returns {Function}
 */
const verifyOwner = (paramName) => {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[paramName], 10);
    
    if (req.user.id !== resourceId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `No tienes permisos sobre este ${paramName}`,
      });
    }

    next();
  };
};

/**
 * Middleware: Verifica que el usuario es miembro de la conversación
 * @returns {Function}
 */
const verifyConversationMember = () => {
  return async (req, res, next) => {
    const { conversationId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Autenticación requerida',
      });
    }

    const isMember = await models.UserConversation.isMember(
      req.user.id,
      conversationId
    );

    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No eres miembro de esta conversación',
      });
    }

    next();
  };
};

/**
 * Middleware: Verifica permisos en una conversación
 * @param {string[]} allowedRoles - Roles permitidos
 * @returns {Function}
 */
const verifyConversationRole = (allowedRoles) => {
  return async (req, res, next) => {
    const { conversationId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Autenticación requerida',
      });
    }

    const uc = await models.UserConversation.findUserConversation(
      req.user.id,
      conversationId
    );

    // Quien salió (o fue eliminado) ya no tiene rol en la conversación
    if (!uc || uc.left_at || !allowedRoles.includes(uc.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `No tienes permisos suficientes en esta conversación (requerido: ${allowedRoles.join(', ')})`,
      });
    }

    next();
  };
};

/**
 * Refresca el token JWT
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const refreshTokens = async (refreshToken) => {
  try {
    const decoded = await verifyJwtToken(refreshToken);
    
    const user = await models.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user || !user.is_active) {
      throw new Error('Usuario no válido');
    }

    const newAccessToken = generateToken({ userId: user.id });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    logger.error('❌ Error al refrescar tokens:', error.message);
    throw error;
  }
};

module.exports = {
  verifyToken,
  verifyTokenOptional,
  verifyAdmin,
  verifyOwner,
  verifyConversationMember,
  verifyConversationRole,
  generateToken,
  generateRefreshToken,
  refreshTokens,
  verifyJwtToken,
};
