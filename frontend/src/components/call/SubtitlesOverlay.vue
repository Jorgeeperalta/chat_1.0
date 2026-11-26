<!--
 * @file SubtitlesOverlay.vue
 * @description Subtítulos en vivo: escucha el text stream "lk.transcription" que publica el
 * agente, se queda con los del idioma elegido y muestra los últimos 3 con el nombre de quien habló.
 * Si la frase ya estaba en el idioma elegido, el agente la manda tal cual (sin traducir).
 -->

<template>
  <div v-if="enabled && lines.length" class="subtitles" aria-live="polite">
    <TransitionGroup name="subtitle">
      <p v-for="line in lines" :key="line.id" class="subtitles__line">
        <span class="subtitles__speaker" :style="{ color: line.color }">{{ line.speaker }}:</span>
        {{ line.text }}
      </p>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { getAvatarColor } from '@/utils/conversationDisplay';

const CAPTIONS_TOPIC = 'lk.transcription';

const props = defineProps({
  // Room de livekit-client (o null mientras conecta)
  room: { type: Object, default: null },
  language: { type: String, required: true },
  enabled: { type: Boolean, default: true },
});

const MAX_LINES = 3;
// Un subtítulo viejo se va solo aunque nadie siga hablando
const LINE_TTL_MS = 9000;

const lines = ref([]);
let registeredRoom = null;

const addLine = (line) => {
  lines.value = [...lines.value.filter(item => item.id !== line.id), line].slice(-MAX_LINES);
  setTimeout(() => {
    lines.value = lines.value.filter(item => item.id !== line.id);
  }, LINE_TTL_MS);
};

const onCaption = async (reader, participantInfo) => {
  const attributes = reader.info?.attributes || {};
  const text = (await reader.readAll()).trim();
  if (!text) return;
  // Solo el idioma elegido; y lo que dice uno mismo no se muestra
  if (attributes.language !== props.language) return;
  if (attributes.speaker_identity && attributes.speaker_identity === props.room?.localParticipant?.identity) return;

  const speakerIdentity = attributes.speaker_identity || participantInfo?.identity || '';
  const userId = Number(String(speakerIdentity).replace(/^user-/, '')) || speakerIdentity;
  addLine({
    id: attributes['lk.segment_id'] || `${Date.now()}-${Math.random()}`,
    speaker: attributes.speaker_name || speakerIdentity,
    color: getAvatarColor(userId),
    text,
  });
};

const register = (room) => {
  if (registeredRoom === room) return;
  unregister();
  if (!room) return;
  room.registerTextStreamHandler(CAPTIONS_TOPIC, onCaption);
  registeredRoom = room;
};

const unregister = () => {
  try { registeredRoom?.unregisterTextStreamHandler(CAPTIONS_TOPIC); } catch { /* ya no estaba */ }
  registeredRoom = null;
};

watch(() => props.room, register, { immediate: true });
// Al cambiar de idioma no se mezclan subtítulos de dos idiomas
watch(() => props.language, () => { lines.value = []; });

onBeforeUnmount(unregister);
</script>

<style lang="scss" scoped>
.subtitles {
  position: absolute;
  left: 50%;
  // Justo encima de la botonera (CallView mide su alto en --call-controls-height)
  bottom: calc(var(--call-controls-height, 64px) + max(16px, env(safe-area-inset-bottom)) + 10px);
  z-index: 3;
  width: min(92%, 860px);
  transform: translateX(-50%);
  pointer-events: none;
  text-align: center;
}

// Una línea debajo de la otra, cada una del ancho de su texto
.subtitles__line {
  display: table;
  margin: 3px auto;
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: clamp(0.95rem, 2.4vw, 1.25rem);
  line-height: 1.4;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  overflow-wrap: anywhere;
}

.subtitles__speaker {
  margin-right: 4px;
  font-weight: 700;
  filter: brightness(1.6);
}

.subtitle-enter-from,
.subtitle-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.subtitle-enter-active,
.subtitle-leave-active {
  transition: all 0.2s ease;
}
</style>
