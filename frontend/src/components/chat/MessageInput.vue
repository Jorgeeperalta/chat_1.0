<!--
 * @file MessageInput.vue
 * @description Input para enviar mensajes de texto y voz
 * @author Arquitecto de Software Senior
 -->

<template>
  <div
    class="message-input"
    :class="[
      { 'is-focused': isFocused },
      { 'is-recording': isRecording },
      { 'is-disabled': disabled },
      { 'mobile': isMobile },
      { 'has-voice': hasVoiceCapability },
    ]"
  >
    <!-- Caja del input (con contorno marcado) -->
    <div class="input-shell">
      <!-- Acciones de la izquierda -->
      <div class="input-actions">
        <!-- Botón para adjuntar archivos -->
        <v-btn
          variant="text"
          icon
          size="small"
          class="action-btn"
          :disabled="disabled || isRecording"
          :aria-label="$t('chat.attachFile')"
          @click="triggerFileInput"
        >
          <v-icon icon="mdi-paperclip" />
          <v-tooltip activator="parent" location="top">
            {{ $t('chat.attachFile') }}
          </v-tooltip>
        </v-btn>

        <!-- Input oculto para archivos -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          multiple
          style="display: none;"
          @change="handleFileChange"
        />

        <!-- Botón para emojis -->
        <v-btn
          variant="text"
          icon
          size="small"
          class="action-btn"
          :disabled="disabled || isRecording"
          :aria-label="$t('chat.emoji')"
          @click="toggleEmojiPicker"
        >
          <v-icon icon="mdi-emoticon-happy-outline" />
          <v-tooltip activator="parent" location="top">
            {{ $t('chat.emoji') }}
          </v-tooltip>
        </v-btn>
      </div>

      <!-- Texto / indicador de grabación -->
      <div class="text-input-container">
        <transition name="fade" mode="out-in">
          <div
            v-if="isRecording"
            key="recording"
            class="recording-indicator"
          >
            <span class="recording-dot" />
            <span class="recording-text">{{ recordingTime }}</span>
            <span class="recording-label">{{ $t('chat.audioRecording') }}</span>
          </div>

          <v-textarea
            v-else
            key="text"
            ref="textarea"
            v-model="messageText"
            :placeholder="placeholder || $t('chat.typeMessage')"
            :disabled="disabled"
            :rows="1"
            :max-rows="6"
            auto-grow
            density="compact"
            variant="plain"
            hide-details
            no-resize
            class="message-textarea"
            @focus="handleFocus"
            @blur="handleBlur"
            @keydown.enter.exact="handleEnterKey"
            @keydown.enter.shift="handleShiftEnter"
            @keydown.esc="handleEscape"
            @input="handleInput"
            @paste="handlePaste"
          />
        </transition>
      </div>

      <!-- Acciones de la derecha -->
      <div class="input-actions">
        <!-- Selector de idioma (opcional) -->
        <v-menu
          v-if="showLanguageSelector"
          :close-on-content-click="false"
          location="top end"
          transition="scale-transition"
        >
          <template v-slot:activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              variant="text"
              icon
              size="small"
              class="action-btn"
              :disabled="disabled || isRecording"
              :aria-label="$t('settings.language')"
            >
              <v-icon :icon="currentLanguageIcon" />
              <v-tooltip activator="parent" location="top">
                {{ $t('settings.language') }}
              </v-tooltip>
            </v-btn>
          </template>
          <v-list density="compact" nav>
            <v-list-item
              v-for="lang in availableLanguages"
              :key="lang.value"
              :value="lang.value"
              @click="setMessageLanguage(lang.value)"
            >
              <template v-slot:prepend>
                <v-icon :icon="lang.icon" />
              </template>
              <v-list-item-title>{{ lang.text }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Botón para grabar audio -->
        <v-btn
          v-if="hasVoiceCapability && !hasText"
          variant="text"
          icon
          size="small"
          class="action-btn"
          :disabled="disabled"
          :color="isRecording ? 'error' : undefined"
          :aria-label="isRecording ? $t('chat.cancelAudioRecording') : $t('chat.startAudioRecording')"
          @click="isRecording ? cancelRecording() : toggleRecording()"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchCancel"
        >
          <v-icon :icon="isRecording ? 'mdi-close' : 'mdi-microphone'" />
          <v-tooltip activator="parent" location="top">
            {{ isRecording ? $t('chat.cancelAudioRecording') : $t('chat.startAudioRecording') }}
          </v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Botón de enviar (siempre visible, circular) -->
    <v-btn
      class="send-btn"
      :class="{ 'is-active': canSend }"
      color="primary"
      variant="flat"
      icon
      :size="isCompact ? 'default' : 'large'"
      :disabled="!canSend || disabled"
      :loading="loading"
      :aria-label="$t('chat.send')"
      @click="sendMessage"
    >
      <v-icon icon="mdi-send" />
      <v-tooltip activator="parent" location="top">
        {{ $t('chat.send') }}
      </v-tooltip>
    </v-btn>

    <!-- Selector de emoji -->
    <v-dialog
      v-model="showEmojiDialog"
      :max-width="400"
      transition="dialog-bottom-transition"
      class="emoji-dialog"
    >
      <v-card>
        <v-card-title class="pa-2">
          <v-text-field
            v-model="emojiSearch"
            :placeholder="$t('chat.searchEmoji')"
            density="compact"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-magnify"
            clearable
            @update:modelValue="filterEmojis"
          />
        </v-card-title>
        <v-card-text class="pa-0">
          <div class="emoji-grid">
            <v-btn
              v-for="(category, index) in filteredEmojiCategories"
              :key="index"
              variant="text"
              color="primary"
              size="small"
              class="category-tab"
              :class="{ active: activeEmojiCategory === index }"
              @click="activeEmojiCategory = index"
            >
              {{ category.title }}
            </v-btn>
          </div>
          <div class="emoji-list">
            <v-btn
              v-for="emoji in activeEmojiCategory >= 0 ? filteredEmojiCategories[activeEmojiCategory]?.emojis : []"
              :key="emoji.char"
              variant="text"
              size="large"
              class="emoji-item"
              @click="insertEmoji(emoji.char)"
            >
              <span class="emoji-char">{{ emoji.char }}</span>
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';

// ============================================
// PROPS
// ============================================

const props = defineProps({
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  showLanguageSelector: {
    type: Boolean,
    default: false,
  },
  isCompact: {
    type: Boolean,
    default: false,
  },
  autoFocus: {
    type: Boolean,
    default: false,
  },
  maxLength: {
    type: Number,
    default: 2000,
  },
  hasVoiceCapability: {
    type: Boolean,
    default: true,
  },
});

// ============================================
// EMITS
// ============================================

const emit = defineEmits([
  'send',
  'send:voice',
  'send:file',
  'record:start',
  'record:stop',
  'record:error',
  'focus',
  'blur',
  'change',
]);

// ============================================
// INJECT
// ============================================

const device = inject('device');
const snackbar = inject('snackbar');

// ============================================
// STORE
// ============================================

const userStore = useUserStore();
const themeStore = useThemeStore();

// ============================================
// ESTADO LOCAL
// ============================================

const messageText = ref('');
const isFocused = ref(false);
const isRecording = ref(false);
const recordingTime = ref('00:00');
const recordingInterval = ref(null);
const recordingStartTime = ref(0);
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const audioStream = ref(null);
const fileInput = ref(null);
const textarea = ref(null);
const showEmojiDialog = ref(false);
const emojiSearch = ref('');
const activeEmojiCategory = ref(-1); // -1 = todos
let discardRecording = false;
let isStartingRecording = false;
let stopRequestedWhileStarting = false;

// Formatos de grabación en orden de preferencia
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];
const MIN_RECORDING_MS = 700;
const MAX_RECORDING_SECONDS = parseInt(import.meta.env.VITE_MAX_AUDIO_DURATION, 10) || 300;

