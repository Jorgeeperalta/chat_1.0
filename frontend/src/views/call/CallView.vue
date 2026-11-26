<!--
 * @file CallView.vue
 * @description Videollamada de una conversación: grilla de participantes, subtítulos traducidos
 * y controles (micrófono, cámara, pantalla compartida, subtítulos, idioma y colgar).
 * ?join=1 al sumarse a una llamada en curso (no vuelve a sonarle a los demás).
 -->

<template>
  <div class="call-view" :style="{ '--call-controls-height': `${controlsHeight}px` }">
    <!-- Encabezado -->
    <header class="call-header">
      <v-btn icon="mdi-chevron-down" variant="text" color="white" :aria-label="$t('call.backToChat')" @click="hangUp" />
      <div class="call-header__title">
        <h1>{{ title }}</h1>
        <span>{{ statusText }}</span>
      </div>
    </header>

    <!-- Conectando / error -->
    <div v-if="phase !== 'in-call'" class="call-center">
      <template v-if="phase === 'error'">
        <v-icon icon="mdi-video-off-outline" size="48" color="white" />
        <p class="mt-3">{{ errorText }}</p>
        <v-btn color="white" variant="tonal" class="mt-4" @click="hangUp">{{ $t('call.backToChat') }}</v-btn>
      </template>
      <template v-else>
        <v-progress-circular indeterminate color="white" size="48" />
        <p class="mt-3">{{ $t('call.connecting') }}</p>
      </template>
    </div>

    <!-- Participantes -->
    <main v-else class="call-grid" :class="`call-grid--${Math.min(tiles.length, 6)}`">
      <ParticipantTile
        v-for="tile in tiles"
        :key="tile.key"
        :participant="tile.participant"
        :source="tile.source"
        :is-local="tile.isLocal"
        :speaking="activeSpeakers.has(tile.participant.identity) && tile.source === 'camera'"
        :revision="revision"
      />
      <p v-if="tiles.length === 1" class="call-waiting">{{ $t('call.waiting') }}</p>
    </main>

    <SubtitlesOverlay :room="room" :language="subtitleLanguage" :enabled="subtitlesOn && phase === 'in-call'" />

    <!-- El navegador bloqueó el audio hasta que se toque la pantalla -->
    <v-btn
      v-if="audioBlocked && phase === 'in-call'"
      class="call-audio-unlock"
      color="warning"
      prepend-icon="mdi-volume-high"
      @click="startAudio"
    >
      {{ $t('call.enableAudio') }}
    </v-btn>

    <!-- Controles -->
    <footer v-if="phase === 'in-call'" ref="controlsEl" class="call-controls">
      <v-btn
        :icon="micEnabled ? 'mdi-microphone' : 'mdi-microphone-off'"
        :color="micEnabled ? 'grey-darken-3' : 'error'"
        :aria-label="micEnabled ? $t('call.muteMic') : $t('call.unmuteMic')"
        :title="micEnabled ? $t('call.muteMic') : $t('call.unmuteMic')"
        @click="toggleMicrophone"
      />
      <v-btn
        :icon="cameraEnabled ? 'mdi-video' : 'mdi-video-off'"
        :color="cameraEnabled ? 'grey-darken-3' : 'error'"
        :aria-label="cameraEnabled ? $t('call.cameraOff') : $t('call.cameraOn')"
        :title="cameraEnabled ? $t('call.cameraOff') : $t('call.cameraOn')"
        @click="toggleCamera"
      />
      <v-btn
        v-if="canShareScreen"
        icon="mdi-monitor-share"
        :color="screenSharing ? 'primary' : 'grey-darken-3'"
        :aria-label="screenSharing ? $t('call.stopShare') : $t('call.shareScreen')"
        :title="screenSharing ? $t('call.stopShare') : $t('call.shareScreen')"
        @click="toggleScreenShare"
      />
      <v-btn
        :icon="subtitlesOn ? 'mdi-closed-caption' : 'mdi-closed-caption-outline'"
        :color="subtitlesOn ? 'primary' : 'grey-darken-3'"
        :aria-label="subtitlesOn ? $t('call.subtitlesOff') : $t('call.subtitlesOn')"
        :title="subtitlesOn ? $t('call.subtitlesOff') : $t('call.subtitlesOn')"
        @click="toggleSubtitles"
      />
      <v-menu location="top">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            color="grey-darken-3"
            class="call-language-btn"
            :aria-label="$t('call.subtitleLanguage')"
            :title="$t('call.subtitleLanguage')"
          >
            <v-icon icon="mdi-translate" start />
            {{ subtitleLanguage.toUpperCase() }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-subheader>{{ $t('call.subtitleLanguage') }}</v-list-subheader>
          <v-list-item
            v-for="option in SUBTITLE_LANGUAGES"
            :key="option.code"
            :title="option.name"
            :active="option.code === subtitleLanguage"
            @click="changeSubtitleLanguage(option.code)"
          />
        </v-list>
      </v-menu>
      <v-btn icon="mdi-phone-hangup" color="error" :aria-label="$t('call.hangUp')" :title="$t('call.hangUp')" @click="hangUp" />
    </footer>

    <v-snackbar v-model="mediaWarning" color="warning" timeout="6000" location="top">
      {{ $t('call.mediaError') }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useCallStore } from '@/stores/callStore';
import { useLiveKitRoom, Track } from '@/composables/useLiveKitRoom';
import ParticipantTile from '@/components/call/ParticipantTile.vue';
import SubtitlesOverlay from '@/components/call/SubtitlesOverlay.vue';
import { getConversationTitle } from '@/utils/conversationDisplay';

const props = defineProps({
  conversationId: { type: [String, Number], required: true },
});

// Cada idioma con su propio nombre (así se reconoce aunque la app esté en otro idioma)
const SUBTITLE_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
];
const CAPTIONS_LANGUAGE_ATTRIBUTE = 'captions_language';
const SUBTITLES_KEY = 'chat_app_subtitles_on';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const conversationStore = useConversationStore();
const callStore = useCallStore();

