/**
 * @file Tipos de archivo que se pueden adjuntar a un mensaje
 * @description Lista cerrada a propósito: lo subido se sirve desde /uploads en el mismo
 * dominio que la app, así que nunca se acepta HTML, SVG ni JavaScript (se ejecutarían en el sitio).
 * La extensión con la que se guarda sale de esta tabla, nunca del nombre que manda el usuario.
 */

const ATTACHMENT_TYPES = {
  // Imágenes (las fotos de la cámara llegan como JPEG; iPhone puede mandar HEIC)
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'file' },
  'image/heif': { ext: 'heif', kind: 'file' },
  // Videos
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/3gpp': { ext: '3gp', kind: 'video' },
  // Audio (archivos, no notas de voz)
  'audio/mpeg': { ext: 'mp3', kind: 'file' },
  'audio/mp4': { ext: 'm4a', kind: 'file' },
  'audio/x-m4a': { ext: 'm4a', kind: 'file' },
  'audio/ogg': { ext: 'ogg', kind: 'file' },
  'audio/wav': { ext: 'wav', kind: 'file' },
  'audio/webm': { ext: 'weba', kind: 'file' },
  // Documentos
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'text/plain': { ext: 'txt', kind: 'file' },
  'text/csv': { ext: 'csv', kind: 'file' },
  'application/msword': { ext: 'doc', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', kind: 'file' },
  'application/vnd.ms-excel': { ext: 'xls', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', kind: 'file' },
  'application/vnd.ms-powerpoint': { ext: 'ppt', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', kind: 'file' },
  'application/vnd.oasis.opendocument.text': { ext: 'odt', kind: 'file' },
  'application/vnd.oasis.opendocument.spreadsheet': { ext: 'ods', kind: 'file' },
  'application/zip': { ext: 'zip', kind: 'file' },
  'application/x-zip-compressed': { ext: 'zip', kind: 'file' },
};

// Carpeta dentro de /uploads según el tipo de mensaje
const SUBDIRS = { image: 'images', video: 'videos', file: 'files' };

/**
 * @param {string} mimeType - Tipo que informa el navegador (puede traer "; charset=…")
 * @returns {{ext: string, kind: 'image'|'video'|'file', subDir: string}|null} null si no se permite
 */
const getAttachmentType = (mimeType) => {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const type = ATTACHMENT_TYPES[base];
  return type ? { ...type, subDir: SUBDIRS[type.kind] } : null;
};

/**
 * Nombre visible del archivo: sin rutas ni caracteres de control, largo acotado
 * @param {string} originalName
 * @returns {string}
 */
const sanitizeFileName = (originalName) => {
  const name = String(originalName || 'archivo')
    .split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (name || 'archivo').slice(0, 200);
};

module.exports = { ATTACHMENT_TYPES, getAttachmentType, sanitizeFileName };
