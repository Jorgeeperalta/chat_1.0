<!--
 * @file ConversationView.vue
 * @description Vista de una conversación individual
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="conversation-view">
    <header class="conversation-header">
      <!-- Vuelve a la lista de chats (la ruta 'chat' es solo un contenedor vacío) -->
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        density="comfortable"
        :to="{ name: 'home' }"
        :aria-label="$t('chat.backToChats')"
      />
      <v-badge
        :model-value="!isGroup"
        dot
        bordered
        location="bottom end"
        offset-x="3"
        offset-y="3"
        :color="isOtherOnline ? 'success' : 'grey-lighten-1'"
      >
        <v-avatar :color="conversationAvatar ? undefined : 'primary'" size="40">
          <v-img v-if="conversationAvatar" :src="conversationAvatar" cover />
          <v-icon v-else-if="isGroup" icon="mdi-account-group" color="white" />
          <span v-else class="text-white font-weight-bold">{{ conversationInitials }}</span>
        </v-avatar>
      </v-badge>
      <div class="conversation-heading">
        <h1>{{ conversationTitle }}</h1>
        <span :class="{ 'is-online': isOtherOnline || isTyping }">{{ conversationSubtitle }}</span>
      </div>
    </header>

    <!-- Área de mensajes -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="!messages.length && !chatStore.isLoading" class="empty-messages">
        <v-icon icon="mdi-message-text-outline" size="40" />
        <p>{{ $t('chat.noMessages') }}</p>
      </div>

      <!-- Indicador de que hay más mensajes (antiguos) -->
      <div
        v-if="hasMoreMessages && !loadingMore"
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

      <!-- Mensajes -->
      <template v-for="(message, index) in messages" :key="message.id ?? message.tempId">
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
        @send="sendMessage"
        @send:voice="sendVoiceMessage"
        @change="handleTyping"
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
import { useI18n } from 'vue-i18n';
import MessageInput from '@/components/chat/MessageInput.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import {
  getOtherUser,
  getConversationTitle,
  getInitials,
  formatRelativeTime,
} from '@/utils/conversationDisplay';

// ============================================
// INJECT
// ============================================

const device = inject('device');
const snackbar = inject('snackbar');

// ============================================
// STORES
// ============================================

const route = useRoute();
const { t, locale } = useI18n();
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
let typingTimeout = null;
let isLocalUserTyping = false;

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

const isGroup = computed(() => currentConversation.value?.type === 'group');

const otherUser = computed(() => getOtherUser(currentConversation.value, currentUserId.value));

const conversationTitle = computed(() =>
  currentConversation.value ? getConversationTitle(currentConversation.value, currentUserId.value) : t('chat.chat')
);

const conversationInitials = computed(() => getInitials(conversationTitle.value));

const conversationAvatar = computed(() =>
  isGroup.value ? currentConversation.value?.avatar_url : otherUser.value?.avatar_url
);

const isOtherOnline = computed(() => !isGroup.value && otherUser.value?.status === 'online');

// "Últ. vez hace X" debe avanzar aunque no lleguen eventos
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 60 * 1000);

const conversationSubtitle = computed(() => {
  if (isTyping.value) return t('chat.typing');
  if (isGroup.value) {
    const members = currentConversation.value?.users || [];
    const online = members.filter(u => Number(u.id) !== Number(currentUserId.value) && u.status === 'online').length;
    return online > 0
      ? `${t('chat.participants', { n: members.length })} · ${t('chat.onlineCount', { n: online })}`
      : t('chat.participants', { n: members.length });
  }
  const user = otherUser.value;
  if (!user) return '';
  if (user.status === 'online') return t('chat.online');
  if (!user.last_seen_at) return t('chat.offline');
  return t('chat.lastSeen', { time: formatRelativeTime(user.last_seen_at, locale.value, now.value) });
});

const hasMoreMessages = computed(() => {
  return chatStore.hasMoreMessages && messages.value.length > 0;
});

// Otros usuarios escribiendo en esta conversación (eventos 'user_typing' del socket)
const typingUserIds = computed(() => {
  return chatStore.currentTypingUsers.filter(id => id !== Number(currentUserId.value));
});

const isTyping = computed(() => typingUserIds.value.length > 0);

