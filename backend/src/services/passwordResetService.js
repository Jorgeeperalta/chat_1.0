/**
 * @file Recuperar contraseña
 * @description
 *  1. requestReset: si el correo es de una cuenta activa, genera un token aleatorio de un solo uso
 *     (vence en PASSWORD_RESET_EXPIRES_MINUTES) y envía el enlace por correo. Quien lo pide recibe
 *     siempre la misma respuesta, exista o no la cuenta: así no se puede averiguar qué correos
 *     están registrados.
 *  2. findValidToken: el enlace sigue sirviendo (existe, no se usó, no venció).
 *  3. resetPassword: guarda la nueva contraseña (bcrypt, en el hook del modelo), anula el enlace
 *     y los demás pendientes, y cierra las sesiones abiertas (password_changed_at).
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');
const { models, sequelize } = require('../models');
const mailService = require('./mailService');

// Pedidos repetidos del mismo usuario: no más de un correo por minuto
const MIN_SECONDS_BETWEEN_EMAILS = 60;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const EMAILS = {
  es: {
    subject: 'Restablecer tu contraseña de Converxar',
    hello: (name) => `Hola${name ? ` ${name}` : ''}:`,
    body: 'Recibimos un pedido para restablecer la contraseña de tu cuenta. Para elegir una nueva, abre este enlace:',
    button: 'Restablecer contraseña',
    expires: (minutes) => `El enlace vence en ${minutes} minutos y sirve una sola vez.`,
    ignore: 'Si no lo pediste, ignora este correo: tu contraseña no cambia.',
  },
  en: {
    subject: 'Reset your Converxar password',
    hello: (name) => `Hi${name ? ` ${name}` : ''},`,
    body: 'We received a request to reset the password for your account. To choose a new one, open this link:',
    button: 'Reset password',
    expires: (minutes) => `The link expires in ${minutes} minutes and can be used only once.`,
    ignore: "If you didn't ask for this, ignore this email: your password won't change.",
  },
  pt: {
    subject: 'Redefinir sua senha do Converxar',
    hello: (name) => `Olá${name ? ` ${name}` : ''},`,
    body: 'Recebemos um pedido para redefinir a senha da sua conta. Para escolher uma nova, abra este link:',
    button: 'Redefinir senha',
    expires: (minutes) => `O link vence em ${minutes} minutos e pode ser usado uma única vez.`,
    ignore: 'Se você não pediu, ignore este e-mail: sua senha não muda.',
  },
  fr: {
    subject: 'Réinitialiser votre mot de passe Converxar',
    hello: (name) => `Bonjour${name ? ` ${name}` : ''},`,
    body: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Pour en choisir un nouveau, ouvrez ce lien :',
    button: 'Réinitialiser le mot de passe',
    expires: (minutes) => `Le lien expire dans ${minutes} minutes et ne peut être utilisé qu'une fois.`,
    ignore: "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.",
  },
  de: {
    subject: 'Converxar-Passwort zurücksetzen',
    hello: (name) => `Hallo${name ? ` ${name}` : ''},`,
    body: 'Wir haben eine Anfrage zum Zurücksetzen des Passworts deines Kontos erhalten. Um ein neues festzulegen, öffne diesen Link:',
    button: 'Passwort zurücksetzen',
    expires: (minutes) => `Der Link läuft in ${minutes} Minuten ab und kann nur einmal verwendet werden.`,
    ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail: Dein Passwort bleibt unverändert.',
  },
  it: {
    subject: 'Reimposta la password di Converxar',
    hello: (name) => `Ciao${name ? ` ${name}` : ''},`,
    body: 'Abbiamo ricevuto una richiesta di reimpostare la password del tuo account. Per sceglierne una nuova, apri questo link:',
    button: 'Reimposta password',
    expires: (minutes) => `Il link scade tra ${minutes} minuti e si può usare una sola volta.`,
    ignore: 'Se non l\'hai richiesto, ignora questa email: la tua password non cambia.',
  },
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Correo con el enlace, en el idioma del usuario
 * @returns {{subject: string, text: string, html: string}}
 */
