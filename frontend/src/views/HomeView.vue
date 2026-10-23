<!--
 * @file HomeView.vue
 * @description Vista principal de la aplicación
 * @author Arquitecto de Software Senior
 -->

<template>
  <v-container fluid class="home-view pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Lista de conversaciones (sidebar izquierdo) -->
      <v-col cols="12" md="4" lg="3" class="conversation-sidebar">
        <ConversationList />
      </v-col>

      <!-- Contenido principal del chat -->
      <v-col cols="12" md="8" lg="9" class="chat-main">
        <!-- Header del chat -->
        <v-app-bar
          v-if="currentConversation"
          density="comfortable"
          color="transparent"
          flat
          class="chat-header"
        >
          <v-btn
            v-if="isMobile"
            variant="text"
            icon
            @click="toggleSidebar"
          >
            <v-icon icon="mdi-menu" />
          </v-btn>

          <div class="conversation-info">
            <v-avatar
              v-if="currentConversation.user?.avatar_url"
              :image="currentConversation.user.avatar_url"
              size="40"
              class="mr-3"
            />
            <v-avatar
              v-else
              :color="avatarColor"
              size="40"
              class="mr-3"
            >
              <span class="text-white text-subtitle-1 font-weight-bold">
                {{ conversationInitials }}
              </span>
            </v-avatar>
            <div class="conversation-details">
              <h3 class="text-h6 font-weight-medium">
                {{ conversationTitle }}
              </h3>
              <p class="text-caption text-grey">
                <template v-if="isOnline">
                  <v-icon icon="mdi-circle" size="small" color="success" />
                  {{ $t('chat.online') }}
                </template>
                <template v-else>
                  <v-icon icon="mdi-circle" size="small" color="grey" />
                  {{ lastSeen }}
                </template>
              </p>
            </div>
          </div>

          <v-spacer />

          <div class="conversation-actions">
            <!-- Botón para buscar mensajes -->
            <v-btn
              variant="text"
              icon
              @click="openSearch"
            >
              <v-icon icon="mdi-magnify" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('common.search') }}
              </v-tooltip>
            </v-btn>

            <!-- Botón para video llamada (futuro) -->
            <v-btn
              variant="text"
              icon
              :disabled="true"
            >
              <v-icon icon="mdi-video" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('chat.videoCall') }}
              </v-tooltip>
            </v-btn>

            <!-- Botón para llamda de voz (futuro) -->
            <v-btn
              variant="text"
              icon
              :disabled="true"
            >
              <v-icon icon="mdi-phone" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('chat.voiceCall') }}
              </v-tooltip>
            </v-btn>

            <!-- Menú de opciones de conversación -->
            <v-menu
              :close-on-content-click="false"
              location="bottom end"
              transition="scale-transition"
            >
              <template v-slot:activator="{ props: menuProps }">
                <v-btn v-bind="menuProps" variant="text" icon>
                  <v-icon icon="mdi-dots-vertical" />
                  <v-tooltip activator="parent" location="bottom">
                    {{ $t('common.more') }}
                  </v-tooltip>
                </v-btn>
              </template>
              <v-list density="compact" nav>
                <v-list-item @click="muteConversation">
                  <template v-slot:prepend>
                    <v-icon :icon="isMuted ? 'mdi-bell-off' : 'mdi-bell'">
                    </v-icon>
                  </template>
                  <v-list-item-title>
                    {{ isMuted ? $t('chat.unmuteConversation') : $t('chat.muteConversation') }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item @click="archiveConversation">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-archive" />
                  </template>
                  <v-list-item-title>{{ $t('chat.archiveConversation') }}</v-list-item-title>
                </v-list-item>
                <v-list-item @click="deleteConversation" class="text-error">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-delete" />
                  </template>
                  <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </v-app-bar>

        <!-- Área de mensajes -->
        <v-main class="messages-area">
          <!-- Mensaje de bienvenida (si no hay conversación seleccionada) -->
          <div
            v-if="!currentConversation"
            class="welcome-message fill-height"
          >
            <v-container fluid class="fill-height d-flex flex-column align-center justify-center">
              <v-avatar
                color="primary"
                size="100"
                class="mb-6"
              >
                <v-icon icon="mdi-message-text" size="50" color="white" />
              </v-avatar>
              <h2 class="text-h4 font-weight-bold mb-2">
                {{ $t('app.name') }}
              </h2>
              <p class="text-subtitle-1 text-grey mb-6">
                {{ $t('app.description') }}
              </p>
              <v-btn
                color="primary"
                size="large"
                prepend-icon="mdi-message-plus"
                :to="{ name: 'new-conversation' }"
              >
                {{ $t('chat.newConversation') }}
              </v-btn>
            </v-container>
          </div>

          <!-- Mensajes (si hay conversación seleccionada) -->
          <template v-else>
            <div
              ref="messagesContainer"
              class="messages-container"
            >
              <!-- Lista de mensajes -->
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
            </div>

            <!-- Input de mensaje -->
            <div class="message-input-container pa-4">
              <MessageInput
                :placeholder="inputPlaceholder"
                :disabled="!currentConversation"
                :loading="isSending"
                @send="sendMessage"
                @send:voice="sendVoiceMessage"
                @send:file="sendFile"
                @record:start="handleRecordStart"
                @record:stop="handleRecordStop"
                @record:error="handleRecordError"
              />
            </div>
          </template>
        </v-main>
      </v-col>
    </v-row>

    <!-- Diálogo de búsqueda -->
    <v-dialog v-model="searchDialog" max-width="500">
      <v-card>
        <v-card-title>
          <v-text-field
            v-model="searchQuery"
            :placeholder="$t('chat.searchMessages')"
            density="comfortable"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-magnify"
            clearable
            @update:modelValue="searchMessages"
          />
        </v-card-title>
        <v-card-text class="pa-0">
          <v-list density="compact" nav>
            <v-list-item
              v-for="message in searchResults"
              :key="message.id"
              @click="scrollToMessage(message)"
            >
              <template v-slot:prepend>
                <v-icon icon="mdi-message-text" />
              </template>
              <v-list-item-title>
                {{ truncateMessage(message.content || message.transcription) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDate(message.created_at) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Diálogo de respuesta -->
    <v-dialog v-model="replyDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('common.replyToMessage') }}</v-card-title>
        <v-card-text>
          <MessageBubble
            :message="replyMessage"
            compact
          />
          <v-textarea
            v-model="replyText"
            :placeholder="$t('chat.typeMessage')"
            :rows="3"
            auto-grow
            density="comfortable"
            variant="outlined"
            class="mt-4"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelReply">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!replyText.trim()"
            @click="sendReply"
          >
            {{ $t('common.send') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar para notificaciones -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useChatStore } from '@/stores/chatStore';
import { useSocketStore } from '@/stores/socketStore';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import MessageInput from '@/components/chat/MessageInput.vue';

// ============================================
// INJECT
// ============================================

const device = inject('device');

// ============================================
// STORES
// ============================================

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const conversationStore = useConversationStore();
const chatStore = useChatStore();
const socketStore = useSocketStore();

// ============================================
// ESTADO LOCAL
// ============================================

const messagesContainer = ref(null);
const isMobile = computed(() => device?.isMobile?.value || false);
const showSidebar = ref(!isMobile.value);
const searchDialog = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const replyDialog = ref(false);
const replyMessage = ref(null);
const replyText = ref('');
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');

// ============================================
// COMPUTED
// ============================================

const currentUserId = computed(() => authStore.user?.id);

const currentConversation = computed(() => {
  return conversationStore.currentConversation;
});

const messages = computed(() => {
  return chatStore.messages.filter(m => m.conversation_id === currentConversation.value?.id);
});

const incomingMessages = computed(() => {
  return chatStore.incomingMessages.filter(m => m.conversation_id === currentConversation.value?.id);
});

const hasMoreMessages = computed(() => {
  return chatStore.hasMoreMessages && messages.value.length > 0;
});

const isSending = computed(() => {
  return chatStore.isSending;
});

const conversationTitle = computed(() => {
  if (!currentConversation.value) return '';
  if (currentConversation.value.type === 'group') {
    return currentConversation.value.name || 'Grupo';
  }
  const user = currentConversation.value.user;
  if (!user) return 'Chat';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Usuario';
});

const conversationInitials = computed(() => {
  if (!currentConversation.value) return 'C';
  if (currentConversation.value.type === 'group') {
    return (currentConversation.value.name || 'G').charAt(0).toUpperCase();
  }
  const user = currentConversation.value.user;
  if (!user) return 'U';
  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
});

const avatarColor = computed(() => {
  if (!currentConversation.value) return 'primary';
  if (currentConversation.value.type === 'group') return 'secondary';
  return 'primary';
});

const isOnline = computed(() => {
  if (!currentConversation.value) return false;
  if (currentConversation.value.type === 'group') return true;
  const user = currentConversation.value.user;
  return userStore.isUserOnline(user?.id);
});

const lastSeen = computed(() => {
  if (!currentConversation.value) return '';
  const user = currentConversation.value.user;
  if (!user?.last_seen_at) return '';
  return formatLastSeen(user.last_seen_at);
});

const inputPlaceholder = computed(() => {
  if (!currentConversation.value) return '';
  if (currentConversation.value.type === 'group') {
    return `Mensaje a ${currentConversation.value.name || 'el grupo'}`;
  }
  const user = currentConversation.value.user;
  return `Mensaje a ${user?.first_name || user?.username || 'el usuario'}`;
});

const isMuted = computed(() => {
  if (!currentConversation.value) return false;
  return conversationStore.isMuted(currentConversation.value.id);
});

// ============================================
// MÉTODOS
// ============================================

const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value;
};

const openSearch = () => {
  searchDialog.value = true;
  searchQuery.value = '';
};

const searchMessages = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  
  const query = searchQuery.value.toLowerCase();
  searchResults.value = messages.value.filter(message => {
    const text = (message.content || message.transcription || '').toLowerCase();
    return text.includes(query);
  });
};

const scrollToMessage = async (message) => {
  searchDialog.value = false;
  
  await nextTick();
  
  const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Resaltar el mensaje
    messageElement.classList.add('highlight');
    setTimeout(() => {
      messageElement.classList.remove('highlight');
    }, 2000);
  }
};

const handleReply = (message) => {
  replyMessage.value = message;
  replyText.value = '';
  replyDialog.value = true;
};

const sendReply = () => {
  if (!replyText.value.trim()) return;
  
  const text = replyText.value.trim();
  
  if (currentConversation.value) {
    chatStore.sendMessage({
      conversation_id: currentConversation.value.id,
      content: text,
      reply_to_id: replyMessage.value.id,
    });
  }
  
  cancelReply();
};

const cancelReply = () => {
  replyDialog.value = false;
  replyMessage.value = null;
  replyText.value = '';
};

const handleReact = (message) => {
  // TODO: Implementar reacciones
  console.log('Reaccionar a mensaje:', message);
};

const handleDelete = (message) => {
  // TODO: Implementar eliminación de mensajes
  console.log('Eliminar mensaje:', message);
};

const handleMessageClick = (event) => {
  // TODO: Implementar acciones al hacer click
  console.log('Click en mensaje:', event);
};

const handleTranslationRequired = async (message) => {
  try {
    await chatStore.translateMessage(message);
    showSnackbarMessage('Mensaje traducido', 'success');
  } catch (error) {
    console.error('Error al traducir:', error);
    showSnackbarMessage('Error al traducir el mensaje', 'error');
  }
};

const sendMessage = async (data) => {
  if (!currentConversation.value) {
    showSnackbarMessage('Seleccione una conversación primero', 'warning');
    return;
  }
  
  try {
    await chatStore.sendMessage({
      conversation_id: currentConversation.value.id,
      type: 'text',
      content: data.content,
      language: data.language || userStore.settings?.message_language || userStore.preferredLanguage,
    });
    
    // Scroll al final
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    showSnackbarMessage('Error al enviar mensaje', 'error');
  }
};

const sendVoiceMessage = async (audioFile) => {
  if (!currentConversation.value) {
    showSnackbarMessage('Seleccione una conversación primero', 'warning');
    return;
  }
  
  try {
    showSnackbarMessage('Procesando audio...', 'info');
    
    await chatStore.sendVoiceMessage({
      conversation_id: currentConversation.value.id,
      audio: audioFile,
    });
    
    showSnackbarMessage('Audio enviado', 'success');
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar audio:', error);
    showSnackbarMessage('Error al enviar audio', 'error');
  }
};

const sendFile = async (files) => {
  if (!currentConversation.value) {
    showSnackbarMessage('Seleccione una conversación primero', 'warning');
    return;
  }
  
  try {
    showSnackbarMessage('Subiendo archivo...', 'info');
    
    await chatStore.sendFiles({
      conversation_id: currentConversation.value.id,
      files,
    });
    
    showSnackbarMessage('Archivo enviado', 'success');
    scrollToBottom();
  } catch (error) {
    console.error('Error al enviar archivo:', error);
    showSnackbarMessage('Error al enviar archivo', 'error');
  }
};

const handleRecordStart = () => {
  // Opcional: mostrar indicador de grabación
};

const handleRecordStop = () => {
  // Opcional: ocultar indicador
};

const handleRecordError = (error) => {
  console.error('Error en grabación:', error);
  showSnackbarMessage('Error en la grabación', 'error');
};

const loadMoreMessages = async () => {
  if (!currentConversation.value) return;
  
  try {
    await chatStore.loadMoreMessages({
      conversation_id: currentConversation.value.id,
    });
  } catch (error) {
    console.error('Error al cargar más mensajes:', error);
  }
};

const muteConversation = () => {
  if (!currentConversation.value) return;
  
  conversationStore.toggleMute(currentConversation.value.id);
  showSnackbarMessage(
    isMuted.value ? 'Conversación silenciada' : 'Conversación activada',
    isMuted.value ? 'warning' : 'success'
  );
};

const archiveConversation = () => {
  if (!currentConversation.value) return;
  
  conversationStore.archiveConversation(currentConversation.value.id);
  showSnackbarMessage('Conversación archivada', 'success');
};

const deleteConversation = () => {
  if (!currentConversation.value) return;
  
  conversationStore.deleteConversation(currentConversation.value.id);
  router.push({ name: 'home' });
  showSnackbarMessage('Conversación eliminada', 'success');
};

const isSameSender = (currentMessage, previousMessage) => {
  if (!previousMessage || previousMessage.type === 'system') return false;
  return currentMessage.sender_id === previousMessage.sender_id;
};

const isFirstInGroup = (currentMessage, index) => {
  if (index === 0) return true;
  return !isSameSender(currentMessage, messages.value[index - 1]);
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth',
    });
  }
};

