/**
 * @file Servicio de audio con Mistral (Voxtral)
 * @description Transcripción de notas de voz (STT), síntesis de voz (TTS) y elección de la voz
 * según el idioma y el género que eligió el emisor.
 *
 * API: POST /v1/audio/transcriptions (multipart), POST /v1/audio/speech (JSON, devuelve
 * `audio_data` en base64) y GET /v1/audio/voices (catálogo con idioma y género de cada voz).
 */

const config = require('../config');
const logger = require('../utils/logger');

const VOICES_CACHE_MS = 24 * 60 * 60 * 1000;
const VOICES_RETRY_MS = 5 * 60 * 1000;

// Copia del catálogo de voces de Mistral (oct. 2026). Se usa solo si no se puede pedir el
// catálogo en vivo: así la app sigue hablando aunque falle esa consulta.
const FALLBACK_VOICES = [
  ['voice_478', 'en_us', 'female'], ['voice_485', 'en_us', 'male'],
  ['voice_483', 'es', 'female'], ['voice_480', 'pt', 'female'],
  ['voice_592', 'fr', 'female'], ['voice_481', 'de', 'female'],
  ['voice_482', 'it', 'male'], ['voice_479', 'ar', 'female'],
  ['voice_3143', 'ca', 'male'], ['voice_3139', 'hi', 'female'],
  ['voice_3153', 'hi', 'male'], ['voice_3146', 'hu', 'female'],
  ['voice_3133', 'ja', 'male'], ['voice_3135', 'ko', 'male'],
  ['voice_3145', 'nl', 'female'], ['voice_3134', 'no', 'male'],
  ['voice_3154', 'pl', 'male'], ['voice_3155', 'ro', 'female'],
  ['voice_3132', 'ru', 'female'], ['voice_3138', 'tr', 'male'],
  ['voice_3140', 'uk', 'male'], ['voice_3144', 'vi', 'female'],
  ['voice_3142', 'zh', 'female'],
].map(([slug, language, gender]) => ({ slug, languages: [language], gender, type: 'preset', kind: 'pvc' }));

// Las voces viejas (Voxtral 2) vienen en una variante por emoción (gb_jane_sad, en_paul_angry...):
// para un mensaje común solo sirve la neutral
const isEmotionVariant = (voice) =>
  voice.type === 'preset' && voice.kind === 'ivc' && !String(voice.slug || '').endsWith('_neutral');

/** "en_US", "pt-BR", "es" -> "en", "pt", "es" */
const baseLanguage = (code) => String(code || '').toLowerCase().split(/[-_]/)[0];

/**
 * Elige la voz para leer un texto en `languageCode`, con el género que prefiere el emisor.
 * El idioma manda: una voz de otro idioma lo leería con acento extranjero. Si el idioma no tiene
 * voz del género pedido, se usa la que haya.
 * @param {Array} voices - Catálogo (GET /v1/audio/voices)
 * @param {string} languageCode - Idioma del texto
 * @param {'female'|'male'|null} gender - Preferencia del emisor
 * @param {Object} [overrides] - config.mistral.ttsVoices: {"es":{"male":"id","default":"id"}}
 * @returns {string|null} voice_id, o null si ningún voz habla ese idioma
 */
const selectVoice = (voices, languageCode, gender, overrides = {}) => {
  const language = baseLanguage(languageCode);
  const custom = overrides[language];
  if (custom) {
    const chosen = (gender && custom[gender]) || custom.default;
    if (chosen) return chosen;
  }

  const candidates = (voices || []).filter(voice =>
    (voice.languages || []).some(code => baseLanguage(code) === language) && !isEmotionVariant(voice)
  );
  if (candidates.length === 0) return null;

  const score = (voice) =>
    (gender && voice.gender === gender ? 4 : 0) +
    (voice.type === 'custom' ? 2 : 0) + // una voz guardada en la cuenta: la eligió el dueño
    (voice.kind === 'pvc' ? 1 : 0); // voces de Voxtral 3, más naturales que las viejas
  const best = candidates.reduce((winner, voice) => (score(voice) > score(winner) ? voice : winner));
  return best.slug || best.id;
};

