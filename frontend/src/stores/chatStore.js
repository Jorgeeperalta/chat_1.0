/**
 * @file Store de Chat
 * @description Maneja el estado del chat (mensajes, grabación de audio, etc.)
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './authStore';
import { useUserStore } from './userStore';
import { useConversationStore } from './conversationStore';
import { useSocketStore } from './socketStore';
import { useTranslationStore } from './translationStore';

/**
 * @typedef {Object} Message
 * @property {number} id - ID del mensaje
 * @property {number} conversation_id - ID de la conversación
 * @property {number} sender_id - ID del remitente
 * @property {string} message_type - Tipo de mensaje
 * @property {string} content - Contenido
 * @property {string} translated_content - Contenido traducido
 * @property {number} original_language_id - ID del idioma original
 * @property {number} target_language_id - ID del idioma de destino
 * @property {string} translation_status - Estado de la traducción
 * @property {string} audio_url - URL del audio
 * @property {number} audio_duration - Duración del audio
 * @property {boolean} is_read - Si está leído
 * @property {boolean} is_delivered - Si está entregado
 * @property {Date} created_at - Fecha de creación
 * @property {Object} sender - Remitente
 * @property {Object} originalLanguage - Idioma original
 * @property {Object} targetLanguage - Idioma de destino
 * @property {Object[]} attachments - Adjuntos
 */

/**
 * @typedef {Object} ChatState
 * @property {Message[]} messages - Lista de mensajes
 * @property {Message[]} pendingMessages - Mensajes pendientes de envío
 * @property {Object} messagesById - Mensajes indexados por ID
 * @property {Object} typingUsers - Usuarios que están escribiendo
 * @property {number} currentConversationId - ID de la conversación actual
 * @property {boolean} isRecording - Si se está grabando audio
 * @property {number} recordingDuration - Duración de la grabación
 * @property {number} recordingInterval - Intervalo de actualización
 * @property {Blob[]} audioChunks - Chunks de audio grabados
 * @property {MediaRecorder|null} mediaRecorder - Instancia de MediaRecorder
 * @property {boolean} isPlaying - Si se está reproduciendo audio
 * @property {string} playingAudioUrl - URL del audio que se está reproduciendo
 * @property {boolean} isLoading - Si se está cargando
 * @property {Error|null} error - Error
 */