const showSnackbarMessage = (text, color = 'info') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

// ============================================
// FORMATO DE FECHAS
// ============================================

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

const formatLastSeen = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = (now - date) / (1000 * 60);
  const diffInHours = (now - date) / (1000 * 60 * 60);
  const diffInDays = (now - date) / (1000 * 60 * 60 * 24);
  
  if (diffInMinutes < 1) {
    return 'Justo ahora';
  } else if (diffInMinutes < 60) {
    return `Hace ${Math.floor(diffInMinutes)} min`;
  } else if (diffInHours < 24) {
    return `Hace ${Math.floor(diffInHours)} h`;
  } else if (diffInDays < 7) {
    return `Hace ${Math.floor(diffInDays)} días`;
  } else {
    return date.toLocaleDateString([], { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    });
  }
};

const truncateMessage = (text) => {
  if (!text) return '';
  if (text.length > 50) {
    return text.substring(0, 50) + '...';
  }
  return text;
};

// ============================================
// MONTAJE
// ============================================

onMounted(async () => {
  // Cargar conversaciones si no hay ninguna seleccionada
  if (!currentConversation.value && conversationStore.conversations.length === 0) {
    await conversationStore.fetchConversations();
  }
  
  // Conectar Socket.io
  if (!socketStore.isConnected) {
    socketStore.connect();
  }
  
  // Scroll al final si hay mensajes
  await nextTick();
  scrollToBottom();
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  // Limpiar recursos
});

