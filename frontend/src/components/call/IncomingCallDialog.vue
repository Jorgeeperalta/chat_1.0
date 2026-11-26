<!--
 * @file IncomingCallDialog.vue
 * @description Aviso de videollamada entrante (en cualquier pantalla de la app):
 * quién llama, y los botones Rechazar / Unirse.
 -->

<template>
  <v-dialog :model-value="!!invite" max-width="360" persistent>
    <v-card v-if="invite" class="incoming-call text-center pa-4">
      <v-avatar size="80" class="mx-auto mb-3 incoming-call__avatar" :color="avatarUrl ? undefined : avatarColor">
        <v-img v-if="avatarUrl" :src="avatarUrl" cover />
        <span v-else class="text-h4 text-white font-weight-bold">{{ initials }}</span>
      </v-avatar>
      <div class="text-h6">{{ callerName }}</div>
      <div class="text-body-2 text-medium-emphasis mb-5">
        <v-icon icon="mdi-video" size="16" start />
        {{ invite.conversationType === 'group' ? $t('call.incomingGroup', { group: invite.conversationName }) : $t('call.incoming') }}
      </div>
      <div class="d-flex justify-center ga-6">
        <v-btn icon="mdi-phone-hangup" color="error" size="large" :aria-label="$t('call.decline')" @click="decline" />
        <v-btn icon="mdi-video" color="success" size="large" :aria-label="$t('call.join')" @click="accept" />
      </div>
      <div class="d-flex justify-center ga-6 mt-1 text-caption">
        <span class="incoming-call__label">{{ $t('call.decline') }}</span>
        <span class="incoming-call__label">{{ $t('call.join') }}</span>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCallStore } from '@/stores/callStore';
import { getAvatarColor, getInitials, getUserDisplayName } from '@/utils/conversationDisplay';
import { resolveMediaUrl } from '@/utils/media';

const router = useRouter();
const callStore = useCallStore();

const invite = computed(() => callStore.incoming);
const callerName = computed(() => getUserDisplayName(invite.value?.caller));
const avatarUrl = computed(() => resolveMediaUrl(invite.value?.caller?.avatar_url));
const avatarColor = computed(() => getAvatarColor(invite.value?.caller?.id));
const initials = computed(() => getInitials(callerName.value));

const decline = () => callStore.dismiss();

const accept = () => {
  const conversationId = invite.value.conversationId;
  callStore.dismiss();
  router.push({ name: 'call', params: { conversationId }, query: { join: '1' } });
};
</script>

<style lang="scss" scoped>
.incoming-call__avatar {
  animation: ring 1.2s ease-in-out infinite;
}

.incoming-call__label {
  width: 56px;
}

@keyframes ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.5); }
  50% { box-shadow: 0 0 0 14px rgba(76, 175, 80, 0); }
}
</style>
