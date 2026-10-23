/**
 * @file Store de Conversaciones
 * @description Maneja el estado de las conversaciones
 * @author Arquitecto de Software Senior
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';
import { useAuthStore } from './authStore';
import { useUserStore } from './userStore';

/**
 * @typedef {Object} Conversation
 * @property {number} id - ID de la conversación
 * @property {string} name - Nombre de la conversación
 * @property {string} type - Tipo ('private', 'group')
 * @property {number} created_by - ID del creador
 * @property {string} description - Descripción
 * @property {string} avatar_url - URL del avatar
 * @property {boolean} is_archived - Si está archivada
 * @property {Date} last_message_at - Fecha del último mensaje
 * @property {Object} lastMessage - Último mensaje
 * @property {Object} creator - Creador de la conversación
 * @property {Object[]} users - Participantes
 * @property {number} unread_count - Cantidad de mensajes no leídos
 * @property {boolean} is_muted - Si está silenciada
 * @property {boolean} is_pinned - Si está fijada
 */

/**
 * @typedef {Object} ConversationState
 * @property {Conversation[]} conversations - Lista de conversaciones
 * @property {Conversation|null} currentConversation - Conversación actual
 * @property {Object} conversationsById - Conversaciones indexadas por ID
 * @property {boolean} isLoading - Si se está cargando
 * @property {Error|null} error - Error
 */