const typingUser = computed(() => {
  return typingUserIds.value
    .map(id => getUserName(userStore.getUserById(id) || currentConversation.value?.users?.find(u => Number(u.id) === id)))
    .join(', ');
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
  
  const container = messagesContainer.value;
  const previousScrollHeight = container?.scrollHeight || 0;

  try {
    loadingMore.value = true;
    await chatStore.loadMoreMessages(conversationId.value);

    // Mantener la posición visual al agregar mensajes arriba
    await nextTick();
    if (container) {
      container.scrollTop += container.scrollHeight - previousScrollHeight;
    }
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

const stopTyping = () => {
  clearTimeout(typingTimeout);
  typingTimeout = null;
  if (isLocalUserTyping) {
    isLocalUserTyping = false;
    chatStore.sendTyping(false);
  }
};

const handleTyping = (text) => {
  if (!text) {
    stopTyping();
    return;
  }
  if (!isLocalUserTyping) {
    isLocalUserTyping = true;
    chatStore.sendTyping(true);
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 3000);
};

const sendMessage = async ({ content }) => {
  stopTyping();
  try {
    await chatStore.sendTextMessage(content);
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    snackbar?.error(error.message || 'No se pudo enviar el mensaje');
  }
};

const sendVoiceMessage = async (audio, duration) => {
  try {
    await chatStore.sendAudioMessage(audio, duration);
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar audio:', error);
    snackbar?.error(error.message || 'No se pudo enviar el audio');
  }
};

const getUserName = (user) => {
  if (!user) return 'Alguien';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Usuario';
};

/**
 * Abre una conversación: la marca como actual, se une a la sala y carga mensajes
 * @param {string|number} id - ID de la conversación
 */
const openConversation = async (id) => {
  chatStore.currentConversationId = Number(id);

  // Marcarla como actual para que los mensajes entrantes no sumen "no leídos"
  const conversation = conversationStore.conversationsById[id];
  if (conversation) {
    conversationStore.setCurrentConversation(conversation);
  }

  try {
    await socketStore.joinConversation(id);
  } catch (error) {
    console.error('Error al conectar con el chat:', error);
    snackbar?.error('Sin conexión al chat. Puedes escribir y volver a intentar enviar.');
  }
  try {
    await chatStore.fetchMessages(id);
    scrollToBottom();
  } catch (error) {
    console.error('Error al cargar mensajes:', error);
    snackbar?.error('No se pudieron cargar los mensajes');
  }

  // Marcar la conversación como leída
  conversationStore.markAsRead(id);
};

// ============================================
// MONTAJE
// ============================================

onMounted(async () => {
  if (conversationId.value) {
    await openConversation(conversationId.value);
  }
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  clearInterval(clock);
  stopTyping();
  if (conversationId.value) {
    socketStore.leaveConversation(conversationId.value);
  }
  conversationStore.clearCurrentConversation();
});

// ============================================
// WATCHERS
// ============================================

import { watch } from 'vue';

// Hacer scroll al final solo cuando llega un mensaje nuevo al final
// (no al cargar mensajes antiguos arriba)
watch(() => {
  const last = messages.value[messages.value.length - 1];
  return last ? (last.id ?? last.tempId) : null;
}, (lastKey) => {
  if (lastKey != null) {
    scrollToBottom();
  }
});

// Si las conversaciones se cargan después de abrir la vista, marcar la actual
watch(currentConversation, (conversation) => {
  if (conversation && Number(conversationStore.currentConversation?.id) !== Number(conversation.id)) {
    conversationStore.setCurrentConversation(conversation);
  }
});

// Escuchar cambios en la conversación
watch(() => conversationId.value, async (newId, oldId) => {
  stopTyping();
  if (oldId) {
    socketStore.leaveConversation(oldId);
  }
  if (newId) {
    await openConversation(newId);
  }
});
</script>

<style lang="scss" scoped>
// La vista ocupa todo el alto disponible:
//   header (fijo) / mensajes (único elemento con scroll) / input (fijo abajo)
.conversation-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background-color: var(--app-bg);

  .conversation-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 16px;
    // En el celular la barra de la app se oculta en el chat: respetar el notch / barra de estado
    padding-top: max(8px, env(safe-area-inset-top));
    background-color: var(--app-surface);
    border-bottom: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-sm);
    z-index: 2;

    .conversation-heading {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;

      h1 {
        margin: 0;
        overflow: hidden;
        color: var(--app-text);
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.3;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      span {
        overflow: hidden;
        color: var(--app-text-muted);
        font-size: 0.8rem;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.is-online {
          color: rgb(var(--v-theme-success));
          font-weight: 500;
        }
      }
    }
  }

  // Celular: menos relleno para que entre el nombre
  @media (max-width: 599px) {
    .conversation-header {
      gap: 8px;
      min-height: 56px;
      padding-left: 4px;
      padding-right: 12px;
    }
  }

  // Único contenedor con scroll
  .messages-container {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px clamp(12px, 4vw, 48px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    background-color: var(--app-bg);
    background-image: radial-gradient(rgba(var(--v-theme-primary), 0.06) 1px, transparent 1px);
    background-size: 22px 22px;

    .empty-messages {
      display: grid;
      flex: 1;
      place-content: center;
      justify-items: center;
      gap: 8px;
      color: var(--app-text-muted);
      text-align: center;
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
        margin-top: 10px;
      }
    }

    .system-message-date {
      margin: 8px 0;

      .v-chip {
        font-size: 0.75rem;
        background-color: var(--app-surface);
      }
    }

    .typing-indicator {
      display: flex;
      margin-top: 6px;

      &.other-user {
        justify-content: flex-start;
      }
    }

    .load-more-indicator {
      margin: 4px 0 12px;
    }
  }

  // Input fijo abajo: no se mueve aunque se deslicen los mensajes
  .message-composer {
    flex: 0 0 auto;
    position: sticky;
    bottom: 0;
    z-index: 2;
    padding: 10px clamp(12px, 4vw, 48px);
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    background-color: var(--app-surface);
    border-top: 1px solid var(--app-border);
    box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.05);
  }
}

// Animaciones
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-group {
  animation: slideIn 0.18s ease-out;
}

@media (max-width: 600px) {
  .conversation-view .conversation-header {
    min-height: 56px;
    padding: 6px 8px;
  }
}
</style>