// ============================================
// SOCKET.IO EVENTOS
// ============================================

import { watch } from 'vue';

// Escuchar nuevos mensajes
watch(() => chatStore.messages, (newMessages) => {
  if (newMessages.length > messages.value.length) {
    scrollToBottom();
  }
}, { deep: true });

// Escuchar mensajes entrantes en tiempo real
watch(() => incomingMessages.value, (newMessages) => {
  if (newMessages.length > 0) {
    scrollToBottom();
  }
});
</script>

<style lang="scss" scoped>
.home-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  
  .conversation-sidebar {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    background-color: #FFFFFF;
    
    @media (max-width: 768px) {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 100;
      width: 80%;
      transform: translateX(v-bind(showSidebar ? '0' : '-100%'));
      transition: transform 0.3s ease;
    }
  }
  
  .chat-main {
    display: flex;
    flex-direction: column;
    background-color: #F5F5F5;
    
    .chat-header {
      background-color: #FFFFFF;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      
      .conversation-info {
        display: flex;
        align-items: center;
        min-width: 0;
        
        .conversation-details {
          min-width: 0;
          
          h3 {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          p {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
      
      .conversation-actions {
        display: flex;
        gap: 4px;
        
        .v-btn {
          min-width: 36px;
          width: 36px;
          height: 36px;
          padding: 0;
        }
      }
    }
    
    .messages-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      
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
      }
      
      .message-input-container {
        background-color: #FFFFFF;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
      }
    }
  }
  
  .welcome-message {
    background-color: #F5F5F5;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// Animaciones
@keyframes highlight {
  0% {
    background-color: rgba(24, 103, 192, 0.1);
  }
  100% {
    background-color: transparent;
  }
}

.highlight {
  animation: highlight 2s ease;
}

// Responsive
@media (max-width: 768px) {
  .home-view {
    .chat-header {
      .conversation-info {
        .v-avatar {
          display: none;
        }
      }
      
      .conversation-actions {
        .v-btn {
          min-width: 40px;
          width: 40px;
          height: 40px;
        }
      }
    }
  }
}
</style>
