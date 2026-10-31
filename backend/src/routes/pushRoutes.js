/**
 * @file Rutas de Notificaciones Push
 * @description Registro de los teléfonos/navegadores que reciben notificaciones push
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { models } = require('../models');
const logger = require('../utils/logger');
const pushService = require('../services/pushService');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ error: 'Validation Error', details: errors.array() });
  return false;
};

/**
 * @route GET /api/push/public-key
 * @description Clave pública VAPID para suscribir el navegador (null si push está desactivado)
 * @access Privado
 */
router.get('/public-key', (req, res) => {
  res.json({ success: true, publicKey: pushService.getPublicKey() });
});

/**
 * @route POST /api/push/subscribe
 * @description Guarda la suscripción push de este dispositivo para el usuario actual
 * @access Privado
 */
router.post(
  '/subscribe',
  [
    body('endpoint').isURL({ protocols: ['https'], require_tld: false }).isLength({ max: 500 })
      .withMessage('Suscripción inválida'),
    body('keys.p256dh').isString().notEmpty().isLength({ max: 255 }),
    body('keys.auth').isString().notEmpty().isLength({ max: 255 }),
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      if (!pushService.isEnabled()) {
        return res.status(503).json({ error: 'Service Unavailable', message: 'Las notificaciones push no están configuradas' });
      }

      const { endpoint, keys } = req.body;

      // El mismo dispositivo puede pasar a otro usuario (cerrar sesión e iniciar con otra cuenta)
      const existing = await models.PushSubscription.findOne({ where: { endpoint } });
      if (existing) {
        await existing.update({ user_id: req.userId, p256dh: keys.p256dh, auth: keys.auth });
      } else {
        await models.PushSubscription.create({
          user_id: req.userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        });
      }

      res.status(201).json({ success: true });
    } catch (error) {
      logger.error(`❌ Error al guardar suscripción push: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/push/unsubscribe
 * @description Deja de enviar notificaciones a este dispositivo (al cerrar sesión o desactivarlas)
 * @access Privado
 */
router.post(
  '/unsubscribe',
  [body('endpoint').isString().notEmpty()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      await models.PushSubscription.destroy({ where: { endpoint: req.body.endpoint, user_id: req.userId } });
      res.json({ success: true });
    } catch (error) {
      logger.error(`❌ Error al borrar suscripción push: ${error.message}`);
      next(error);
    }
  }
);

module.exports = router;
