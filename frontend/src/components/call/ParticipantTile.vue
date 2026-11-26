<!--
 * @file ParticipantTile.vue
 * @description Un participante de la videollamada: su cámara (o su pantalla compartida), su
 * nombre y si tiene el micrófono apagado. Sin video, muestra su avatar.
 -->

<template>
  <div
    class="participant-tile"
    :class="{ 'is-speaking': speaking, 'is-screen': source === 'screen' }"
  >
    <video
      v-show="hasVideo"
      ref="videoEl"
      class="participant-tile__video"
      :class="{ 'is-mirrored': isLocal && source === 'camera' }"
      autoplay
      playsinline
      muted
    />

    <div v-if="!hasVideo" class="participant-tile__placeholder">
      <v-avatar size="72" :color="avatarUrl ? undefined : avatarColor">
        <v-img v-if="avatarUrl" :src="avatarUrl" cover />
        <span v-else class="text-h5 text-white font-weight-bold">{{ initials }}</span>
      </v-avatar>
    </div>

    <div class="participant-tile__label">
      <v-icon v-if="source === 'screen'" icon="mdi-monitor-share" size="14" />
      <v-icon v-else-if="!micOn" icon="mdi-microphone-off" size="14" color="error" />
      <span>{{ label }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Track } from 'livekit-client';
import { getAvatarColor, getInitials } from '@/utils/conversationDisplay';
import { resolveMediaUrl } from '@/utils/media';

const props = defineProps({
  participant: { type: Object, required: true },
  // camera | screen
  source: { type: String, default: 'camera' },
  isLocal: { type: Boolean, default: false },
  speaking: { type: Boolean, default: false },
  // Cambia cuando cambian las pistas (useLiveKitRoom.revision)
  revision: { type: Number, default: 0 },
});

const { t } = useI18n();
const videoEl = ref(null);
let attachedTrack = null;

const metadata = computed(() => {
  try { return JSON.parse(props.participant.metadata || '{}'); } catch { return {}; }
});
const avatarUrl = computed(() => resolveMediaUrl(metadata.value.avatarUrl));
const avatarColor = computed(() => getAvatarColor(metadata.value.userId || props.participant.identity));
const name = computed(() => props.participant.name || props.participant.identity);
const initials = computed(() => getInitials(name.value));
const label = computed(() => {
  const who = props.isLocal ? t('call.you') : name.value;
  return props.source === 'screen' ? t('call.screenOf', { name: who }) : who;
});

const videoTrack = () => {
  const source = props.source === 'screen' ? Track.Source.ScreenShare : Track.Source.Camera;
  const publication = props.participant.getTrackPublication(source);
  return publication && !publication.isMuted ? publication.track || null : null;
};

const hasVideo = ref(false);
const micOn = ref(true);

// En qué <video> quedó enganchada la pista: la primera vez el elemento todavía no existe
let attachedTo = null;

// Las pistas cambian dentro del mismo objeto participante: se relee todo en cada "revision"
const sync = () => {
  micOn.value = props.participant.isMicrophoneEnabled;
  const track = videoTrack();
  const element = videoEl.value;

  if (attachedTrack && (attachedTrack !== track || attachedTo !== element)) {
    if (attachedTo) attachedTrack.detach(attachedTo);
    attachedTrack = null;
    attachedTo = null;
  }
  if (track && element && attachedTrack !== track) {
    track.attach(element);
    attachedTrack = track;
    attachedTo = element;
  }
  hasVideo.value = Boolean(track);
};

watch(() => [props.participant, props.source, props.revision, videoEl.value], sync, { immediate: true, flush: 'post' });

onBeforeUnmount(() => {
  if (attachedTrack && attachedTo) attachedTrack.detach(attachedTo);
  attachedTrack = null;
  attachedTo = null;
});
</script>

<style lang="scss" scoped>
.participant-tile {
  position: relative;
  overflow: hidden;
  min-height: 0;
  border: 2px solid transparent;
  border-radius: 14px;
  background: #1f2430;
  transition: border-color 0.15s ease;

  &.is-speaking {
    border-color: #4caf50;
  }

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;

    &.is-mirrored {
      transform: scaleX(-1);
    }
  }

  &.is-screen &__video {
    object-fit: contain;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  &__label {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: calc(100% - 16px);
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 0.8rem;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
