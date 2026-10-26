/**
 * @file Logger de la Aplicación
 * @description Configuración centralizada de logging
 * @author Arquitecto de Software Senior
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;
const path = require('path');
const config = require('../config');
const fs = require('fs');

// Crear directorio de logs si no existe
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato de log personalizado
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (meta.userId) {
    logMessage += ` (User: ${meta.userId})`;
  }
  
  if (meta.path) {
    logMessage += ` - ${meta.path}`;
  }
  
  if (stack) {
    logMessage += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0 && !meta.userId && !meta.path && !meta.method) {
    logMessage += ` - ${JSON.stringify(meta)}`;
  }
  
  return logMessage;
});

// Configuración del logger
const logger = createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Consola (solo en desarrollo)
    new transports.Console({
      silent: !config.logging.console,
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    // Archivo de log
    new transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxFileSizeMB * 1024 * 1024,
      maxFiles: config.logging.maxFiles,
      tailable: true,
    }),
  ],
  exitOnError: false,
});

// Agregar stream para morgan (middleware de logging HTTP)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Manejo de excepciones no capturadas
logger.exceptions.handle(
  new transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
  new transports.Console({
    silent: !config.logging.console,
    format: combine(
      colorize(),
      logFormat
    ),
  })
);

// Manejo de rechazos de promesas no manejados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise.toString(),
    reason: reason?.message || String(reason),
    stack: reason?.stack,
  });
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  logger.end();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  logger.end();
});

/**
 * Logger para solicitudes HTTP
 * @param {string} level - Nivel de log
 * @param {string} message - Mensaje
 * @param {Object} [meta] - Metadatos adicionales
 */
const httpLogger = (level, message, meta = {}) => {
  logger.log(level, message, meta);
};

/**
 * Logger para errores
 * @param {Error} error - Error
 * @param {string} [context] - Contexto del error
 */
const errorLogger = (error, context = '') => {
  logger.error(error.message, {
    context,
    stack: error.stack,
    name: error.name,
  });
};

module.exports = logger;
