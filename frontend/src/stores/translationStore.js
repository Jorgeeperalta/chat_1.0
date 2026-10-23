/**
 * @file Store de Traducción
 * @description Maneja la configuración de traducción y cache
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';

/**
 * @typedef {Object} Language
 * @property {number} id - ID del idioma
 * @property {string} code - Código ISO
 * @property {string} name - Nombre del idioma
 * @property {string} native_name - Nombre nativo
 * @property {string} flag_emoji - Emoji de la bandera
 * @property {boolean} is_active - Si está activo
 */

/**
 * @typedef {Object} TranslationCache
 * @property {string} key - Clave del cache
 * @property {string} text - Texto original
 * @property {string} sourceLanguage - Idioma de origen
 * @property {string} targetLanguage - Idioma de destino
 * @property {string} translatedText - Texto traducido
 * @property {Date} timestamp - Fecha de cache
 */

/**
 * @typedef {Object} TranslationPreferences
 * @property {boolean} autoTranslateMessages - Traducir automáticamente
 * @property {boolean} showOriginalMessage - Mostrar mensaje original
 * @property {string} audioQuality - Calidad de audio
 * @property {boolean} playAudioAutomatically - Reproducir audio automáticamente
 * @property {boolean} notificationSound - Sonido de notificación
 * @property {boolean} notificationVibration - Vibración de notificación
 */

/**
 * @typedef {Object} TranslationState
 * @property {Language[]} languages - Lista de idiomas
 * @property {Language[]} supportedLanguages - Idiomas soportados
 * @property {Object} languagesByCode - Idiomas indexados por código
 * @property {Object} languagesById - Idiomas indexados por ID
 * @property {Object} translationCache - Cache de traducciones
 * @property {TranslationPreferences} preferences - Preferencias de traducción
 * @property {boolean} isLoading - Si se está cargando
 * @property {Error|null} error - Error
 */

