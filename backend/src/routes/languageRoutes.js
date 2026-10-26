/**
 * @file Rutas de Idiomas
 * @description Rutas para obtener la lista de idiomas soportados
 * @author Arquitecto de Software Senior
 */

const express = require('express');
const router = express.Router();
const { models } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * @route GET /api/languages
 * @description Obtiene todos los idiomas soportados
 * @access Público
 */
router.get('/', async (req, res, next) => {
  try {
    const languages = await models.Language.findAllActive();

    res.json({
      success: true,
      languages,
    });
  } catch (error) {
    logger.error(`❌ Error al obtener idiomas: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/languages/:code
 * @description Obtiene un idioma por código
 * @access Público
 */
router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    const language = await models.Language.findByCode(code);

    if (!language) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Idioma no encontrado',
      });
    }

    res.json({
      success: true,
      language,
    });
  } catch (error) {
    logger.error(`❌ Error al obtener idioma ${req.params.code}: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/languages/me
 * @description Obtiene los idiomas del usuario autenticado
 * @access Privado
 */
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const user = await models.User.findByPk(req.userId, {
      include: [
        {
          model: models.Language,
          as: 'nativeLanguage',
          attributes: ['id', 'code', 'name', 'native_name', 'flag_emoji'],
        },
        {
          model: models.Language,
          as: 'preferredLanguage',
          attributes: ['id', 'code', 'name', 'native_name', 'flag_emoji'],
        },
      ],
    });

    res.json({
      success: true,
      nativeLanguage: user.nativeLanguage,
      preferredLanguage: user.preferredLanguage,
    });
  } catch (error) {
    logger.error(`❌ Error al obtener idiomas del usuario: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/languages/supported
 * @description Obtiene la lista de idiomas soportados (desde configuración)
 * @access Público
 */
router.get('/supported', (req, res) => {
  res.json({
    success: true,
    languages: config.translation.supportedLanguages,
  });
});

module.exports = router;
