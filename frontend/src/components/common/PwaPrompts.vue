<!--
 * @file PwaPrompts.vue
 * @description Avisos de la PWA: instalar la app y actualizar a una versión nueva
 -->

<template>
  <!-- Nueva versión disponible: se aplica cuando el usuario quiere (no corta una conversación) -->
  <v-snackbar
    :model-value="needRefresh"
    :timeout="-1"
    location="bottom"
    color="primary"
    multi-line
  >
    {{ $t('pwa.updateAvailable') }}
    <template v-slot:actions>
      <v-btn variant="text" @click="needRefresh = false">
        {{ $t('pwa.later') }}
      </v-btn>
      <v-btn variant="flat" color="white" class="text-primary" @click="updateServiceWorker(true)">
        {{ $t('pwa.update') }}
      </v-btn>
    </template>
  </v-snackbar>

  <!-- Instalar la app -->
  <v-snackbar
    :model-value="showInstall && !needRefresh"
    :timeout="-1"
    location="bottom"
    multi-line
  >
    <div class="d-flex align-center">
      <v-icon icon="mdi-cellphone-arrow-down" class="mr-3" />
      <span v-if="isIos">{{ $t('pwa.installIos') }}</span>
      <span v-else>{{ $t('pwa.installPrompt') }}</span>
    </div>
    <template v-slot:actions>
      <v-btn variant="text" @click="dismissInstall">
        {{ isIos ? $t('common.close') : $t('pwa.later') }}
      </v-btn>
      <v-btn v-if="!isIos" variant="flat" color="primary" @click="install">
        {{ $t('pwa.install') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';

// Si el usuario descarta el aviso de instalación, no volver a mostrarlo por un tiempo
const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

// ============================================
// ACTUALIZACIONES (service worker)
// ============================================

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    // Buscar versiones nuevas cada hora mientras la app está abierta
    if (registration) {
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('No se pudo registrar el service worker:', error);
  },
});

// ============================================
// INSTALACIÓN
// ============================================

const deferredPrompt = ref(null);
const dismissed = ref(false);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Safari en iPhone/iPad no tiene diálogo de instalación: se explica cómo agregarla
const isIos = computed(() =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const showInstall = computed(() => {
  if (dismissed.value || isStandalone()) return false;
  // En iOS solo tiene sentido en https: sin service worker no se instala como app
  if (isIos.value) return window.isSecureContext;
  return !!deferredPrompt.value;
});

const onBeforeInstallPrompt = (event) => {
  event.preventDefault();
  deferredPrompt.value = event;
};

const onInstalled = () => {
  deferredPrompt.value = null;
};

const install = async () => {
  const promptEvent = deferredPrompt.value;
  if (!promptEvent) return;
  deferredPrompt.value = null;
  promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  if (outcome !== 'accepted') dismissInstall();
};

const dismissInstall = () => {
  dismissed.value = true;
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento: el aviso vuelve a aparecer en la próxima visita
  }
};

onMounted(() => {
  dismissed.value = recentlyDismissed();
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onInstalled);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.removeEventListener('appinstalled', onInstalled);
});
</script>
