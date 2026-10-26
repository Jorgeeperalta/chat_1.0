<!--
 * @file MessageBubble.vue
 * @description Burbuja de mensaje del chat
 * @author Arquitecto de Software Senior
 -->

<template>
  <div
    class="message-bubble"
    :class="[
      'mb-1',
      { 'message-sent': isCurrentUser && !isSystemMessage },
      { 'message-received': !isCurrentUser && !isSystemMessage },
      { 'message-pending': message.status === 'sending' },
      { 'message-voice': message.type === 'voice' },
      { 'message-system': message.type === 'system' },
      { 'message-translated': showTranslation && translatedText },
      { 'message-compact': compact }
    ]"
    :style="bubbleStyle"
    @click="handleMessageClick"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <!-- Avatar del remitente (solo para mensajes recibidos) -->
    <div
      v-if="!isCurrentUser && !compact"
      class="message-avatar"
    >
      <v-avatar
        :image="senderAvatar"
        :size="avatarSize"
        :color="avatarColor"
      >
        <span v-if="!senderAvatar" class="text-white text-subtitle-2 font-weight-bold">
          {{ senderInitials }}
        </span>
      </v-avatar>
    </div>

    <!-- Contenido del mensaje -->
    <div class="message-content">
      <!-- Header del mensaje -->
      <div
        v-if="!compact"
        class="message-header"
      >
        <span
          v-if="!isCurrentUser"
          class="message-sender text-caption font-weight-medium"
        >
          {{ senderName }}
        </span>
        <span
          v-if="showTimestamp"
          class="message-time text-caption text-grey"
        >
          {{ formattedTime }}
        </span>
      </div>

      <!-- Contenido principal -->
      <div class="message-body">
        <!-- Mensaje de texto -->
        <template v-if="message.type === 'text' || message.type === 'transcription'">
          <div
            class="message-text"
              :class="{ 'message-text-original': showOriginal && availableTranslation }"
            v-html="formattedText"
          />
          
          <!-- Traducción -->
          <div
            v-if="showTranslationComputed && availableTranslation && (isCurrentUser || props.showOriginal)"
            class="message-translation"
          >
            <v-chip
              color="primary"
              variant="text"
              size="x-small"
              class="mb-1"
            >
              {{ $t('chat.translated') }}
            </v-chip>
            <p class="text-body-2">{{ availableTranslation }}</p>
          </div>
          
          <!-- Botón para mostrar/ocultar traducción -->
          <v-btn
            v-if="!showTranslation && canTranslate"
            variant="text"
            size="x-small"
            color="primary"
            class="mt-1"
            @click.stop="toggleTranslation"
          >
            <v-icon size="small" start icon="mdi-translate" />
            {{ $t('chat.showTranslation') }}
          </v-btn>
        </template>

        <!-- Mensaje de voz -->
        <template v-if="message.type === 'voice'">
          <div class="voice-message">
            <VoiceMessagePlayer
              v-if="message.audio_url"
              :audio-url="message.audio_url"
              :duration="Number(message.duration) || 0"
              :is-current-user="isCurrentUser"
              @play="handlePlay"
              @pause="handlePause"
              @seek="handleSeek"
            />
            <div v-else class="voice-unavailable text-caption">
              <v-icon icon="mdi-microphone-off" size="small" start />
              Audio no disponible
            </div>
            
            <!-- Transcripción (si existe) -->
            <div
              v-if="message.transcription"
              class="voice-transcription mt-2"
            >
              <p class="text-body-2">
                <strong>{{ $t('chat.transcription') }}:</strong> {{ message.transcription }}
              </p>
              
              <!-- Traducción de la transcripción -->
              <div
                v-if="showTranslationComputed && availableTranslation && (isCurrentUser || props.showOriginal)"
                class="message-translation mt-1"
              >
                <p class="text-body-2">{{ availableTranslation }}</p>
              </div>
              
              <v-btn
                v-if="!showTranslation && canTranslate"
                variant="text"
                size="x-small"
                color="primary"
                class="mt-1"
                @click.stop="toggleTranslation"
              >
                <v-icon size="small" start icon="mdi-translate" />
                {{ $t('chat.showTranslation') }}
              </v-btn>
            </div>
          </div>
        </template>

        <!-- Mensaje del sistema -->
        <template v-if="message.type === 'system'">
          <div class="system-message">
            <v-icon icon="mdi-information-outline" size="small" />
            <span class="text-body-2">{{ message.content }}</span>
          </div>
        </template>

        <!-- Contenido multimedia -->
        <template v-if="message.attachments && message.attachments.length > 0">
          <div class="message-attachments mt-2">
            <v-chip
              v-for="(attachment, index) in message.attachments"
              :key="index"
              color="primary"
              variant="outlined"
              size="small"
              class="mr-2 mb-2"
            >
              <v-icon start icon="mdi-file" />
              {{ attachment.name || `Archivo ${index + 1}` }}
            </v-chip>
          </div>
        </template>
      </div>

      <!-- Footer del mensaje -->
      <div
        v-if="!compact"
        class="message-footer"
      >
        <!-- Estado del mensaje (solo para mensajes enviados) -->
        <div v-if="isCurrentUser" class="message-status">
          <v-icon
            v-if="message.status === 'sent'"
            icon="mdi-check"
            size="small"
            color="grey"
          />
          <v-icon
            v-else-if="message.status === 'delivered'"
            icon="mdi-check-all"
            size="small"
            color="grey"
          />
          <v-icon
            v-else-if="message.status === 'read'"
            icon="mdi-check-all"
            size="small"
            color="primary"
          />
          <v-icon
            v-else-if="message.status === 'failed'"
            icon="mdi-alert-circle"
            size="small"
            color="error"
            @click="retrySend"
          />
        </div>

        <!-- Botones de acción (hover) -->
        <div
          v-if="hover && !compact"
          class="message-actions"
        >
          <v-btn
            variant="text"
            icon
            size="x-small"
            color="grey"
            @click.stop="copyMessage"
          >
            <v-icon icon="mdi-content-copy" size="small" />
            <v-tooltip activator="parent" location="top">
              {{ $t('common.copy') }}
            </v-tooltip>
          </v-btn>
          
          <v-btn
            variant="text"
            icon
            size="x-small"
            color="grey"
            @click.stop="reactToMessage"
          >
            <v-icon icon="mdi-emoticon-happy-outline" size="small" />
            <v-tooltip activator="parent" location="top">
              {{ $t('common.react') }}
            </v-tooltip>
          </v-btn>
          
          <v-btn
            variant="text"
            icon
            size="x-small"
            color="grey"
            @click.stop="replyToMessage"
          >
            <v-icon icon="mdi-reply" size="small" />
            <v-tooltip activator="parent" location="top">
              {{ $t('common.reply') }}
            </v-tooltip>
          </v-btn>
          
          <v-btn
            v-if="isCurrentUser && !isSystemMessage"
            variant="text"
            icon
            size="x-small"
            color="grey"
            @click.stop="deleteMessage"
          >
            <v-icon icon="mdi-delete" size="small" />
            <v-tooltip activator="parent" location="top">
              {{ $t('common.delete') }}
            </v-tooltip>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useTranslationStore } from '@/stores/translationStore';
