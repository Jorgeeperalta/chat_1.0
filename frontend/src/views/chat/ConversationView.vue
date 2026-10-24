<!--
 * @file ConversationView.vue
 * @description Vista de una conversación individual
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="conversation-view">
    <header class="conversation-header">
      <v-btn icon variant="text" :to="{ name: 'chat' }" aria-label="Volver a conversaciones">
        <v-icon icon="mdi-arrow-left" />
      </v-btn>
      <div class="conversation-heading">
        <h1>{{ conversationTitle }}</h1>
        <span>{{ conversationSubtitle }}</span>
      </div>
    </header>

    <!-- Área de mensajes -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="!messages.length && !chatStore.isLoading" class="empty-messages">
        <v-icon icon="mdi-message-text-outline" size="40" />
        <p>{{ $t('chat.noMessages') }}</p>
      </div>
      <!-- Mensajes -->
      <template v-for="(message, index) in messages" :key="message.id">
        <!-- Mensaje del sistema (fecha) -->
        <div
          v-if="message.type === 'system'"
          class="system-message-date text-center my-4"
        >
          <v-chip
            color="grey"
            variant="outlined"
            size="small"
          >
            {{ formatDate(message.created_at) }}
          </v-chip>
        </div>

        <!-- Agrupar mensajes del mismo usuario -->
        <div
          v-else
          class="message-group"
          :class="{
            'current-user': String(message.sender_id) === String(currentUserId),
            'other-user': String(message.sender_id) !== String(currentUserId),
            'first-in-group': !isSameSender(message, messages[index - 1]),
          }"
          :data-message-id="message.id"
        >
          <MessageBubble
            :message="message"
            :compact="!isFirstInGroup(message, index)"
            :show-timestamp="isFirstInGroup(message, index)"
            @reply="handleReply"
            @react="handleReact"
            @delete="handleDelete"
            @click="handleMessageClick"
          />
        </div>
      </template>

      <!-- Indicador de que hay más mensajes -->
      <div
        v-if="hasMoreMessages"
        class="load-more-indicator text-center my-4"
      >
        <v-btn
          variant="text"
          color="primary"
          prepend-icon="mdi-chevron-up"
          @click="loadMoreMessages"
        >
          {{ $t('chat.loadMoreMessages') }}
        </v-btn>
      </div>

      <!-- Indicador de carga -->
      <div
        v-if="loadingMore"
        class="text-center py-4"
      >
        <v-progress-circular
          color="primary"
          indeterminate
          size="24"
        />
      </div>

      <!-- Indicador de que está escribiendo -->
      <div
        v-if="isTyping"
        class="typing-indicator other-user"
      >
        <MessageBubble
          :message="{
            type: 'system',
            content: `${typingUser} está escribiendo...`,
          }"
          compact
        />
      </div>
    </div>

    <div class="message-composer">
      <MessageInput
        :placeholder="$t('chat.typeMessage')"
        :loading="chatStore.isLoading"
        @send="sendMessage"
        @send:voice="sendVoiceMessage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useChatStore } from '@/stores/chatStore';
import { useSocketStore } from '@/stores/socketStore';
import MessageInput from '@/components/chat/MessageInput.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';

// ============================================
// INJECT
// ============================================

const device = inject('device');
const snackbar = inject('snackbar');

// ============================================
// STORES
// ============================================

const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const conversationStore = useConversationStore();
const chatStore = useChatStore();
const socketStore = useSocketStore();

// ============================================
// ESTADO LOCAL
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);
const loadingMore = ref(false);
const isTyping = ref(false);
const typingUser = ref('');

// ============================================
// COMPUTED
// ============================================

const currentUserId = computed(() => authStore.user?.id);
const messagesContainer = ref(null);

const conversationId = computed(() => {
  return route.params.conversationId;
});

const messages = computed(() => {
  return chatStore.messages.filter(m => Number(m.conversation_id) === Number(conversationId.value));
});

const currentConversation = computed(() => conversationStore.conversationsById[conversationId.value]);

const conversationTitle = computed(() => {
  const otherUser = currentConversation.value?.users?.find(user => user.id !== currentUserId.value);
  return currentConversation.value?.name || otherUser?.first_name || otherUser?.username || 'Conversación';
});

const conversationSubtitle = computed(() => {
  const otherUser = currentConversation.value?.users?.find(user => user.id !== currentUserId.value);
  return otherUser?.status === 'online' ? 'En línea' : otherUser?.username || '';
});

const hasMoreMessages = computed(() => {
  return chatStore.hasMoreMessages && messages.value.length > 0;
});

// ============================================
// MÉTODOS
// ============================================

const isSameSender = (currentMessage, previousMessage) => {
  if (!previousMessage || previousMessage.type === 'system') return false;
  return currentMessage.sender_id === previousMessage.sender_id;
};

const isFirstInGroup = (currentMessage, index) => {
  if (index === 0) return true;
  return !isSameSender(currentMessage, messages.value[index - 1]);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else if (diffInHours < 48) {
    return 'Ayer';
  } else if (diffInHours < 7 * 24) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    });
  }
};

