/**
 * @file Utilidades de archivos multimedia
 * @description Resolución de URLs de archivos servidos por el backend (/uploads)
 */

/**
 * Convierte una URL relativa del backend (p. ej. "/uploads/audio/x.webm") en
 * absoluta usando VITE_API_BASE_URL. Sin esto, el navegador la pediría al
 * servidor del frontend (Vite), que no sirve /uploads.
 * @param {string} url - URL devuelta por el backend
 * @returns {string}
 */
export const resolveMediaUrl = (url) => {
  if (!url) return '';
  // Ya es absoluta, o es local del navegador (grabación optimista)
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  if (!/^https?:/i.test(base)) return url;

  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};
