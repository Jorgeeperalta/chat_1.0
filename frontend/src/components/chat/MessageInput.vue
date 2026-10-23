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
    <!-- Contenedor de acciones de la izquierda -->
    <div class="input-actions left-actions">
      <!-- Botón para adjuntar archivos -->
      <v-btn
        variant="text"
        icon
        :disabled="disabled || isRecording"
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

      <!-- Botón para grabar audio -->
      <v-btn
        v-if="hasVoiceCapability"
        variant="text"
        icon
        :disabled="disabled"
        :color="isRecording ? 'error' : ''"
        @click="toggleRecording"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchCancel"
      >
        <v-icon v-if="!isRecording" icon="mdi-microphone" />
        <v-icon v-else icon="mdi-microphone-off" />
        <v-tooltip activator="parent" location="top">
          {{ isRecording ? $t('chat.stopAudioRecording') : $t('chat.startAudioRecording') }}
        </v-tooltip>
      </v-btn>
    </div>

    <!-- Contenedor de texto -->
    <div class="text-input-container">
      <!-- Indicador de grabación -->
      <transition name="fade">
        <div
          v-if="isRecording"
          class="recording-indicator"
        >
          <v-icon icon="mdi-record-circle" color="error" size="small" />
          <span class="recording-text">{{ recordingTime }}</span>
        </div>
      </transition>

      <!-- Input de texto -->
      <v-textarea
        ref="textarea"
        v-model="messageText"
        :placeholder="placeholder"
        :disabled="disabled || isRecording"
        :rows="1"
        :max-rows="6"
        auto-grow
        density="comfortable"
        variant="outlined"
        hide-details
        :no-resize="true"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter.exact="handleEnterKey"
        @keydown.enter.shift="handleShiftEnter"
        @keydown.esc="handleEscape"
        @input="handleInput"
        @paste="handlePaste"
      />

      <!-- Botón para enviar (solo mobile cuando hay texto) -->
      <v-btn
        v-if="isMobile"
        variant="text"
        icon
        color="primary"
        :disabled="!canSend"
        @click="sendMessage"
      >
        <v-icon icon="mdi-send" />
        <v-tooltip activator="parent" location="top">
          {{ $t('chat.send') }}
        </v-tooltip>
      </v-btn>
    </div>

    <!-- Contenedor de acciones de la derecha -->
    <div class="input-actions right-actions">
      <!-- Botón para enviar emoji -->
      <v-btn
        variant="text"
        icon
        :disabled="disabled || isRecording"
        @click="toggleEmojiPicker"
      >
        <v-icon icon="mdi-emoticon-happy-outline" />
        <v-tooltip activator="parent" location="top">
          {{ $t('chat.emoji') }}
        </v-tooltip>
      </v-btn>

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
            :disabled="disabled || isRecording"
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

      <!-- Botón para enviar (desktop) -->
      <v-btn
        v-if="!isMobile"
        color="primary"
        variant="elevated"
        :disabled="!canSend"
        :size="isCompact ? 'small' : 'default'"
        rounded
        @click="sendMessage"
      >
        <v-icon icon="mdi-send" start />
        {{ $t('chat.send') }}
      </v-btn>
    </div>

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

// ============================================
// COMPUTED
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);

