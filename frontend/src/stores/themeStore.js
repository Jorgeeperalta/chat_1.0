/**
 * @file Store de Tema
 * @description Maneja la configuración de tema (light/dark/system)
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { detectLocale } from '@/i18n';
import { DEFAULT_BACKGROUND, getChatBackground } from '@/utils/chatBackgrounds';

/**
 * @typedef {Object} ThemeState
 * @property {string} theme - Tema actual ('light', 'dark', 'system')
 * @property {boolean} isDark - Si el tema oscuro está activo
 */

const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const useThemeStore = defineStore('theme', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const theme = ref(localStorage.getItem('chat_app_theme') || 'system');
  // Idioma de las etiquetas: siempre el del navegador (no se elige dentro de la app)
  const language = ref(detectLocale());
  const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
  // Fondo del chat: se elige en Preferencias y se guarda en este dispositivo
  const chatBackground = ref(readStorage('chat_app_background') || DEFAULT_BACKGROUND);
  let initialized = false;

  // ============================================
  // GETTERS
  // ============================================

  const isDark = computed(() => {
    if (theme.value === 'system') {
      // Verificar preferencia del sistema
      return systemPrefersDark.value;
    }
    return theme.value === 'dark';
  });

  const currentTheme = computed(() => theme.value);

  // Valor CSS del fondo elegido, en su versión clara u oscura según el tema
  const chatBackgroundStyle = computed(() => getChatBackground(chatBackground.value, isDark.value));

  // ============================================
  // ACCIONES
  // ============================================

  /**
   * Cambia el fondo del chat (se guarda en este dispositivo)
   * @param {string} id - Uno de CHAT_BACKGROUNDS
   */
  const setChatBackground = (id) => {
    chatBackground.value = id;
    try { localStorage.setItem('chat_app_background', id); } catch { /* sin almacenamiento: solo por esta vez */ }
  };

  /**
   * Inicializa el store
   */
  const initialize = () => {
    // Aplicar clase al body
    updateBodyClass();

    if (initialized) return;
    initialized = true;

    // Escuchar cambios en la preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
      if (theme.value === 'system') {
        updateBodyClass();
      }
    });
  };

  /**
   * Establece el tema
   * @param {string} newTheme - Nuevo tema ('light', 'dark', 'system')
   */
  const setTheme = (newTheme) => {
    const validThemes = ['light', 'dark', 'system'];
    
    if (!validThemes.includes(newTheme)) {
      console.warn(`Tema inválido: ${newTheme}. Usando 'system'`);
      newTheme = 'system';
    }
    
    theme.value = newTheme;
    localStorage.setItem('chat_app_theme', newTheme);
    updateBodyClass();
  };

  /**
   * Alterna entre temas light y dark
   */
  const toggleTheme = () => {
    if (theme.value === 'system') {
      setTheme('light');
    } else if (theme.value === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  /**
   * Actualiza la clase del body según el tema
   */
  const updateBodyClass = () => {
    const body = document.body;
    
    // Remover clases anteriores
    body.classList.remove('theme-light', 'theme-dark');
    
    // Agregar nueva clase
    if (theme.value === 'light') {
      body.classList.add('theme-light');
    } else if (theme.value === 'dark') {
      body.classList.add('theme-dark');
    }
  };

  /**
   * Obtiene el tema actual
   * @returns {string}
   */
  const getTheme = () => theme.value;

  // Escuchar cambios en el tema para actualizar el body
  watch(theme, () => {
    updateBodyClass();
  });

  return {
    // Estado
    theme,
    language,

    chatBackground,

    // Getters
    isDark,
    currentTheme,
    chatBackgroundStyle,

    // Acciones
    initialize,
    setChatBackground,
    setTheme,
    toggleTheme,
    getTheme,
  };
});