const buildEmail = ({ name, link, languageCode, minutes }) => {
  const t = EMAILS[String(languageCode || '').slice(0, 2)] || EMAILS.en;
  const text = [t.hello(name), '', t.body, link, '', t.expires(minutes), t.ignore].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#1565c0">Converxar</h1>
    <p style="margin:0 0 12px">${escapeHtml(t.hello(name))}</p>
    <p style="margin:0 0 20px">${escapeHtml(t.body)}</p>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#1565c0;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">${escapeHtml(t.button)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">${escapeHtml(t.expires(minutes))}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${escapeHtml(t.ignore)}</p>
    <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all">${escapeHtml(link)}</p>
  </div>
</body></html>`;
  return { subject: t.subject, text, html };
};

/**
 * Paso 1: pedido de "olvidé mi contraseña". No informa si el correo existe.
 * @param {string} email
 * @param {string} [requestIp]
 * @returns {Promise<void>}
 */
const requestReset = async (email, requestIp) => {
  // El correo se guarda como se escribió al registrarse: se compara sin mayúsculas
  const user = await models.User.findOne({
    where: {
      [Op.and]: [
        sequelize.where(sequelize.fn('lower', sequelize.col('email')), String(email).trim().toLowerCase()),
        { is_active: true },
      ],
    },
    include: [{ model: models.Language, as: 'preferredLanguage', attributes: ['code'] }],
  });
  if (!user) {
    logger.info('🔑 Recuperar contraseña: correo no registrado (se responde igual)');
    return;
  }

  const recent = await models.PasswordResetToken.findOne({
    where: {
      user_id: user.id,
      created_at: { [Op.gt]: new Date(Date.now() - MIN_SECONDS_BETWEEN_EMAILS * 1000) },
    },
  });
  if (recent) {
    logger.info(`🔑 Recuperar contraseña: pedido repetido del usuario ${user.id}, no se reenvía`);
    return;
  }

  // Un solo enlace vigente por usuario: los anteriores dejan de servir
  await models.PasswordResetToken.update(
    { used_at: new Date() },
    { where: { user_id: user.id, used_at: null } }
  );

  const token = crypto.randomBytes(32).toString('hex');
  const minutes = config.passwordReset.expiresMinutes;
  await models.PasswordResetToken.create({
    user_id: user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + minutes * 60 * 1000),
    request_ip: requestIp ? String(requestIp).slice(0, 45) : null,
  });

  const link = `${config.appUrl}/auth/reset-password?token=${token}`;
  const email$ = buildEmail({
    name: user.first_name || user.username,
    link,
    languageCode: user.preferredLanguage?.code,
    minutes,
  });

  const sent = await mailService.sendMail({ to: user.email, ...email$ });
  if (sent) {
    logger.info(`🔑 Enlace para restablecer la contraseña enviado al usuario ${user.id}`);
  } else if (config.isDevelopment) {
    // Sin SMTP en desarrollo: el enlace queda en el log para poder probar
    logger.warn(`🔑 (desarrollo, sin SMTP) Enlace para el usuario ${user.id}: ${link}`);
  }
};

/**
 * Paso 2: el enlace sigue sirviendo
 * @param {string} token
 * @returns {Promise<Object|null>} El registro del token, o null
 */
const findValidToken = async (token) => {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  return models.PasswordResetToken.findOne({
    where: {
      token_hash: hashToken(token),
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
  });
};

/**
 * Paso 3: nueva contraseña
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<boolean>} false si el enlace no sirve (vencido, usado o inexistente)
 */
const resetPassword = async (token, newPassword) => {
  const record = await findValidToken(token);
  if (!record) return false;

  // Se marca usado antes que nada: dos envíos simultáneos con el mismo enlace no cambian dos veces
  const [claimed] = await models.PasswordResetToken.update(
    { used_at: new Date() },
    { where: { id: record.id, used_at: null } }
  );
  if (!claimed) return false;

  const user = await models.User.findByPk(record.user_id);
  if (!user || !user.is_active) return false;

  // El hook beforeSave del modelo la guarda con bcrypt
  user.password_hash = newPassword;
  user.password_changed_at = new Date();
  await user.save();

  await models.PasswordResetToken.update(
    { used_at: new Date() },
    { where: { user_id: user.id, used_at: null } }
  );
  await models.UserSession.expireUserSessions(user.id);

  logger.info(`🔑 Contraseña restablecida para el usuario ${user.id}`);
  return true;
};

module.exports = {
  hashToken,
  buildEmail,
  requestReset,
  findValidToken,
  resetPassword,
};
