/**
 * @file Nombres de salas de Socket.io
 */

/**
 * Sala personal de cada usuario (todas sus pestañas/dispositivos). El prefijo evita
 * chocar con las salas de conversación, que usan el id numérico a secas.
 * @param {number|string} userId
 * @returns {string}
 */
const userRoom = (userId) => `user:${userId}`;

module.exports = { userRoom };
