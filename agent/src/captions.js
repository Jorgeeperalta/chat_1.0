/**
 * Subtítulos de un segmento final: qué texto recibe cada idioma pedido en la sala.
 *
 * - Si el idioma detectado del segmento ya es el que pidió alguien, ese idioma recibe la
 *   transcripción tal cual (sin pasar por el LLM).
 * - Los demás idiomas se traducen en paralelo. Si una traducción falla, ese idioma se queda sin
 *   ese segmento: la llamada y los demás subtítulos siguen.
 */

import { SUBTITLE_LANGUAGES, baseLanguage } from './translator.js';

export const CAPTIONS_TOPIC = 'lk.transcription';
// Atributo del participante con el idioma que quiere ver (lo pone el backend en el token)
export const CAPTIONS_LANGUAGE_ATTRIBUTE = 'captions_language';

/**
 * Idiomas pedidos por los participantes de la sala (solo los ofrecidos por la app)
 * @param {Iterable<{attributes?: Record<string, string>}>} participants
 * @returns {Set<string>}
 */
export const requestedLanguages = (participants) => {
  const languages = new Set();
  for (const participant of participants) {
    const language = baseLanguage(participant.attributes?.[CAPTIONS_LANGUAGE_ATTRIBUTE]);
    if (SUBTITLE_LANGUAGES.includes(language)) languages.add(language);
  }
  return languages;
};

/**
 * @param {Object} params
 * @param {string} params.text - Segmento final transcrito
 * @param {string} params.detectedLanguage - Idioma dominante del segmento (Deepgram multi)
 * @param {Iterable<string>} params.targets - Idiomas pedidos en la sala
 * @param {import('./translator.js').Translator} params.translator
 * @param {(error: Error, target: string) => void} [params.onError]
 * @returns {Promise<Array<{language: string, text: string, translated: boolean}>>}
 */
export const buildCaptions = async ({ text, detectedLanguage, targets, translator, onError }) => {
  const source = baseLanguage(detectedLanguage);
  const results = await Promise.all([...targets].map(async (target) => {
    if (target === source) return { language: target, text, translated: false };
    if (!translator?.isConfigured) return null;
    try {
      return { language: target, text: await translator.translate(text, target), translated: true };
    } catch (error) {
      onError?.(error, target);
      return null;
    }
  }));
  return results.filter(Boolean);
};
