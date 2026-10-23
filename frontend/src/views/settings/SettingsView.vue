<!--
 * @file SettingsView.vue
 * @description Vista principal de configuración
 * @author Arquitecto de Software Senior
 -->

<template>
  <v-container fluid class="settings-view pa-0">
    <!-- Header -->
    <v-app-bar
      density="comfortable"
      color="transparent"
      flat
      class="app-bar"
    >
      <v-btn
        v-if="isMobile"
        variant="text"
        icon
        @click="goBack"
      >
        <v-icon icon="mdi-arrow-left" />
      </v-btn>
      
      <v-toolbar-title class="font-weight-medium">
        {{ $t('settings.title') }}
      </v-toolbar-title>
      
      <v-spacer />
    </v-app-bar>

    <!-- Contenido -->
    <v-main class="settings-main">
      <router-view v-slot="{ Component, route }">
        <transition name="settings-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </v-main>
  </v-container>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';

// ============================================
// INJECT
// ============================================

const device = inject('device');

// ============================================
// STORES
// ============================================

const router = useRouter();

// ============================================
// COMPUTED
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);

// ============================================
// MÉTODOS
// ============================================

const goBack = () => {
  router.go(-1);
};
</script>

<style lang="scss" scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  
  .app-bar {
    background-color: #FFFFFF;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
  
  .settings-main {
    background-color: #F5F5F5;
    padding: 16px;
  }
}

// Transiciones
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: all 0.3s ease;
}
</style>