// ============================================
// COMPUTED
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);

const hasText = computed(() => messageText.value.trim().length > 0);

const canSend = computed(() => {
  return hasText.value || isRecording.value;
});

const isVoiceAvailable = computed(() => {
  return props.hasVoiceCapability && typeof window !== 'undefined' && 
    ('MediaRecorder' in window || 'webkitMediaRecorder' in window);
});

const currentLanguage = computed(() => {
  return userStore.settings?.message_language || userStore.preferredLanguage || 'es';
});

const currentLanguageIcon = computed(() => {
  const lang = availableLanguages.value.find(l => l.value === currentLanguage.value);
  return lang ? lang.icon : 'mdi-flag-outline-es';
});

const availableLanguages = computed(() => [
  { value: 'es', text: 'Español', icon: 'mdi-flag-outline-es' },
  { value: 'en', text: 'English', icon: 'mdi-flag-outline-us' },
  { value: 'fr', text: 'Français', icon: 'mdi-flag-outline-fr' },
  { value: 'de', text: 'Deutsch', icon: 'mdi-flag-outline-de' },
  { value: 'it', text: 'Italiano', icon: 'mdi-flag-outline-it' },
  { value: 'pt', text: 'Português', icon: 'mdi-flag-outline-pt' },
  { value: 'ca', text: 'Català', icon: 'mdi-flag-outline-es' },
]);

