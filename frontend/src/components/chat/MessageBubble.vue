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
      { 'message-compact': compact },
      { 'message-deleted': isDeleted },
      { 'message-highlighted': highlighted }
    ]"
    :style="bubbleStyle"
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

    <!-- Contenido del mensaje: tocarlo (o clic derecho) abre las acciones -->
    <div
      class="message-content"
      @click="handleMessageClick"
      @contextmenu="openMenu"
    >
      <!-- Acciones del mensaje -->
      <v-menu
        v-if="hasActions"
        v-model="menuOpen"
        activator="parent"
        :open-on-click="false"
        location="bottom"
      >
        <v-list density="compact" min-width="170">
          <v-list-item prepend-icon="mdi-reply" :title="$t('common.reply')" @click="replyToMessage" />
          <v-list-item v-if="copyText" prepend-icon="mdi-content-copy" :title="$t('common.copy')" @click="copyMessage" />
          <v-list-item v-if="canEdit" prepend-icon="mdi-pencil" :title="$t('common.edit')" @click="editMessage" />
          <v-list-item
            v-if="canDelete"
            prepend-icon="mdi-delete"
            :title="$t('common.delete')"
            base-color="error"
            @click="deleteMessage"
          />
        </v-list>
      </v-menu>

      <!-- En escritorio: flecha visible al pasar el mouse -->
      <v-btn
        v-if="hasActions && hover"
        class="message-menu-btn"
        icon="mdi-chevron-down"
        variant="text"
        size="x-small"
        density="comfortable"
        :aria-label="$t('common.more')"
        @click.stop="menuOpen = true"
      />

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
        <!-- Mensaje eliminado -->
        <div v-if="isDeleted" class="message-deleted-text">
          <v-icon icon="mdi-cancel" size="small" />
          <span>{{ $t('chat.messageDeleted') }}</span>
        </div>

        <template v-else>
        <!-- Mensaje citado (respuesta) -->
        <button
          v-if="message.replyTo"
          type="button"
          class="message-quote"
          @click.stop="emit('jump', message.replyTo.id)"
        >
          <span class="message-quote__author">{{ quoteAuthor }}</span>
          <span class="message-quote__text">{{ quoteText }}</span>
        </button>

        <!-- Foto, video o documento -->
        <div v-if="attachments.length" class="message-attachments">
          <template v-for="(attachment, index) in attachments" :key="index">
            <!-- Foto: al tocarla se abre en grande -->
            <button
              v-if="attachment.file_type === 'image'"
              type="button"
              class="attachment-image"
              :aria-label="$t('chat.attach.open')"
              @click.stop="viewerUrl = attachment.file_url"
            >
              <img :src="attachment.file_url" :alt="attachment.file_name" loading="lazy" />
            </button>

            <video
              v-else-if="attachment.file_type === 'video'"
              class="attachment-video"
              :src="attachment.file_url"
              controls
              playsinline
              preload="metadata"
              @click.stop
            />

            <!-- Documento: ícono, nombre, tamaño y descarga -->
            <a
              v-else
              class="attachment-file"
              :href="attachment.file_url || undefined"
              :download="attachment.file_name"
              target="_blank"
              rel="noopener"
              @click.stop
            >
              <v-icon :icon="fileIcon(attachment)" size="28" />
              <span class="attachment-file__info">
                <span class="attachment-file__name">{{ attachment.file_name || $t('chat.file', { n: index + 1 }) }}</span>
                <span class="attachment-file__size">{{ formatFileSize(attachment.file_size) }}</span>
              </span>
              <v-icon v-if="attachment.file_url" icon="mdi-download" size="20" class="attachment-file__download" />
            </a>
          </template>

          <!-- Subiendo: progreso sobre el adjunto -->
          <div v-if="message.status === 'sending'" class="attachment-progress">
            <v-progress-circular
              :model-value="message.uploadProgress || 0"
              :indeterminate="!message.uploadProgress"
              size="40"
              width="4"
              color="white"
            >
              <span v-if="message.uploadProgress" class="text-caption">{{ message.uploadProgress }}%</span>
            </v-progress-circular>
          </div>
        </div>

        <!-- Mensaje de texto (también el texto que acompaña a una foto o archivo) -->
        <template v-if="message.type === 'text' || message.type === 'transcription' || (attachments.length && message.content)">
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
              {{ $t('chat.voice.loadError') }}
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

        <!-- "editado" y, en los mensajes propios, el estado: enviando / ✓ / ✓✓ / ✓✓ azul -->
        <span v-if="message.is_edited || statusInfo" class="message-meta">
          <span v-if="message.is_edited" class="message-edited">{{ $t('chat.edited') }}</span>
          <v-icon
            v-if="statusInfo"
            class="message-status"
            :class="`message-status--${status}`"
            :icon="statusInfo.icon"
            size="15"
            role="img"
            :title="statusInfo.label"
            :aria-label="statusInfo.label"
          />
        </span>
        </template>
      </div>

    </div>

    <!-- Foto en grande -->
    <v-dialog :model-value="!!viewerUrl" fullscreen @update:model-value="viewerUrl = ''">
      <div class="image-viewer" @click="viewerUrl = ''">
        <img :src="viewerUrl" alt="" @click.stop />
        <div class="image-viewer__actions">
          <v-btn icon="mdi-download" variant="text" color="white" :href="viewerUrl" download :aria-label="$t('chat.attach.download')" @click.stop />
          <v-btn icon="mdi-close" variant="text" color="white" :aria-label="$t('common.close')" @click.stop="viewerUrl = ''" />
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useTranslationStore } from '@/stores/translationStore';
import { useChatStore } from '@/stores/chatStore';
import VoiceMessagePlayer from './VoiceMessagePlayer.vue';
import { getMessagePreview } from '@/utils/conversationDisplay';

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
  // Permisos calculados por la vista (dependen del rol en el grupo)
  canEdit: {
    type: Boolean,
    default: false,
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
  // Estado de un mensaje propio, calculado por la vista: sending | sent | delivered | read | failed
  status: {
    type: String,
    default: '',
  },
  // Resaltado breve al saltar a un mensaje citado
  highlighted: {
    type: Boolean,
    default: false,
  },
});

