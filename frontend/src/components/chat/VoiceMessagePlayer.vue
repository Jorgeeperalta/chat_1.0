<!--
 * @file VoiceMessagePlayer.vue
 * @description Reproductor de mensajes de voz
 * @author Arquitecto de Software Senior
 -->

<template>
  <div
    class="voice-message-player"
    :class="[
      { 'is-playing': isPlaying },
      { 'is-paused': isPaused },
      { 'is-loading': isLoading },
      { 'is-error': isError }
    ]"
    @click="togglePlay"
  >
    <!-- Contenedor de la onda de sonido -->
    <div class="waveform-container">
      <svg
        ref="waveformSvg"
        class="waveform"
        :width="waveformWidth"
        :height="waveformHeight"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
      >
        <path
          v-if="waveformData.length > 0"
          :d="waveformPath"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
    </div>

    <!-- Botón de reproducción -->
    <div class="play-button">
      <v-icon
        v-if="isLoading"
        icon="mdi-loading"
        spin
        size="small"
      />
      <v-icon
        v-else-if="isPlaying"
        icon="mdi-pause-circle"
        size="small"
      />
      <v-icon
        v-else-if="isError"
        icon="mdi-alert-circle"
        size="small"
        color="error"
      />
      <v-icon
        v-else
        icon="mdi-play-circle"
        size="small"
      />
    </div>

    <!-- Duración y progreso -->
    <div class="duration-container">
      <span class="duration-text">{{ formattedDuration }}</span>
      <v-progress-linear
        v-if="!isError"
        :model-value="progress"
        color="primary"
        height="2"
        class="progress-bar"
      />
    </div>

    <!-- Icono de igualar (opcional) -->
    <v-tooltip location="top" v-if="!isCurrentUser">
      <template v-slot:activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          variant="text"
          icon
          size="x-small"
          color="grey"
          class="speed-button"
          @click.stop="toggleSpeed"
        >
          <v-icon :icon="speedIcon" size="small" />
        </v-btn>
      </template>
      {{ speedTooltip }}
    </v-tooltip>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useUserStore } from '@/stores/userStore';

// ============================================
// PROPS
// ============================================

const props = defineProps({
  audioUrl: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 0,
  },
  isPlaying: {
    type: Boolean,
    default: false,
  },
  isCurrentUser: {
    type: Boolean,
    default: false,
  },
  waveformData: {
    type: Array,
    default: () => [],
  },
  colors: {
    type: Object,
    default: () => ({
      primary: '#1867C0',
      secondary: '#5CBBF6',
      error: '#FF5252',
      success: '#4CAF50',
      background: '#F5F5F5',
      text: '#1E1E1E',
    }),
  },
});

// ============================================
// EMITS
// ============================================

const emit = defineEmits([
  'play',
  'pause',
  'stop',
  'seek',
  'ended',
  'error',
  'ready',
  'speed-change',
]);

// ============================================
// STORE
// ============================================

const userStore = useUserStore();

// ============================================
// ESTADO LOCAL
// ============================================

const audioElement = ref(null);
const waveformSvg = ref(null);
const isLoading = ref(false);
const isPaused = ref(false);
const isError = ref(false);
const currentTime = ref(0);
const playSpeed = ref(1.0);
const isDragging = ref(false);
const touchStartTime = ref(0);

// ============================================
// COMPUTED
// ============================================

const waveformWidth = computed(() => 100);
const waveformHeight = computed(() => 20);

const progress = computed(() => {
  if (props.duration <= 0) return 0;
  return (currentTime.value / props.duration) * 100;
});

