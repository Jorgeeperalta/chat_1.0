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

// ============================================
// MIDDLEWARE GLOBAL
// ============================================

// CORS
app.use(cors(config.security.cors));

// Helmet (seguridad)
if (config.security.helmetEnabled) {
  app.use(helmet());
}

// Parseo de JSON
app.use(express.json({ limit: '10mb' }));

// Parseo de form-data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: config.rateLimit.message,
  headers: config.rateLimit.headers,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

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

  // Evento: nuevo usuario conectado
  socket.on('join', async (data) => {
    await socketMiddleware.handleJoin(socket, data);
  });

  // Evento: usuario se desconecta de una conversación
  socket.on('leave', async (data) => {
    await socketMiddleware.handleLeave(socket, data);
  });

  // Evento: mensaje de texto
  socket.on('text_message', async (data) => {
    await socketMiddleware.handleTextMessage(socket, data, io);
  });

  // Evento: mensaje de audio
  socket.on('audio_message', async (data) => {
    await socketMiddleware.handleAudioMessage(socket, data, io);
  });

  // Evento: usuario está escribiendo
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', {
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

  // Sincronizar modelos (en producción usar migraciones)
  if (config.isDevelopment) {
    try {
      await sync({ alter: true });
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