// Categorías de emojis
const emojiCategories = computed(() => [
  {
    title: '😀 Smileys',
    emojis: [
      { char: '😀', keywords: 'happy joy' },
      { char: '😃', keywords: 'grinning' },
      { char: '😄', keywords: 'laugh' },
      { char: '😁', keywords: 'beaming' },
      { char: '😆', keywords: 'laughing' },
      { char: '😅', keywords: 'sweat smile' },
      { char: '😂', keywords: 'joy tears' },
      { char: '🤣', keywords: 'rolling' },
      { char: '😊', keywords: 'blush' },
      { char: '😇', keywords: 'halo' },
      { char: '🙂', keywords: 'slightly' },
      { char: '🙃', keywords: 'upside down' },
      { char: '😉', keywords: 'wink' },
      { char: '😌', keywords: 'relieved' },
      { char: '😍', keywords: 'hearts' },
      { char: '❤️', keywords: 'heart' },
      { char: '😘', keywords: 'kiss' },
      { char: '😗', keywords: 'kiss' },
      { char: '😙', keywords: 'kiss' },
      { char: '🥰', keywords: 'smiling' },
      { char: '😚', keywords: 'kiss' },
    ],
  },
  {
    title: '👍 Gestos',
    emojis: [
      { char: '👍', keywords: 'thumbs up' },
      { char: '👎', keywords: 'thumbs up' },
      { char: '👏', keywords: 'clap' },
      { char: '🙌', keywords: 'raising hands' },
      { char: '🫱', keywords: 'heart hands' },
      { char: '🤝', keywords: 'handshake' },
      { char: '✌️', keywords: 'peace' },
      { char: '🤞', keywords: 'crossed fingers' },
      { char: '✊', keywords: 'fist' },
      { char: '🤛', keywords: 'fist left' },
      { char: '🤜', keywords: 'fist right' },
      { char: '👊', keywords: 'punch' },
      { char: '🤚', keywords: 'raised back' },
      { char: '🖐️', keywords: 'hand' },
      { char: '👋', keywords: 'wave' },
      { char: '🤟', keywords: 'ok' },
      { char: '🤏', keywords: 'pinch' },
      { char: '🤘', keywords: 'rock' },
    ],
  },
  {
    title: '🐶 Animales',
    emojis: [
      { char: '🐶', keywords: 'dog' },
      { char: '🐱', keywords: 'cat' },
      { char: '🐭', keywords: 'mouse' },
      { char: '🐹', keywords: 'hamster' },
      { char: '🐰', keywords: 'rabbit' },
      { char: '🦊', keywords: 'fox' },
      { char: '🐻', keywords: 'bear' },
      { char: '🐼', keywords: 'panda' },
      { char: '🐨', keywords: 'koala' },
      { char: '🐯', keywords: 'tiger' },
      { char: '🦁', keywords: 'lion' },
      { char: '🐮', keywords: 'cow' },
      { char: '🐷', keywords: 'pig' },
      { char: '🐵', keywords: 'monkey' },
      { char: '🐺', keywords: 'wolf' },
    ],
  },
]);

const filteredEmojiCategories = computed(() => {
  if (!emojiSearch.value.trim()) {
    return emojiCategories.value;
  }
  
  const searchTerm = emojiSearch.value.toLowerCase();
  return emojiCategories.value.map(category => ({
    ...category,
    emojis: category.emojis.filter(emoji => 
      emoji.char.toLowerCase().includes(searchTerm) ||
      emoji.keywords.toLowerCase().includes(searchTerm)
    ),
  })).filter(category => category.emojis.length > 0);
});

// ============================================
// MÉTODOS
// ============================================

const handleFocus = () => {
  isFocused.value = true;
  emit('focus');
};

const handleBlur = () => {
  isFocused.value = false;
  emit('blur');
};

const handleInput = () => {
  emit('change', messageText.value);
  
  // Ajustar altura del textarea
  adjustTextareaHeight();
};

