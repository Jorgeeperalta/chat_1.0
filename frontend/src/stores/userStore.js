/**
 * @file Store de Usuarios
 * @description Maneja los datos de usuarios
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';
import { useTranslationStore } from './translationStore';

/**
 * @typedef {Object} User
 * @property {number} id - ID del usuario
 * @property {string} username - Nombre de usuario
 * @property {string} email - Correo electrónico
 * @property {string} first_name - Nombre
 * @property {string} last_name - Apellido
 * @property {string} avatar_url - URL del avatar
 * @property {number} native_language_id - ID del idioma nativo
 * @property {number} preferred_language_id - ID del idioma preferido
 * @property {string} status - Estado del usuario
 * @property {string} bio - Biografía
 * @property {Object} nativeLanguage - Idioma nativo
 * @property {Object} preferredLanguage - Idioma preferido
 * @property {Object} preferences - Preferencias del usuario
 */

/**
 * @typedef {Object} UserState
 * @property {User|null} currentUser - Usuario actual
 * @property {User[]} users - Lista de usuarios
 * @property {Object} usersById - Usuarios indexados por ID
 * @property {boolean} isLoading - Si se está cargando
 * @property {Error|null} error - Error
 */

// Preferencias en formato del frontend; las que existen en el backend se mapean en
// fromBackendPreferences / toBackendPreferences.
const DEFAULT_SETTINGS = {
  theme: 'system',
  notifications_enabled: true,
  notification_sound: true,
  notification_vibration: true,
  auto_translate: true,
  show_original: true,
  audio_quality: 'medium',
  play_audio_automatically: false,
  show_online_status: true,
  show_read_receipts: true,
  message_language: null,
};

const fromBackendPreferences = (prefs = {}) => ({
  theme: prefs.theme,
  notification_sound: prefs.notification_sound,
  notification_vibration: prefs.notification_vibration,
  auto_translate: prefs.auto_translate_messages,
  show_original: prefs.show_original_message,
  audio_quality: prefs.audio_quality,
  play_audio_automatically: prefs.play_audio_automatically,
});

const toBackendPreferences = (s) => ({
  theme: s.theme,
  notification_sound: s.notification_sound,
  notification_vibration: s.notification_vibration,
  auto_translate_messages: s.auto_translate,
  show_original_message: s.show_original,
  audio_quality: s.audio_quality,
  play_audio_automatically: s.play_audio_automatically,
});

const withoutUndefined = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)
);

