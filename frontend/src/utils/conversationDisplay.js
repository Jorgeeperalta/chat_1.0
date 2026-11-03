/**
 * @file Datos para mostrar una conversación en listas
 * @description Nombre, avatar y estado en línea del otro participante (o del grupo)
 */

import { t } from '@/i18n';

/**
 * Participante distinto del usuario actual (conversaciones privadas)
 * @param {Object} conversation
 * @param {number} currentUserId
 * @returns {Object|null}
 */
export const getOtherUser = (conversation, currentUserId) =>
  conversation?.users?.find(user => Number(user.id) !== Number(currentUserId)) || null;

/**
 * Nombre visible de un usuario: nombre y apellido, o el nombre de usuario
 * @param {Object} user
 * @returns {string}
 */
export const getUserDisplayName = (user) => {
  if (!user) return '';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '';
};

/**
 * Iniciales para el avatar cuando no hay foto
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || '?';

/**
 * Título de la conversación: nombre del grupo o del otro participante
 * @param {Object} conversation
 * @param {number} currentUserId
 * @returns {string}
 */
export const getConversationTitle = (conversation, currentUserId) => {
  if (conversation?.type === 'group') return conversation.name || t('chat.group');
  return getUserDisplayName(getOtherUser(conversation, currentUserId)) || conversation?.name || t('pages.chat');
};

/**
 * Hace cuánto: "hace 5 minutos", "ayer"... en el idioma de la interfaz.
 * Pasada una semana muestra la fecha.
 * @param {string|Date} date
 * @param {string} locale
 * @param {number} [now] - Date.now(), para que la vista pueda refrescarlo
 * @returns {string}
 */
export const formatRelativeTime = (date, locale, now = Date.now()) => {
  if (!date) return '';
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return '';

  const seconds = Math.round((time - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);

  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day');
  return new Date(time).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

// Mensajes que no son texto: ícono y nombre (en el idioma de la interfaz)
const MEDIA_PREVIEW = {
  audio: ['🎤', 'chat.voiceMessage'],
  image: ['📷', 'chat.photo'],
  video: ['🎥', 'chat.video'],
  file: ['📎', 'chat.document'],
};

/**
 * Texto corto de un mensaje para listas, citas y la barra de "Respondiendo a":
 * "hola", "🎤 Mensaje de voz", "📷 Foto", "📷 mirá esto" (foto con texto), "📎 informe.pdf"
 * @param {Object} message
 * @returns {string}
 */
export const getMessagePreview = (message) => {
  if (!message) return '';
  if (message.is_deleted) return t('chat.messageDeleted');
  const media = MEDIA_PREVIEW[message.message_type];
  if (!media) return message.content || '';
  const [icon, label] = media;
  const fileName = message.message_type === 'file' ? message.attachments?.[0]?.file_name : null;
  return `${icon} ${message.content || fileName || t(label)}`;
};

// Colores de los avatares de iniciales: todos con buen contraste para texto blanco
const AVATAR_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5',
  '#00838F', '#00897B', '#43A047', '#F4511E', '#6D4C41', '#546E7A',
];

/**
 * Color fijo para el avatar de una persona o grupo: siempre el mismo para el mismo ID,
 * así se reconoce a cada uno de un vistazo (como en WhatsApp o Gmail)
 * @param {number|string} seed - ID del usuario (o 'g' + ID para un grupo)
 * @returns {string} Color hexadecimal
 */
export const getAvatarColor = (seed) => {
  const text = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/**
 * Color del avatar de una conversación: el del otro participante o, en un grupo, uno propio del grupo
 * @param {Object} conversation
 * @param {number} currentUserId
 * @returns {string}
 */
export const getConversationColor = (conversation, currentUserId) =>
  conversation?.type === 'group'
    ? getAvatarColor(`g${conversation.id}`)
    : getAvatarColor(getOtherUser(conversation, currentUserId)?.id ?? conversation?.id);