const adjustTextareaHeight = async () => {
  // La altura la maneja v-textarea con auto-grow (hasta max-rows);
  // solo esperamos al próximo tick para que recalcule tras cambios programáticos.
  await nextTick();
};

const handleEnterKey = (event) => {
  if (canSend.value) {
    event.preventDefault();
    sendMessage();
  }
};

const handleShiftEnter = (event) => {
  // Insertar nueva línea
  const textareaEl = textarea.value?.$el.querySelector('textarea');
  if (textareaEl) {
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    messageText.value = messageText.value.substring(0, start) + '\n' + messageText.value.substring(end);
    textareaEl.selectionStart = textareaEl.selectionEnd = start + 1;
    event.preventDefault();
    adjustTextareaHeight();
  }
};

const handleEscape = () => {
  if (isRecording.value) {
    cancelRecording();
  }
};

const handlePaste = (event) => {
  // Manejar pegado de archivos
  const items = event.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          emit('send:file', [file]);
        }
      }
    }
  }
};

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const handleFileChange = (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length > 0) {
    emit('send:file', files);
    // Limpiar el input
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};

const sendMessage = () => {
  if (!canSend.value || props.loading) return;

  // Si se está grabando, el botón de enviar termina la grabación y envía el audio
  if (isRecording.value) {
    stopRecording();
    return;
  }

  const text = messageText.value.trim();
  if (text.length > 0) {
    emit('send', {
      type: 'text',
      content: text,
      language: currentLanguage.value,
    });
    messageText.value = '';
    emit('change', '');
    adjustTextareaHeight();
  }
};

const toggleEmojiPicker = () => {
  showEmojiDialog.value = !showEmojiDialog.value;
};

const insertEmoji = (emoji) => {
  const textareaEl = textarea.value?.$el.querySelector('textarea');
  if (textareaEl) {
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    messageText.value = messageText.value.substring(0, start) + emoji + messageText.value.substring(end);
    textareaEl.selectionStart = textareaEl.selectionEnd = start + emoji.length;
    handleInput();
    textareaEl.focus();
  }
  showEmojiDialog.value = false;
  emojiSearch.value = '';
  activeEmojiCategory.value = -1;
};

const filterEmojis = () => {
  // Ya está manejado por la propiedad computada
};

const setMessageLanguage = (lang) => {
  userStore.setMessageLanguage(lang);
};

// ============================================
// GRABACIÓN DE AUDIO
// ============================================

const toggleRecording = async () => {
  if (isRecording.value) {
    await stopRecording();
  } else {
    await startRecording();
  }
};

/**
 * Elige un formato de grabación soportado por el navegador
 * (Chrome/Firefox: webm/ogg con opus; Safari: mp4/aac)
 * @returns {string} Tipo MIME o '' para usar el predeterminado del navegador
 */
const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return AUDIO_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

