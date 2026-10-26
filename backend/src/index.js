/**
 * @file Punto de Entrada del Backend
 * @description Configuración del servidor Express + Socket.io
 * @author Arquitecto de Software Senior
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { userRoom } = require('./utils/socketRooms');

// Inicializar Sequelize y modelos
const { sequelize, testConnection, sync } = require('./models');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const languageRoutes = require('./routes/languageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Importar middleware
const { errorHandler } = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/authMiddleware');
const socketMiddleware = require('./middleware/socketMiddleware');

// Importar servicios
const translationService = require('./services/translationService');

// ============================================
// CONFIGURACIÓN DEL SERVIDOR EXPRESS
// ============================================

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
  cors: config.socket.cors,
  path: config.socket.path,
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval,
  maxHttpBufferSize: config.socket.maxHttpBufferSize,
});

// Las rutas REST lo usan (req.app.get('io')) para avisar por Socket.io
app.set('io', io);

// ============================================
// MIDDLEWARE GLOBAL
// ============================================

// Detrás de IIS/iisnode (o cualquier proxy) la IP real llega en X-Forwarded-For
if (config.security.trustProxy) {
  app.set('trust proxy', true);
}

// CORS
app.use(cors(config.security.cors));

// Helmet (seguridad)
// - crossOriginResourcePolicy 'cross-origin': el frontend en desarrollo (otro puerto)
//   puede reproducir audios e imágenes servidos desde /uploads.
// - CSP ajustada al frontend: avatares externos, Google Fonts y audios locales (blob:).
//   Sin upgrade-insecure-requests, para que funcione en hostings sin https.
if (config.security.helmetEnabled) {
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'blob:', 'data:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'upgrade-insecure-requests': null,
      },
    },
    // Sin https, HSTS solo causaría problemas si luego se sirve el sitio por http
    strictTransportSecurity: config.security.forceHttps,
  }));
}

// Parseo de JSON
app.use(express.json({ limit: '10mb' }));

// Parseo de form-data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (uploads)
// Se usa el mismo directorio en el que storageService guarda los archivos
app.use('/uploads', express.static(path.resolve(config.storage.local.uploadsDir)));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: config.rateLimit.message,
  headers: config.rateLimit.headers,
  standardHeaders: true,
  legacyHeaders: false,
});

// Solo la API cuenta para el límite (no los archivos del frontend ni los uploads)
app.use('/api', limiter);

// ============================================
// RUTAS
// ============================================

// Ruta de salud
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const mistralHealthy = await translationService.checkHealth();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    database: dbConnected ? 'connected' : 'disconnected',
    mistral: mistralHealthy ? 'healthy' : 'unhealthy',
  });
});

// Rutas públicas
app.use('/api/auth', authRoutes);
app.use('/api/languages', languageRoutes);

// Rutas protegidas
app.use('/api/users', authMiddleware.verifyToken, userRoutes);
app.use('/api/conversations', authMiddleware.verifyToken, conversationRoutes);
app.use('/api/messages', authMiddleware.verifyToken, messageRoutes);
app.use('/api/upload', authMiddleware.verifyToken, uploadRoutes);

// Frontend compilado (producción): se sirve desde el mismo servidor, así la app,
// la API y Socket.io comparten origen y no hace falta CORS.
const frontendDir = path.resolve(config.frontend.distDir);
const frontendIndex = path.join(frontendDir, 'index.html');
if (require('fs').existsSync(frontendIndex)) {
  // Los assets llevan hash en el nombre: se pueden cachear mucho tiempo
  // fallthrough: false -> un asset inexistente da 404 en vez de devolver index.html
  app.use('/assets', express.static(path.join(frontendDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(frontendDir, { index: false }));

  // Rutas del SPA (vue-router con history): cualquier GET que no sea API devuelve index.html
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/|health$).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(frontendIndex);
  });
  logger.info(`🖥️ Sirviendo frontend desde ${frontendDir}`);
}

// Ruta no encontrada
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Ruta ${req.method} ${req.path} no encontrada`,
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// ============================================
// CONFIGURACIÓN DE SOCKET.IO
// ============================================

// Middleware de Socket.io
io.use(socketMiddleware.authenticateSocket);

// Manejo de conexiones WebSocket
io.on('connection', (socket) => {
  logger.info(`✅ Conexión WebSocket establecida: ${socket.id}`);

  // Sala personal: avisos dirigidos a este usuario (p. ej. confirmaciones de lectura)
  socket.join(userRoom(socket.userId));

  // Evento: nuevo usuario conectado
  socket.on('join', async (data, acknowledge) => {
    await socketMiddleware.handleJoin(socket, data, acknowledge);
  });

  // Evento: usuario se desconecta de una conversación
  socket.on('leave', async (data) => {
    await socketMiddleware.handleLeave(socket, data);
  });

  // Evento: mensaje de texto
  socket.on('text_message', async (data, acknowledge) => {
    await socketMiddleware.handleTextMessage(socket, data, io, acknowledge);
  });

  // Evento: mensaje de audio
  socket.on('audio_message', async (data, acknowledge) => {
    await socketMiddleware.handleAudioMessage(socket, data, io, acknowledge);
  });

  // Evento: usuario está escribiendo
  socket.on('typing', (data) => {
    socket.to(String(data.conversationId)).emit('user_typing', {
      userId: socket.userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    });
  });

  // Evento: mensaje leído
  socket.on('message_read', async (data) => {
    await socketMiddleware.handleMessageRead(socket, data, io);
  });

  // Evento: mensaje entregado
  socket.on('message_delivered', async (data) => {
    await socketMiddleware.handleMessageDelivered(socket, data);
  });

  // Evento: usuario desconnectado
  socket.on('disconnect', async () => {
    await socketMiddleware.handleDisconnect(socket, io);
  });

  // Evento: error
  socket.on('error', (error) => {
    logger.error(`❌ Error en socket ${socket.id}:`, error.message);
  });
});

// ============================================
// INICIALIZACIÓN
// ============================================

const startServer = async () => {
  // Verificar conexión a la base de datos
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('❌ No se pudo conectar a la base de datos. Saliendo...');
    process.exit(1);
  }

  // Crear tablas faltantes en desarrollo; los cambios de esquema se aplican mediante migraciones.
  if (config.isDevelopment) {
    try {
      await sync();
      logger.info('✅ Modelos sincronizados con la base de datos');
    } catch (error) {
      logger.error('⚠️ Error al sincronizar modelos:', error.message);
    }
  }

  // Iniciar servidor
  server.listen(config.port, () => {
    logger.info(`🚀 Servidor iniciado en http://localhost:${config.port}`);
    logger.info(`🔌 Socket.io disponible en ws://localhost:${config.port}${config.socket.path}`);
    logger.info(`🌍 Entorno: ${config.env}`);
    logger.info(`🗄️ Base de datos: ${config.database.host}:${config.database.port}/${config.database.name}`);
  });

  // Manejo de señales de terminación
  process.on('SIGTERM', async () => {
    logger.info('🛑 Recibida señal SIGTERM. Cerrando servidor...');
    await gracefulShutdown();
  });

  process.on('SIGINT', async () => {
    logger.info('🛑 Recibida señal SIGINT. Cerrando servidor...');
    await gracefulShutdown();
  });

  process.on('uncaughtException', (error) => {
    logger.error('❌ Excepción no capturada:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promesa rechazada sin manejo:', reason);
  });
};

/**
 * Cierre elegante del servidor
 */
const gracefulShutdown = async () => {
  try {
    // Cerrar conexión a la base de datos
    const { closeConnection } = require('./models');
    await closeConnection();

    // Cerrar servidor HTTP
    server.close(() => {
      logger.info('✅ Servidor cerrado correctamente');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('❌ El servidor no se cerró correctamente');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('❌ Error durante el cierre:', error);
    process.exit(1);
  }
};

// ============================================
// INICIAR SERVIDOR
// ============================================

startServer();

// Exportar para pruebas
if (config.isTest) {
  module.exports = { app, server, io };
}
