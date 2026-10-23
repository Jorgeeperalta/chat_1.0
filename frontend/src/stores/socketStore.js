/**
 * @file Store de Socket.io
 * @description Maneja la conexión WebSocket con Socket.io
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io } from 'socket.io-client';
import { useAuthStore } from './authStore';
import { useChatStore } from './chatStore';
import { useConversationStore } from './conversationStore';

/**
 * @typedef {Object} SocketState
 * @property {Object|null} socket - Instancia del socket
 * @property {boolean} isConnected - Si está conectado
 * @property {boolean} isConnecting - Si se está conectando
 * @property {string} socketId - ID del socket
 * @property {Error|null} error - Error de conexión
 * @property {Object} listeners - Escuchadores de eventos registrados
 */

export const useSocketStore = defineStore('socket', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const authStore = useAuthStore();
  const chatStore = useChatStore();
  const conversationStore = useConversationStore();
  
  const socket = ref(null);
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const socketId = ref('');
  const error = ref(null);
  const listeners = ref({});
  
  // ============================================
  // GETTERS
  // ============================================
  
  const getSocket = computed(() => socket.value);
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Conecta al servidor Socket.io
   */
  const connect = () => {
    if (isConnected.value || isConnecting.value) return;
    
    isConnecting.value = true;
    error.value = null;
    
    const token = authStore.getAccessToken;
    
    if (!token) {
      isConnecting.value = false;
      return;
    }
    
    try {
      const socketUrl = import.meta.env.VITE_SOCKET_IO_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const socketPath = import.meta.env.VITE_SOCKET_IO_PATH || '/socket.io';
      
      socket.value = io(socketUrl, {
        path: socketPath,
        reconnection: true,
        reconnectionAttempts: parseInt(import.meta.env.VITE_SOCKET_IO_RECONNECTION_ATTEMPTS) || 5,
        reconnectionDelay: parseInt(import.meta.env.VITE_SOCKET_IO_RECONNECTION_DELAY) || 1000,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        query: {
          token: token,
          userId: authStore.user?.id,
        },
      });
      
      // Configurar escuchadores
      setupEventListeners();
      
    } catch (err) {
      error.value = err;
      isConnecting.value = false;
      console.error('Error al crear socket:', err);
    }
  };

  /**
   * Configura los escuchadores de eventos del socket
   */
  const setupEventListeners = () => {
    if (!socket.value) return;
    
    // Evento: conexión establecida
    socket.value.on('connect', () => {
      isConnected.value = true;
      socketId.value = socket.value.id;
      isConnecting.value = false;
      console.log(`✅ Socket conectado: ${socket.value.id}`);
    });
    
    // Evento: conexión perdida
    socket.value.on('disconnect', () => {
      isConnected.value = false;
      socketId.value = '';
      console.log('⚡ Socket desconectado');
    });
    
    // Evento: error de conexión
    socket.value.on('connect_error', (err) => {
      isConnected.value = false;
      isConnecting.value = false;
      error.value = err;
      console.error('❌ Error de conexión:', err);
    });
    
    // Evento: error
    socket.value.on('error', (err) => {
      error.value = err;
      console.error('❌ Error en socket:', err);
    });
    
    // Evento: nuevo mensaje de texto
    socket.value.on('new_text_message', (data) => {
      chatStore.addTextMessage(data);
      conversationStore.handleNewMessage(data.conversationId, data.message);
    });
    
    // Evento: nuevo mensaje de audio
    socket.value.on('new_audio_message', (data) => {
      chatStore.addAudioMessage(data);
      conversationStore.handleNewMessage(data.conversationId, data.message);
    });
    
    // Evento: usuario se unió a la conversación
    socket.value.on('user_joined', (data) => {
      conversationStore.handleUserJoined(data);
    });
    
    // Evento: usuario abandonó la conversación
    socket.value.on('user_left', (data) => {
      conversationStore.handleUserLeft(data);
    });
    
    // Evento: usuario está escribiendo
    socket.value.on('user_typing', (data) => {
      chatStore.handleUserTyping(data);
    });
    
    // Evento: mensaje leído
    socket.value.on('message_read_receipt', (data) => {
      chatStore.handleMessageRead(data);
    });
    
    // Evento: estado de usuario cambió
    socket.value.on('user_status_changed', (data) => {
      conversationStore.handleUserStatusChanged(data);
    });
    
    // Evento: acuse de recibido del join
    socket.value.on('joined', (data) => {
      console.log('✅ usuario se unió a las conversaciones:', data);
      conversationStore.setConversations(data.conversations);
    });
    
    // Evento: error al unirse
    socket.value.on('join_error', (data) => {
      console.error('❌ Error al unirse:', data.error);
    });
    
    // Evento: mensaje enviado (confirmación)
    socket.value.on('message_sent', (data) => {
      chatStore.handleMessageSent(data);
    });
    
    // Evento: error en mensaje
    socket.value.on('message_error', (data) => {
      console.error('❌ Error en mensaje:', data.error);
    });
  };

  /**
   * Desconecta del servidor Socket.io
   */
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
      isConnected.value = false;
      socketId.value = '';
      listeners.value = {};
      console.log('🔌 Socket desconectado manualmente');
    }
  };

  /**
   * Reconecta al servidor
   */
  const reconnect = () => {
    disconnect();
    connect();
  };

  /**
   * Une el usuario a una conversación
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<void>}
   */
  const joinConversation = async (conversationId) => {
    if (!socket.value || !isConnected.value) {
      await connect();
      
      // Esperar un tiempo para que la conexión se establezca
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (socket.value && isConnected.value) {
      socket.value.emit('join', { conversationId });
    }
  };

  /**
   * Abandona una conversación
   * @param {number} conversationId - ID de la conversación
   */
  const leaveConversation = (conversationId) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('leave', { conversationId });
    }
  };

  /**
   * Envía un mensaje de texto
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<void>}
   */
  const sendTextMessage = (messageData) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('text_message', messageData);
    } else {
      // Si no hay conexión, intentar conectar y luego enviar
      connect();
      setTimeout(() => {
        if (socket.value && isConnected.value) {
          socket.value.emit('text_message', messageData);
        }
      }, 1000);
    }
  };

  /**
   * Envía un mensaje de audio
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<void>}
   */
  const sendAudioMessage = (messageData) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('audio_message', messageData);
    } else {
      connect();
      setTimeout(() => {
        if (socket.value && isConnected.value) {
          socket.value.emit('audio_message', messageData);
        }
      }, 1000);
    }
  };

  /**
   * Envía el estado de escritura
   * @param {Object} data - Datos de escritura
   */
  const sendTyping = (data) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('typing', data);
    }
  };

  /**
   * Envía acuse de lectura de mensaje
   * @param {Object} data - Datos del mensaje
   */
  const sendMessageRead = (data) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('message_read', data);
    }
  };

  /**
   * Envía cambio de estado del usuario
   * @param {string} status - Nuevo estado
   */
  const sendStatusChange = (status) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('user_status_changed', { status });
    }
  };

  /**
   * Registra un escuchador de evento personalizado
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Función de callback
   */
  const on = (event, callback) => {
    if (!socket.value) {
      connect();
    }
    
    if (socket.value) {
      socket.value.on(event, callback);
      listeners.value[event] = callback;
    }
  };

  /**
   * Elimina un escuchador de evento
   * @param {string} event - Nombre del evento
   */
  const off = (event) => {
    if (socket.value && listeners.value[event]) {
      socket.value.off(event, listeners.value[event]);
      delete listeners.value[event];
    }
  };

  /**
   * Verifica si está conectado
   * @returns {boolean}
   */
  const checkConnection = () => {
    return isConnected.value;
  };

  return {
    // Estado
    socket,
    isConnected,
    isConnecting,
    socketId,
    error,
    
    // Getters
    getSocket,
    
    // Acciones
    connect,
    disconnect,
    reconnect,
    setupEventListeners,
    joinConversation,
    leaveConversation,
    sendTextMessage,
    sendAudioMessage,
    sendTyping,
    sendMessageRead,
    sendStatusChange,
    on,
    off,
    checkConnection,
  };
});