const canSend = computed(() => {
  return messageText.value.trim().length > 0 || isRecording.value;
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
  await nextTick();
  if (textarea.value?.$el) {
    textarea.value.$el.style.height = 'auto';
    textarea.value.$el.style.height = `${textarea.value.$el.scrollHeight}px`;
  }
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
    stopRecording();
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

const startRecording = async () => {
  try {
    if (!isVoiceAvailable.value) {
      snackbar?.error('La grabación de voz no está disponible en este navegador');
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
    
    // Crear el MediaRecorder
    mediaRecorder.value = new MediaRecorder(audioStream.value, {
      mimeType: 'audio/webm',
    });
    
    // Configurar eventos
    mediaRecorder.value.ondataavailable = (event) => {
      audioChunks.value.push(event.data);
    };
    
    mediaRecorder.value.onstop = () => {
      // Combinar los chunks y enviar
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm',
      });
      
      emit('send:voice', audioFile);
      
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
    
    snackbar?.show({ text: 'Grabando... Suelta para enviar', color: 'info' });
  } catch (error) {
    console.error('Error al iniciar la grabación:', error);
    if (error.name === 'NotAllowedError') {
      snackbar?.error('Permiso de micrófono denegado');
    } else {
      snackbar?.error('Error al iniciar la grabación');
    }
    emit('record:error', error);
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

const startRecordingTimer = () => {
  recordingInterval.value = setInterval(() => {
    const elapsed = Date.now() - recordingStartTime.value;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    recordingTime.value = `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
};

const stopRecordingTimer = () => {
  if (recordingInterval.value) {
    clearInterval(recordingInterval.value);
    recordingInterval.value = null;
  }
  recordingTime.value = '00:00';
};

const handleTouchStart = async (event) => {
  if (isMobile.value) {
    event.preventDefault();
    await startRecording();
  }
};

const handleTouchEnd = async (event) => {
  if (isMobile.value && isRecording.value) {
    event.preventDefault();
    await stopRecording();
  }
};

const handleTouchCancel = async () => {
  if (isRecording.value) {
    await stopRecording();
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
  stopRecording();
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
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  
  &.is-focused {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  }
  
  &.is-recording {
    background-color: rgba(244, 67, 54, 0.05);
    border: 1px solid rgba(244, 67, 54, 0.3);
  }
  
  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  &.mobile {
    padding: 6px 8px;
    
    .text-input-container {
      flex: 1;
    }
    
    .input-actions {
      &.left-actions {
        gap: 2px;
      }
      &.right-actions {
        display: none;
      }
    }
  }
  
  .input-actions {
    display: flex;
    gap: 4px;
    
    .v-btn {
      min-width: 36px;
      width: 36px;
      height: 36px;
      padding: 0;
      
      .v-icon {
        font-size: 1.1rem;
      }
      
      &.v-btn--disabled {
        opacity: 0.5;
      }
    }
  }
  
  .text-input-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    position: relative;
    
    .recording-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #FF5252;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 2px 6px;
      background-color: rgba(244, 67, 54, 0.1);
      border-radius: 4px;
      align-self: flex-start;
    }
    
    :deep(.v-textarea) {
      .v-field {
        padding: 4px 8px;
      }
      
      .v-field__input {
        padding: 0;
        min-height: 24px;
        
        textarea {
          font-size: 0.95rem;
          line-height: 1.4;
          resize: none;
          padding: 4px 0;
          min-height: 24px;
          max-height: 150px;
          
          &::placeholder {
            color: rgba(0, 0, 0, 0.54);
          }
          
          &:focus {
            outline: none;
          }
        }
      }
      
      .v-field__outline {
        display: none;
      }
      
      .v-field--disabled {
        opacity: 1;
        
        .v-field__input {
          textarea {
            color: rgba(0, 0, 0, 0.54);
          }
        }
      }
    }
    
    .recording-text {
      font-family: monospace;
    }
  }
  
  .right-actions {
    .v-btn {
      min-width: auto;
      padding: 0 8px;
    }
  }
}

// Diálogo de emojis
.emoji-dialog {
  .v-card {
    border-radius: 12px;
  }
  
  .v-card-title {
    padding: 8px 12px 4px;
    
    :deep(.v-text-field) {
      .v-field {
        padding: 0 8px;
      }
      
      .v-field__input {
        input {
          font-size: 0.85rem;
        }
      }
    }
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
      overflow-x: auto;
      
      .category-tab {
        flex: 1;
        min-width: fit-content;
        font-size: 0.8rem;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        
        &.active {
          background-color: rgba(24, 103, 192, 0.1);
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
        min-width: auto;
        width: auto;
        height: auto;
        padding: 4px;
        
        &:hover {
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        
        .emoji-char {
          font-size: 1.5rem;
          display: block;
        }
      }
    }
  }
}

// Transiciones
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

// Responsive
@media (max-width: 768px) {
  .message-input {
    .input-actions {
      gap: 0;
    }
    
    .v-btn {
      min-width: 32px;
      width: 32px;
      height: 32px;
    }
  }
}
</style>
