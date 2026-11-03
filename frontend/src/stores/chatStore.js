/**
 * @file Store de Chat
 * @description Maneja el estado del chat (mensajes, grabación de audio, etc.)
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';
import { useAuthStore } from './authStore';
import { useUserStore } from './userStore';
import { useConversationStore } from './conversationStore';
import { useSocketStore } from './socketStore';
import { useTranslationStore } from './translationStore';
import { resolveMediaUrl } from '@/utils/media';
import { t } from '@/i18n';

// El backend serializa los mensajes por socket con un límite de 10 MB (base64 ≈ +33 %)
const MAX_AUDIO_BYTES = 7 * 1024 * 1024;

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
  const messagesTotal = ref({});
  // Hasta qué mensaje le llegó / vio cada integrante: { [conversationId]: { [userId]: { delivered, read } } }
  const receiptsByConversation = ref({});

  // ============================================
  // GETTERS
  // ============================================

  const getMessageById = computed(() => (id) => messagesById.value[id]);

  const currentMessages = computed(() => {
    if (currentConversationId.value) {
      return messages.value.filter(m => Number(m.conversation_id) === Number(currentConversationId.value));
    }
    return [];
  });

  // IDs de los usuarios que están escribiendo en la conversación actual
  const currentTypingUsers = computed(() => {
    if (currentConversationId.value) {
      const users = typingUsers.value[String(currentConversationId.value)] || {};
      return Object.keys(users).map(Number);
    }
    return [];
  });

  const hasTypingUsers = computed(() => currentTypingUsers.value.length > 0);

  const isCurrentUserTyping = computed(() => {
    return currentTypingUsers.value.includes(authStore.user?.id);
  });

  const canSendMessage = computed(() => {
    return !isRecording.value && socketStore.isConnected;
  });

  const isSending = computed(() => pendingMessages.value.length > 0);

  const hasMoreMessages = computed(() => {
    if (currentConversationId.value == null) return false;
    const key = Number(currentConversationId.value);
    const total = messagesTotal.value[key];
    if (total == null) return false;
    const loaded = messages.value.filter(m => Number(m.conversation_id) === key && m.id != null).length;
    return loaded < total;
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
      
      const fetchedMessages = response.data.messages.map(message =>
        processMessage(message, Number(conversationId))
      );

      const conversationKey = Number(conversationId);
      if (response.data.total != null) {
        messagesTotal.value[conversationKey] = response.data.total;
      }
      if (response.data.receipts) setReceipts(conversationKey, response.data.receipts);
      const otherConversationMessages = messages.value.filter(
        message => Number(message.conversation_id) !== conversationKey
      );
      const mergedMessages = new Map();

      fetchedMessages.forEach(message => mergedMessages.set(message.id ?? message.tempId, message));
      messages.value
        .filter(message => Number(message.conversation_id) === conversationKey)
        .forEach(message => mergedMessages.set(message.id ?? message.tempId, message));

      const conversationMessages = [...mergedMessages.values()].sort((left, right) =>
        new Date(left.created_at) - new Date(right.created_at)
      );
      messages.value = [...otherConversationMessages, ...conversationMessages];
      messagesById.value = {
        ...messagesById.value,
        ...conversationMessages.reduce((acc, message) => {
          if (message.id != null) acc[message.id] = message;
          return acc;
        }, {}),
      };
      
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
   * @param {number|string} conversationId - ID de la conversación
   * @returns {Promise<Message[]>}
   */
  const loadMoreMessages = async (conversationId) => {
    try {
      const conversationKey = Number(conversationId);
      const currentMessagesCount = messages.value.filter(
        m => Number(m.conversation_id) === conversationKey && m.id != null
      ).length;

      const response = await api.get(`/api/messages/${conversationKey}`, {
        params: {
          limit: 50,
          offset: currentMessagesCount,
        },
      });

      if (response.data.total != null) {
        messagesTotal.value[conversationKey] = response.data.total;
      }
      if (response.data.receipts) setReceipts(conversationKey, response.data.receipts);

      const newMessages = response.data.messages
        .filter(msg => !messagesById.value[msg.id])
        .map(msg => processMessage(msg, conversationKey));

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
    const clientMessageId = data.clientMessageId;
    
    // Verificar si el mensaje ya existe
    if (messagesById.value[message.id]) return;
    
    // Procesar el mensaje
    const processedMessage = processMessage(message, conversationId);
    
    const optimisticIndex = messages.value.findIndex(item => item.tempId === clientMessageId);
    if (optimisticIndex === -1) {
      messages.value.push(processedMessage);
    } else {
      messages.value.splice(optimisticIndex, 1, processedMessage);
    }
    pendingMessages.value = pendingMessages.value.filter(item => item.tempId !== clientMessageId);
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
    const clientMessageId = data.clientMessageId;
    
    // Verificar si el mensaje ya existe
    if (messagesById.value[message.id]) return;
    
    // Procesar el mensaje
    const processedMessage = processMessage(message, conversationId);
    
    const optimisticIndex = messages.value.findIndex(item => item.tempId === clientMessageId);
    if (optimisticIndex === -1) {
      messages.value.push(processedMessage);
    } else {
      // Liberar la URL local de la grabación optimista
      const optimisticUrl = messages.value[optimisticIndex].audio_url;
      if (optimisticUrl?.startsWith('blob:')) URL.revokeObjectURL(optimisticUrl);
      messages.value.splice(optimisticIndex, 1, processedMessage);
    }
    pendingMessages.value = pendingMessages.value.filter(item => item.tempId !== clientMessageId);
    messagesById.value[message.id] = processedMessage;

    const isFromOtherUser = Number(message.sender_id) !== Number(authStore.user?.id);
    const isCurrentConversation = Number(currentConversationId.value) === Number(conversationId);

    // Si es la conversación actual, descontrar no leídos
    if (isCurrentConversation) {
      conversationStore.markAsRead(conversationId);
    }

    // Reproducir sonido de notificación
    if (isFromOtherUser) {
      playNotificationSound();
    }

    // Si la configuración lo permite, reproducir automáticamente los audios recibidos
    if (isFromOtherUser && isCurrentConversation && translationStore.preferences?.playAudioAutomatically) {
      playAudio(processedMessage.audio_url);
    }
  };

  const updateMessageTranslation = (data) => {
    const message = messagesById.value[data.messageId];
    if (!message) return;

    const updates = {
      translated_content: data.translatedContent,
      target_language_id: data.targetLanguageId,
      translation_status: data.translationStatus,
    };
    Object.assign(message, updates);
    messagesById.value[data.messageId] = message;
    const index = messages.value.findIndex(item => item.id === data.messageId);
    if (index !== -1) messages.value[index] = message;
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
      type: message.type || (message.message_type === 'audio' ? 'voice' : message.message_type),
      audio_url: resolveMediaUrl(message.audio_url),
      attachments: message.attachments?.map(attachment => ({
        ...attachment,
        file_url: resolveMediaUrl(attachment.file_url),
      })),
      duration: message.duration ?? message.audio_duration,
      transcription: message.transcription ?? message.audio_transcription,
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
      return t('chat.yesterday');
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
  // ---- Estados de los mensajes propios: enviando / ✓ enviado / ✓✓ entregado / ✓✓ visto ----

  const toReceipt = (receipt) => ({
    delivered: Number(receipt.last_delivered_message_id) || 0,
    read: Number(receipt.last_read_message_id) || 0,
  });

  const setReceipts = (conversationId, receipts) => {
    receiptsByConversation.value[Number(conversationId)] = Object.fromEntries(
      receipts.map(receipt => [Number(receipt.user_id), toReceipt(receipt)])
    );
  };

  // Evento 'receipts_updated': a alguien le llegaron o vio mensajes
  const applyReceipt = ({ conversationId, receipt }) => {
    const key = Number(conversationId);
    receiptsByConversation.value[key] = {
      ...(receiptsByConversation.value[key] || {}),
      [Number(receipt.user_id)]: toReceipt(receipt),
    };
  };

  /**
   * Estado de un mensaje propio. En un grupo cuenta el que va más atrás:
   * "visto" recién cuando lo vieron todos, como en WhatsApp.
   * @returns {'sending'|'failed'|'sent'|'delivered'|'read'}
   */
  const getMessageStatus = (message) => {
    if (message.id == null) return message.status === 'failed' ? 'failed' : 'sending';

    const conversationId = Number(message.conversation_id);
    const receipts = receiptsByConversation.value[conversationId] || {};
    const me = Number(authStore.user?.id);
    // Solo los integrantes actuales (quien salió del grupo ya no cuenta)
    const members = conversationStore.conversationsById[conversationId]?.users;
    const memberIds = members ? new Set(members.map(user => Number(user.id))) : null;
    const others = Object.entries(receipts)
      .filter(([userId]) => Number(userId) !== me && (!memberIds || memberIds.has(Number(userId))))
      .map(([, receipt]) => receipt);

    if (!others.length) return 'sent';
    const id = Number(message.id);
    if (others.every(receipt => receipt.read >= id)) return 'read';
    if (others.every(receipt => Math.max(receipt.delivered, receipt.read) >= id)) return 'delivered';
    return 'sent';
  };

  // Un contacto cambió su foto: los mensajes ya cargados la muestran sin recargar
  const applySenderAvatar = ({ userId, avatar_url: avatarUrl }) => {
    messages.value.forEach(message => {
      if (Number(message.sender_id) === Number(userId) && message.sender) {
        message.sender = { ...message.sender, avatar_url: avatarUrl };
      }
    });
  };

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
    pendingMessages.value = pendingMessages.value.filter(
      message => message.tempId !== data.clientMessageId
    );
  };

  /**
   * Copia del mensaje citado para mostrar la respuesta antes de que confirme el servidor
   * @param {Message|null} replyTo - Mensaje al que se responde
   * @returns {Object}
   */
  const replyFields = (replyTo) => {
    if (!replyTo?.id) return {};
    return {
      reply_to_message_id: replyTo.id,
      replyTo: {
        id: replyTo.id,
        sender_id: replyTo.sender_id,
        message_type: replyTo.message_type,
        content: replyTo.content,
        audio_duration: replyTo.audio_duration,
        is_deleted: replyTo.is_deleted,
        sender: replyTo.sender,
      },
    };
  };

  /**
   * Aplica cambios a un mensaje cargado y a las citas que lo muestran
   * @param {number} messageId - ID del mensaje
   * @param {Object} updates - Campos nuevos
   */
  const patchMessage = (messageId, updates) => {
    const message = messagesById.value[messageId];
    if (message) {
      Object.assign(message, updates);
      const index = messages.value.findIndex(item => item.id === messageId);
      if (index !== -1) messages.value[index] = message;
    }

    // Respuestas que citan este mensaje
    const quoteUpdates = {};
    for (const key of ['content', 'is_deleted', 'is_edited']) {
      if (key in updates) quoteUpdates[key] = updates[key];
    }
    messages.value.forEach(item => {
      if (item.replyTo && Number(item.replyTo.id) === Number(messageId)) {
        item.replyTo = { ...item.replyTo, ...quoteUpdates };
      }
    });
  };

  /**
   * Mensaje editado (respuesta del servidor o evento 'message_updated')
   * @param {Object} message - Mensaje completo devuelto por el backend
   */
  const applyMessageUpdate = (message) => {
    if (!message?.id) return;
    patchMessage(message.id, {
      content: message.content,
      is_edited: message.is_edited,
      translated_content: message.translated_content,
      target_language_id: message.target_language_id,
      translation_status: message.translation_status,
    });
  };

  /**
   * Mensaje eliminado (para todos)
   * @param {number} messageId - ID del mensaje
   */
  const applyMessageDeleted = (messageId) => {
    patchMessage(Number(messageId), {
      is_deleted: true,
      content: null,
      translated_content: null,
      transcription: null,
      audio_url: null,
    });
  };

  /**
   * Envía un mensaje de texto
   * @param {string} content - Contenido del mensaje
   * @param {Object} [options]
   * @param {Message} [options.replyTo] - Mensaje al que responde
   * @returns {Promise<Message>}
   */
  const sendTextMessage = async (content, { replyTo = null } = {}) => {
    let tempId;
    try {
      if (!currentConversationId.value) {
        throw new Error(t('errors.noConversation'));
      }
      
      if (!content.trim()) {
        throw new Error(t('errors.emptyMessage'));
      }
      
      // Crear mensaje temporal
      tempId = `temp_${Date.now()}`;
      const tempMessage = {
        tempId,
        conversation_id: currentConversationId.value,
        sender_id: authStore.user?.id,
        type: 'text',
        message_type: 'text',
        content,
        created_at: new Date().toISOString(),
        sender: authStore.user,
        isCurrentUser: true,
        status: 'sending',
        ...replyFields(replyTo),
      };

      // Agregar a mensajes pendientes
      pendingMessages.value.push(tempMessage);
      messages.value.push(tempMessage);

      // Enviar por Socket.io
      await socketStore.sendTextMessage({
        conversationId: currentConversationId.value,
        clientMessageId: tempId,
        content,
        replyToMessageId: replyTo?.id || null,
      });
      
      // Limpiar el campo de escritura
      sendTyping(false);
      
      return tempMessage;
    } catch (err) {
      if (tempId) {
        messages.value = messages.value.filter(message => message.tempId !== tempId);
        pendingMessages.value = pendingMessages.value.filter(message => message.tempId !== tempId);
      }
      error.value = err;
      throw err;
    }
  };

  /**
   * Envía una foto, video o documento. Se muestra al instante (con la imagen local y el
   * progreso de subida) y se reemplaza por el mensaje del servidor al terminar.
   * @param {File} file - Archivo ya validado (y comprimido, si es foto)
   * @param {Object} [options]
   * @param {Object} [options.replyTo] - Mensaje al que responde
   * @returns {Promise<Object>} Mensaje creado
   */
  const sendAttachment = async (file, { replyTo = null } = {}) => {
    const conversationId = currentConversationId.value;
    if (!conversationId) throw new Error(t('errors.noConversation'));

    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const localUrl = kind === 'file' ? null : URL.createObjectURL(file);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    messages.value.push({
      tempId,
      conversation_id: conversationId,
      sender_id: authStore.user?.id,
      type: kind,
      message_type: kind,
      content: null,
      attachments: [{
        file_name: file.name,
        file_url: localUrl,
        file_type: kind,
        file_size: file.size,
        mime_type: file.type,
      }],
      created_at: new Date().toISOString(),
      sender: authStore.user,
      isCurrentUser: true,
      status: 'sending',
      uploadProgress: 0,
      ...replyFields(replyTo),
    });
    // El objeto reactivo (el que ve la vista), para ir actualizando el progreso
    const pending = messages.value[messages.value.length - 1];

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('client_message_id', tempId);
    if (replyTo?.id) form.append('reply_to_message_id', String(replyTo.id));

    try {
      const response = await api.post(`/api/messages/${conversationId}/attachment`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Un video con datos móviles puede tardar bastante más que los 30 s por defecto
        timeout: 5 * 60 * 1000,
        onUploadProgress: (event) => {
          if (event.total) pending.uploadProgress = Math.round((event.loaded / event.total) * 100);
        },
      });
      // Puede haber llegado antes por Socket.io (y ya reemplazó al provisorio)
      addTextMessage({ message: response.data.message, conversationId, clientMessageId: tempId });
      return response.data.message;
    } catch (err) {
      messages.value = messages.value.filter(message => message.tempId !== tempId);
      error.value = err;
      throw err;
    } finally {
      if (localUrl) URL.revokeObjectURL(localUrl);
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
   * @param {number} [duration] - Duración en segundos (si se grabó fuera del store)
   * @param {Object} [options]
   * @param {Message} [options.replyTo] - Mensaje al que responde
   * @returns {Promise<Message>}
   */
  const sendAudioMessage = async (audioBlob, duration = recordingDuration.value, { replyTo = null } = {}) => {
    let tempId;
    let localUrl;
    try {
      if (!currentConversationId.value) {
        throw new Error(t('errors.noConversation'));
      }

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error(t('chat.voice.empty'));
      }

      if (audioBlob.size > MAX_AUDIO_BYTES) {
        throw new Error(t('chat.voice.tooLong'));
      }

      // Tipo base sin parámetros de codec (p. ej. "audio/webm;codecs=opus" -> "audio/webm")
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      const conversationId = currentConversationId.value;

      // Leer el blob como base64
      const audioBase64 = await blobToBase64(audioBlob);

      // Mensaje temporal: se puede escuchar desde la grabación local mientras se envía
      tempId = `temp_${Date.now()}`;
      localUrl = URL.createObjectURL(audioBlob);
      const tempMessage = {
        tempId,
        conversation_id: conversationId,
        sender_id: authStore.user?.id,
        type: 'voice',
        message_type: 'audio',
        audio_url: localUrl,
        audio_duration: duration,
        duration,
        created_at: new Date().toISOString(),
        sender: authStore.user,
        isCurrentUser: true,
        status: 'sending',
        ...replyFields(replyTo),
      };

      // Agregar a mensajes pendientes
      pendingMessages.value.push(tempMessage);
      messages.value.push(tempMessage);

      // Enviar por Socket.io
      await socketStore.sendAudioMessage({
        conversationId,
        clientMessageId: tempId,
        audioBase64,
        duration,
        mimeType,
        replyToMessageId: replyTo?.id || null,
      });

      // Resetear temporizador
      recordingDuration.value = 0;

      return tempMessage;
    } catch (err) {
      if (tempId) {
        messages.value = messages.value.filter(message => message.tempId !== tempId);
        pendingMessages.value = pendingMessages.value.filter(message => message.tempId !== tempId);
      }
      if (localUrl) URL.revokeObjectURL(localUrl);
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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error(t('chat.voice.readError')));
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
    if (translationStore.preferences?.notificationSound) {
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
   * Reintenta el envío de un mensaje de texto fallido
   * @param {Message} message - Mensaje a reenviar
   * @returns {Promise<Message>}
   */
  const retryMessage = async (message) => {
    if (message.tempId) {
      messages.value = messages.value.filter(item => item.tempId !== message.tempId);
      pendingMessages.value = pendingMessages.value.filter(item => item.tempId !== message.tempId);
    }
    if (!message.content) {
      throw new Error(t('errors.onlyTextRetry'));
    }
    return sendTextMessage(message.content, { replyTo: message.replyTo });
  };

  /**
   * Edita un mensaje de texto propio
   * @param {number} messageId - ID del mensaje
   * @param {string} content - Texto nuevo
   */
  const editMessage = async (messageId, content) => {
    try {
      const text = content.trim();
      if (!text) throw new Error(t('errors.emptyMessage'));

      const response = await api.patch(`/api/messages/${messageId}`, { content: text });
      applyMessageUpdate(response.data.message);
      conversationStore.handleMessageChanged(
        messagesById.value[messageId]?.conversation_id,
        { id: messageId, content: text, is_edited: true }
      );
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Elimina un mensaje para todos (el servidor valida los permisos)
   * @param {number} messageId - ID del mensaje
   */
  const deleteMessage = async (messageId) => {
    try {
      const message = messagesById.value[messageId];

      if (!message) {
        throw new Error(t('errors.messageNotFound'));
      }

      await api.delete(`/api/messages/${messageId}`);

      applyMessageDeleted(messageId);
      conversationStore.handleMessageChanged(
        message.conversation_id,
        { id: messageId, is_deleted: true, content: null }
      );
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
    messagesTotal.value = {};
    receiptsByConversation.value = {};

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
    isSending,
    hasMoreMessages,

    // Acciones
    initialize,
    setupEventListeners,
    setCurrentConversation,
    clearCurrentConversation,
    fetchMessages,
    loadMoreMessages,
    addTextMessage,
    addAudioMessage,
    updateMessageTranslation,
    processMessage,
    formatMessageDate,
    handleNewTextMessage,
    handleNewAudioMessage,
    handleUserTyping,
    sendTyping,
    handleMessageRead,
    applyReceipt,
    getMessageStatus,
    applySenderAvatar,
    sendAttachment,
    handleMessageSent,
    sendTextMessage,
    startRecording,
    stopRecording,
    sendAudioMessage,
    blobToBase64,
    playAudio,
    stopAudio,
    playNotificationSound,
    retryMessage,
    applyMessageUpdate,
    applyMessageDeleted,
    editMessage,
    deleteMessage,
    markMessageAsRead,
    clear,
  };
});