export const useChatStore = defineStore('chat', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const authStore = useAuthStore();
  const userStore = useUserStore();
  const conversationStore = useConversationStore();
  const socketStore = useSocketStore();
  const translationStore = useTranslationStore();
  
  const messages = ref([]);
  const pendingMessages = ref([]);
  const messagesById = ref({});
  const typingUsers = ref({});
  const currentConversationId = ref(null);
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const recordingInterval = ref(null);
  const audioChunks = ref([]);
  const mediaRecorder = ref(null);
  const isPlaying = ref(false);
  const playingAudioUrl = ref('');
  const isLoading = ref(false);
  const error = ref(null);
  
  // ============================================
  // GETTERS
  // ============================================
  
  const getMessageById = computed(() => (id) => messagesById.value[id]);
  
  const currentMessages = computed(() => {
    if (currentConversationId.value) {
      return messages.value.filter(m => m.conversation_id === currentConversationId.value);
    }
    return [];
  });
  
  const currentTypingUsers = computed(() => {
    if (currentConversationId.value) {
      return Object.entries(typingUsers.value)
        .filter(([conversationId]) => conversationId === currentConversationId.value)
        .map(([_, users]) => users)
        .flat();
    }
    return [];
  });
  
  const hasTypingUsers = computed(() => currentTypingUsers.value.length > 0);
  
  const isCurrentUserTyping = computed(() => {
    if (currentConversationId.value) {
      const users = typingUsers.value[currentConversationId.value];
      return users?.some(userId => userId === authStore.user?.id);
    }
    return false;
  });
  
  const canSendMessage = computed(() => {
    return !isRecording.value && socketStore.isConnected;
  });
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = () => {
    // Configurar escuchadores de eventos
    setupEventListeners();
  };

  /**
   * Configura los escuchadores de eventos del socket
   */
  const setupEventListeners = () => {
    // Escuchar nuevos mensajes
    socketStore.on('new_text_message', handleNewTextMessage);
    socketStore.on('new_audio_message', handleNewAudioMessage);
  };

  /**
   * Establece la conversación actual
   * @param {number} id - ID de la conversación
   */
  const setCurrentConversation = (id) => {
    currentConversationId.value = id;
    
    // Cargar mensajes
    fetchMessages(id);
    
    // Unirse a la conversación
    socketStore.joinConversation(id);
  };

  /**
   * Limpia la conversación actual
   */
  const clearCurrentConversation = () => {
    currentConversationId.value = null;
    messages.value = [];
    messagesById.value = {};
    typingUsers.value = {};
  };

  /**
   * Obtiene los mensajes de una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Message[]>}
   */
  const fetchMessages = async (conversationId, options = {}) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const params = { ...options };
      
      const response = await api.get(`/api/messages/${conversationId}`, { params });
      
      const fetchedMessages = response.data.messages;
      
      // Procesar mensajes
      messages.value = fetchedMessages;
      messagesById.value = fetchedMessages.reduce((acc, msg) => {
        acc[msg.id] = msg;
        return acc;
      }, {});
      
      // Marcar conversación como leída
      conversationStore.markAsRead(conversationId);
      
      isLoading.value = false;
      return fetchedMessages;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Carga más mensajes (paginación)
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<Message[]>}
   */
  const loadMoreMessages = async (conversationId) => {
    try {
      const currentMessagesCount = messages.value.filter(m => m.conversation_id === conversationId).length;
      
      const response = await api.get(`/api/messages/${conversationId}`, {
        params: {
          limit: 50,
          offset: currentMessagesCount,
        },
      });
      
      const newMessages = response.data.messages;
      
      // Agregar mensajes al principio del array
      messages.value = [...newMessages, ...messages.value];
      
      // Actualizar messagesById
      newMessages.forEach(msg => {
        messagesById.value[msg.id] = msg;
      });
      
      return newMessages;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Agrega un mensaje de texto
   * @param {Object} data - Datos del mensaje
   */
  const addTextMessage = (data) => {
    const message = data.message;
    const conversationId = data.conversationId;
    
    // Verificar si el mensaje ya existe
    if (messagesById.value[message.id]) return;
    
    // Procesar el mensaje
    const processedMessage = processMessage(message, conversationId);
    
    // Agregar al array
    messages.value.push(processedMessage);
    messagesById.value[message.id] = processedMessage;
    
    // Si es la conversación actual, descontrar no leídos
    if (currentConversationId.value === conversationId) {
      conversationStore.markAsRead(conversationId);
    }
    
    // Reproducir sonido de notificación si es de otro usuario
    if (message.sender_id !== authStore.user?.id) {
      playNotificationSound();
    }
  };

  /**
   * Agrega un mensaje de audio
   * @param {Object} data - Datos del mensaje
   */
  const addAudioMessage = (data) => {
    const message = data.message;
    const conversationId = data.conversationId;
    
    // Verificar si el mensaje ya existe
    if (messagesById.value[message.id]) return;
    
    // Procesar el mensaje
    const processedMessage = processMessage(message, conversationId);
    
    // Agregar al array
    messages.value.push(processedMessage);
    messagesById.value[message.id] = processedMessage;
    
    // Si es la conversación actual, descontrar no leídos
    if (currentConversationId.value === conversationId) {
      conversationStore.markAsRead(conversationId);
    }
    
    // Reproducir sonido de notificación
    if (message.sender_id !== authStore.user?.id) {
      playNotificationSound();
    }
    
    // Si la configuración lo permite, reproducir automáticamente
    if (translationStore.preferences?.play_audio_automatically) {
      playAudio(message.audio_url);
    }
  };

  /**
   * Procesa un mensaje para agregar metadatos
   * @param {Object} message - Mensaje
   * @param {number} conversationId - ID de la conversación
   * @returns {Message}
   */
  const processMessage = (message, conversationId) => {
    // Obtener remitente del userStore
    const sender = userStore.getUserById(message.sender_id) || message.sender;
    
    // Obtener idioma original y de destino
    const originalLanguage = translationStore.getLanguageById(message.original_language_id);
    const targetLanguage = translationStore.getLanguageById(message.target_language_id);
    
    return {
      ...message,
      conversation_id: conversationId,
      sender,
      originalLanguage,
      targetLanguage,
      // Determinar si es del usuario actual
      isCurrentUser: message.sender_id === authStore.user?.id,
      // Formatear fecha
      formattedDate: formatMessageDate(message.created_at),
    };
  };

  /**
   * Formatea la fecha de un mensaje
   * @param {string|Date} date - Fecha
   * @returns {string}
   */
  const formatMessageDate = (date) => {
    const messageDate = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate >= today) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate >= yesterday) {
      return 'Ayer';
    } else if (messageDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  /**
   * Maneja un nuevo mensaje de texto
   * @param {Object} data - Datos del mensaje
   */
  const handleNewTextMessage = (data) => {
    addTextMessage(data);
  };

  /**
   * Maneja un nuevo mensaje de audio
   * @param {Object} data - Datos del mensaje
   */
  const handleNewAudioMessage = (data) => {
    addAudioMessage(data);
  };

  /**
   * Maneja el estado de escritura
   * @param {Object} data - Datos de escritura
   */
  const handleUserTyping = (data) => {
    const { conversationId, userId, isTyping } = data;
    
    if (!typingUsers.value[conversationId]) {
      typingUsers.value[conversationId] = {};
    }
    
    if (isTyping) {
      typingUsers.value[conversationId][userId] = true;
    } else {
      delete typingUsers.value[conversationId][userId];
      
      // Si no hay más usuarios escribiendo, eliminar el objeto
      if (Object.keys(typingUsers.value[conversationId]).length === 0) {
        delete typingUsers.value[conversationId];
      }
    }
  };

  /**
   * Envía el estado de escritura
   * @param {boolean} isTyping - Si el usuario está escribiendo
   */
  const sendTyping = (isTyping) => {
    if (currentConversationId.value && socketStore.isConnected) {
      socketStore.sendTyping({
        conversationId: currentConversationId.value,
        isTyping,
      });
    }
  };

  /**
   * Maneja el acuse de lectura de mensaje
   * @param {Object} data - Datos del mensaje
   */
  const handleMessageRead = (data) => {
    const message = messagesById.value[data.messageId];
    
    if (message) {
      message.is_read = true;
      messagesById.value[data.messageId] = message;
    }
  };

  /**
   * Maneja la confirmación de mensaje enviado
   * @param {Object} data - Datos del mensaje
   */
  const handleMessageSent = (data) => {
    // Actualizar el mensaje pendiente
    const pendingIndex = pendingMessages.value.findIndex(
      pm => pm.tempId === data.messageId
    );
    
    if (pendingIndex !== -1) {
      pendingMessages.value.splice(pendingIndex, 1);
    }
  };

  /**
   * Envía un mensaje de texto
   * @param {string} content - Contenido del mensaje
   * @returns {Promise<Message>}
   */
  const sendTextMessage = async (content) => {
    try {
      if (!currentConversationId.value) {
        throw new Error('No hay una conversación seleccionada');
      }
      
      if (!content.trim()) {
        throw new Error('El mensaje no puede estar vacío');
      }
      
      // Crear mensaje temporal
      const tempId = `temp_${Date.now()}`;
      const tempMessage = {
        tempId,
        conversation_id: currentConversationId.value,
        sender_id: authStore.user?.id,
        message_type: 'text',
        content,
        created_at: new Date().toISOString(),
        sender: authStore.user,
        isCurrentUser: true,
        status: 'sending',
      };
      
      // Agregar a mensajes pendientes
      pendingMessages.value.push(tempMessage);
      messages.value.push(tempMessage);
      
      // Enviar por Socket.io
      socketStore.sendTextMessage({
        conversationId: currentConversationId.value,
        content,
      });
      
      // Limpiar el campo de escritura
      sendTyping(false);
      
      return tempMessage;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Inicia la grabación de audio
   */
  const startRecording = async () => {
    try {
      // Solicitar permiso para el micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configurar MediaRecorder
      mediaRecorder.value = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000,
      });
      
      audioChunks.value = [];
      recordingDuration.value = 0;
      
      // Escuchar evento de datos
      mediaRecorder.value.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.value.push(event.data);
        }
      };
      
      // Iniciar grabación
      mediaRecorder.value.start(100); // Recopilar datos cada 100ms
      
      // Iniciar temporizador
      recordingInterval.value = setInterval(() => {
        recordingDuration.value += 1;
      }, 1000);
      
      isRecording.value = true;
      
      // Escuchar evento de detención
      mediaRecorder.value.onstop = () => {
        clearInterval(recordingInterval.value);
        recordingInterval.value = null;
      };
    } catch (err) {
      error.value = err;
      console.error('Error al iniciar grabación:', err);
      throw err;
    }
  };

  /**
   * Detiene la grabación de audio
   * @returns {Promise<Blob>}
   */
  const stopRecording = async () => {
    return new Promise((resolve) => {
      if (!mediaRecorder.value || !isRecording.value) {
        resolve(null);
        return;
      }
      
      // Detener MediaRecorder
      mediaRecorder.value.stop();
      isRecording.value = false;
      
      // Detener todos los tracks
      mediaRecorder.value.stream.getTracks().forEach(track => track.stop());
      
      // Crear Blob de audio
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
      
      // Limpiar
      audioChunks.value = [];
      
      resolve(audioBlob);
    });
  };

  /**
   * Envía un mensaje de audio
   * @param {Blob} audioBlob - Blob de audio
   * @returns {Promise<Message>}
   */
  const sendAudioMessage = async (audioBlob) => {
    try {
      if (!currentConversationId.value) {
        throw new Error('No hay una conversación seleccionada');
      }
      
      if (!audioBlob) {
        throw new Error('No se proporcionó audio');
      }
      
      // Leer el blob como base64
      const audioBase64 = await blobToBase64(audioBlob);
      
      // Crear mensaje temporal
      const tempId = `temp_${Date.now()}`;
      const tempMessage = {
        tempId,
        conversation_id: currentConversationId.value,
        sender_id: authStore.user?.id,
        message_type: 'audio',
        audio_duration: recordingDuration.value,
        created_at: new Date().toISOString(),
        sender: authStore.user,
        isCurrentUser: true,
        status: 'sending',
      };
      
      // Agregar a mensajes pendientes
      pendingMessages.value.push(tempMessage);
      messages.value.push(tempMessage);
      
      // Enviar por Socket.io
      socketStore.sendAudioMessage({
        conversationId: currentConversationId.value,
        audioBase64,
        duration: recordingDuration.value,
        mimeType: 'audio/webm',
      });
      
      // Resetear temporizador
      recordingDuration.value = 0;
      
      return tempMessage;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Convierte Blob a Base64
   * @param {Blob} blob - Blob a convertir
   * @returns {Promise<string>}
   */
  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  };

  /**
   * Reproduce un audio
   * @param {string} audioUrl - URL del audio
   */
  const playAudio = (audioUrl) => {
    if (isPlaying.value) {
      stopAudio();
    }
    
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      isPlaying.value = false;
      playingAudioUrl.value = '';
    };
    
    audio.onerror = () => {
      isPlaying.value = false;
      playingAudioUrl.value = '';
      console.error('Error al reproducir audio');
    };
    
    audio.play().then(() => {
      isPlaying.value = true;
      playingAudioUrl.value = audioUrl;
    }).catch(err => {
      console.error('Error al reproducir audio:', err);
    });
  };

  /**
   * Detiene la reproducción de audio
   */
  const stopAudio = () => {
    // Detener todos los elementos de audio
    document.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    
    isPlaying.value = false;
    playingAudioUrl.value = '';
  };

  /**
   * Reproduce el sonido de notificación
   */
  const playNotificationSound = () => {
    if (translationStore.preferences?.notification_sound) {
      // Crear un tono de notificación simple
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
   * Elimina un mensaje
   * @param {number} messageId - ID del mensaje
   */
  const deleteMessage = async (messageId) => {
    try {
      const message = messagesById.value[messageId];
      
      if (!message) {
        throw new Error('Mensaje no encontrado');
      }
      
      if (message.sender_id !== authStore.user?.id) {
        throw new Error('No puedes eliminar este mensaje');
      }
      
      await api.delete(`/api/messages/${messageId}`);
      
      // Marcar como eliminado
      message.is_deleted = true;
      message.content = '[Mensaje eliminado]';
      messagesById.value[messageId] = message;
      
      // Actualizar en el array
      const index = messages.value.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.value[index] = message;
      }
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Marca un mensaje como leído
   * @param {number} messageId - ID del mensaje
   */
  const markMessageAsRead = (messageId) => {
    const message = messagesById.value[messageId];
    
    if (message && !message.is_read && message.sender_id !== authStore.user?.id) {
      message.is_read = true;
      messagesById.value[messageId] = message;
      
      // Enviar acuse de lectura
      socketStore.sendMessageRead({
        conversationId: message.conversation_id,
        messageId,
      });
    }
  };

  /**
   * Limpia el store
   */
  const clear = () => {
    messages.value = [];
    pendingMessages.value = [];
    messagesById.value = {};
    typingUsers.value = {};
    currentConversationId.value = null;
    isRecording.value = false;
    recordingDuration.value = 0;
    audioChunks.value = [];
    mediaRecorder.value = null;
    isPlaying.value = false;
    playingAudioUrl.value = '';
    error.value = null;
    
    if (recordingInterval.value) {
      clearInterval(recordingInterval.value);
      recordingInterval.value = null;
    }
  };

  return {
    // Estado
    messages,
    pendingMessages,
    messagesById,
    typingUsers,
    currentConversationId,
    isRecording,
    recordingDuration,
    recordingInterval,
    audioChunks,
    mediaRecorder,
    isPlaying,
    playingAudioUrl,
    isLoading,
    error,
    
    // Getters
    getMessageById,
    currentMessages,
    currentTypingUsers,
    hasTypingUsers,
    isCurrentUserTyping,
    canSendMessage,
    
    // Acciones
    initialize,
    setupEventListeners,
    setCurrentConversation,
    clearCurrentConversation,
    fetchMessages,
    loadMoreMessages,
    addTextMessage,
    addAudioMessage,
    processMessage,
    formatMessageDate,
    handleNewTextMessage,
    handleNewAudioMessage,
    handleUserTyping,
    sendTyping,
    handleMessageRead,
    handleMessageSent,
    sendTextMessage,
    startRecording,
    stopRecording,
    sendAudioMessage,
    blobToBase64,
    playAudio,
    stopAudio,
    playNotificationSound,
    deleteMessage,
    markMessageAsRead,
    clear,
  };
});
