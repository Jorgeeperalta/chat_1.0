/**
 * @file Datos para mostrar una conversación en listas
 * @description Nombre, avatar y estado en línea del otro participante (o del grupo)
 */

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
  if (conversation?.type === 'group') return conversation.name || 'Grupo';
  return getUserDisplayName(getOtherUser(conversation, currentUserId)) || conversation?.name || 'Chat';
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
