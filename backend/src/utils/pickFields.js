/**
 * @file Copia solo los campos permitidos de un objeto (p. ej. req.body)
 * @description Evita guardar campos que el usuario no debería poder cambiar (email, is_active, ...).
 */

/**
 * @param {Object} source
 * @param {string[]} fields
 * @returns {Object} Solo los campos presentes (los ausentes no se incluyen)
 */
const pickFields = (source, fields) =>
  Object.fromEntries(fields.filter(field => source?.[field] !== undefined).map(field => [field, source[field]]));

module.exports = { pickFields };
