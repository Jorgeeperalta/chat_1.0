<!--
 * @file App.vue
 * @description Componente principal de la aplicación
 * @author Arquitecto de Software Senior
 -->

<template>
  <v-app>
    <!-- Barra de carga global -->
    <v-overlay
      :model-value="loading"
      class="align-center justify-center"
    >
      <v-progress-circular
        color="primary"
        indeterminate
        size="64"
      />
    </v-overlay>

    <!-- Notificaciones globales -->
    <NotificationBar />

    <!-- Router View - Aquí se renderizan las vistas -->
    <router-view v-slot="{ Component, route }">
      <transition name="route-fade" mode="out-in">
        <!-- Clave por layout (no por ruta) para no recrear AppLayout en cada navegación -->
        <component :is="Component" :key="route.matched[0]?.path" />
      </transition>
    </router-view>

    <!-- Diálogo de confirmación global -->
    <v-dialog
      v-model="confirmationDialog.show"
      :max-width="confirmationDialog.maxWidth || 400"
      persistent
    >
      <v-card>
        <v-card-title class="headline">
          {{ confirmationDialog.title || $t('common.confirm') }}
        </v-card-title>
        <v-card-text v-if="confirmationDialog.message">
          {{ confirmationDialog.message }}
        </v-card-text>
        <v-card-text v-else>
          {{ $t('common.confirmAction') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="confirmationDialog.onCancel"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="confirmationDialog.onConfirm"
          >
            {{ $t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar para mensajes -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout || 3000"
      :multi-line="snackbar.multiLine"
      location="bottom"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, provide, readonly, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import NotificationBar from '@/components/common/NotificationBar.vue';

// ============================================
// ESTADO GLOBAL
// ============================================

const router = useRouter();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const vuetifyTheme = useTheme();
const { locale } = useI18n();

// Aplicar el tema del store a Vuetify
watch(() => themeStore.isDark, (isDark) => {
  vuetifyTheme.change(isDark ? 'dark' : 'light');
}, { immediate: true });

// Aplicar el idioma de la interfaz a i18n
watch(() => themeStore.language, (lang) => {
  if (lang) locale.value = lang;
}, { immediate: true });

// ============================================
// ESTADO LOCAL
// ============================================

const loading = ref(false);

// Diálogo de confirmación
const confirmationDialog = ref({
  show: false,
  title: '',
  message: '',
  maxWidth: 400,
  onConfirm: () => {},
  onCancel: () => {},
});

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'info',
  timeout: 3000,
  multiLine: false,
});

// ============================================
// COMPUTED
// ============================================

const currentRoute = computed(() => router.currentRoute.value);
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
});

// ============================================
// PROVIDE / INJECT
// ============================================

// Proporcionar funciones de UI globales a los componentes hijos
provide('loading', {
  start: () => { loading.value = true; },
  stop: () => { loading.value = false; },
  set: (value) => { loading.value = value; },
});

provide('confirmation', {
  show: (options) => {
    confirmationDialog.value = {
      show: true,
      title: options.title || '',
      message: options.message || '',
      maxWidth: options.maxWidth || 400,
      onConfirm: options.onConfirm || (() => {}),
      onCancel: options.onCancel || (() => {}),
    };
  },
  hide: () => {
    confirmationDialog.value.show = false;
  },
});

provide('snackbar', {
  show: (options) => {
    snackbar.value = {
      show: true,
      text: options.text || '',
      color: options.color || 'info',
      timeout: options.timeout || 3000,
      multiLine: options.multiLine || false,
    };
  },
  hide: () => {
    snackbar.value.show = false;
  },
  error: (message, timeout = 3000) => {
    snackbar.value = {
      show: true,
      text: message,
      color: 'error',
      timeout,
      multiLine: false,
    };
  },
  success: (message, timeout = 3000) => {
    snackbar.value = {
      show: true,
      text: message,
      color: 'success',
      timeout,
      multiLine: false,
    };
  },
});

// Proporcionar información del dispositivo
provide('device', readonly({
  isMobile,
  isDesktop: computed(() => !isMobile.value),
  isTablet: computed(() => window.innerWidth >= 768 && window.innerWidth < 1024),
}));

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  // Inicializar el tema
  themeStore.initialize();

  // Detectar soporte/permiso de notificaciones del navegador
  notificationStore.initialize();

  // Verificar autenticación al cargar la app
  if (authStore.isAuthenticated) {
    authStore.fetchUser().catch(() => {});
  }
  
  // Manejar cambios de tamaño de ventana
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
});

// ============================================
// MÉTODOS
// ============================================

const handleResize = () => {
  // Actualizar información del dispositivo
  // Esto se maneja automáticamente gracias a las propiedades computadas
};

// ============================================
// LIMPIEZA
// ============================================

import { onUnmounted } from 'vue';

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
  }
});
</script>

<style lang="scss" scoped>
// Transiciones de ruta
.route-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.route-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition: all 0.3s ease;
}

// Estilos para la barra de carga
:deep(.v-overlay__content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

// Estilos para snackbar
:deep(.v-snackbar__content) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
