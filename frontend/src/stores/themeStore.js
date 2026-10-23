/**
 * @file Store de Tema
 * @description Maneja la configuración de tema (light/dark/system)
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

/**
 * @typedef {Object} ThemeState
 * @property {string} theme - Tema actual ('light', 'dark', 'system')
 * @property {boolean} isDark - Si el tema oscuro está activo
 */

export const useThemeStore = defineStore('theme', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const theme = ref(localStorage.getItem('chat_app_theme') || 'system');
  
  // ============================================
  // GETTERS
  // ============================================
  
  const isDark = computed(() => {
    if (theme.value === 'system') {
      // Verificar preferencia del sistema
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme.value === 'dark';
  });

  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = () => {
    // Verificar preferencia del sistema
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Aplicar clase al body
    updateBodyClass();
    
    // Escuchar cambios en la preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
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
    
    // Getters
    isDark,
    
    // Acciones
    initialize,
    setTheme,
    toggleTheme,
    getTheme,
  };
});
