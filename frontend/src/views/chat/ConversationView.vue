<!--
 * @file ConversationView.vue
 * @description Vista de una conversación individual
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="conversation-view">
    <!-- Esta vista se muestra dentro del AppLayout,
         que ya tiene el header con la información de la conversación
         y el MessageInput. Solo necesitamos mostrar los mensajes aquí. -->
    
    <!-- Área de mensajes -->
    <div class="messages-container">
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
            'current-user': message.sender_id === currentUserId,
            'other-user': message.sender_id !== currentUserId,
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
            @translation-required="handleTranslationRequired"
          />
        </div>
      </template>

      <!-- Mensajes en tiempo real (Socket.io) -->
      <div
        v-for="message in incomingMessages"
        :key="`incoming-${message.id || Date.now()}`"
        class="message-group"
        :class="{
          'current-user': message.sender_id === currentUserId,
          'other-user': message.sender_id !== currentUserId,
        }"
      >
        <MessageBubble
          :message="message"
          :compact="false"
          :show-timestamp="true"
          @reply="handleReply"
          @react="handleReact"
          @delete="handleDelete"
          @click="handleMessageClick"
          @translation-required="handleTranslationRequired"
        />
      </div>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useChatStore } from '@/stores/chatStore';
import { useSocketStore } from '@/stores/socketStore';
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

const conversationId = computed(() => {
  return route.params.conversationId;
});

const messages = computed(() => {
  return chatStore.messages.filter(m => m.conversation_id === conversationId.value);
});

const incomingMessages = computed(() => {
  return chatStore.incomingMessages.filter(m => m.conversation_id === conversationId.value);
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

const handleTranslationRequired = async (message) => {
  try {
    await chatStore.translateMessage(message);
    snackbar?.show({ text: 'Mensaje traducido', color: 'success' });
  } catch (error) {
    console.error('Error al traducir:', error);
    snackbar?.error('Error al traducir el mensaje');
  }
};

const scrollToBottom = async () => {
  await nextTick();
  const container = document.querySelector('.messages-container');
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
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
  // Cargar mensajes de la conversación
  if (conversationId.value) {
    await chatStore.fetchMessages({ conversation_id: conversationId.value });
    scrollToBottom();
  }
  
  // Configurar listeners de Socket.io
  setupSocketListeners();
  
  // Marcar la conversación como leída
  if (conversationId.value) {
    await chatStore.markAsRead(conversationId.value);
  }
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
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

// Escuchar mensajes entrantes en tiempo real
watch(() => incomingMessages.value, (newMessages) => {
  if (newMessages.length > 0) {
    scrollToBottom();
  }
});

// Escuchar cambios en la conversación
watch(() => conversationId.value, async (newId) => {
  if (newId) {
    await chatStore.fetchMessages({ conversation_id: newId });
    scrollToBottom();
    setupSocketListeners();
  }
});
</script>

<style lang="scss" scoped>
.conversation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    
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
