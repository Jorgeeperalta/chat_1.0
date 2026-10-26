<!--
 * @file ConversationList.vue
 * @description Lista de conversaciones del usuario
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="conversation-list">
    <!-- Barra de búsqueda -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('chat.search')"
      density="comfortable"
      variant="outlined"
      hide-details
      prepend-inner-icon="mdi-magnify"
      clearable
      class="pa-4 pb-0"
      @update:modelValue="searchConversations"
    />

    <!-- Opciones rápidas -->
    <div class="quick-actions px-4 py-2">
      <v-btn
        color="primary"
        variant="text"
        size="small"
        block
        prepend-icon="mdi-account-plus"
        :to="{ name: 'new-conversation' }"
      >
        {{ $t('chat.newConversation') }}
      </v-btn>
    </div>

    <!-- Lista de conversaciones -->
    <v-list density="compact" nav class="conversation-list-items">
      <!-- grupo de conversaciones activas -->
      <v-list-subheader v-if="filteredConversations.length > 0 && hasRecentConversations">
        {{ $t('common.recent') }}
      </v-list-subheader>
      
      <template v-for="conversation in filteredConversations" :key="conversation.id">
        <v-list-item
          :to="{ name: 'conversation', params: { conversationId: conversation.id } }"
          :active="isActive(conversation)"
          lines="two"
          :prepend-avatar="getAvatar(conversation)"
          class="conversation-item"
          @contextmenu="showContextMenu($event, conversation)"
        >
          <template v-slot:title>
            <div class="conversation-title">
              <span>{{ getTitle(conversation) }}</span>
              <v-chip
                v-if="conversation.unread_count > 0"
                :color="getUnreadColor(conversation)"
                size="x-small"
                class="ml-2"
              >
                {{ conversation.unread_count > 99 ? '99+' : conversation.unread_count }}
              </v-chip>
            </div>
          </template>
          
          <template v-slot:subtitle>
            <div class="conversation-subtitle">
              <span v-if="getLastMessage(conversation)" class="message-preview">
                <template v-if="getLastMessage(conversation).sender_id === currentUserId">
                  <v-icon icon="mdi-check" size="small" class="mr-1" />
                </template>
                {{ truncateMessage(getLastMessage(conversation)) }}
              </span>
              <span v-else class="no-messages text-grey">
                {{ $t('chat.noMessages') }}
              </span>
              <span class="message-time">
                {{ formatTime(conversation.last_message_at || conversation.updated_at || conversation.created_at) }}
              </span>
            </div>
          </template>

          <template v-slot:append>
            <v-btn
              v-if="conversationStore.isPinned(conversation.id)"
              variant="text"
              icon
              size="x-small"
              @click.prevent.stop="togglePin(conversation)"
            >
              <v-icon icon="mdi-pin" />
            </v-btn>
          </template>
        </v-list-item>
      </template>

      <!-- Indicador de carga -->
      <div
        v-if="loading"
        class="text-center py-4"
      >
        <v-progress-circular
          color="primary"
          indeterminate
          size="24"
        />
      </div>

      <!-- Mensaje de no hay conversaciones -->
      <div
        v-if="!loading && filteredConversations.length === 0"
        class="no-conversations text-center py-8"
      >
        <v-icon icon="mdi-message-text-outline" size="40" color="grey" />
        <p class="text-subtitle-1 text-grey mt-2">
          {{ $t('chat.noConversations') }}
        </p>
        <v-btn
          color="primary"
          variant="elevated"
          size="small"
          :to="{ name: 'new-conversation' }"
          class="mt-4"
        >
          {{ $t('chat.startNewConversation') }}
        </v-btn>
      </div>
    </v-list>

    <!-- Menú contextual -->
    <v-menu
      v-model="contextMenu.show"
      :target="[contextMenu.x, contextMenu.y]"
    >
      <v-list density="compact" nav>
        <v-list-item @click="archiveSelected">
          <template v-slot:prepend>
            <v-icon icon="mdi-archive" />
          </template>
          <v-list-item-title>{{ $t('chat.archiveConversation') }}</v-list-item-title>
        </v-list-item>
        <v-list-item @click="muteSelected">
          <template v-slot:prepend>
            <v-icon :icon="selectedIsMuted ? 'mdi-bell-off' : 'mdi-bell'">
            </v-icon>
          </template>
          <v-list-item-title>
            {{ selectedIsMuted ? $t('chat.unmuteConversation') : $t('chat.muteConversation') }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="pinSelected" v-if="selectedConversation">
          <template v-slot:prepend>
            <v-icon :icon="selectedIsPinned ? 'mdi-pin' : 'mdi-pin-outline'" />
          </template>
          <v-list-item-title>
            {{ selectedIsPinned ? $t('chat.unpinConversation') : $t('chat.pinConversation') }}
          </v-list-item-title>
        </v-list-item>
        <v-divider class="my-2" />
        <v-list-item @click="deleteSelected" class="text-error">
          <template v-slot:prepend>
            <v-icon icon="mdi-delete" />
          </template>
          <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useUserStore } from '@/stores/userStore';

