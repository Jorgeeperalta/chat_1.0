/**
 * Traducción de segmentos con un LLM liviano por una API compatible con OpenAI
 * (/chat/completions). Por defecto Mistral (la misma clave que usa el backend); se puede
 * apuntar a OpenAI (gpt-4o-mini) u otro proveedor con TRANSLATION_* en el .env.
 *
 * Las frases repetidas ("sí", "ok", "¿me escuchan?") se sirven de un caché en memoria.
 */

export const SUBTITLE_LANGUAGES = ['es', 'en', 'fr', 'it', 'de', 'zh'];

// Nombres para el prompt (en español, como pide el prompt del sistema)
const LANGUAGE_NAMES = {
  es: 'español',
  en: 'inglés',
  fr: 'francés',
  it: 'italiano',
  de: 'alemán',
  zh: 'chino simplificado',
};

/** "en-US", "zh-Hans", "pt_BR" -> "en", "zh", "pt" */
export const baseLanguage = (code) => String(code || '').toLowerCase().split(/[-_]/)[0];

export class Translator {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - p. ej. https://api.mistral.ai/v1 o https://api.openai.com/v1
   * @param {string} options.apiKey
   * @param {string} options.model - p. ej. mistral-small-latest o gpt-4o-mini
   * @param {number} [options.timeoutMs]
   * @param {number} [options.cacheSize]
   * @param {Function} [options.fetchImpl] - Para pruebas
   */
  constructor({ baseUrl, apiKey, model, timeoutMs = 4000, cacheSize = 2000, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.cacheSize = cacheSize;
    this.fetch = fetchImpl;
    this.cache = new Map();
    this.pending = new Map();
  }

  get isConfigured() {
    return Boolean(this.baseUrl && this.apiKey && this.model);
  }

  /**
   * @param {string} text
   * @param {string} targetLanguage - es/en/fr/it/de/zh
   * @returns {Promise<string>}
   */
  async translate(text, targetLanguage) {
    const clean = String(text || '').trim();
    if (!clean) return '';
    const key = `${targetLanguage}\u0000${clean.toLowerCase()}`;

    if (this.cache.has(key)) {
      // Se mueve al final: el caché descarta primero lo menos usado
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    // La misma frase pedida dos veces a la vez: una sola llamada
    if (this.pending.has(key)) return this.pending.get(key);

    const request = this.#request(clean, targetLanguage)
      .then((translated) => {
        this.cache.set(key, translated);
        if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value);
        return translated;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  async #request(text, targetLanguage) {
    const language = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            // Lo de "mezcla idiomas": sin eso, el modelo deja sin traducir las partes en otro idioma
            content: `Traducí el siguiente texto a ${language}. Devolvé solo la traducción. `
              + `El texto puede mezclar varios idiomas: traducí TODO a ${language}, `
              + 'sin dejar ninguna parte en otro idioma.',
          },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`LLM respondió ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const data = await response.json();
    const translated = String(data.choices?.[0]?.message?.content || '').trim();
    if (!translated) throw new Error('LLM devolvió una traducción vacía');
    return translated;
  }
}