export const useConversationStore = defineStore('conversation', () => {
  // ============================================
  // ESTADO
  // ============================================
  
  const authStore = useAuthStore();
  const userStore = useUserStore();
  
  const conversations = ref([]);
  const currentConversation = ref(null);
  const conversationsById = ref({});
  const isLoading = ref(false);
  const error = ref(null);
  
  // ============================================
  // GETTERS
  // ============================================
  
  const getConversationById = computed(() => (id) => conversationsById.value[id]);
  
  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => {
      // Primero las fijadas
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      
      // Luego por fecha del último mensaje (descendente)
      const aDate = a.last_message_at || a.created_at || new Date(0);
      const bDate = b.last_message_at || b.created_at || new Date(0);
      
      return new Date(bDate) - new Date(aDate);
    });
  });
  
  const unreadConversations = computed(() => {
    return conversations.value.filter(c => c.unread_count > 0);
  });
  
  const unreadCount = computed(() => {
    return conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  });
  
  const archivedConversations = computed(() => {
    return conversations.value.filter(c => c.is_archived);
  });
  
  const activeConversations = computed(() => {
    return conversations.value.filter(c => !c.is_archived);
  });
  
  const privateConversations = computed(() => {
    return conversations.value.filter(c => c.type === 'private');
  });
  
  const groupConversations = computed(() => {
    return conversations.value.filter(c => c.type === 'group');
  });
  
  // ============================================
  // ACCIONES
  // ============================================
  
  /**
   * Inicializa el store
   */
  const initialize = async () => {
    if (!authStore.isAuthenticated) return;
    
    try {
      isLoading.value = true;
      await fetchConversations();
      isLoading.value = false;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
    }
  };

  /**
   * Obtiene las conversaciones del usuario
   * @returns {Promise<Conversation[]>}
   */
  const fetchConversations = async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const userId = authStore.user?.id;
      if (!userId) {
        conversations.value = [];
        conversationsById.value = {};
        isLoading.value = false;
        return [];
      }
      
      const response = await api.get(`/api/users/${userId}/conversations`, {
        params: { limit: 100 },
      });
      
      const convs = response.data.conversations;
      
      // Procesar conversaciones
      conversations.value = convs;
      conversationsById.value = convs.reduce((acc, conv) => {
        acc[conv.id] = conv;
        return acc;
      }, {});
      
      isLoading.value = false;
      return convs;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Establece las conversaciones
   * @param {Conversation[]} convs - Array de conversaciones
   */
  const setConversations = (convs) => {
    conversations.value = convs;
    conversationsById.value = convs.reduce((acc, conv) => {
      acc[conv.id] = conv;
      return acc;
    }, {});
  };

  /**
   * Crea una nueva conversación
   * @param {Object} data - Datos de la conversación
   * @returns {Promise<Conversation>}
   */
  const createConversation = async (data) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await api.post('/api/conversations', data);
      const newConversation = response.data.conversation;
      
      // Agregar a la lista
      conversations.value.unshift(newConversation);
      conversationsById.value[newConversation.id] = newConversation;
      
      // Establecer como conversación actual
      setCurrentConversation(newConversation);
      
      isLoading.value = false;
      return newConversation;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Crea una conversación privada con un usuario
   * @param {number} userId - ID del otro usuario
   * @returns {Promise<Conversation>}
   */
  const createPrivateConversation = async (userId) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      // Verificar si ya existe una conversación privada
      const existing = conversations.value.find(c => {
        return c.type === 'private' && 
               c.users?.some(u => u.id === userId) &&
               c.users?.some(u => u.id === authStore.user?.id);
      });
      
      if (existing) {
        setCurrentConversation(existing);
        isLoading.value = false;
        return existing;
      }
      
      const response = await api.post('/api/conversations', {
        type: 'private',
        participant_ids: [userId],
      });
      
      const newConversation = response.data.conversation;
      
      conversations.value.unshift(newConversation);
      conversationsById.value[newConversation.id] = newConversation;
      
      setCurrentConversation(newConversation);
      
      isLoading.value = false;
      return newConversation;
    } catch (err) {
      error.value = err;
      isLoading.value = false;
      throw err;
    }
  };

  /**
   * Establece la conversación actual
   * @param {Conversation} conversation - Conversación
   */
  const setCurrentConversation = (conversation) => {
    currentConversation.value = conversation;
    
    // Cargar participantes en el userStore
    if (conversation.users) {
      userStore.addUsers(conversation.users);
    }
  };

  /**
   * Limpia la conversación actual
   */
  const clearCurrentConversation = () => {
    currentConversation.value = null;
  };

  /**
   * Actualiza una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {Object} updates - Actualizaciones
   */
  const updateConversation = (conversationId, updates) => {
    if (conversationsById.value[conversationId]) {
      conversationsById.value[conversationId] = {
        ...conversationsById.value[conversationId],
        ...updates,
      };
      
      // Actualizar en el array
      const index = conversations.value.findIndex(c => c.id === conversationId);
      if (index !== -1) {
        conversations.value[index] = conversationsById.value[conversationId];
      }
      
      // Si es la conversación actual, actualizarla
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value = { ...currentConversation.value, ...updates };
      }
    }
  };

  /**
   * Maneja un nuevo mensaje en una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {Object} message - Mensaje
   */
  const handleNewMessage = (conversationId, message) => {
    const conversation = conversationsById.value[conversationId];
    
    if (conversation) {
      // Actualizar último mensaje
      updateConversation(conversationId, {
        last_message_id: message.id,
        last_message_at: message.created_at,
        lastMessage: message,
      });
      
      // Si no es la conversación actual, incrementar contador de no leídos
      if (currentConversation.value?.id !== conversationId) {
        const currentUnread = conversation.unread_count || 0;
        updateConversation(conversationId, {
          unread_count: currentUnread + 1,
        });
      }
    }
  };

  /**
   * Maneja un usuario que se unió a una conversación
   * @param {Object} data - Datos del evento
   */
  const handleUserJoined = (data) => {
    const conversation = conversationsById.value[data.conversationId];
    
    if (conversation) {
      // Agregar usuario a la conversación
      if (!conversation.users) {
        conversation.users = [];
      }
      
      const existingIndex = conversation.users.findIndex(u => u.id === data.userId);
      if (existingIndex === -1) {
        conversation.users.push({
          id: data.userId,
          username: data.username,
        });
      }
      
      updateConversation(data.conversationId, { users: conversation.users });
    }
  };

  /**
   * Maneja un usuario que abandonó una conversación
   * @param {Object} data - Datos del evento
   */
  const handleUserLeft = (data) => {
    const conversation = conversationsById.value[data.conversationId];
    
    if (conversation && conversation.users) {
      conversation.users = conversation.users.filter(u => u.id !== data.userId);
      updateConversation(data.conversationId, { users: conversation.users });
    }
  };

  /**
   * Maneja el cambio de estado de un usuario
   * @param {Object} data - Datos del evento
   */
  const handleUserStatusChanged = (data) => {
    // Actualizar estado en todas las conversaciones
    conversations.value.forEach(conversation => {
      if (conversation.users) {
        const user = conversation.users.find(u => u.id === data.userId);
        if (user) {
          user.status = data.status;
          if (data.lastSeenAt) {
            user.last_seen_at = data.lastSeenAt;
          }
        }
      }
    });
    
    // También actualizar en el userStore
    userStore.updateUserStatus(data.userId, data.status, data.lastSeenAt);
  };

  /**
   * Marca una conversación como leída
   * @param {number} conversationId - ID de la conversación
   */
  const markAsRead = (conversationId) => {
    updateConversation(conversationId, { unread_count: 0 });
  };

  /**
   * Archiva/desarchiva una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {boolean} isArchived - Estado de archivo
   */
  const toggleArchive = async (conversationId, isArchived) => {
    try {
      const response = await api.post(`/api/conversations/${conversationId}/archive`, {
        is_archived: isArchived,
      });
      
      updateConversation(conversationId, { is_archived: isArchived });
      
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Fija/desfija una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {boolean} isPinned - Estado de fijado
   */
  const togglePin = async (conversationId, isPinned) => {
    try {
      const response = await api.post(`/api/conversations/${conversationId}/pin`, {
        is_pinned: isPinned,
      });
      
      updateConversation(conversationId, { is_pinned: isPinned });
      
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Silencia/activa notificaciones de una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {boolean} isMuted - Estado de silencio
   */
  const toggleMute = async (conversationId, isMuted) => {
    try {
      const response = await api.post(`/api/conversations/${conversationId}/mute`, {
        is_muted: isMuted,
      });
      
      updateConversation(conversationId, { is_muted: isMuted });
      
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Elimina una conversación
   * @param {number} conversationId - ID de la conversación
   */
  const deleteConversation = async (conversationId) => {
    try {
      const response = await api.delete(`/api/conversations/${conversationId}`);
      
      // Remover de la lista
      conversations.value = conversations.value.filter(c => c.id !== conversationId);
      delete conversationsById.value[conversationId];
      
      // Si es la conversación actual, limpiarla
      if (currentConversation.value?.id === conversationId) {
        clearCurrentConversation();
      }
      
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    }
  };

  /**
   * Limpia el store
   */
  const clear = () => {
    conversations.value = [];
    currentConversation.value = null;
    conversationsById.value = {};
    error.value = null;
  };

  return {
    // Estado
    conversations,
    currentConversation,
    conversationsById,
    isLoading,
    error,
    
    // Getters
    getConversationById,
    sortedConversations,
    unreadConversations,
    unreadCount,
    archivedConversations,
    activeConversations,
    privateConversations,
    groupConversations,
    
    // Acciones
    initialize,
    fetchConversations,
    setConversations,
    createConversation,
    createPrivateConversation,
    setCurrentConversation,
    clearCurrentConversation,
    updateConversation,
    handleNewMessage,
    handleUserJoined,
    handleUserLeft,
    handleUserStatusChanged,
    markAsRead,
    toggleArchive,
    togglePin,
    toggleMute,
    deleteConversation,
    clear,
  };
});
