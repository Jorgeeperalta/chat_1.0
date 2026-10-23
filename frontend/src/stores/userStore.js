/**
 * @file Store de Usuarios
 * @description Maneja los datos de usuarios
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';

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

export const useUserStore = defineStore('user', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const currentUser = ref(null);
  const users = ref([]);
  const usersById = ref({});
  const isLoading = ref(false);
  const error = ref(null);
  
  // ============================================
  // GETTERS
  // ============================================
  
  const getUserById = computed(() => (id) => usersById.value[id]);
  
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
    
    // Getters
    getUserById,
    onlineUsers,
    
    // Acciones
    initialize,
    setUser,
    clearUser,
    searchUsers,
    fetchUserById,
    updateUser,
    updateUserAvatar,
    updateUserStatus,
    getUserStatus,
    addUsers,
    removeUser,
    clear,
  };
});
