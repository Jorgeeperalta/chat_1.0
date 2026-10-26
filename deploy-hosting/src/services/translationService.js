/**
 * @file Servicio de Traducción con Mistral AI
 * @description Servicio para traducir textos utilizando la API de Mistral AI
 * @author Arquitecto de Software Senior
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { TranslationCache } = require('../models');

class TranslationService {
  /**
   * @typedef {Object} TranslationOptions
   * @property {string} [model] - Modelo a utilizar
   * @property {number} [maxTokens] - Máximo de tokens
   * @property {number} [temperature] - Temperatura
   * @property {boolean} [useCache] - Usar cache
   * @property {boolean} [forceRefresh] - Forzar actualización del cache
   */

  /**
   * @typedef {Object} TranslationResult
   * @property {string} translatedText - Texto traducido
   * @property {string} sourceLanguage - Idioma de origen
   * @property {string} targetLanguage - Idioma de destino
   * @property {string} model - Modelo utilizado
   * @property {number} promptTokens - Tokens del prompt
   * @property {number} completionTokens - Tokens de la respuesta
   * @property {number} responseTimeMs - Tiempo de respuesta
   * @property {boolean} fromCache - Si se obtuvo del cache
   * @property {string} [error] - Error si ocurrió alguno
   */

  constructor() {
    this.apiClient = axios.create({
      baseURL: config.mistral.baseUrl,
      timeout: config.mistral.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.mistral.apiKey}`,
      },
    });

    this.cacheEnabled = config.mistral.cacheEnabled;
    this.maxRetries = config.mistral.maxRetries;
    this.retryDelay = config.mistral.retryDelayMs;
  }

  /**
   * Genera el prompt de traducción para Mistral AI
   * @param {string} text - Texto a traducir
   * @param {string} sourceLang - Idioma de origen
   * @param {string} targetLang - Idioma de destino
   * @returns {string}
   */
  generateTranslationPrompt(text, sourceLang, targetLang) {
    const languageNames = {
      es: 'Spanish',
      en: 'English',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
      ar: 'Arabic',
    };

    const sourceLangName = languageNames[sourceLang] || sourceLang;
    const targetLangName = languageNames[targetLang] || targetLang;

    return `Translate the following text from ${sourceLangName} to ${targetLangName}. ` +
           `Return ONLY the translated text without any additional explanations or metadata. ` +
           `Preserve the original formatting, punctuation, and meaning.\n\n` +
           `Text to translate: ${text}`;
  }

  /**
   * Traduce texto utilizando Mistral AI
   * @param {string} text - Texto a traducir
   * @param {string} sourceLang - Código del idioma de origen
   * @param {string} targetLang - Código del idioma de destino
   * @param {TranslationOptions} [options={}] - Opciones de traducción
   * @returns {Promise<TranslationResult>}
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    const startTime = Date.now();
    const {
      model = config.mistral.translationModel,
      maxTokens = config.mistral.maxTokens,
      temperature = config.mistral.temperature,
      useCache = this.cacheEnabled,
      forceRefresh = false,
    } = options;

    // Normalizar el texto
    const normalizedText = text.trim();
    
    // Validar entradas
    if (!normalizedText) {
      throw new Error('Text to translate cannot be empty');
    }

    if (sourceLang === targetLang) {
      return {
        translatedText: normalizedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        model,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        fromCache: false,
      };
    }

    // Intentar obtener del cache
    if (useCache && !forceRefresh) {
      try {
        const cached = await this.getFromCache(normalizedText, sourceLang, targetLang);
        if (cached) {
          logger.info(`✅ Traducción obtenida del cache: ${sourceLang} -> ${targetLang}`);
          return {
            ...cached,
            fromCache: true,
            responseTimeMs: Date.now() - startTime,
          };
        }
      } catch (cacheError) {
        logger.warn('⚠️ Error al acceder al cache:', cacheError.message);
      }
    }

    // Traducir usando Mistral AI
    const result = await this.translateWithMistral(
      normalizedText,
      sourceLang,
      targetLang,
      model,
      maxTokens,
      temperature,
      startTime
    );

    // Guardar en cache
    if (useCache && result.translatedText) {
      try {
        await this.saveToCache(
          normalizedText,
          sourceLang,
          targetLang,
          result.translatedText,
          model
        );
      } catch (cacheError) {
        logger.warn('⚠️ Error al guardar en cache:', cacheError.message);
      }
    }

    return result;
  }

  /**
   * Traduce utilizando la API de Mistral AI
   * @param {string} text - Texto a traducir
   * @param {string} sourceLang - Código del idioma de origen
   * @param {string} targetLang - Código del idioma de destino
   * @param {string} model - Modelo a utilizar
   * @param {number} maxTokens - Máximo de tokens
   * @param {number} temperature - Temperatura
   * @param {number} startTime - Tiempo de inicio
   * @returns {Promise<TranslationResult>}
   */
  async translateWithMistral(text, sourceLang, targetLang, model, maxTokens, temperature, startTime) {
    const prompt = this.generateTranslationPrompt(text, sourceLang, targetLang);
    
    const requestData = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
    };

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        logger.info(`📤 Enviando solicitud de traducción a Mistral AI (intento ${attempt + 1}): ${sourceLang} -> ${targetLang}`);
        
        const response = await this.apiClient.post('/chat/completions', requestData);
        
        const responseTimeMs = Date.now() - startTime;
        const translatedText = this.extractTranslatedText(response.data);

        logger.info(`📥 Traducción completada en ${responseTimeMs}ms: ${sourceLang} -> ${targetLang}`);

        return {
          translatedText,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          model,
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          responseTimeMs,
          fromCache: false,
        };
      } catch (error) {
        lastError = error;
        attempt++;
        
        logger.error(`❌ Error en intento ${attempt} de traducción:`, error.message);
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    // Si fallaron todos los intentos, intentar con el fallback
    if (config.mistral.fallbackProvider && config.mistral.fallbackApiKey) {
      logger.info('➡️  Intentando con proveedor de fallback...');
      try {
        const fallbackResult = await this.translateWithFallback(
          text,
          sourceLang,
          targetLang,
          startTime
        );
        return fallbackResult;
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }

    throw new Error(`Error de traducción después de ${this.maxRetries} intentos: ${lastError?.message}`);
  }

  /**
   * Extrae el texto traducido de la respuesta de Mistral
   * @param {Object} responseData - Datos de la respuesta
   * @returns {string}
   */
  extractTranslatedText(responseData) {
    if (responseData.choices?.[0]?.message?.content) {
      return responseData.choices[0].message.content;
    }
    
    if (responseData.choices?.[0]?.text) {
      return responseData.choices[0].text;
    }

    // Formato de chat/completions
    if (responseData.choices?.[0]?.message?.content) {
      return responseData.choices[0].message.content;
    }

    throw new Error('No se pudo extraer el texto traducido de la respuesta');
  }

  /**
   * Traduce utilizando el proveedor de fallback (Google Translate, DeepL, etc.)
   * @param {string} text - Texto a traducir
   * @param {string} sourceLang - Código del idioma de origen
   * @param {string} targetLang - Código del idioma de destino
   * @param {number} startTime - Tiempo de inicio
   * @returns {Promise<TranslationResult>}
   */
  async translateWithFallback(text, sourceLang, targetLang, startTime) {
    // Implementación de ejemplo para Google Cloud Translation
    // Se necesita configurar el cliente adecuadamente
    
    // Por ahora, lanzamos un error
    throw new Error('Proveedor de fallback no configurado');
  }

  /**
   * Obtiene una traducción del cache
   * @param {string} text - Texto original
   * @param {string} sourceLang - Código del idioma de origen
   * @param {string} targetLang - Código del idioma de destino
   * @returns {Promise<TranslationResult|NULL>}
   */
  async getFromCache(text, sourceLang, targetLang) {
    const { models } = require('../models');
    
    const sourceLangRecord = await models.Language.findByCode(sourceLang);
    const targetLangRecord = await models.Language.findByCode(targetLang);

    if (!sourceLangRecord || !targetLangRecord) {
      return null;
    }

    const cached = await TranslationCache.getCachedTranslation(
      text,
      sourceLangRecord.id,
      targetLangRecord.id
    );

    if (!cached || (cached.expires_at && new Date(cached.expires_at) < new Date())) {
      return null;
    }

    return {
      translatedText: cached.translated_text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      model: cached.mistral_model || config.mistral.translationModel,
      promptTokens: 0,
      completionTokens: 0,
      responseTimeMs: 0,
      fromCache: true,
    };
  }

  /**
   * Guarda una traducción en el cache
   * @param {string} text - Texto original
   * @param {string} sourceLang - Código del idioma de origen
   * @param {string} targetLang - Código del idioma de destino
   * @param {string} translatedText - Texto traducido
   * @param {string} model - Modelo utilizado
   * @returns {Promise<void>}
   */
  async saveToCache(text, sourceLang, targetLang, translatedText, model) {
    const { models } = require('../models');

    const sourceLangRecord = await models.Language.findByCode(sourceLang);
    const targetLangRecord = await models.Language.findByCode(targetLang);

    if (!sourceLangRecord || !targetLangRecord) {
      return;
    }

    await TranslationCache.cacheTranslation(
      text,
      sourceLangRecord.id,
      targetLangRecord.id,
      translatedText,
      model
    );
  }

  /**
   * Limpia el cache de traducciones
   * @returns {Promise<{deleted: number, error?: Error}>}
   */
  async cleanupCache() {
    try {
      const deleted = await TranslationCache.cleanupExpired();
      logger.info(`🧹 Cache de traducciones limpiado: ${deleted} entradas eliminadas`);
      return { deleted };
    } catch (error) {
      logger.error('❌ Error al limpiar cache de traducciones:', error);
      return { deleted: 0, error };
    }
  }

  /**
   * Obtiene estadísticas del cache
   * @returns {Promise<Object>}
   */
  async getCacheStats() {
    return TranslationCache.getStats();
  }

  /**
   * Verifica si el servicio está disponible
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      if (!config.mistral.apiKey) {
        logger.warn('⚠️  No se ha configurado MISTRAL_API_KEY');
        return false;
      }

      // Hacer una solicitud de prueba
      const response = await this.apiClient.get('/models', {
        timeout: 5000,
      });

      logger.info('✅ Servicio de Mistral AI disponible');
      return true;
    } catch (error) {
      logger.error('❌ Servicio de Mistral AI no disponible:', error.message);
      return false;
    }
  }

  /**
   * Traduce un array de mensajes
   * @param {Array<{text: string, sourceLang: string, targetLang: string}>} translations
   * @param {TranslationOptions} [options={}] - Opciones de traducción
   * @returns {Promise<Array<TranslationResult>>}
   */
  async batchTranslate(translations, options = {}) {
    const results = [];
    
    for (const translation of translations) {
      try {
        const result = await this.translate(
          translation.text,
          translation.sourceLang,
          translation.targetLang,
          options
        );
        results.push(result);
      } catch (error) {
        results.push({
          text: translation.text,
          sourceLanguage: translation.sourceLang,
          targetLanguage: translation.targetLang,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Transcribe audio a texto
   * @param {Buffer} audioBuffer - Buffer del audio
   * @param {string} language - Idioma del audio
   * @returns {Promise<{text: string, language: string}>}
   */
  async transcribeAudio(audioBuffer, language) {
    // Implementación de transcripción
    // Para producción, usar la API de Mistral AI o un servicio externo
    
    // Por ahora, lanzar un error
    throw new Error('Transcripción de audio no implementada');
  }
}

// Exportar instancia singleton
const translationService = new TranslationService();

module.exports = translationService;