const startRecording = async () => {
  if (isRecording.value || isStartingRecording) return;
  isStartingRecording = true;
  stopRequestedWhileStarting = false;

  try {
    if (!isVoiceAvailable.value) {
      snackbar?.error('La grabación de voz no está disponible en este navegador');
      return;
    }

    // getUserMedia solo existe en contextos seguros (https o localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      snackbar?.error('Para grabar audio la app debe abrirse con https o desde localhost');
      return;
    }

    // Pedir permiso para usar el micrófono
    audioStream.value = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Crear el MediaRecorder con un formato soportado (64 kbps alcanza para voz)
    const preferredMimeType = getSupportedAudioMimeType();
    mediaRecorder.value = new MediaRecorder(audioStream.value, {
      ...(preferredMimeType && { mimeType: preferredMimeType }),
      audioBitsPerSecond: 64000,
    });
    audioChunks.value = [];
    discardRecording = false;

    // Configurar eventos
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        audioChunks.value.push(event.data);
      }
    };

    mediaRecorder.value.onstop = () => {
      // Combinar los chunks y enviar
      const mimeType = mediaRecorder.value?.mimeType || preferredMimeType || 'audio/webm';
      const baseType = mimeType.split(';')[0];
      const extension = baseType.includes('mp4') ? 'm4a' : baseType.split('/')[1] || 'webm';
      const audioBlob = new Blob(audioChunks.value, { type: mimeType });
      const audioFile = new File([audioBlob], `voice-${Date.now()}.${extension}`, {
        type: mimeType,
      });
      const elapsedMs = Date.now() - recordingStartTime.value;
      const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));

      // Se descarta si se canceló, si quedó vacía o si fue un toque accidental
      if (discardRecording) {
        // Cancelada por el usuario: no se envía nada
      } else if (audioBlob.size === 0 || elapsedMs < MIN_RECORDING_MS) {
        snackbar?.show({ text: 'Mantén presionado el micrófono para grabar', color: 'info' });
      } else {
        emit('send:voice', audioFile, durationSeconds);
      }
      discardRecording = false;

      // Limpiar
      audioChunks.value = [];
      
      // Detener el stream
      audioStream.value?.getTracks().forEach(track => track.stop());
      audioStream.value = null;
    };
    
    mediaRecorder.value.onerror = (event) => {
      console.error('Error en MediaRecorder:', event);
      emit('record:error', event);
      snackbar?.error('Error al grabar audio');
      stopRecording();
    };
    
    // Iniciar la grabación
    mediaRecorder.value.start();
    
    // Iniciar el temporizador
    recordingStartTime.value = Date.now();
    startRecordingTimer();
    
    isRecording.value = true;
    emit('record:start');
    
    snackbar?.show({
      text: isMobile.value ? 'Grabando... Suelta para enviar' : 'Grabando... Pulsa enviar para mandar el audio',
      color: 'info',
    });

    // El usuario soltó el botón mientras se pedía el permiso del micrófono
    if (stopRequestedWhileStarting) {
      await stopRecording();
    }
  } catch (error) {
    console.error('Error al iniciar la grabación:', error);
    audioStream.value?.getTracks().forEach(track => track.stop());
    audioStream.value = null;
    if (error.name === 'NotAllowedError') {
      snackbar?.error('Permiso de micrófono denegado');
    } else if (error.name === 'NotFoundError') {
      snackbar?.error('No se encontró ningún micrófono');
    } else {
      snackbar?.error('Error al iniciar la grabación');
    }
    emit('record:error', error);
  } finally {
    isStartingRecording = false;
  }
};

const stopRecording = async () => {
  if (!isRecording.value || !mediaRecorder.value) return;
  
  try {
    // Detener el temporizador
    stopRecordingTimer();
    
    // Detener la grabación
    mediaRecorder.value.stop();
    isRecording.value = false;
    emit('record:stop');
  } catch (error) {
    console.error('Error al detener la grabación:', error);
    emit('record:error', error);
  }
};

/**
 * Detiene la grabación sin enviar el audio
 */
const cancelRecording = async () => {
  if (!isRecording.value) return;
  discardRecording = true;
  await stopRecording();
};

const startRecordingTimer = () => {
  recordingTime.value = '0:00';
  recordingInterval.value = setInterval(() => {
    const elapsed = Date.now() - recordingStartTime.value;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    recordingTime.value = `${minutes}:${secs.toString().padStart(2, '0')}`;

    // Límite de duración: se detiene y envía automáticamente
    if (seconds >= MAX_RECORDING_SECONDS) {
      snackbar?.show({ text: 'Se alcanzó la duración máxima del audio', color: 'info' });
      stopRecording();
    }
  }, 250);
};

const stopRecordingTimer = () => {
  if (recordingInterval.value) {
    clearInterval(recordingInterval.value);
    recordingInterval.value = null;
  }
  recordingTime.value = '0:00';
};

// Móvil: mantener presionado para grabar, soltar para enviar
const handleTouchStart = async (event) => {
  if (isMobile.value) {
    event.preventDefault();
    await startRecording();
  }
};

const handleTouchEnd = async (event) => {
  if (!isMobile.value) return;
  event.preventDefault();
  if (isStartingRecording) {
    // Todavía se está pidiendo el micrófono: detener apenas arranque
    stopRequestedWhileStarting = true;
  } else if (isRecording.value) {
    await stopRecording();
  }
};

const handleTouchCancel = async () => {
  if (isStartingRecording) {
    stopRequestedWhileStarting = true;
    discardRecording = true;
  } else if (isRecording.value) {
    await cancelRecording();
  }
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  if (props.autoFocus) {
    textarea.value?.$el.querySelector('textarea')?.focus();
  }
  adjustTextareaHeight();
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  // Al salir de la vista se descarta la grabación en curso (no se envía)
  cancelRecording();
  if (audioStream.value) {
    audioStream.value.getTracks().forEach(track => track.stop());
  }
  if (mediaRecorder.value) {
    mediaRecorder.value.stream?.getTracks().forEach(track => track.stop());
  }
});