// ============================================
// EMITS
// ============================================

const emit = defineEmits([
  'click',
  'double-click',
  'reply',
  'edit',
  'delete',
  'jump',
  'copy',
  'play',
  'pause',
]);

// ============================================
// STORES
// ============================================

const { t } = useI18n();
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
const menuOpen = ref(false);
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
  
  // Buscar el usuario en el store (en grupos puede no estar: usar el que trae el mensaje)
  return userStore.getUserById(props.message.sender_id) || props.message.sender;
});

const isDeleted = computed(() => Boolean(props.message.is_deleted));

// ---- Fotos, videos y documentos ----

const attachments = computed(() => (isDeleted.value ? [] : props.message.attachments || []));
const viewerUrl = ref('');

const fileIcon = (attachment) => {
  const type = attachment.mime_type || '';
  if (type === 'application/pdf') return 'mdi-file-pdf-box';
  if (type.startsWith('audio/')) return 'mdi-file-music-outline';
  if (/word|opendocument.text/.test(type)) return 'mdi-file-word-outline';
  if (/excel|spreadsheet|csv/.test(type)) return 'mdi-file-excel-outline';
  if (/powerpoint|presentation/.test(type)) return 'mdi-file-powerpoint-outline';
  if (/zip/.test(type)) return 'mdi-folder-zip-outline';
  return 'mdi-file-outline';
};

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

// Mensajes reales (ya confirmados por el servidor) que no son del sistema
const hasActions = computed(() =>
  !isSystemMessage.value && !isDeleted.value && props.message.id != null
);

const copyText = computed(() =>
  props.message.type === 'voice' ? props.message.transcription : props.message.content
);

// Cita de la respuesta: autor y un extracto del mensaje original
const quoteAuthor = computed(() => {
  const quoted = props.message.replyTo;
  if (!quoted) return '';
  if (String(quoted.sender_id) === String(currentUserId.value)) return t('chat.you');
  const user = quoted.sender || userStore.getUserById(quoted.sender_id);
  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || '';
});

const quoteText = computed(() => {
  const quoted = props.message.replyTo;
  if (!quoted) return '';
  return getMessagePreview(quoted);
});