// ============================================
// PROPS
// ============================================

const props = defineProps({
  showPinned: {
    type: Boolean,
    default: true,
  },
  showArchived: {
    type: Boolean,
    default: false,
  },
});

// ============================================
// STORES
// ============================================

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const conversationStore = useConversationStore();
const userStore = useUserStore();

// ============================================
// ESTADO LOCAL
// ============================================

const searchQuery = ref('');
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
});
const selectedConversation = ref(null);

// ============================================
// COMPUTED
// ============================================

const currentUserId = computed(() => authStore.user?.id);

const conversations = computed(() => {
  return conversationStore.conversations;
});

const loading = computed(() => {
  return conversationStore.isLoading;
});

const filteredConversations = computed(() => {
  // sortedConversations ya ordena (fijadas primero, luego por último mensaje)
  let filtered = conversationStore.sortedConversations.filter(c => !c.is_archived);

  // Filtrar por búsqueda
  if (searchQuery.value?.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(conversation => {
      const title = getTitle(conversation).toLowerCase();
      const lastMessage = getLastMessage(conversation)?.content || '';
      return title.includes(query) || lastMessage.toLowerCase().includes(query);
    });
  }

  return filtered;
});

const hasRecentConversations = computed(() => {
  return filteredConversations.value.length > 0;
});

const selectedIsMuted = computed(() => {
  return selectedConversation.value ? conversationStore.isMuted(selectedConversation.value.id) : false;
});

const selectedIsPinned = computed(() => {
  return selectedConversation.value ? conversationStore.isPinned(selectedConversation.value.id) : false;
});

// ============================================
// MÉTODOS
// ============================================

const searchConversations = () => {
  // La filtración se hace automáticamente en la propiedad computada
};

const isActive = (conversation) => {
  return route.name === 'conversation' &&
    route.params.conversationId === conversation.id.toString();
};

const getOtherUser = (conversation) => {
  return conversation.user || conversationStore.getOtherUser(conversation);
};

const getLastMessage = (conversation) => {
  return conversation.lastMessage || conversation.last_message || null;
};

const getTitle = (conversation) => {
  if (conversation.type === 'group') {
    return conversation.name || 'Grupo';
  }

  const user = getOtherUser(conversation);
  if (!user) return conversation.name || 'Chat';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Usuario';
};

const getAvatar = (conversation) => {
  if (conversation.type === 'group') {
    return conversation.avatar_url || '';
  }

  const user = getOtherUser(conversation);
  if (!user) return '';
  return user.avatar_url || '';
};

const getUnreadColor = (conversation) => {
  if (!conversation.unread_count) return 'grey';
  return conversationStore.isMuted(conversation.id) ? 'grey' : 'primary';
};

const truncateMessage = (message) => {
  if (!message) return '';

  // Si el mensaje es de voz
  if (message.type === 'voice' || message.message_type === 'audio') {
    return '🎤 Mensaje de voz';
  }
  
  // Si el mensaje es una transcripción
  if (message.transcription) {
    return truncateText(message.transcription);
  }
  
  // Mensaje de texto
  return truncateText(message.content);
};