const formattedDuration = computed(() => {
  if (props.duration <= 0) return '0:00';
  const minutes = Math.floor(props.duration / 60);
  const seconds = Math.floor(props.duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const formattedCurrentTime = computed(() => {
  if (currentTime.value <= 0) return '0:00';
  const minutes = Math.floor(currentTime.value / 60);
  const seconds = Math.floor(currentTime.value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const waveformPath = computed(() => {
  if (props.waveformData.length === 0) {
    // Forma de onda por defecto
    const defaultData = Array(50).fill().map((_, i) => 
      Math.abs(Math.sin(i / 5)) * 5 + 5
    );
    return buildWaveformPath(defaultData);
  }
  return buildWaveformPath(props.waveformData);
});

const speedIcon = computed(() => {
  switch (playSpeed.value) {
    case 0.5: return 'mdi-speedometer-slow';
    case 1.0: return 'mdi-speedometer-medium';
    case 1.5: return 'mdi-speedometer';
    case 2.0: return 'mdi-speedometer-fast';
    default: return 'mdi-speedometer-medium';
  }
});

const speedTooltip = computed(() => {
  switch (playSpeed.value) {
    case 0.5: return '0.5x';
    case 1.0: return '1x';
    case 1.5: return '1.5x';
    case 2.0: return '2x';
    default: return `${playSpeed.value}x`;
  }
});

const color = computed(() => {
  return props.isCurrentUser ? props.colors.primary : props.colors.secondary;
});

// ============================================
// MÉTODOS
// ============================================

const buildWaveformPath = (data) => {
  const pointsPerSegment = Math.ceil(data.length / 50);
  let path = '';
  
  for (let i = 0; i < 50; i++) {
    const segmentIndex = Math.floor(i * pointsPerSegment);
    const height = data[segmentIndex] || 10;
    const x = (i / 50) * 100;
    const y = 20 - (height / 20) * 20;
    
    if (i === 0) {
      path = `M ${x} ${y}`;
    } else {
      const prevSegmentIndex = Math.floor((i - 1) * pointsPerSegment);
      const prevHeight = data[prevSegmentIndex] || 10;
      const prevX = ((i - 1) / 50) * 100;
      const prevY = 20 - (prevHeight / 20) * 20;
      
      // Línea recta entre puntos
      path += ` L ${x} ${prevY}`;
      // Curva a la parte inferior
      path += ` L ${x} ${20}`;
    }
  }
  
  // Cerrar el path
  path += ' L 100 20 L 0 20 Z';
  
  return path;
};

const togglePlay = async () => {
  if (isLoading.value || isError.value) return;
  
  if (isPlaying.value || audioElement.value?.paused === false) {
    pause();
  } else {
    await play();
  }
};

const play = async () => {
  try {
    if (!audioElement.value) {
      await initializeAudio();
    }
    
    if (!audioElement.value) return;
    
    isLoading.value = true;
    isError.value = false;
    
    audioElement.value.currentTime = currentTime.value;
    audioElement.value.playbackRate = playSpeed.value;
    
    await audioElement.value.play();
    
    isLoading.value = false;
    isPlaying.value = true;
    isPaused.value = false;
    
    emit('play');
  } catch (error) {
    console.error('Error al reproducir audio:', error);
    isLoading.value = false;
    isError.value = true;
    emit('error', error);
  }
};

const pause = () => {
  if (!audioElement.value) return;
  
  audioElement.value.pause();
  isPlaying.value = false;
  isPaused.value = true;
  emit('pause');
};

const stop = () => {
  if (!audioElement.value) return;
  
  audioElement.value.pause();
  audioElement.value.currentTime = 0;
  currentTime.value = 0;
  isPlaying.value = false;
  isPaused.value = false;
  emit('stop');
};

const seek = (time) => {
  if (!audioElement.value) return;
  
  const newTime = Math.max(0, Math.min(props.duration, time));
  audioElement.value.currentTime = newTime;
  currentTime.value = newTime;
  emit('seek', newTime);
};

const toggleSpeed = () => {
  // Cambiar velocidad: 0.5x -> 1x -> 1.5x -> 2x -> 0.5x
  const speeds = [0.5, 1.0, 1.5, 2.0];
  const currentIndex = speeds.indexOf(playSpeed.value);
  const nextIndex = (currentIndex + 1) % speeds.length;
  playSpeed.value = speeds[nextIndex];
  
  if (audioElement.value) {
    audioElement.value.playbackRate = playSpeed.value;
  }
  
  emit('speed-change', playSpeed.value);
};

const initializeAudio = async () => {
  if (audioElement.value) return;
  
  try {
    audioElement.value = new Audio(props.audioUrl);
    
    // Configurar eventos
    audioElement.value.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.value.addEventListener('ended', handleEnded);
    audioElement.value.addEventListener('error', handleAudioError);
    audioElement.value.addEventListener('canplay', handleCanPlay);
    audioElement.value.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Configurar velocidad
    audioElement.value.playbackRate = playSpeed.value;
    
    // Pre-cargar el audio
    await audioElement.value.load();
    
    emit('ready');
  } catch (error) {
    console.error('Error al inicializar audio:', error);
    isError.value = true;
    emit('error', error);
  }
};

const handleTimeUpdate = () => {
  if (!audioElement.value || isDragging.value) return;
  
  currentTime.value = audioElement.value.currentTime;
};

const handleEnded = () => {
  stop();
  emit('ended');
};

const handleAudioError = (event) => {
  console.error('Error de audio:', event);
  isError.value = true;
  isLoading.value = false;
  emit('error', event);
};

const handleCanPlay = () => {
  isLoading.value = false;
};

const handleLoadedMetadata = () => {
  // Actualizar duración si no se proporciona
  if (props.duration <= 0 && audioElement.value?.duration > 0) {
    emit('update:duration', audioElement.value.duration);
  }
};

const handleTouchStart = (event) => {
  touchStartTime.value = Date.now();
};

const handleTouchMove = (event) => {
  if (!audioElement.value || !props.duration) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const clickX = event.touches[0].clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
  const newTime = (percentage / 100) * props.duration;
  
  currentTime.value = newTime;
};

const handleTouchEnd = (event) => {
  if (!audioElement.value || !props.duration) return;
  
  const duration = Date.now() - touchStartTime.value;
  
  // Si fue un click rápido, toggle play
  if (duration < 200) {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.changedTouches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const newTime = (percentage / 100) * props.duration;
    
    audioElement.value.currentTime = newTime;
    currentTime.value = newTime;
    
    // Si ya estaba reproduciendo, continuar
    if (isPlaying.value) {
      audioElement.value.play();
    }
  }
  
  touchStartTime.value = 0;
};

// ============================================
// WATCHERS
// ============================================

watch(() => props.isPlaying, (newValue) => {
  if (newValue === true && !isPlaying.value) {
    play();
  } else if (newValue === false && isPlaying.value) {
    pause();
  }
}, { immediate: false });

watch(() => props.audioUrl, (newUrl) => {
  // Reinicializar si cambia la URL
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value.src = newUrl;
    audioElement.value.load();
  } else {
    initializeAudio();
  }
});

// ============================================
// MONTAJE
// ============================================

onMounted(async () => {
  await nextTick();
  await initializeAudio();
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value.removeEventListener('timeupdate', handleTimeUpdate);
    audioElement.value.removeEventListener('ended', handleEnded);
    audioElement.value.removeEventListener('error', handleAudioError);
    audioElement.value.removeEventListener('canplay', handleCanPlay);
    audioElement.value.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }
  audioElement.value = null;
});

// Exponer métodos al padre
defineExpose({
  play,
  pause,
  stop,
  seek,
  getCurrentTime: () => currentTime.value,
  getDuration: () => props.duration || audioElement.value?.duration || 0,
  setSpeed: (speed) => {
    playSpeed.value = speed;
    if (audioElement.value) {
      audioElement.value.playbackRate = speed;
    }
  },
  getSpeed: () => playSpeed.value,
});
</script>

<style lang="scss" scoped>
.voice-message-player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-width: 150px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    
    .waveform {
      opacity: 0.8;
    }
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  .waveform-container {
    flex: 1;
    height: 20px;
    
    .waveform {
      width: 100%;
      height: 100%;
      display: block;
      color: v-bind(color);
      transition: opacity 0.2s ease;
      opacity: 0.6;
    }
  }
  
  .play-button {
    flex-shrink: 0;
    color: v-bind(color);
    transition: transform 0.2s ease;
    
    .v-icon {
      opacity: 0.8;
      
      &:hover {
        opacity: 1;
      }
    }
  }
  
  .duration-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 40px;
    
    .duration-text {
      font-size: 0.7rem;
      color: v-bind('color');
      opacity: 0.7;
      white-space: nowrap;
    }
    
    .progress-bar {
      width: 100%;
      
      :deep(.v-progress-linear__background) {
        opacity: 0.3;
      }
      
      :deep(.v-progress-linear__bar) {
        border-radius: 1px;
      }
    }
  }
  
  .speed-button {
    opacity: 0.6;
    transition: opacity 0.2s ease;
    
    &:hover {
      opacity: 1;
    }
  }
  
  &.is-playing {
    .waveform {
      animation: pulse 1s ease-in-out infinite;
    }
  }
  
  &.is-loading {
    cursor: wait;
    opacity: 0.7;
    
    .waveform {
      opacity: 0.4;
    }
  }
  
  &.is-error {
    .waveform {
      color: v-bind('props.colors.error') !important;
      opacity: 0.4;
    }
    
    .play-button {
      color: v-bind('props.colors.error') !important;
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
}

// Estilos táctiles
@media (hover: none) and (pointer: coarse) {
  .voice-message-player {
    .speed-button {
      display: none;
    }
  }
}
</style>
