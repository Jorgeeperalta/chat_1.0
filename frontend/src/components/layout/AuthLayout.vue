<!--
 * @file AuthLayout.vue
 * @description Layout para páginas de autenticación
 * @author Arquitecto de Software Senior
 -->

<template>
    <!-- Barra superior -->
    <v-app-bar
      app
      :elevation="2"
      color="primary"
      density="comfortable"
    >
      <!-- Logo -->
      <v-toolbar-title class="text-white font-weight-bold">
        {{ $t('app.name') }}
      </v-toolbar-title>

      <!-- Spacer -->
      <v-spacer />

      <!-- Selector de idioma -->
      <v-menu
        :close-on-content-click="false"
        location="bottom end"
        transition="scale-transition"
      >
        <template v-slot:activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            prepend-icon="mdi-translate"
            class="text-white"
          >
            <span class="d-none d-sm-inline">{{ currentLanguageName }}</span>
          </v-btn>
        </template>
        <v-list density="compact" nav>
          <v-list-item
            v-for="lang in availableLanguages"
            :key="lang.value"
            :value="lang.value"
            @click="changeLanguage(lang.value)"
          >
            <template v-slot:prepend>
              <v-icon :icon="lang.icon" />
            </template>
            <v-list-item-title>{{ lang.text }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- Botón para ir a inicio (si está autenticado) -->
      <v-btn
        v-if="isAuthenticated"
        variant="text"
        color="white"
        :to="{ name: 'home' }"
        prepend-icon="mdi-home"
      >
        {{ $t('common.home') }}
      </v-btn>
    </v-app-bar>

    <!-- Contenido principal: el html no hace scroll (main.scss), así que el scroll vive aquí -->
    <v-main class="auth-main">
      <div class="auth-scroll">
        <v-card
          class="auth-card elevation-4"
          :class="{ 'auth-card--wide': route.name === 'register' }"
        >
          <v-card-text class="auth-card__body">
            <!-- Contenido del router (cada vista trae su propio encabezado) -->
            <router-view v-slot="{ Component, route }">
              <transition name="auth-fade" mode="out-in">
                <component :is="Component" :key="route.path" />
              </transition>
            </router-view>

            <!-- Footer de la tarjeta -->
            <div class="text-center border-top">
              <p class="text-caption text-grey mb-0">
                {{ currentYear }} &copy; {{ $t('app.name') }}.
                {{ $t('auth.allRightsReserved') }}
              </p>
            </div>
          </v-card-text>
        </v-card>

        <!-- Footer (dentro del scroll para no tapar el formulario en pantallas chicas) -->
        <footer class="auth-footer text-center text-caption text-grey">
          {{ $t('auth.poweredBy') }}
          <v-chip color="primary" variant="text" size="small" class="mx-1">
            Vue.js
          </v-chip>
          <v-chip color="primary" variant="text" size="small" class="mx-1">
            Vuetify
          </v-chip>
          <v-chip color="primary" variant="text" size="small" class="mx-1">
            Mistral AI
          </v-chip>
        </footer>
      </div>
    </v-main>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

// ============================================
// STORES
// ============================================

const router = useRouter();
const route = useRoute();
const themeStore = useThemeStore();
const authStore = useAuthStore();

// ============================================
// INJECT
// ============================================

const snackbar = inject('snackbar');

// ============================================
// COMPUTED
// ============================================

const isAuthenticated = computed(() => authStore.isAuthenticated);

const currentYear = computed(() => new Date().getFullYear());

// Idiomas disponibles
const availableLanguages = computed(() => [
  { value: 'es', text: 'Español', icon: 'mdi-flag-outline-es' },
  { value: 'en', text: 'English', icon: 'mdi-flag-outline-us' },
  { value: 'fr', text: 'Français', icon: 'mdi-flag-outline-fr' },
  { value: 'de', text: 'Deutsch', icon: 'mdi-flag-outline-de' },
  { value: 'it', text: 'Italiano', icon: 'mdi-flag-outline-it' },
  { value: 'pt', text: 'Português', icon: 'mdi-flag-outline-pt' },
]);

const currentLanguage = computed(() => {
  return themeStore.language || 'es';
});

const currentLanguageName = computed(() => {
  const lang = availableLanguages.value.find(l => l.value === currentLanguage.value);
  return lang ? lang.text : 'Español';
});

// ============================================
// MÉTODOS
// ============================================

const changeLanguage = (lang) => {
  try {
    themeStore.setLanguage(lang);
    snackbar?.show({ text: 'Idioma cambiado correctamente', color: 'success' });
  } catch (error) {
    console.error('Error al cambiar idioma:', error);
    snackbar?.error('Error al cambiar idioma');
  }
};
</script>

<style lang="scss" scoped>
// Transiciones para autenticación
.auth-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.auth-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: all 0.3s ease;
}

// v-main ocupa la pantalla (dvh: descuenta las barras del navegador móvil) y hace su propio scroll
.auth-main {
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

// Centra la tarjeta cuando entra en pantalla; si no entra, crece y se desliza
.auth-scroll {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-card {
  width: 100%;
  max-width: 480px;
  border-radius: 12px;

  // El registro usa dos columnas desde tablet
  &--wide {
    max-width: 680px;
  }
}

.auth-card__body {
  padding: 24px !important;
}

// Borde superior para el footer de la tarjeta
.border-top {
  border-top: 1px solid var(--app-border);
  margin-top: 16px;
  padding-top: 16px;
}

.auth-footer {
  padding-top: 16px;
}

// Celular: tarjeta de borde a borde y menos relleno para aprovechar la pantalla
@media (max-width: 599px) {
  .auth-scroll {
    justify-content: flex-start;
    padding: 12px 8px;
  }

  .auth-card__body {
    padding: 16px !important;
  }
}

// Estilos para el avatar
:deep(.v-avatar) {
  border-radius: 50%;
}

// Estilos para los chips del footer
:deep(.v-chip) {
  font-weight: 500;
}
</style>
