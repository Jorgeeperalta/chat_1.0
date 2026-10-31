/**
 * @file Configuración Central de la Aplicación
 * @description Módulo que centraliza todas las configuraciones de la aplicación
 * @author Arquitecto de Software Senior
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️  Archivo .env no encontrado. Usando valores por defecto.');
}

// ============================================
// VALIDACIÓN DE VARIABLES OBLIGATORIAS
// ============================================
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
  process.exit(1);
}

// ============================================
// CONFIGURACIÓN GENERAL
// ============================================
const config = {
  env: process.env.NODE_ENV || 'development',
  // Con HttpPlatformHandler PORT es un número; con iisnode sería un named pipe (\\.\pipe\...)
  port: /^\d+$/.test(process.env.PORT || '') ? parseInt(process.env.PORT, 10) : (process.env.PORT || 3000),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // ============================================
  // BASE DE DATOS
  // ============================================
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || 'chat_translate_app',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'mysql',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
    logging: process.env.DB_LOGGING === 'true' || false,
    timezone: process.env.DB_TIMEZONE || '+00:00',
  },
  
  // ============================================
  // JWT (AUTENTICACIÓN)
  // ============================================
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256',
    issuer: 'chat-translate-app',
  },
  
  // ============================================
  // SOCKET.IO
  // ============================================
  socket: {
    corsOrigin: process.env.SOCKET_IO_CORS_ORIGIN?.split(',') || ['http://localhost:8080', 'http://localhost:5173'],
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    pingTimeout: parseInt(process.env.SOCKET_IO_PING_TIMEOUT, 10) || 20000,
    pingInterval: parseInt(process.env.SOCKET_IO_PING_INTERVAL, 10) || 25000,
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8080', 'http://localhost:5173'],
      methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(',') || ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  },
  
  // ============================================
  // MISTRAL AI API
  // ============================================
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    baseUrl: process.env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1',
    translationModel: process.env.MISTRAL_TRANSLATION_MODEL || 'mistral-small',
    maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS, 10) || 1000,
    temperature: parseFloat(process.env.MISTRAL_TEMPERATURE) || 0.7,
    timeoutMs: parseInt(process.env.MISTRAL_TIMEOUT_MS, 10) || 30000,
    
    // Configuración de retry
    maxRetries: parseInt(process.env.MISTRAL_MAX_RETRIES, 10) || 3,
    retryDelayMs: parseInt(process.env.MISTRAL_RETRY_DELAY_MS, 10) || 1000,
    
    // Configuración de cache
    cacheEnabled: process.env.TRANSLATION_CACHE_ENABLED === 'true',
    cacheTTLHours: parseInt(process.env.TRANSLATION_CACHE_TTL_HOURS, 10) || 24,
    
    // Fallback (opcional)
    fallbackProvider: process.env.FALLBACK_TRANSLATION_API || null,
    fallbackApiKey: process.env.FALLBACK_API_KEY || null,
  },
  
  // ============================================
  // FRONTEND COMPILADO (producción)
  // ============================================
  frontend: {
    // Carpeta con el build de Vite (index.html + assets). Si no existe, no se sirve.
    distDir: process.env.FRONTEND_DIST_DIR || path.join(__dirname, '../../public'),
  },

  // ============================================
  // ALMACENAMIENTO DE ARCHIVOS
  // ============================================
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    
    // Configuración para almacenamiento local
    local: {
      uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
      allowedAudioTypes: process.env.ALLOWED_AUDIO_TYPES?.split(',') || [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/mp3',
        'audio/webm',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
      ],
      allowedImageTypes: process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ],
    },
    
    // Configuración para AWS S3 (opcional)
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
      region: process.env.AWS_REGION || null,
      bucket: process.env.AWS_S3_BUCKET || null,
      publicUrl: process.env.AWS_S3_PUBLIC_URL || null,
    },
  },
  
  // ============================================
  // LOGGING
  // ============================================
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(__dirname, '../../logs/app.log'),
    maxFiles: parseInt(process.env.MAX_LOG_FILES, 10) || 10,
    maxFileSizeMB: parseInt(process.env.LOG_FILE_SIZE_MB, 10) || 10,
    console: true,
  },
  
  // ============================================
  // RATE LIMITING
  // ============================================
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later',
    headers: true,
  },
  
  // ============================================
  // SEGURIDAD
  // ============================================
  security: {
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Activar solo cuando el sitio tenga certificado (envía Strict-Transport-Security)
    forceHttps: process.env.FORCE_HTTPS === 'true',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8080', 'http://localhost:5173'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  },

  // ============================================
  // NOTIFICACIONES PUSH (Web Push)
  // ============================================
  // Claves VAPID: se generan una sola vez con "npx web-push generate-vapid-keys".
  // Si se cambian, los teléfonos deben volver a activar las notificaciones.
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@converxar.com',
  },
  
  // ============================================
  // CONFIGURACIÓN DE TRADUCCIÓN
  // ============================================
  translation: {
    // Idiomas soportados
    supportedLanguages: [
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    ],
    
    // Configuración de procesamiento de audio
    audio: {
      sampleRate: 48000,
      bitsPerSecond: 128000,
      mimeType: 'audio/webm',
      maxDurationSeconds: 300, // 5 minutos
    },
  },
};

// ============================================
// EXPORTACIÓN
// ============================================

// Validar configuración crítica
if (!config.mistral.apiKey && config.mistral.fallbackProvider) {
  console.warn('⚠️  No se ha configurado MISTRAL_API_KEY. Usando proveedor de fallback si está configurado.');
}

if (config.storage.type === 's3' && !config.storage.s3.accessKeyId) {
  console.warn('⚠️  Configuración S3 incompleta. Volviendo a almacenamiento local.');
  config.storage.type = 'local';
}

module.exports = config;