import { useChatStore } from '@/stores/chatStore';
import VoiceMessagePlayer from './VoiceMessagePlayer.vue';

// ============================================
// PROPS
// ============================================

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  showTimestamp: {
    type: Boolean,
    default: true,
  },
  showOriginal: {
    type: Boolean,
    default: false,
  },
  showTranslation: {
    type: Boolean,
    default: null, // null = usar configuración del usuario
  },
  autoTranslate: {
    type: Boolean,
    default: null, // null = usar configuración del usuario
  },
  avatarSize: {
    type: [Number, String],
    default: 36,
  },
});

// ============================================
// EMITS
// ============================================

const emit = defineEmits([
  'click',
  'double-click',
  'reply',
  'react',
  'delete',
  'copy',
  'play',
  'pause',
]);

// ============================================
// STORES
// ============================================

const authStore = useAuthStore();
const userStore = useUserStore();
const translationStore = useTranslationStore();
const chatStore = useChatStore();

// ============================================
// INJECT
// ============================================

const snackbar = inject('snackbar');

// ============================================
// ESTADO LOCAL
// ============================================

const hover = ref(false);
const isPlaying = ref(false);
const showTranslationLocal = ref(false);
const translatedText = ref('');

// ============================================
// COMPUTED
// ============================================

const currentUserId = computed(() => authStore.user?.id);

const isCurrentUser = computed(() => {
  return String(props.message.sender_id) === String(currentUserId.value);
});

const isSystemMessage = computed(() => {
  return props.message.type === 'system';
});