export const useUserStore = defineStore('user', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const currentUser = ref(null);
  const users = ref([]);
  const usersById = ref({});
  const isLoading = ref(false);
  const error = ref(null);
  const settings = ref({
    ...DEFAULT_SETTINGS,
    message_language: localStorage.getItem('chat_app_message_language') || null,
  });

  // ============================================
  // GETTERS
  // ============================================

  const getUserById = computed(() => (id) => usersById.value[id]);

  // Código del idioma preferido del usuario actual (si el backend lo incluye)
  const preferredLanguage = computed(() => {
    return currentUser.value?.preferredLanguage?.code || null;
  });
  
  const onlineUsers = computed(() => {
    return Object.values(usersById.value).filter(user => user.status === 'online');
  });
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = () => {
    // Cargar usuarios desde localStorage si existe
    const storedUsers = localStorage.getItem('chat_app_users');
    if (storedUsers) {
      users.value = JSON.parse(storedUsers);
      usersById.value = users.value.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
    }
  };

  /**
   * Sincroniza las preferencias con el translationStore (que usan chat y notificaciones)
   */
  const syncTranslationPreferences = () => {
    const translationStore = useTranslationStore();
    translationStore.updatePreferences({
      autoTranslateMessages: settings.value.auto_translate,
      showOriginalMessage: settings.value.show_original,
      audioQuality: settings.value.audio_quality,
      playAudioAutomatically: settings.value.play_audio_automatically,
      notificationSound: settings.value.notification_sound,
      notificationVibration: settings.value.notification_vibration,
    });
  };

  /**
   * Carga las preferencias del usuario desde el backend
   * @param {number} [userId] - ID del usuario (por defecto, el actual)
   * @returns {Promise<Object>}
   */
  const fetchSettings = async (userId = currentUser.value?.id) => {
    if (!userId) return settings.value;
    try {
      const response = await api.get(`/api/users/${userId}/preferences`);
      settings.value = {
        ...settings.value,
        ...withoutUndefined(fromBackendPreferences(response.data.preferences)),
      };
      syncTranslationPreferences();
      return settings.value;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Guarda las preferencias del usuario
   * @param {Object} newSettings - Preferencias (formato del frontend)
   * @param {number} [userId] - ID del usuario (por defecto, el actual)
   * @returns {Promise<Object>}
   */
  const updateSettings = async (newSettings, userId = currentUser.value?.id) => {
    if (!userId) throw new Error('No hay un usuario autenticado');
    const merged = { ...settings.value, ...newSettings };
    const response = await api.post(
      `/api/users/${userId}/preferences`,
      withoutUndefined(toBackendPreferences(merged))
    );
    settings.value = {
      ...merged,
      ...withoutUndefined(fromBackendPreferences(response.data.preferences)),
    };
    syncTranslationPreferences();
    return settings.value;
  };

  /**
   * Establece el idioma con el que el usuario escribe sus mensajes
   * @param {string} lang - Código del idioma
   */
  const setMessageLanguage = (lang) => {
    settings.value = { ...settings.value, message_language: lang };
    localStorage.setItem('chat_app_message_language', lang);
  };

  /**
   * Establece el usuario actual
   * @param {User} userData - Datos del usuario
   */
  const setUser = (userData) => {
    currentUser.value = userData;
    
    // Almacenar en usersById
    if (userData && userData.id) {
      usersById.value[userData.id] = userData;
    }
  };

  /**
   * Limpia el usuario actual
   */
  const clearUser = () => {
    currentUser.value = null;
  };

  /**
   * Busca usuarios
   * @param {string} query - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<User[]>}
   */
  const searchUsers = async (query, limit = 10) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await api.get('/api/users/search', {
        params: { query, limit },
      });
      
      const foundUsers = response.data.users;
      
      // Actualizar usersById
      foundUsers.forEach(user => {
        usersById.value[user.id] = user;
      });
      
      // Actualizar lista de usuarios
      users.value = Object.values(usersById.value);
      
      isLoading.value = false;
      return foundUsers;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Obtiene un usuario por ID
   * @param {number} userId - ID del usuario
   * @returns {Promise<User>}
   */
  const fetchUserById = async (userId) => {
    try {
      // Verificar si ya está en cache
      if (usersById.value[userId]) {
        return usersById.value[userId];
      }
      
      isLoading.value = true;
      error.value = null;
      
      const response = await api.get(`/api/users/${userId}`);
      const userData = response.data.user;
      
      // Guardar en cache
      usersById.value[userId] = userData;
      users.value = Object.values(usersById.value);
      
      isLoading.value = false;
      return userData;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Actualiza el estado de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} updates - Actualizaciones
   */
  const updateUser = (userId, updates) => {
    if (usersById.value[userId]) {
      usersById.value[userId] = { ...usersById.value[userId], ...updates };
      
      // Si es el usuario actual, actualizarlo
      if (currentUser.value?.id === userId) {
        currentUser.value = { ...currentUser.value, ...updates };
      }
      
      users.value = Object.values(usersById.value);
    }
  };

  /**
   * Actualiza el avatar de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} avatarUrl - URL del nuevo avatar
   */
  const updateUserAvatar = (userId, avatarUrl) => {
    updateUser(userId, { avatar_url: avatarUrl });
  };

  /**
   * Actualiza el estado online/offline de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} status - Nuevo estado
   * @param {string} lastSeenAt - Fecha de última vez visto
   */
  const updateUserStatus = (userId, status, lastSeenAt = null) => {
    const updates = { status };
    if (lastSeenAt) {
      updates.last_seen_at = lastSeenAt;
    }
    updateUser(userId, updates);
  };

  /**
   * Obtiene el estado de un usuario
   * @param {number} userId - ID del usuario
   * @returns {string}
   */
  const getUserStatus = (userId) => {
    return usersById.value[userId]?.status || 'offline';
  };

  const isUserOnline = (userId) => {
    return getUserStatus(userId) === 'online';
  };

  /**
   * Agrega múltiples usuarios al store
   * @param {User[]} newUsers - Array de usuarios
   */
  const addUsers = (newUsers) => {
    newUsers.forEach(user => {
      if (user && user.id) {
        usersById.value[user.id] = user;
      }
    });
    
    users.value = Object.values(usersById.value);
  };

  /**
   * Elimina un usuario del store
   * @param {number} userId - ID del usuario
   */
  const removeUser = (userId) => {
    delete usersById.value[userId];
    users.value = Object.values(usersById.value);
  };

  /**
   * Limpia el store
   */
  const clear = () => {
    currentUser.value = null;
    users.value = [];
    usersById.value = {};
    error.value = null;
  };

  return {
    // Estado
    currentUser,
    users,
    usersById,
    isLoading,
    error,
    settings,

    // Getters
    getUserById,
    onlineUsers,
    preferredLanguage,

    // Acciones
    initialize,
    fetchSettings,
    updateSettings,
    setMessageLanguage,
    setUser,
    clearUser,
    searchUsers,
    fetchUserById,
    updateUser,
    updateUserAvatar,
    updateUserStatus,
    getUserStatus,
    isUserOnline,
    addUsers,
    removeUser,
    clear,
  };
});