const senderName = computed(() => {
  if (!sender.value) return t('chat.user');
  return `${sender.value.first_name || ''} ${sender.value.last_name || ''}`.trim() || sender.value.username || t('chat.user');
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

const STATUS_ICONS = {
  sending: 'mdi-clock-outline',
  sent: 'mdi-check',
  delivered: 'mdi-check-all',
  read: 'mdi-check-all',
  failed: 'mdi-alert-circle-outline',
};

const statusInfo = computed(() => {
  if (!isCurrentUser.value || !STATUS_ICONS[props.status]) return null;
  return { icon: STATUS_ICONS[props.status], label: t(`chat.status.${props.status}`) };
});

const formattedTime = computed(() => {
  return formatDate(props.message.created_at || props.message.timestamp);
});

const formattedText = computed(() => {
  // Formatear enlaces
  let text = !isCurrentUser.value && availableTranslation.value && !props.showOriginal
    ? availableTranslation.value
    : props.message.content || '';

  // Escapar HTML: el texto lo escribe otro usuario y se muestra con v-html
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  // Los mensajes propios ya están en el idioma del usuario
  if (isCurrentUser.value) return false;
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

  // Tocar el mensaje abre sus acciones (salvo que se toque un enlace o un botón)
  if (hasActions.value && !event.target.closest('a, button, input')) {
    menuOpen.value = true;
  }
};

const openMenu = (event) => {
  if (!hasActions.value) return;
  event.preventDefault();
  menuOpen.value = true;
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
    snackbar?.error(t('chat.translateError'));
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
    const text = copyText.value;

    if (!text) {
      snackbar?.error(t('chat.nothingToCopy'));
      return;
    }
    
    await navigator.clipboard.writeText(text);
    emit('copy', props.message);
    snackbar?.show({ text: t('chat.copied'), color: 'success' });
  } catch (error) {
    console.error('Error al copiar:', error);
    snackbar?.error(t('chat.copyError'));
  }
};

const replyToMessage = () => {
  emit('reply', props.message);
};

const editMessage = () => {
  emit('edit', props.message);
};

const deleteMessage = () => {
  emit('delete', props.message);
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
    return t('chat.yesterday');
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

.message-content {
  cursor: pointer;
}

// Flecha de acciones (escritorio)
.message-menu-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  background: inherit;
  opacity: 0.85;
}

// Cita del mensaje al que se responde
.message-quote {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 140px;
  margin-bottom: 6px;
  padding: 4px 8px;
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 6px;
  background-color: rgba(var(--v-theme-primary), 0.1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &__author {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
  }

  &__text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.82rem;
    opacity: 0.85;
    overflow-wrap: anywhere;
  }
}

.message-sent .message-quote {
  border-left-color: rgba(var(--v-theme-on-primary), 0.9);
  background-color: rgba(255, 255, 255, 0.18);

  .message-quote__author {
    color: rgb(var(--v-theme-on-primary));
  }
}

// ---- Fotos, videos y documentos ----
.message-attachments {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: -2px -4px 4px;
}

.attachment-image {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;

  img {
    display: block;
    width: 100%;
    max-width: 280px;
    max-height: 320px;
    min-height: 80px;
    object-fit: cover;
    border-radius: 10px;
  }
}

.attachment-video {
  display: block;
  width: 100%;
  max-width: 300px;
  max-height: 360px;
  border-radius: 10px;
  background: #000;
}

.attachment-file {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  max-width: 300px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.14);
  color: inherit;
  text-decoration: none;

  .attachment-file__info {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .attachment-file__name {
    overflow: hidden;
    font-size: 0.88rem;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-file__size {
    font-size: 0.72rem;
    opacity: 0.75;
  }
}

.attachment-progress {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
}

.image-viewer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.92);

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .image-viewer__actions {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    right: 8px;
    display: flex;
    gap: 4px;
  }
}

.message-meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  line-height: 1;

  .message-edited {
    display: inline;
    margin-top: 0;
  }
}

.message-status {
  opacity: 0.75;

  // Visto: celeste, legible tanto sobre la burbuja azul como en modo oscuro
  &.message-status--read {
    color: #7fdcff !important;
    opacity: 1;
  }

  &.message-status--failed {
    color: rgb(var(--v-theme-error)) !important;
    opacity: 1;
  }
}

.message-edited {
  display: block;
  margin-top: 2px;
  font-size: 0.68rem;
  font-style: italic;
  opacity: 0.7;
  text-align: right;
}

.message-deleted-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  font-style: italic;
  opacity: 0.75;
}

.message-deleted .message-content {
  cursor: default;
}

// Resaltado al saltar desde una cita
.message-highlighted .message-content {
  box-shadow: 0 0 0 3px rgba(var(--v-theme-warning), 0.8);
  transition: box-shadow 0.3s ease;
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