const loadMoreMessages = async () => {
  if (loadingMore.value || !conversationId.value) return;
  
  try {
    loadingMore.value = true;
    await chatStore.loadMoreMessages({
      conversation_id: conversationId.value,
    });
  } catch (error) {
    console.error('Error al cargar más mensajes:', error);
    snackbar?.error('Error al cargar más mensajes');
  } finally {
    loadingMore.value = false;
  }
};

const handleReply = (message) => {
  // TODO: Implementar respuesta a mensaje
  console.log('Responder a:', message);
};

const handleReact = (message) => {
  // TODO: Implementar reacción a mensaje
  console.log('Reaccionar a:', message);
};

const handleDelete = (message) => {
  // TODO: Implementar eliminación de mensaje
  console.log('Eliminar:', message);
};

const handleMessageClick = (event) => {
  // TODO: Implementar acciones al hacer click
  console.log('Click en mensaje:', event);
};

const scrollToBottom = async () => {
  await nextTick();
  const container = messagesContainer.value;
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }
};

const sendMessage = async ({ content }) => {
  try {
    await chatStore.sendTextMessage(content);
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    snackbar?.error(error.message || 'No se pudo enviar el mensaje');
  }
};

const sendVoiceMessage = async (audio) => {
  try {
    await chatStore.sendAudioMessage(audio);
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar audio:', error);
    snackbar?.error(error.message || 'No se pudo enviar el audio');
  }
};

// ============================================
// SOCKET.IO EVENTOS
// ============================================

const setupSocketListeners = () => {
  if (!socketStore.socket) return;
  
  // Escuchar cuando alguien está escribiendo
  socketStore.socket.on('user-typing', (data) => {
    if (data.conversation_id === conversationId.value && data.user_id !== currentUserId.value) {
      isTyping.value = true;
      typingUser.value = getUserName(userStore.getUserById(data.user_id));
    }
  });
  
  // Escuchar cuando alguien deja de escribir
  socketStore.socket.on('user-stop-typing', (data) => {
    if (data.conversation_id === conversationId.value && data.user_id !== currentUserId.value) {
      isTyping.value = false;
      typingUser.value = '';
    }
  });
};

const getUserName = (user) => {
  if (!user) return 'Alguien';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Usuario';
};

// ============================================
// MONTAJE
// ============================================

onMounted(async () => {
  if (conversationId.value) {
    chatStore.currentConversationId = Number(conversationId.value);
    try {
      await socketStore.joinConversation(conversationId.value);
    } catch (error) {
      console.error('Error al conectar con el chat:', error);
      snackbar?.error('Sin conexión al chat. Puedes escribir y volver a intentar enviar.');
    }
    try {
      await chatStore.fetchMessages(conversationId.value);
      scrollToBottom();
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      snackbar?.error('No se pudieron cargar los mensajes');
    }
  }
  
  // Configurar listeners de Socket.io
  setupSocketListeners();
  
  // Marcar la conversación como leída
  if (conversationId.value) {
    conversationStore.markAsRead(conversationId.value);
  }
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  if (conversationId.value) {
    socketStore.leaveConversation(conversationId.value);
  }

  // Limpiar listeners de Socket.io
  if (socketStore.socket) {
    socketStore.socket.off('user-typing');
    socketStore.socket.off('user-stop-typing');
  }
});

// ============================================
// WATCHERS
// ============================================

import { watch } from 'vue';

// Escuchar nuevos mensajes
watch(() => messages.value, (newMessages) => {
  if (newMessages.length > 0) {
    scrollToBottom();
  }
}, { deep: true });

// Escuchar cambios en la conversación
watch(() => conversationId.value, async (newId) => {
  if (newId) {
    chatStore.currentConversationId = Number(newId);
    try {
      await socketStore.joinConversation(newId);
    } catch (error) {
      console.error('Error al conectar con el chat:', error);
      snackbar?.error('Sin conexión al chat. Puedes escribir y volver a intentar enviar.');
    }
    try {
      await chatStore.fetchMessages(newId);
      scrollToBottom();
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      snackbar?.error('No se pudieron cargar los mensajes');
    }
    setupSocketListeners();
  }
});
</script>

<style lang="scss" scoped>
.conversation-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;

  .conversation-header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);

    .conversation-heading {
      min-width: 0;

      h1 {
        overflow: hidden;
        font-size: 1rem;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      span {
        color: #757575;
        font-size: 0.8rem;
      }
    }
  }
  
  .messages-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .empty-messages {
      display: grid;
      flex: 1;
      place-content: center;
      justify-items: center;
      gap: 8px;
      color: #757575;
    }
    
    // Scrollbar custom
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4);
    }
    
    .message-group {
      display: flex;
      
      &.current-user {
        justify-content: flex-end;
      }
      
      &.other-user {
        justify-content: flex-start;
      }
      
      &.first-in-group {
        margin-top: 8px;
      }
    }
    
    .system-message-date {
      margin: 8px 0;
      
      .v-chip {
        font-size: 0.75rem;
      }
    }
    
    .typing-indicator {
      display: flex;
      
      &.other-user {
        justify-content: flex-start;
      }
    }
    
    .load-more-indicator {
      margin: 8px 0;
    }
  }

  .message-composer {
    flex: 0 0 auto;
    padding: 12px 16px;
    background: #fff;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }
}

// Animaciones
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-group {
  animation: slideIn 0.2s ease-out;
}
</style>
