/**
 * @file Store de Autenticación
 * @description Maneja el estado de autenticación del usuario
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api';
import { disablePushNotifications } from '@/services/pushNotifications';
import { useSocketStore } from './socketStore';
import { useUserStore } from './userStore';

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
 */

/**
 * @typedef {Object} Tokens
 * @property {string} accessToken - Token de acceso
 * @property {string} refreshToken - Token de actualización
 * @property {string} expiresIn - Tiempo de expiración
 * @property {string} refreshExpiresIn - Tiempo de expiración del refresh token
 */

/**
 * @typedef {Object} AuthState
 * @property {User|null} user - Usuario autenticado
 * @property {Tokens|null} tokens - Tokens de autenticación
 * @property {boolean} isAuthenticated - Si está autenticado
 * @property {boolean} isLoading - Si se está cargando
 * @property {Error|null} error - Error de autenticación
 */

export const useAuthStore = defineStore('auth', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const user = ref(null);
  const tokens = ref(null);
  const isAuthenticated = computed(() => !!user.value);
  const isLoading = ref(false);
  const error = ref(null);
  
  // ============================================
  // ACCIONES
  // ============================================
  
  const router = useRouter();
  const socketStore = useSocketStore();
  const userStore = useUserStore();

  /**
   * Inicializa el store desde el almacenamiento local
   */
  const initialize = () => {
    const storedUser = localStorage.getItem('chat_app_user');
    const storedTokens = localStorage.getItem('chat_app_tokens');
    const tokenExpiry = localStorage.getItem('chat_app_token_expiry');
    
    if (storedUser && storedTokens) {
      // Verificar si el token ha expirado
      if (tokenExpiry) {
        const expiryDate = new Date(tokenExpiry);
        const now = new Date();
        
        if (expiryDate > now) {
          user.value = JSON.parse(storedUser);
          tokens.value = JSON.parse(storedTokens);
        } else {
          // Token expirado, limpiar
          clearAuth();
        }
      } else {
        user.value = JSON.parse(storedUser);
        tokens.value = JSON.parse(storedTokens);
      }
    }
  };

  /**
   * Guarda los datos de autenticación en el almacenamiento local
   */
  const saveAuth = () => {
    if (user.value) {
      localStorage.setItem('chat_app_user', JSON.stringify(user.value));
    }
    if (tokens.value) {
      localStorage.setItem('chat_app_tokens', JSON.stringify(tokens.value));
    }
  };

  /**
   * Limpia los datos de autenticación
   */
  const clearAuth = () => {
    user.value = null;
    tokens.value = null;
    error.value = null;
    
    localStorage.removeItem('chat_app_user');
    localStorage.removeItem('chat_app_tokens');
    localStorage.removeItem('chat_app_token_expiry');
  };

  /**
   * Establece el token de expiración
   * @param {string|Date} expiresIn - Tiempo de expiración
   */
  const setTokenExpiry = (expiresIn) => {
    if (typeof expiresIn === 'string') {
      // Si es una cadena como "24h", calcular la fecha
      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const now = new Date();
        
        let expiry;
        switch (unit) {
          case 's': expiry = now.getTime() + value * 1000; break;
          case 'm': expiry = now.getTime() + value * 60 * 1000; break;
          case 'h': expiry = now.getTime() + value * 60 * 60 * 1000; break;
          case 'd': expiry = now.getTime() + value * 24 * 60 * 60 * 1000; break;
          default: expiry = now.getTime() + 24 * 60 * 60 * 1000;
        }
        
        localStorage.setItem('chat_app_token_expiry', new Date(expiry).toISOString());
      }
    } else if (expiresIn instanceof Date) {
      localStorage.setItem('chat_app_token_expiry', expiresIn.toISOString());
    }
  };

  /**
   * Inicia sesión
   * @param {Object} credentials - Credenciales de usuario
   * @returns {Promise<User>}
   */
  const login = async (credentials) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await api.post('/api/auth/login', credentials);
      
      user.value = response.data.user;
      tokens.value = {
        accessToken: response.data.tokens.accessToken,
        refreshToken: response.data.tokens.refreshToken,
        expiresIn: response.data.tokens.expiresIn,
        refreshExpiresIn: response.data.tokens.refreshExpiresIn,
      };
      
      // Guardar token de expiración
      setTokenExpiry(response.data.tokens.expiresIn);
      saveAuth();
      
      // Inicializar el usuario en el store
      userStore.setUser(user.value);
      
      // Conectar Socket.io
      socketStore.connect();
      
      isLoading.value = false;
      return user.value;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>}
   */
  const register = async (userData) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await api.post('/api/auth/register', userData);
      
      user.value = response.data.user;
      tokens.value = {
        accessToken: response.data.tokens.accessToken,
        refreshToken: response.data.tokens.refreshToken,
        expiresIn: response.data.tokens.expiresIn,
        refreshExpiresIn: response.data.tokens.refreshExpiresIn,
      };
      
      // Guardar token de expiración
      setTokenExpiry(response.data.tokens.expiresIn);
      saveAuth();
      
      // Inicializar el usuario en el store
      userStore.setUser(user.value);
      
      // Conectar Socket.io
      socketStore.connect();
      
      isLoading.value = false;
      return user.value;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Cierra la sesión
   */
  const logout = async () => {
    try {
      isLoading.value = true;

      // Este teléfono deja de recibir notificaciones de esta cuenta (antes de perder el token)
      await disablePushNotifications();
      
      // Cerrar sesión en el backend
      await api.post('/api/auth/logout', {}, {
        headers: {
          Authorization: `Bearer ${tokens.value?.accessToken}`,
        },
      });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      // Limpiar estado
      clearAuth();
      userStore.clearUser();
      socketStore.disconnect();
      
      // Redirigir a la página de login
      router.push({ name: 'login' });
      
      isLoading.value = false;
    }
  };

  /**
   * Refresca el token de acceso
   * @returns {Promise<boolean>}
   */
  // Refresh en curso: varias peticiones con 401 simultáneas comparten el mismo
  let refreshPromise = null;

  const refreshToken = () => {
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  };

  const doRefreshToken = async () => {
    try {
      if (!tokens.value?.refreshToken) {
        return false;
      }

      const response = await api.post('/api/auth/refresh', {
        refreshToken: tokens.value.refreshToken,
      });

      tokens.value.accessToken = response.data.tokens.accessToken;
      tokens.value.refreshToken = response.data.tokens.refreshToken || tokens.value.refreshToken;
      tokens.value.expiresIn = response.data.tokens.expiresIn;
      tokens.value.refreshExpiresIn = response.data.tokens.refreshExpiresIn || tokens.value.refreshExpiresIn;

      setTokenExpiry(response.data.tokens.expiresIn);
      saveAuth();

      return true;
    } catch (err) {
      console.error('Error al refrescar token:', err);
      clearAuth();
      return false;
    }
  };

  /**
   * Obtiene el usuario autenticado
   * @returns {Promise<User>}
   */
  const fetchUser = async () => {
    try {
      isLoading.value = true;
      const response = await api.get('/api/auth/me');
      user.value = response.data.user;
      userStore.setUser(user.value);
      isLoading.value = false;
      return user.value;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Actualiza la contraseña
   * @param {Object} data - Datos para cambiar contraseña
   * @returns {Promise<boolean>}
   */
  const changePassword = async (data) => {
    try {
      isLoading.value = true;
      await api.patch('/api/auth/change-password', data);
      isLoading.value = false;
      return true;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Actualiza el perfil del usuario
   * @param {Object} data - Datos del perfil
   * @returns {Promise<User>}
   */
  const updateProfile = async (data) => {
    try {
      isLoading.value = true;
      const response = await api.patch('/api/auth/me', data);
      user.value = response.data.user;
      userStore.setUser(user.value);
      saveAuth();
      isLoading.value = false;
      return user.value;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Verifica si el usuario está autenticado
   * @returns {boolean}
   */
  const checkAuth = () => {
    return isAuthenticated.value;
  };

  // ============================================
  // GETTERS
  // ============================================

  const getAccessToken = computed(() => tokens.value?.accessToken || '');
  const getUser = computed(() => user.value);

  return {
    // Estado
    user,
    tokens,
    isAuthenticated,
    isLoading,
    error,
    
    // Getters
    getAccessToken,
    getUser,
    
    // Acciones
    initialize,
    saveAuth,
    clearAuth,
    setTokenExpiry,
    login,
    register,
    logout,
    refreshToken,
    fetchUser,
    changePassword,
    updateProfile,
    checkAuth,
  };
});