const sender = computed(() => {
  // Si el mensaje es del usuario actual,ornar el usuario actual
  if (isCurrentUser.value) {
    return authStore.user;
  }
  
  // Buscar el usuario en el store
  return userStore.getUserById(props.message.sender_id);
});

const senderName = computed(() => {
  if (!sender.value) return 'Desconocido';
  return `${sender.value.first_name || ''} ${sender.value.last_name || ''}`.trim() || sender.value.username || 'Desconocido';
});

const senderInitials = computed(() => {
  if (!sender.value) return '?';
  const firstName = sender.value.first_name || '';
  const lastName = sender.value.last_name || '';
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
});

const senderAvatar = computed(() => {
  if (!sender.value) return '';
  return sender.value.avatar_url || '';
});

const avatarColor = computed(() => {
  if (isCurrentUser.value) return 'primary';
  return 'secondary';
});

const formattedTime = computed(() => {
  return formatDate(props.message.created_at || props.message.timestamp);
});

const formattedText = computed(() => {
  // Formatear enlaces
  let text = !isCurrentUser.value && availableTranslation.value && !props.showOriginal
    ? availableTranslation.value
    : props.message.content || '';
  
  // Convertir URLs a enlaces clickeables
  text = text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  // Convertir saltos de línea a <br>
  text = text.replace(/\n/g, '<br>');
  
  return text;
});

const availableTranslation = computed(() =>
  props.message.translated_content || translatedText.value
);

const bubbleStyle = computed(() => {
  const style = {};
  
  // Ancho máximo para mensajes de voz
  if (props.message.type === 'voice') {
    style.maxWidth = '380px';
  }
  
  return style;
});

const canTranslate = computed(() => {
  // No se puede traducir mensajes del sistema o mensajes vacíos
  if (isSystemMessage.value) return false;
  if (!props.message.content && !props.message.transcription) return false;
  return true;
});

const autoTranslateSetting = computed(() => {
  // Si se pasa explícitamente, usar ese valor
  if (props.autoTranslate !== null) {
    return props.autoTranslate;
  }
  // De lo contrario, usar la configuración del usuario
  return userStore.settings?.auto_translate || false;
});

const showTranslationComputed = computed(() => {
  // Si se pasa explícitamente, usar ese valor
  if (props.showTranslation !== null) {
    return props.showTranslation;
  }
  // Si auto-translate está activado y hay traducción disponible
  if (!isCurrentUser.value && availableTranslation.value) {
    return true;
  }
  if (autoTranslateSetting.value && availableTranslation.value) {
    return true;
  }
  // De lo contrario, usar el estado local
  return showTranslationLocal.value;
});

const userPreferredLanguage = computed(() => {
  const preferredLanguageId = userStore.currentUser?.preferred_language_id || authStore.user?.preferred_language_id;
  return translationStore.getLanguageById(preferredLanguageId)?.code || 'es';
});

// ============================================
// MÉTODOS
// ============================================

const handleMessageClick = (event) => {
  emit('click', { event, message: props.message });
};

const handleDoubleClick = (event) => {
  emit('double-click', { event, message: props.message });
};

const toggleTranslation = async () => {
  if (!canTranslate.value) return;
  
  if (translatedText.value) {
    showTranslationLocal.value = !showTranslationLocal.value;
    return;
  }
  
  try {
    const textToTranslate = props.message.type === 'voice'
      ? props.message.transcription || props.message.audio_transcription
      : props.message.content;
    if (!textToTranslate) return;

    const result = await translationStore.translate(props.message, userPreferredLanguage.value);
    translatedText.value = result.translatedText;
    
    showTranslationLocal.value = true;
  } catch (error) {
    console.error('Error al traducir:', error);
    snackbar?.error('Error al traducir el mensaje');
  }
};

const handlePlay = () => {
  isPlaying.value = true;
  emit('play', props.message);
};

const handlePause = () => {
  isPlaying.value = false;
  emit('pause', props.message);
};

const handleSeek = (time) => {
  emit('seek', { message: props.message, time });
};

const copyMessage = async () => {
  try {
    const text = props.message.type === 'voice' 
      ? props.message.transcription 
      : props.message.content;
    
    if (!text) {
      snackbar?.error('No hay texto para copiar');
      return;
    }
    
    await navigator.clipboard.writeText(text);
    emit('copy', props.message);
    snackbar?.show({ text: 'Mensaje copiado al portapapeles', color: 'success' });
  } catch (error) {
    console.error('Error al copiar:', error);
    snackbar?.error('Error al copiar el mensaje');
  }
};

