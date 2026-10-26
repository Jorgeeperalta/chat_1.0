/**
 * @file Servicio API
 * @description Configuración centralizada de Axios para llamadas HTTP
 * @author Arquitecto de Software Senior
 */

import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

// Crear instancia de Axios
// Las rutas ya incluyen el prefijo /api: en producción (mismo origen que el backend)
// VITE_API_BASE_URL queda vacío y las peticiones son relativas.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  const token = authStore.getAccessToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore();
    const notificationStore = useNotificationStore();
    const originalRequest = error.config;
    
    // Las propias rutas de refresh/logout no deben disparar otro refresh (evita bucles)
    const isAuthSessionRequest = /\/api\/auth\/(refresh|logout)$/.test(originalRequest?.url || '');

    // Si es un error 401 (No autorizado) y no es una solicitud de refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthSessionRequest) {
      originalRequest._retry = true;
      
      try {
        // Intentar refrescar el token
        const success = await authStore.refreshToken();
        
        if (success) {
          // Reintentar la solicitud original
          return api(originalRequest);
        } else {
          // Token de refresh también expirado, cerrar sesión
          authStore.logout();
          notificationStore.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
      } catch (refreshError) {
        console.error('Error al refrescar token:', refreshError);
        authStore.logout();
        notificationStore.error('Error de autenticación. Por favor, inicia sesión nuevamente.');
      }
    }
    
    // Manejar otros errores
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      // Mostrar notificación para errores comunes
      if (status >= 500) {
        notificationStore.error('Error del servidor. Por favor, inténtalo más tarde.');
      } else if (status === 403) {
        notificationStore.error(data.message || 'No tienes permisos para realizar esta acción.');
      } else if (status === 404) {
        notificationStore.error(data.message || 'Recurso no encontrado.');
      } else if (status === 429) {
        notificationStore.warning('Demasiadas solicitudes. Por favor, espera un momento.');
      } else if (status === 400 && data.message) {
        notificationStore.error(data.message);
      }
    } else if (error.code === 'ECONNABORTED') {
      notificationStore.error('La solicitud tardó demasiado. Por favor, inténtalo nuevamente.');
    } else if (!navigator.onLine) {
      notificationStore.error('No hay conexión a Internet. Por favor, verifica tu conexión.');
    }
    
    return Promise.reject(error);
  }
);

// Funciones de conveniencia
const get = (url, config = {}) => {
  return api.get(url, config);
};

const post = (url, data = {}, config = {}) => {
  return api.post(url, data, config);
};

const put = (url, data = {}, config = {}) => {
  return api.put(url, data, config);
};

const patch = (url, data = {}, config = {}) => {
  return api.patch(url, data, config);
};

const del = (url, config = {}) => {
  return api.delete(url, config);
};

// Configuración para subida de archivos
const upload = (url, file, config = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(url, formData, {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'multipart/form-data',
    },
  });
};

export default {
  get,
  post,
  put,
  patch,
  del,
  upload,
  // Exportar instancia para acceso directo
  instance: api,
};
