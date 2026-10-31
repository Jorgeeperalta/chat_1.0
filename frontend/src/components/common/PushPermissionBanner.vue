<!--
 * @file PushPermissionBanner.vue
 * @description Invita a activar las notificaciones push, para que el teléfono suene o vibre
 * con los mensajes nuevos aunque la app esté cerrada.
 -->

<template>
  <v-alert
    v-if="state"
    class="push-banner mb-3"
    :type="state === 'denied' ? 'warning' : 'info'"
    variant="tonal"
    density="compact"
    :icon="state === 'denied' ? 'mdi-bell-off' : 'mdi-bell-ring'"
    closable
    @click:close="dismiss"
  >
    <div class="push-banner__text">{{ $t(`push.${state}`) }}</div>
    <v-btn
      v-if="state === 'ask'"
      class="mt-2"
      color="primary"
      variant="flat"
      size="small"
      :loading="enabling"
      @click="enable"
    >
      {{ $t('push.enable') }}
    </v-btn>
  </v-alert>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getPushPermission,
  needsInstallForPush,
  enablePushNotifications,
} from '@/services/pushNotifications';

// Si el usuario cierra el aviso, no volver a mostrarlo en este dispositivo
const DISMISS_KEY = 'push-banner-dismissed';

const { t } = useI18n();
const snackbar = inject('snackbar', null);

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

const permission = ref(getPushPermission());
const dismissed = ref(readDismissed());
const enabling = ref(false);

// 'ask' = todavía no decidió | 'denied' = bloqueadas | 'install' = iPhone sin la app instalada
const state = computed(() => {
  if (dismissed.value) return null;
  if (permission.value === 'unsupported') return needsInstallForPush() ? 'install' : null;
  if (permission.value === 'default') return 'ask';
  if (permission.value === 'denied') return 'denied';
  return null;
});

const dismiss = () => {
  dismissed.value = true;
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sin almacenamiento: solo por esta vez */ }
};

const enable = async () => {
  enabling.value = true;
  try {
    permission.value = await enablePushNotifications();
    if (permission.value === 'granted') {
      snackbar?.show?.({ text: t('push.enabled'), color: 'success' });
    }
  } catch (error) {
    console.error('Error al activar notificaciones:', error);
    snackbar?.error?.(t('push.error'));
  } finally {
    enabling.value = false;
  }
};
</script>

<style lang="scss" scoped>
.push-banner__text {
  font-size: 0.9rem;
  line-height: 1.35;
}
</style>
