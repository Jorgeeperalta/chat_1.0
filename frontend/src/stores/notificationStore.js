/**
 * @file Store de Notificaciones
 * @description Maneja las notificaciones del navegador
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './authStore';
import { useTranslationStore } from './translationStore';
import { useConversationStore } from './conversationStore';

/**
 * @typedef {Object} Notification
 * @property {string} id - ID único
 * @property {string} title - Título
 * @property {string} body - Cuerpo
 * @property {string} icon - Icono
 * @property {string} type - Tipo ('info', 'success', 'warning', 'error')
 * @property {boolean} autoClose - Si se cierra automáticamente
 * @property {number} duration - Duración en milisegundos
 * @property {Function} onClick - Callback al hacer clic
 * @property {Function} onClose - Callback al cerrar
 */

/**
 * @typedef {Object} NotificationState
 * @property {Notification[]} notifications - Lista de notificaciones
 * @property {boolean} hasPermission - Si tiene permiso para notificaciones
 * @property {boolean} isSupported - Si las notificaciones están soportadas
 */

export const useNotificationStore = defineStore('notification', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const authStore = useAuthStore();
  const translationStore = useTranslationStore();
  
  const notifications = ref([]);
  const hasPermission = ref(false);
  const isSupported = ref(false);
  
  // ============================================
  // GETTERS
  // ============================================
  
  const activeNotifications = computed(() => {
    return notifications.value.filter(n => !n.closed);
  });
  
  const hasNotifications = computed(() => {
    return activeNotifications.value.length > 0;
  });
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = async () => {
    // Verificar si las notificaciones están soportadas
    isSupported.value = 'Notification' in window;

    // Verificar permiso
    if (isSupported.value) {
      hasPermission.value = await checkNotificationPermission();
    }
  };

  /**
   * Verifica el permiso de notificaciones (sin mostrar el diálogo del navegador)
   * @returns {Promise<boolean>}
   */
  const checkNotificationPermission = async () => {
    if (!isSupported.value) return false;

    return Notification.permission === 'granted';
  };

  /**
   * Solicita permiso de notificaciones
   * @returns {Promise<boolean>}
   */
  const requestNotificationPermission = async () => {
    if (!isSupported.value) return false;
    
    try {
      const permission = await Notification.requestPermission();
      hasPermission.value = permission === 'granted';
      return hasPermission.value;
    } catch (err) {
      console.error('Error al solicitar permiso:', err);
      return false;
    }
  };

  /**
   * Muestra una notificación en el navegador
   * @param {string} title - Título
   * @param {Object} options - Opciones de la notificación
   */
  const showBrowserNotification = (title, options = {}) => {
    if (!isSupported.value || !hasPermission.value) return;
    
    try {
      // Configuración por defecto
      const defaultOptions = {
        body: '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
          url: window.location.href,
        },
        ...options,
      };
      
      // Si el navegador está en segundo plano, mostrar notificación
      if (document.visibilityState === 'hidden') {
        const notification = new Notification(title, defaultOptions);
        
        // Cerrar notificación después de un tiempo
        setTimeout(() => {
          notification.close();
        }, 5000);
        
        // Manejar clic en la notificación
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          notification.close();
        };
      }
    } catch (err) {
      console.error('Error al mostrar notificación:', err);
    }
  };

  /**
   * Agrega una notificación a la lista
   * @param {Object} notification - Notificación
   */
  const addNotification = (notification) => {
    const id = Date.now().toString();
    
    const newNotification = {
      id,
      type: 'info',
      autoClose: true,
      duration: 5000,
      closed: false,
      ...notification,
    };
    
    notifications.value.push(newNotification);
    
    // Cerrar automáticamente si es configurado
    if (newNotification.autoClose) {
      setTimeout(() => {
        closeNotification(id);
      }, newNotification.duration);
    }
    
    // Mostrar notificación del navegador si es importante
    if (newNotification.type === 'error' || newNotification.type === 'success') {
      showBrowserNotification(newNotification.title, {
        body: newNotification.body,
        icon: newNotification.icon,
      });
    }
    
    // Reproducir sonido si está configurado
    if (translationStore.preferences.notificationSound && newNotification.type !== 'info') {
      playNotificationSound();
    }
    
    // Vibrar si está configurado
    if (translationStore.preferences.notificationVibration && newNotification.type !== 'info') {
      vibrate();
    }
    
    return id;
  };

  /**
   * Cierra una notificación
   * @param {string} id - ID de la notificación
   */
  const closeNotification = (id) => {
    const notification = notifications.value.find(n => n.id === id);
    
    if (notification) {
      notification.closed = true;
      
      if (notification.onClose) {
        notification.onClose();
      }
    }
  };

  /**
   * Cierra y elimina una notificación de la lista
   * @param {string} id - ID de la notificación
   */
  const removeNotification = (id) => {
    closeNotification(id);
    notifications.value = notifications.value.filter(n => n.id !== id);
  };

  /**
   * Cierra todas las notificaciones
   */
  const closeAllNotifications = () => {
    notifications.value.forEach(notification => {
      closeNotification(notification.id);
    });
  };

  /**
   * Muestra una notificación de éxito
   * @param {string} message - Mensaje
   * @param {string} title - Título (opcional)
   */
  const success = (message, title = 'Success') => {
    addNotification({
      title,
      body: message,
      type: 'success',
      icon: 'mdi-check-circle',
    });
  };

  /**
   * Muestra una notificación de error
   * @param {string} message - Mensaje
   * @param {string} title - Título (opcional)
   */
  const error = (message, title = 'Error') => {
    addNotification({
      title,
      body: message,
      type: 'error',
      icon: 'mdi-alert-circle',
      autoClose: false,
    });
  };

  /**
   * Muestra una notificación de advertencia
   * @param {string} message - Mensaje
   * @param {string} title - Título (opcional)
   */
  const warning = (message, title = 'Warning') => {
    addNotification({
      title,
      body: message,
      type: 'warning',
      icon: 'mdi-alert',
    });
  };

  /**
   * Muestra una notificación de información
   * @param {string} message - Mensaje
   * @param {string} title - Título (opcional)
   */
  const info = (message, title = 'Info') => {
    addNotification({
      title,
      body: message,
      type: 'info',
      icon: 'mdi-information',
    });
  };

  /**
   * Reproduce el sonido de notificación
   */
  const playNotificationSound = () => {
    if (translationStore.preferences?.notificationSound) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  };

  /**
   * Activa la vibración del dispositivo
   */
  const vibrate = () => {
    if (translationStore.preferences?.notificationVibration && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  /**
   * Muestra una notificación de nuevo mensaje
   * @param {Object} data - Datos del mensaje
   */
  const newMessageNotification = (data) => {
    const message = data.message;
    const sender = message.sender;
    
    addNotification({
      title: sender?.username || 'Nuevo mensaje',
      body: message.content || '[Audio]' || '[Mensaje]',
      type: 'info',
      icon: sender?.avatar_url || 'mdi-message',
      duration: 10000,
      onClick: () => {
        // Abrir la conversación
        const conversationStore = useConversationStore();
        const conversation = conversationStore.conversationsById[message.conversation_id];
        if (conversation) {
          conversationStore.setCurrentConversation(conversation);
        }
      },
    });
  };

  /**
   * Limpia el store
   */
  const clear = () => {
    notifications.value = [];
  };

  return {
    // Estado
    notifications,
    hasPermission,
    isSupported,
    
    // Getters
    activeNotifications,
    hasNotifications,
    
    // Acciones
    initialize,
    checkNotificationPermission,
    requestNotificationPermission,
    showBrowserNotification,
    addNotification,
    closeNotification,
    removeNotification,
    closeAllNotifications,
    success,
    error,
    warning,
    info,
    playNotificationSound,
    vibrate,
    newMessageNotification,
    clear,
  };
});