// ============================================
// EXPOSE
// ============================================

defineExpose({
  focus: () => textarea.value?.$el.querySelector('textarea')?.focus(),
  blur: () => textarea.value?.$el.querySelector('textarea')?.blur(),
  clear: () => { messageText.value = ''; },
  setText: (text) => { messageText.value = text; },
  getText: () => messageText.value,
});
</script>

<style lang="scss" scoped>
.message-input {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  width: 100%;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

// ============================================
// Caja del input: contorno bien marcado
// ============================================
.input-shell {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  min-height: 48px;
  padding: 4px 6px;
  background-color: var(--app-surface);
  border: 2px solid var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  box-shadow: var(--app-shadow-sm);
  transition: border-color var(--app-transition), box-shadow var(--app-transition);

  &:hover {
    border-color: rgba(var(--v-theme-primary), 0.6);
  }

  .is-focused & {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.18);
  }

  .is-recording & {
    border-color: rgb(var(--v-theme-error));
    box-shadow: 0 0 0 4px rgba(var(--v-theme-error), 0.15);
  }
}

// Botones de acción (iconos) dentro de la caja
.input-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  height: 36px;

  .action-btn {
    color: var(--app-text-muted);

    &:hover {
      color: rgb(var(--v-theme-primary));
    }
  }
}

// ============================================
// Texto
// ============================================
.text-input-container {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  min-height: 36px;

  .message-textarea {
    width: 100%;
  }

  :deep(.v-field) {
    --v-field-padding-start: 6px;
    --v-field-padding-end: 6px;
    --v-field-padding-top: 6px;
    --v-field-padding-bottom: 6px;
    --v-input-control-height: 36px;
  }

  :deep(.v-field__input) {
    min-height: 36px;
    padding-top: 7px;
    padding-bottom: 7px;
    mask-image: none;
    -webkit-mask-image: none;
  }

  :deep(textarea) {
    font-size: 0.95rem;
    line-height: 1.45;
    color: var(--app-text);
    max-height: 9.5em; // ~6 líneas, luego scroll interno
    overflow-y: auto;

    &::placeholder {
      color: var(--app-text-muted);
      opacity: 1;
    }
  }
}

// Indicador de grabación
.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  color: rgb(var(--v-theme-error));
  font-size: 0.9rem;
  font-weight: 500;

  .recording-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: rgb(var(--v-theme-error));
    animation: pulse 1.2s ease-in-out infinite;
  }

  .recording-text {
    font-variant-numeric: tabular-nums;
  }

  .recording-label {
    color: var(--app-text-muted);
    font-weight: 400;
  }
}

// ============================================
// Botón de enviar
// ============================================
.send-btn {
  flex: 0 0 auto;
  box-shadow: var(--app-shadow-md);
  transition: transform var(--app-transition), opacity var(--app-transition), box-shadow var(--app-transition);

  &.is-active:hover {
    transform: translateY(-1px) scale(1.04);
  }

  &.is-active:active {
    transform: scale(0.96);
  }

  // Deshabilitado: visible pero atenuado (no desaparece)
  &.v-btn--disabled {
    opacity: 1;
    box-shadow: none;

    :deep(.v-btn__overlay) {
      opacity: 0;
    }
  }

  :deep(.v-icon) {
    // El icono de avión se ve centrado si se desplaza un poco
    transform: translateX(1px);
  }
}

// ============================================
// Diálogo de emojis
// ============================================
.emoji-dialog {
  .v-card {
    border-radius: var(--app-radius-md);
  }

  .v-card-text {
    padding: 0;
    max-height: 300px;
    overflow-y: auto;

    .emoji-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px 4px;

      .category-tab {
        flex: 1;
        min-width: fit-content;
        font-size: 0.8rem;
        white-space: nowrap;

        &.active {
          background-color: rgba(var(--v-theme-primary), 0.12);
          font-weight: 500;
        }
      }
    }

    .emoji-list {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      padding: 8px;

      .emoji-item {
        min-width: 0;
        padding: 4px;

        .emoji-char {
          font-size: 1.5rem;
          display: block;
        }
      }
    }
  }
}

// ============================================
// Transiciones y animaciones
// ============================================
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

// ============================================
// Responsive
// ============================================
@media (max-width: 600px) {
  .message-input {
    gap: 6px;
  }

  .input-shell {
    min-height: 44px;
    padding: 2px 4px;
  }

  .input-actions .action-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