export const useTranslationStore = defineStore('translation', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const languages = ref([]);
  const supportedLanguages = ref([]);
  const languagesByCode = ref({});
  const languagesById = ref({});
  const translationCache = ref({});
  const preferences = ref({
    autoTranslateMessages: true,
    showOriginalMessage: true,
    audioQuality: 'medium',
    playAudioAutomatically: false,
    notificationSound: true,
    notificationVibration: true,
  });
  const isLoading = ref(false);
  const error = ref(null);
  
  // ============================================
  // GETTERS
  // ============================================
  
  const getLanguageByCode = computed(() => (code) => languagesByCode.value[code]);
  const getLanguageById = computed(() => (id) => languagesById.value[id]);
  
  const getLanguageFlag = computed(() => (code) => {
    const lang = languagesByCode.value[code];
    return lang?.flag_emoji || '';
  });
  
  const getLanguageName = computed(() => (code) => {
    const lang = languagesByCode.value[code];
    return lang?.name || code;
  });
  
  const getNativeLanguageName = computed(() => (code) => {
    const lang = languagesByCode.value[code];
    return lang?.native_name || code;
  });
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = async () => {
    try {
      await fetchLanguages();
      loadPreferences();
    } catch (err) {
      console.error('Error al inicializar translation store:', err);
    }
  };

  /**
   * Carga los idiomas desde la API
   * @returns {Promise<Language[]>}
   */
  const fetchLanguages = async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await api.get('/api/languages');
      
      languages.value = response.data.languages;
      supportedLanguages.value = response.data.languages.filter(lang => lang.is_active);
      
      // Indexar por código y ID
      languagesByCode.value = languages.value.reduce((acc, lang) => {
        acc[lang.code] = lang;
        return acc;
      }, {});
      
      languagesById.value = languages.value.reduce((acc, lang) => {
        acc[lang.id] = lang;
        return acc;
      }, {});
      
      isLoading.value = false;
      return languages.value;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Carga las preferencias desde el almacenamiento local
   */
  const loadPreferences = () => {
    const storedPrefs = localStorage.getItem('chat_app_translation_prefs');
    
    if (storedPrefs) {
      preferences.value = { ...preferences.value, ...JSON.parse(storedPrefs) };
    }
  };

  /**
   * Guarda las preferencias en el almacenamiento local
   */
  const savePreferences = () => {
    localStorage.setItem('chat_app_translation_prefs', JSON.stringify(preferences.value));
  };

  /**
   * Actualiza una preferencia
   * @param {string} key - Clave de la preferencia
   * @param {any} value - Valor de la preferencia
   */
  const updatePreference = (key, value) => {
    if (preferences.value.hasOwnProperty(key)) {
      preferences.value[key] = value;
      savePreferences();
    }
  };

  /**
   * Actualiza múltiples preferencias
   * @param {Object} newPrefs - Nuevas preferencias
   */
  const updatePreferences = (newPrefs) => {
    preferences.value = { ...preferences.value, ...newPrefs };
    savePreferences();
  };

  /**
   * Traduce un texto
   * @param {string} text - Texto a traducir
   * @param {string} sourceLang - Idioma de origen
   * @param {string} targetLang - Idioma de destino
   * @returns {Promise<{translatedText: string, fromCache: boolean}>}
   */
  const translate = async (text, sourceLang, targetLang) => {
    try {
      // Generar clave de cache
      const cacheKey = `${sourceLang}_${targetLang}_${text}`;
      
      // Verificar cache
      if (preferences.value.autoTranslateMessages && translationCache.value[cacheKey]) {
        return {
          translatedText: translationCache.value[cacheKey].translatedText,
          fromCache: true,
        };
      }
      
      // Llamar a la API del backend
      const response = await api.post('/api/messages/translate', {
        message_id: 0, // No aplicable para traducción directa
        target_language_code: targetLang,
      }, {
        params: {
          text,
          sourceLang,
          targetLang,
        },
      });
      
      const translatedText = response.data.translation.translatedText;
      
      // Guardar en cache
      if (preferences.value.autoTranslateMessages) {
        translationCache.value[cacheKey] = {
          text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          translatedText,
          timestamp: new Date(),
        };
      }
      
      return {
        translatedText,
        fromCache: false,
      };
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Obtiene el idioma preferido del usuario actual
   * @returns {string}
   */
  const getUserPreferredLanguage = () => {
    // Esto debería venir del userStore
    const userStore = useUserStore();
    const user = userStore.currentUser;
    
    if (user) {
      const prefLang = getLanguageById.value(user.preferred_language_id);
      if (prefLang) {
        return prefLang.code;
      }
      
      const nativeLang = getLanguageById.value(user.native_language_id);
      if (nativeLang) {
        return nativeLang.code;
      }
    }
    
    return 'es'; // Default
  };

  /**
   * Obtiene el código del idioma a partir del código ISO
   * @param {string} langCode - Código ISO
   * @returns {string}
   */
  const getLanguageCode = (langCode) => {
    // Normalizar el código
    const normalizedCode = langCode?.toLowerCase?.() || '';
    
    // Verificar si el idioma está soportado
    if (languagesByCode.value[normalizedCode]) {
      return normalizedCode;
    }
    
    // Intentar con variantes
    const variants = {
      'en-us': 'en',
      'en-gb': 'en',
      'es-es': 'es',
      'es-mx': 'es',
      'pt-br': 'pt',
      'pt-pt': 'pt',
      'zh-cn': 'zh',
      'zh-tw': 'zh',
    };
    
    return variants[normalizedCode] || 'en';
  };

  /**
   * Limpia el cache de traducciones
   */
  const clearCache = () => {
    translationCache.value = {};
  };

  /**
   * Limpia el store
   */
  const clear = () => {
    languages.value = [];
    supportedLanguages.value = [];
    languagesByCode.value = {};
    languagesById.value = {};
    translationCache.value = {};
    error.value = null;
  };

  return {
    // Estado
    languages,
    supportedLanguages,
    languagesByCode,
    languagesById,
    translationCache,
    preferences,
    isLoading,
    error,
    
    // Getters
    getLanguageByCode,
    getLanguageById,
    getLanguageFlag,
    getLanguageName,
    getNativeLanguageName,
    
    // Acciones
    initialize,
    fetchLanguages,
    loadPreferences,
    savePreferences,
    updatePreference,
    updatePreferences,
    translate,
    getUserPreferredLanguage,
    getLanguageCode,
    clearCache,
    clear,
  };
});
