/**
 * @file Rutas de Upload
 * @description Rutas para subir archivos (imágenes, audio, etc.)
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const storageService = require('../services/storageService');
const logger = require('../utils/logger');

// Configurar multer
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
 * @route POST /api/upload/image
 * @description Sube una imagen
 * @access Privado
 */
router.post(
  '/image',
  authMiddleware.verifyToken,
  upload.single('image'),
  [
    body('file_name').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionó ningún archivo',
        });
      }

      const { mimetype } = req.file;

      if (!storageService.validateMimeType(mimetype, storageService.localConfig.allowedImageTypes)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tipo de archivo no permitido para imagen',
        });
      }

      const file = await storageService.saveImageFile(
        req.file.buffer,
        req.file.originalname,
        mimetype
      );

      logger.info(`🖼️ Imagen subida por usuario ${req.userId}: ${file.fileName}`);

      res.json({
        success: true,
        file: {
          url: file.url,
          fileName: file.fileName,
          size: file.size,
          mimeType: mimetype,
          thumbnailUrl: file.thumbnailUrl,
        },
      });
    } catch (error) {
      logger.error(`❌ Error al subir imagen: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/upload/audio
 * @description Sube un archivo de audio
 * @access Privado
 */
router.post(
  '/audio',
  authMiddleware.verifyToken,
  upload.single('audio'),
  [
    body('file_name').optional().isString(),
    body('duration').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionó ningún archivo',
        });
      }

      const { mimetype } = req.file;

      if (!storageService.validateMimeType(mimetype, storageService.localConfig.allowedAudioTypes)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tipo de archivo no permitido para audio',
        });
      }

      const file = await storageService.saveAudioFile(
        req.file.buffer,
        req.file.originalname,
        mimetype
      );

      logger.info(`🎤 Audio subido por usuario ${req.userId}: ${file.fileName} (${file.size} bytes)`);

      res.json({
        success: true,
        file: {
          url: file.url,
          fileName: file.fileName,
          size: file.size,
          mimeType: mimetype,
          duration: req.body.duration || 0,
        },
      });
    } catch (error) {
      logger.error(`❌ Error al subir audio: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/upload/file
 * @description Sube un archivo genérico
 * @access Privado
 */
router.post(
  '/file',
  authMiddleware.verifyToken,
  upload.single('file'),
  [
    body('file_name').optional().isString(),
    body('file_type').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionó ningún archivo',
        });
      }

      const { mimetype } = req.file;

      // Validar tamaño
      if (!storageService.validateFileSize(req.file.buffer.length)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `El archivo es demasiado grande. Máximo permitido: ${storageService.localConfig.maxFileSizeMB}MB`,
        });
      }

      const file = await storageService.saveFile(
        req.file.buffer,
        req.file.originalname,
        mimetype,
        'files'
      );

      logger.info(`📄 Archivo subido por usuario ${req.userId}: ${file.fileName} (${file.size} bytes)`);

      res.json({
        success: true,
        file: {
          url: file.url,
          fileName: file.fileName,
          size: file.size,
          mimeType: mimetype,
          fileType: storageService.getFileType(mimetype),
        },
      });
    } catch (error) {
      logger.error(`❌ Error al subir archivo: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route DELETE /api/upload
 * @description Elimina un archivo
 * @access Privado
 */
router.delete(
  '/',
  authMiddleware.verifyToken,
  [
    body('url').isString().withMessage('La URL del archivo es obligatoria'),
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

      const { url } = req.body;

      const deleted = await storageService.deleteFile(url);

      if (deleted) {
        logger.info(`🗑️ Archivo eliminado por usuario ${req.userId}: ${url}`);
        res.json({
          success: true,
          message: 'Archivo eliminado correctamente',
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Archivo no encontrado',
        });
      }
    } catch (error) {
      logger.error(`❌ Error al eliminar archivo: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route GET /api/upload/config
 * @description Obtiene la configuración de upload
 * @access Privado
 */
router.get('/config', authMiddleware.verifyToken, (req, res) => {
  res.json({
    success: true,
    config: {
      maxFileSizeMB: storageService.localConfig.maxFileSizeMB,
      allowedAudioTypes: storageService.localConfig.allowedAudioTypes,
      allowedImageTypes: storageService.localConfig.allowedImageTypes,
    },
  });
});

module.exports = router;
