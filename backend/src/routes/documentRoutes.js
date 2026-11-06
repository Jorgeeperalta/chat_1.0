/**
 * @file Rutas de Documentos (OCR)
 * @description Extracción de texto de PDFs e imágenes escaneadas, para cuentas empresariales
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('../config');
const { models } = require('../models');
const logger = require('../utils/logger');
const ocrService = require('../services/ocrService');
const { sanitizeFileName } = require('../utils/attachmentTypes');

// En memoria: los documentos no se guardan en el servidor, solo se leen y se descartan
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.mistral.ocrMaxFileSizeMB * 1024 * 1024,
    files: config.mistral.ocrMaxFiles,
  },
});

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: () => `Cada archivo puede pesar hasta ${config.mistral.ocrMaxFileSizeMB} MB`,
  LIMIT_FILE_COUNT: () => `Se pueden procesar hasta ${config.mistral.ocrMaxFiles} archivos a la vez`,
  LIMIT_UNEXPECTED_FILE: () => 'Los archivos deben enviarse en el campo "documents"',
};

/**
 * Solo cuentas empresariales (users.account_type = 'business')
 */
const requireBusinessAccount = (req, res, next) => {
  if (req.user?.account_type !== 'business') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'El OCR de documentos está disponible para cuentas empresariales',
    });
  }
  next();
};

/**
 * Recibe los archivos y responde 400/413 con un mensaje claro si no cumplen los límites
 */
const receiveDocuments = (req, res, next) => {
  upload.array('documents')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: 'Bad Request',
        message: MULTER_MESSAGES[error.code]?.() || error.message,
      });
    }
    next(error);
  });
};

/**
 * @route POST /api/documents/ocr
 * @description Extrae el texto de uno o varios documentos (PDF, JPG, PNG, WEBP).
 * Campos: documents (archivos), translate_to (opcional: código de idioma para traducir el texto).
 * Responde un resultado por archivo, en el mismo orden; si uno falla, los demás siguen.
 * @access Privado (cuentas empresariales)
 */
router.post(
  '/ocr',
  requireBusinessAccount,
  receiveDocuments,
  async (req, res, next) => {
    try {
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se recibió ningún documento',
        });
      }

      if (!config.mistral.apiKey) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'El OCR no está configurado en el servidor',
        });
      }

      let translateTo = null;
      if (req.body.translate_to) {
        const language = await models.Language.findByCode(String(req.body.translate_to));
        if (!language) {
          return res.status(400).json({ error: 'Bad Request', message: 'Idioma de traducción no válido' });
        }
        translateTo = language.code;
      }

      const documents = await ocrService.mapWithConcurrency(
        files,
        config.mistral.ocrConcurrency,
        async (file) => {
          const fileName = sanitizeFileName(file.originalname);
          if (!ocrService.isSupportedDocument(file.mimetype, file.buffer)) {
            return { file_name: fileName, error: 'unsupported', message: 'Solo se aceptan PDF, JPG, PNG o WEBP' };
          }
          try {
            return await ocrService.processDocument({ ...file, originalname: fileName }, { translateTo });
          } catch (error) {
            logger.warn(`⚠️ OCR: falló ${fileName}: ${error.message}`);
            return { file_name: fileName, error: 'ocr_failed', message: 'No se pudo leer el documento' };
          }
        }
      );

      logger.info(`📄 OCR: ${files.length} documento(s) de la cuenta ${req.userId}`);
      res.json({ success: true, documents });
    } catch (error) {
      logger.error(`❌ Error en OCR de documentos: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