class MistralAudioService {
  constructor() {
    this.voices = null;
    this.voicesLoadedAt = 0;
    this.voicesPromise = null;
  }

  get isConfigured() {
    return Boolean(config.mistral.apiKey);
  }

  async request(path, init = {}, timeoutMs = config.mistral.audioTimeoutMs) {
    const send = () => fetch(`${config.mistral.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.mistral.apiKey}`, ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    let response;
    try {
      response = await send();
    } catch (error) {
      // Corte de red (no un error de la API): un reintento
      logger.warn(`⚠️ Mistral ${path}: ${error.cause?.code || error.message}, se reintenta`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      response = await send();
    }
    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`Mistral ${path} respondió ${response.status}: ${body.slice(0, 300)}`);
      error.status = response.status;
      throw error;
    }
    return body ? JSON.parse(body) : {};
  }

  /**
   * Paso A: audio -> texto
   * @param {Buffer} audioBuffer
   * @param {Object} options
   * @param {string} options.fileName - Con extensión (webm, ogg, m4a...): ayuda a reconocer el formato
   * @param {string} options.mimeType
   * @param {string} [options.languageCode] - Idioma del emisor: fijarlo mejora la precisión
   * @returns {Promise<{text: string, audioSeconds: number|null}>}
   */
  async transcribe(audioBuffer, { fileName, mimeType, languageCode }) {
    const form = new FormData();
    form.append('model', config.mistral.sttModel);
    form.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
    const language = baseLanguage(languageCode);
    if (language) form.append('language', language);

    const result = await this.request('/audio/transcriptions', { method: 'POST', body: form });
    return {
      text: String(result.text || '').trim(),
      audioSeconds: result.usage?.prompt_audio_seconds ?? null,
    };
  }

  /**
   * Paso C: texto -> voz (MP3)
   * @param {string} text
   * @param {string} voiceId
   * @returns {Promise<Buffer>}
   */
  async synthesize(text, voiceId) {
    const result = await this.request('/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.mistral.ttsModel,
        input: text,
        voice_id: voiceId,
        response_format: 'mp3',
      }),
    });
    if (!result.audio_data) throw new Error('Mistral no devolvió audio');
    return Buffer.from(result.audio_data, 'base64');
  }

  /**
   * Catálogo de voces (presets de Mistral y voces guardadas en la cuenta), en memoria por 24 h
   * @returns {Promise<Array>}
   */
  async getVoices() {
    if (this.voices && Date.now() - this.voicesLoadedAt < VOICES_CACHE_MS) return this.voices;
    if (!this.voicesPromise) {
      this.voicesPromise = this.loadVoices()
        .then((voices) => {
          this.voices = voices;
          this.voicesLoadedAt = Date.now();
          return voices;
        })
        .catch((error) => {
          logger.warn(`⚠️ No se pudo leer el catálogo de voces de Mistral, se usa el incluido: ${error.message}`);
          // Se reintenta en unos minutos, no en cada nota de voz
          this.voices ||= FALLBACK_VOICES;
          this.voicesLoadedAt = Date.now() - VOICES_CACHE_MS + VOICES_RETRY_MS;
          return this.voices;
        })
        .finally(() => { this.voicesPromise = null; });
    }
    return this.voicesPromise;
  }

  async loadVoices() {
    const voices = [];
    // La API pagina con limit/offset
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await this.request(`/audio/voices?limit=100&offset=${offset}`, {}, 15000);
      voices.push(...(page.items || []));
      if (!page.items?.length || voices.length >= (page.total ?? 0)) break;
    }
    return voices.length ? voices : FALLBACK_VOICES;
  }

  /**
   * @param {string} languageCode
   * @param {'female'|'male'|null} gender
   * @returns {Promise<string|null>}
   */
  async pickVoice(languageCode, gender) {
    return selectVoice(await this.getVoices(), languageCode, gender, config.mistral.ttsVoices);
  }
}

const mistralAudioService = new MistralAudioService();

module.exports = mistralAudioService;
module.exports.selectVoice = selectVoice;
module.exports.baseLanguage = baseLanguage;
module.exports.FALLBACK_VOICES = FALLBACK_VOICES;