const replyToMessage = () => {
  emit('reply', props.message);
};

const reactToMessage = () => {
  emit('react', props.message);
};

const deleteMessage = () => {
  emit('delete', props.message);
};

const retrySend = async () => {
  // Reintentar enviar el mensaje
  try {
    await chatStore.retryMessage(props.message);
  } catch (error) {
    console.error('Error al reintentar el envío:', error);
    snackbar?.error(error.message || 'No se pudo reenviar el mensaje');
  }
};

// ============================================
// UTILIDADES
// ============================================

const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    return 'Ayer';
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    });
  }
};
</script>

<style lang="scss" scoped>
// Contenedor de la burbuja de mensaje
.message-bubble {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: min(78%, 640px);
  position: relative;

  &.message-sent {
    align-self: flex-end;
    flex-direction: row-reverse;

    .message-content {
      background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.85));
      color: rgb(var(--v-theme-on-primary));
      border-radius: 18px 18px 4px 18px;
    }

    .message-header {
      justify-content: flex-end;
    }

    .message-sender {
      display: none;
    }

    .message-time {
      color: rgba(var(--v-theme-on-primary), 0.75) !important;
    }

    .message-translation {
      background-color: rgba(255, 255, 255, 0.16);
    }

    .message-footer .v-icon,
    .message-actions .v-btn {
      color: rgba(var(--v-theme-on-primary), 0.8) !important;
    }
  }

  &.message-received {
    align-self: flex-start;

    .message-content {
      background-color: var(--app-bubble-received);
      color: var(--app-bubble-received-text);
      border: 1px solid var(--app-border);
      border-radius: 18px 18px 18px 4px;
    }
  }

  // Mensaje aún no confirmado por el servidor
  &.message-pending .message-content {
    opacity: 0.7;
  }

  &.message-system {
    align-self: center;
    justify-content: center;

    .message-content {
      background-color: var(--app-surface);
      color: var(--app-text-muted);
      border: 1px solid var(--app-border);
      border-radius: 999px;
      box-shadow: none;
      padding: 4px 12px;
    }

    .message-avatar {
      display: none;
    }
  }

  &.message-compact {
    .message-avatar,
    .message-header,
    .message-footer {
      display: none;
    }
  }
}

// Avatar del remitente
.message-avatar {
  flex-shrink: 0;
}

// Contenido del mensaje
.message-content {
  min-width: 0;
  padding: 8px 12px;
  box-shadow: var(--app-shadow-sm);
  transition: box-shadow var(--app-transition);
  position: relative;

  &:hover {
    box-shadow: var(--app-shadow-md);
  }
}

// Header del mensaje
.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
  gap: 8px;
}

.message-sender {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.message-time {
  font-size: 0.7rem;
  white-space: nowrap;
}

// Cuerpo del mensaje
.message-body {
  .message-text {
    font-size: 0.95rem;
    line-height: 1.45;
    overflow-wrap: anywhere;

    & :deep(a) {
      color: inherit;
      text-decoration: underline;
    }

    &.message-text-original {
      opacity: 0.8;
      font-style: italic;
    }
  }

  .message-translation {
    margin-top: 6px;
    padding: 6px 8px;
    background-color: rgba(var(--v-theme-primary), 0.08);
    border-radius: var(--app-radius-sm);
    font-size: 0.85rem;

    .v-chip {
      font-size: 0.7rem;
    }
  }

  .voice-message {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .voice-transcription p {
    margin: 0;
    font-size: 0.85rem;
    color: inherit;

    strong {
      font-size: 0.75rem;
      opacity: 0.7;
    }
  }

  .system-message {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
    font-size: 0.8rem;

    .v-icon {
      opacity: 0.7;
    }
  }

  .message-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .v-chip {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

// Footer del mensaje
.message-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 2px;

  .message-status {
    display: flex;
    align-items: center;

    .v-icon {
      font-size: 0.85rem;
    }
  }

  .message-actions {
    display: flex;
    gap: 2px;

    .v-btn {
      width: 24px;
      height: 24px;
    }
  }
}

// Estilos para mensajes de voz
.message-voice .message-content {
  padding: 8px;
}

// Responsive
@media (max-width: 600px) {
  .message-bubble {
    max-width: 88%;
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

.message-bubble {
  animation: slideIn 0.18s ease-out;
}
</style>