const {
  room, state, error, mediaError, participants, activeSpeakers, revision,
  micEnabled, cameraEnabled, screenSharing, audioBlocked,
  connect, leave, toggleMicrophone, toggleCamera, toggleScreenShare, startAudio,
} = useLiveKitRoom();

const phase = ref('connecting'); // connecting | in-call | error
const errorText = ref('');
const subtitleLanguage = ref(authStore.user?.subtitle_language || 'es');
const subtitlesOn = ref((() => {
  try { return localStorage.getItem(SUBTITLES_KEY) !== '0'; } catch { return true; }
})());
const mediaWarning = ref(false);

// Alto real de la botonera: los subtítulos van siempre por encima (aunque ocupe dos filas)
const controlsEl = ref(null);
const controlsHeight = ref(64);
const controlsObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(([entry]) => { controlsHeight.value = Math.ceil(entry.target.offsetHeight); })
  : null;
watch(controlsEl, (element, previous) => {
  if (previous) controlsObserver?.unobserve(previous);
  if (element) controlsObserver?.observe(element);
});
onBeforeUnmount(() => controlsObserver?.disconnect());
const canShareScreen = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

const conversation = computed(() =>
  conversationStore.conversations?.find?.(item => Number(item.id) === Number(props.conversationId)) || null
);
const title = computed(() => (conversation.value ? getConversationTitle(conversation.value, authStore.user?.id) : t('call.title')));

const statusText = computed(() => {
  if (state.value === 'reconnecting') return t('call.reconnecting');
  if (phase.value !== 'in-call') return t('call.connecting');
  return t('call.participants', { n: participants.value.length });
});

// Una baldosa por cámara y otra por cada pantalla compartida (la pantalla va primero)
const tiles = computed(() => {
  const localIdentity = room.value?.localParticipant?.identity;
  const list = [];
  for (const participant of participants.value) {
    const isLocal = participant.identity === localIdentity;
    if (participant.getTrackPublication(Track.Source.ScreenShare)) {
      list.unshift({ key: `${participant.identity}-screen`, participant, source: 'screen', isLocal });
    }
    list.push({ key: `${participant.identity}-camera`, participant, source: 'camera', isLocal });
  }
  return list;
});

watch(mediaError, (value) => { if (value) mediaWarning.value = true; });
watch(state, (value) => {
  if (value === 'disconnected' && phase.value === 'in-call') router.replace(chatRoute());
});

const chatRoute = () => ({ name: 'conversation', params: { conversationId: props.conversationId } });

