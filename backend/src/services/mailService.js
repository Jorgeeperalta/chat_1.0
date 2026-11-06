/**
 * @file Servicio de correo
 * @description Envío de correos por SMTP (nodemailer). Se configura con SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS y MAIL_FROM. Sin SMTP_HOST no se envía nada (se avisa en el log).
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

let transporter = null;

/**
 * @returns {boolean} Si hay un servidor SMTP configurado
 */
const isConfigured = () => Boolean(config.mail.host && config.mail.from);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      ...(config.mail.user && { auth: { user: config.mail.user, pass: config.mail.password } }),
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }
  return transporter;
};

/**
 * Envía un correo
 * @param {Object} message
 * @param {string} message.to
 * @param {string} message.subject
 * @param {string} message.text
 * @param {string} [message.html]
 * @returns {Promise<boolean>} true si se envió
 */
const sendMail = async ({ to, subject, text, html }) => {
  if (!isConfigured()) {
    logger.warn('⚠️ SMTP no configurado (SMTP_HOST / MAIL_FROM): el correo no se envió');
    return false;
  }
  await getTransporter().sendMail({ from: config.mail.from, to, subject, text, html });
  return true;
};

// Resultado de la prueba de conexión al arrancar (se muestra en /health)
let status = isConfigured() ? 'checking' : 'not configured';

/**
 * Prueba una vez la conexión y el usuario/contraseña del SMTP, sin enviar nada.
 * Así un error de configuración se ve en /health y en el log al arrancar, no recién cuando
 * alguien pide recuperar su contraseña.
 * @returns {Promise<string>} 'ok', 'not configured' o 'error: ...'
 */
const verifyConnection = async () => {
  if (!isConfigured()) return status;
  try {
    await getTransporter().verify();
    status = 'ok';
    logger.info(`📧 SMTP listo (${config.mail.host}:${config.mail.port})`);
  } catch (error) {
    status = `error: ${error.code || ''} ${error.message}`.trim().slice(0, 200);
    logger.error(`❌ SMTP ${config.mail.host}:${config.mail.port} no funciona: ${error.message}`);
  }
  return status;
};

const getStatus = () => status;

module.exports = {
  isConfigured,
  sendMail,
  verifyConnection,
  getStatus,
};
