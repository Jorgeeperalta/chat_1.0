/**
 * @file Idiomas de la interfaz
 * @description Las etiquetas de la app se muestran en el idioma del navegador del usuario.
 * Es independiente del idioma al que se traducen los mensajes (selector de la barra superior).
 */

import { createI18n } from 'vue-i18n';
import es from './locales/es';
import en from './locales/en';
import pt from './locales/pt';
import fr from './locales/fr';
import de from './locales/de';
import it from './locales/it';

export const messages = { es, en, pt, fr, de, it };

export const SUPPORTED_LOCALES = Object.keys(messages);

// Si el navegador está en un idioma que la app no tiene, se usa inglés
export const FALLBACK_LOCALE = 'en';

/**
 * Primer idioma del navegador que la app tenga ("es-AR" -> "es", "pt-BR" -> "pt")
 * @param {readonly string[]} [languages] - Idiomas preferidos del navegador, en orden
 * @returns {string}
 */
export const detectLocale = (
  languages = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language])
) => {
  for (const language of languages) {
    const base = String(language || '').toLowerCase().split('-')[0];
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return FALLBACK_LOCALE;
};

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages,
});

/**
 * Traducir fuera de los componentes (stores, servicios): t('chat.messageDeleted')
 */
export const t = (...args) => i18n.global.t(...args);