const truncateText = (text) => {
  if (!text) return '';
  if (text.length > 40) {
    return text.substring(0, 40) + '...';
  }
  return text;
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    return 'Ayer';
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { 
      day: 'numeric', 
      month: 'short' 
    });
  }
};

const togglePin = (conversation) => {
  conversationStore.togglePin(conversation.id);
};

const archiveSelected = () => {
  if (selectedConversation.value) {
    conversationStore.archiveConversation(selectedConversation.value.id);
    selectedConversation.value = null;
    contextMenu.value.show = false;
  }
};

const muteSelected = () => {
  if (selectedConversation.value) {
    conversationStore.toggleMute(selectedConversation.value.id);
    selectedConversation.value = null;
    contextMenu.value.show = false;
  }
};

const pinSelected = () => {
  if (selectedConversation.value) {
    conversationStore.togglePin(selectedConversation.value.id);
    selectedConversation.value = null;
    contextMenu.value.show = false;
  }
};

const deleteSelected = () => {
  if (selectedConversation.value) {
    conversationStore.deleteConversation(selectedConversation.value.id);
    selectedConversation.value = null;
    contextMenu.value.show = false;
  }
};

const showContextMenu = (event, conversation) => {
  event.preventDefault();
  selectedConversation.value = conversation;
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
  };
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  // Cargar conversaciones si no están cargadas
  if (conversations.value.length === 0) {
    conversationStore.fetchConversations();
  }
});
</script>

<style lang="scss" scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--app-surface);
  
  .quick-actions {
    border-bottom: 1px solid var(--app-border);
  }
  
  .conversation-list-items {
    flex: 1;
    overflow-y: auto;
    
    // Scrollbar custom
    &::-webkit-scrollbar {
      width: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--app-scrollbar);
      border-radius: 2px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: var(--app-scrollbar);
    }
    
    .conversation-item {
      padding: 8px 12px;
      border-radius: 8px;
      margin: 4px 8px;
      transition: all 0.2s ease;
      
      &:hover {
        background-color: rgba(var(--v-theme-on-surface), 0.04);
      }
      
      :deep(.v-list-item__prepend) {
        margin-right: 12px;
        
        .v-avatar {
          border-radius: 8px;
        }
      }
      
      :deep(.v-list-item__content) {
        .conversation-title {
          display: flex;
          align-items: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          
          .v-chip {
            flex-shrink: 0;
            margin-left: 4px;
          }
        }
        
        .conversation-subtitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          white-space: nowrap;
          overflow: hidden;
          
          .message-preview {
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
          }
          
          .message-time {
            flex-shrink: 0;
            font-size: 0.75rem;
            color: var(--app-text-muted);
            margin-left: 8px;
          }
        }
      }
      
      :deep(.v-list-item__append) {
        margin-left: 8px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      &:hover :deep(.v-list-item__append) {
        opacity: 1;
      }
      
      // Estado activo
      &.v-list-item--active {
        background-color: rgba(24, 103, 192, 0.1);
        
        :deep(.v-list-item-title) {
          color: rgb(var(--v-theme-primary));
        }
      }
    }
    
    .no-conversations {
      color: var(--app-text-muted);
      
      .v-icon {
        opacity: 0.6;
      }
    }
  }
  
  // V-list-subheader custom
  :deep(.v-list-subheader) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03125em;
    color: var(--app-text-muted);
    padding: 8px 16px;
    margin: 0;
    border-bottom: 1px solid var(--app-border);
  }
}

// Responsive
@media (max-width: 768px) {
  .conversation-list {
    width: 100%;
    
    :deep(.v-text-field) {
      padding: 12px 16px;
    }
    
    .quick-actions {
      padding: 8px 16px;
    }
    
    .conversation-list-items {
      .conversation-item {
        padding: 8px;
        margin: 2px 4px;
      }
    }
  }
}
</style>
