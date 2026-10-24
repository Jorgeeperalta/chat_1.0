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
            :prepend-icon="currentLanguageIcon"
            class="text-white"
          >
            {{ currentLanguageName }}
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

    <!-- Contenido principal -->
    <v-main>
      <v-container fluid class="fill-height">
        <v-row justify="center" align="center" class="fill-height">
          <v-col cols="12" sm="10" md="8" lg="6" xl="4">
            <v-card
              class="elevation-4 pa-4"
              max-width="450"
            >
              <v-card-text class="pa-0">
                <!-- Header de la tarjeta -->
                <div class="text-center mb-6">
                  <v-avatar
                    color="primary"
                    size="80"
                    class="mb-4 mx-auto"
                  >
                    <v-icon icon="mdi-message-text" size="40" color="white" />
                  </v-avatar>
                  <h1 class="text-h4 font-weight-bold text-primary">
                    {{ $t('app.name') }}
                  </h1>
                  <p class="text-subtitle-1 text-grey">
                    {{ $t('app.description') }}
                  </p>
                </div>

                <!-- Contenido del router -->
                <router-view v-slot="{ Component, route }">
                  <transition name="auth-fade" mode="out-in">
                    <component :is="Component" :key="route.path" />
                  </transition>
                </router-view>

                <!-- Footer de la tarjeta -->
                <div class="text-center mt-8 pt-4 border-top">
                  <p class="text-caption text-grey">
                    {{ currentYear }} &copy; {{ $t('app.name') }}. 
                    {{ $t('auth.allRightsReserved') }}
                  </p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Footer -->
    <v-footer app class="text-center text-caption text-grey">
      <v-row justify="center">
        <v-col cols="12">
          <span>
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
          </span>
        </v-col>
      </v-row>
    </v-footer>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

// ============================================
// STORES
// ============================================

const router = useRouter();
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

const currentLanguageIcon = computed(() => {
  const lang = availableLanguages.value.find(l => l.value === currentLanguage.value);
  return lang ? lang.icon : 'mdi-flag-outline-es';
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

// Estilos para el contenedor
.fill-height {
  min-height: calc(100vh - 128px);
}

// Borde superior para el footer de la tarjeta
.border-top {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin-top: 16px;
  padding-top: 16px;
}

// Estilos para el footer de la app
:deep(.v-footer) {
  padding: 16px;
  background-color: transparent;
}

// Estilos para la tarjeta
:deep(.v-card) {
  border-radius: 12px;
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
