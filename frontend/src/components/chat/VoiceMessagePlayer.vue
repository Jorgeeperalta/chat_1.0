
<!--
 * @file VoiceMessagePlayer.vue
 * @description Reproductor de mensajes de voz
 * @author Arquitecto de Software Senior
 -->

<template>
  <div
    class="voice-message-player"
    :class="[
      { 'is-playing': playing },
      { 'is-loading': isLoading },
      { 'is-error': isError },
      { 'is-current-user': isCurrentUser },
    ]"
  >
    <!-- Botón de reproducción -->
    <v-btn
      class="play-button"
      icon
      size="small"
      variant="flat"
      :loading="isLoading"
      :disabled="isError"
      :aria-label="playing ? 'Pausar audio' : 'Reproducir audio'"
      @click.stop="togglePlay"
    >
      <v-icon :icon="isError ? 'mdi-alert-circle-outline' : (playing ? 'mdi-pause' : 'mdi-play')" />
    </v-btn>

    <div class="player-body">
      <!-- Onda de sonido (clic para saltar a una posición) -->
      <div
        class="waveform"
        role="slider"
        aria-label="Posición del audio"
        :aria-valuenow="Math.round(progress)"
        aria-valuemin="0"
        aria-valuemax="100"
        @click.stop="handleWaveformClick"
      >
        <span
          v-for="(height, index) in bars"
          :key="index"
          class="waveform-bar"
          :class="{ 'is-played': (index / bars.length) * 100 < progress }"
          :style="{ height: `${height}%` }"
        />
      </div>

      <!-- Tiempo -->
      <div class="player-meta">
        <span class="time-text">
          {{ isError ? 'No se pudo cargar el audio' : (playing || currentTime > 0 ? formattedCurrentTime : formattedDuration) }}
        </span>
        <button
          v-if="!isError"
          type="button"
          class="speed-button"
          :aria-label="`Velocidad ${speedLabel}`"
          @click.stop="toggleSpeed"
        >
          {{ speedLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
// Compartido entre todas las instancias: solo un audio suena a la vez en toda la app
let activePlayer = null;
</script>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue';

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
// ESTADO LOCAL
// ============================================

const BAR_COUNT = 32;
const SPEEDS = [1, 1.5, 2];

const audioElement = ref(null);
const playing = ref(false);
const isLoading = ref(false);
const isError = ref(false);
const currentTime = ref(0);
const mediaDuration = ref(0);
const playSpeed = ref(1);

// ============================================
// COMPUTED
// ============================================

// Las grabaciones webm de MediaRecorder suelen no tener duración (Infinity) en los
// metadatos, así que se prioriza la duración informada por el backend.
const totalDuration = computed(() => {
  if (props.duration > 0) return props.duration;
  return Number.isFinite(mediaDuration.value) ? mediaDuration.value : 0;
});

const progress = computed(() => {
  if (totalDuration.value <= 0) return 0;
  return Math.min(100, (currentTime.value / totalDuration.value) * 100);
});

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe % 60).toString().padStart(2, '0')}`;
};

const formattedDuration = computed(() => formatTime(totalDuration.value));
const formattedCurrentTime = computed(() => formatTime(currentTime.value));
const speedLabel = computed(() => `${playSpeed.value}x`);

// Barras de la onda: se usan los datos reales si existen; si no, una forma
// pseudoaleatoria estable derivada de la URL (siempre igual para el mismo audio)
const bars = computed(() => {
  if (props.waveformData.length > 0) {
    const max = Math.max(...props.waveformData, 1);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const value = props.waveformData[Math.floor((i / BAR_COUNT) * props.waveformData.length)] || 0;
      return 20 + (value / max) * 80;
    });
  }
  let seed = [...props.audioUrl].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
  return Array.from({ length: BAR_COUNT }, () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return 25 + (seed % 75);
  });
});

// ============================================
// AUDIO
// ============================================

const handleTimeUpdate = () => {
  currentTime.value = audioElement.value?.currentTime || 0;
};

const handleLoadedMetadata = () => {
  mediaDuration.value = audioElement.value?.duration || 0;
};

const handleEnded = () => {
  playing.value = false;
  currentTime.value = 0;
  emit('ended');
};

const handleAudioError = (event) => {
  console.error('Error de audio:', props.audioUrl, event);
  playing.value = false;
  isLoading.value = false;
  isError.value = true;
  emit('error', event);
};

const ensureAudio = () => {
  if (audioElement.value) return audioElement.value;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = props.audioUrl;
  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('error', handleAudioError);
  audioElement.value = audio;
  return audio;
};

const destroyAudio = () => {
  const audio = audioElement.value;
  if (!audio) return;
  audio.pause();
  audio.removeEventListener('timeupdate', handleTimeUpdate);
  audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
  audio.removeEventListener('ended', handleEnded);
  audio.removeEventListener('error', handleAudioError);
  audio.removeAttribute('src');
  audio.load();
  audioElement.value = null;
};

const play = async () => {
  const audio = ensureAudio();
  if (activePlayer && activePlayer !== controls) {
    activePlayer.pause();
  }
  activePlayer = controls;

  try {
    isLoading.value = true;
    isError.value = false;
    audio.playbackRate = playSpeed.value;
    await audio.play();
    playing.value = true;
    emit('play');
  } catch (error) {
    // Cancelado por una pausa inmediata: no es un error real
    if (error?.name !== 'AbortError') {
      handleAudioError(error);
    }
  } finally {
    isLoading.value = false;
  }
};

const pause = () => {
  if (!audioElement.value) return;
  audioElement.value.pause();
  playing.value = false;
  emit('pause');
};

const stop = () => {
  if (!audioElement.value) return;
  audioElement.value.pause();
  audioElement.value.currentTime = 0;
  currentTime.value = 0;
  playing.value = false;
  emit('stop');
};

const seek = (time) => {
  const audio = ensureAudio();
  const max = totalDuration.value || audio.duration || 0;
  const newTime = Math.max(0, Math.min(max, time));
  audio.currentTime = newTime;
  currentTime.value = newTime;
  emit('seek', newTime);
};

const controls = { pause };

const togglePlay = () => {
  if (isLoading.value || isError.value) return;
  if (playing.value) {
    pause();
  } else {
    play();
  }
};

const handleWaveformClick = (event) => {
  if (isError.value || totalDuration.value <= 0) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  seek(ratio * totalDuration.value);
  if (!playing.value) {
    play();
  }
};

const toggleSpeed = () => {
  const index = SPEEDS.indexOf(playSpeed.value);
  playSpeed.value = SPEEDS[(index + 1) % SPEEDS.length];
  if (audioElement.value) {
    audioElement.value.playbackRate = playSpeed.value;
  }
  emit('speed-change', playSpeed.value);
};

// ============================================
// WATCHERS
// ============================================

// Control externo (opcional) mediante la prop isPlaying
watch(() => props.isPlaying, (shouldPlay) => {
  if (shouldPlay && !playing.value) play();
  if (!shouldPlay && playing.value) pause();
});

// Si cambia la URL (p. ej. el mensaje optimista pasa a la URL del servidor)
watch(() => props.audioUrl, () => {
  destroyAudio();
  playing.value = false;
  currentTime.value = 0;
  mediaDuration.value = 0;
  isError.value = false;
});

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  if (activePlayer === controls) {
    activePlayer = null;
  }
  destroyAudio();
});

// Exponer métodos al padre
defineExpose({
  play,
  pause,
  stop,
  seek,
  getCurrentTime: () => currentTime.value,
  getDuration: () => totalDuration.value,
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
// Usa currentColor para adaptarse a la burbuja (blanco en enviados, texto en recibidos)
.voice-message-player {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
  max-width: 320px;
  padding: 2px 0;
  color: inherit;

  .play-button {
    flex-shrink: 0;
    background-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
  }

  &.is-current-user .play-button {
    background-color: rgba(255, 255, 255, 0.92);
    color: rgb(var(--v-theme-primary));
  }

  .player-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .waveform {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    cursor: pointer;

    .waveform-bar {
      flex: 1;
      min-width: 2px;
      border-radius: 2px;
      background-color: currentColor;
      opacity: 0.3;
      transition: opacity 0.15s ease;

      &.is-played {
        opacity: 0.95;
      }
    }
  }

  .player-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.72rem;

    .time-text {
      opacity: 0.8;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .speed-button {
      padding: 0 6px;
      border-radius: 999px;
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
      font-size: 0.68rem;
      font-weight: 600;
      line-height: 1.5;
      opacity: 0.75;
      cursor: pointer;

      &:hover {
        opacity: 1;
      }
    }
  }

  &.is-error {
    .waveform {
      cursor: default;
      opacity: 0.5;
    }

    .time-text {
      color: rgb(var(--v-theme-error));
    }
  }
}
</style>