const join = async () => {
  try {
    const conversationId = Number(props.conversationId);
    const created = await api.post('/api/rooms', { conversationId, notify: route.query.join !== '1' });
    const { data } = await api.post('/api/livekit/token', { roomName: created.data.roomName });
    subtitleLanguage.value = data.subtitleLanguage || subtitleLanguage.value;
    await connect(data.url, data.token);
    phase.value = 'in-call';
  } catch (joinError) {
    const status = joinError.response?.status;
    errorText.value = status === 503 ? t('call.notConfigured')
      : status === 403 ? t('call.notMember')
        : t('call.connectError');
    phase.value = 'error';
    console.error('Error al entrar a la videollamada:', joinError, error.value);
  }
};

const toggleSubtitles = () => {
  subtitlesOn.value = !subtitlesOn.value;
  try { localStorage.setItem(SUBTITLES_KEY, subtitlesOn.value ? '1' : '0'); } catch { /* sin almacenamiento */ }
};

// Se guarda en el perfil y se avisa al agente (atributo del participante) sin salir de la llamada
const changeSubtitleLanguage = async (code) => {
  subtitleLanguage.value = code;
  if (!subtitlesOn.value) toggleSubtitles();
  try {
    await Promise.all([
      api.patch('/api/user/preferences', { subtitle_language: code }),
      room.value?.localParticipant.setAttributes({ [CAPTIONS_LANGUAGE_ATTRIBUTE]: code }),
    ]);
    if (authStore.user) {
      authStore.user = { ...authStore.user, subtitle_language: code };
      authStore.saveAuth();
    }
  } catch (saveError) {
    console.error('No se pudo cambiar el idioma de los subtítulos:', saveError);
  }
};

const hangUp = async () => {
  await leave();
  router.replace(chatRoute());
};

onMounted(() => {
  callStore.dismiss(Number(props.conversationId));
  // Abierta directo (aviso o notificación): sin la lista de chats no hay nombre para el título
  if (!conversation.value) conversationStore.fetchConversations().catch(() => {});
  join();
});
</script>

<style lang="scss" scoped>
.call-view {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #12151c;
  color: #fff;
}

.call-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(8px, env(safe-area-inset-top)) 12px 4px;

  &__title {
    min-width: 0;

    h1 {
      overflow: hidden;
      font-size: 1.05rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      font-size: 0.8rem;
      opacity: 0.75;
    }
  }
}

.call-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.call-grid {
  position: relative;
  display: grid;
  flex: 1;
  min-height: 0;
  gap: 8px;
  padding: 8px 8px calc(var(--call-controls-height, 64px) + 24px);
  grid-auto-rows: 1fr;

  &--1 { grid-template-columns: 1fr; }
  &--2 { grid-template-columns: 1fr; }
  &--3, &--4 { grid-template-columns: repeat(2, 1fr); }
  &--5, &--6 { grid-template-columns: repeat(2, 1fr); }

  @media (min-width: 900px) {
    &--2 { grid-template-columns: repeat(2, 1fr); }
    &--5, &--6 { grid-template-columns: repeat(3, 1fr); }
  }
}

.call-waiting {
  position: absolute;
  top: 16px;
  left: 50%;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  font-size: 0.85rem;
  transform: translateX(-50%);
}

.call-audio-unlock {
  position: absolute;
  top: 72px;
  left: 50%;
  z-index: 4;
  transform: translateX(-50%);
}

// Centrada con margin auto: con left:50% el navegador le da solo la mitad del ancho
// y en el celular los botones pasaban a dos filas, tapando los subtítulos
.call-controls {
  position: absolute;
  right: 0;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  width: fit-content;
  max-width: calc(100% - 16px);
  margin: 0 auto;
  padding: 8px 12px;
  border-radius: 28px;
  background: rgba(0, 0, 0, 0.45);
}

.call-language-btn {
  height: 48px !important;
  border-radius: 999px;
}

// Celular: botones un poco más chicos, para que entren en una fila
@media (max-width: 480px) {
  .call-controls {
    gap: 6px;
    padding: 6px 8px;
  }

  .call-controls :deep(.v-btn--icon) {
    width: 44px;
    height: 44px;
  }

  .call-language-btn {
    height: 44px !important;
    min-width: 0 !important;
    padding: 0 10px !important;
  }
}
</style>
