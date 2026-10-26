/**
 * @file Middleware de Manejo de Errores
 * @description Middleware global para manejo de errores
 * @author Arquitecto de Software Senior
 */

const logger = require('../utils/logger');
const config = require('../config');

/**
 * @typedef {Object} AppError
 * @property {string} name - Nombre del error
 * @property {string} message - Mensaje del error
 * @property {number} statusCode - Código de estado HTTP
 * @property {Object} [details] - Detalles adicionales
 * @property {boolean} [isOperational] - Si es un error operativo
 */

/**
 * Clase base para errores de la aplicación
 */
class AppError extends Error {
  constructor(name, message, statusCode = 500, details = {}, isOperational = true) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error de validación
 */
class ValidationError extends AppError {
  constructor(message = 'Error de validación', details = {}) {
    super('ValidationError', message, 400, details);
  }
}

/**
 * Error de autenticación
 */
class AuthenticationError extends AppError {
  constructor(message = 'Error de autenticación') {
    super('AuthenticationError', message, 401);
  }
}

/**
 * Error de autorización
 */
class AuthorizationError extends AppError {
  constructor(message = 'No autorizado') {
    super('AuthorizationError', message, 403);
  }
}

/**
 * Error no encontrado
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super('NotFoundError', message, 404);
  }
}

/**
 * Error de conflicto
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto de recursos') {
    super('ConflictError', message, 409);
  }
}

/**
 * Error de límite de velocidad
 */
class RateLimitError extends AppError {
  constructor(message = 'Demasiadas solicitudes') {
    super('RateLimitError', message, 429);
  }
}

/**
 * Middleware de manejo de errores
 * @param {Error} error - Error
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next function
 */
const errorHandler = (error, req, res, next) => {
  // Si el error ya fue manejado, pasar al siguiente middleware
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Error interno del servidor';
  let name = error.name || 'Error';
  let details = error.details || {};
  let stack = config.isDevelopment ? error.stack : undefined;

  // Manejar errores específicos
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validación';
    details = error.details || { errors: error.errors || [] };
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'No autorizado';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token de autenticación inválido';
    name = 'JsonWebTokenError';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token de autenticación expirado';
    name = 'TokenExpiredError';
  } else if (error.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Error de validación de datos';
    details = error.errors?.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value,
    })) || [];
  } else if (error.name === 'SequelizeDatabaseError') {
    statusCode = 400;
    message = 'Error de base de datos';
    details = { error: error.message };
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'El recurso ya existe';
    details = { fields: error.fields || {} };
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = error.message;
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = `El archivo es demasiado grande. Máximo permitido: ${storageService.localConfig.maxFileSizeMB}MB`;
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Se esperaba un archivo pero no se proporcionó';
    }
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = `El archivo es demasiado grande. Máximo permitido: ${storageService.localConfig.maxFileSizeMB}MB`;
  }

  // Loguear el error
  if (statusCode >= 500) {
    logger.error(`❌ Error interno: ${message}`, {
      error: error.message,
      stack: config.isDevelopment ? error.stack : undefined,
      path: req.path,
      method: req.method,
      userId: req.userId,
    });
  } else {
    logger.warn(`⚠️ Error ${statusCode}: ${message}`, {
      path: req.path,
      method: req.method,
      userId: req.userId,
    });
  }

  // Enviar respuesta
  const response = {
    success: false,
    error: name,
    message,
  };

  if (Object.keys(details).length > 0) {
    response.details = details;
  }

  if (config.isDevelopment && stack) {
    response.stack = stack.split('\n');
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware para manejar rutas no encontradas
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Ruta ${req.method} ${req.path} no encontrada`);
  next(error);
};

/**
 * Middleware para manejar errores 404
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Ruta ${req.method} ${req.path} no encontrada`,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  notFound,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};
