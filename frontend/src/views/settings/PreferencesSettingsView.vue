<!--
 * @file PreferencesSettingsView.vue
 * @description Vista de preferencias del usuario
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="preferences-settings-view">
    <!-- Header -->
    <div class="settings-header mb-6">
      <h2 class="text-h5 font-weight-bold">
        {{ $t('settings.preferences') }}
      </h2>
      <p class="text-subtitle-1 text-grey">
        {{ $t('settings.preferencesDescription') }}
      </p>
    </div>

    <!-- Configuración de tema -->
    <v-card class="mb-6">
      <v-card-title>
        {{ $t('settings.theme') }}
      </v-card-title>
      <v-card-text>
        <v-select
          v-model="form.theme"
          :label="$t('settings.theme')"
          :placeholder="$t('settings.theme')"
          :items="themeOptions"
          item-title="text"
          item-value="value"
          density="comfortable"
          variant="outlined"
          @update:modelValue="changeTheme"
        />
      </v-card-text>
    </v-card>

    <!-- Configuración de idioma -->
    <v-card class="mb-6">
      <v-card-title>
        {{ $t('settings.language') }}
      </v-card-title>
      <v-card-text>
        <v-select
          v-model="form.language"
          :label="$t('settings.appLanguage')"
          :placeholder="$t('settings.appLanguage')"
          :items="languageOptions"
          item-title="name"
          item-value="code"
          density="comfortable"
          variant="outlined"
          @update:modelValue="changeLanguage"
        />
      </v-card-text>
    </v-card>

    <!-- Configuración de notificaciones -->
    <v-card class="mb-6">
      <v-card-title>
        {{ $t('settings.notifications') }}
      </v-card-title>
      <v-card-text>
        <v-switch
          v-model="form.notifications_enabled"
          :label="$t('settings.enableNotifications')"
          density="comfortable"
          hide-details
          class="mb-4"
        />
        
        <v-switch
          v-model="form.notification_sound"
          :label="$t('settings.notificationSound')"
          density="comfortable"
          hide-details
          class="mb-4"
          :disabled="!form.notifications_enabled"
        />
        
        <v-switch
          v-model="form.notification_vibration"
          :label="$t('settings.notificationVibration')"
          density="comfortable"
          hide-details
          :disabled="!form.notifications_enabled"
        />
      </v-card-text>
    </v-card>

    <!-- Configuración de chat -->
    <v-card class="mb-6">
      <v-card-title>
        {{ $t('chat.chat') }}
      </v-card-title>
      <v-card-text>
        <v-switch
          v-model="form.auto_translate"
          :label="$t('settings.autoTranslate')"
          density="comfortable"
          hide-details
          class="mb-4"
        />
        
        <v-switch
          v-model="form.show_original"
          :label="$t('settings.showOriginal')"
          density="comfortable"
          hide-details
          class="mb-4"
          :disabled="!form.auto_translate"
        />
        
        <v-select
          v-model="form.audio_quality"
          :label="$t('settings.audioQuality')"
          :placeholder="$t('settings.audioQuality')"
          :items="audioQualityOptions"
          item-title="text"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-4"
        />
        
        <v-switch
          v-model="form.play_audio_automatically"
          :label="$t('settings.playAutomatically')"
          density="comfortable"
          hide-details
        />
      </v-card-text>
    </v-card>

    <!-- Configuración de privacidad -->
    <v-card class="mb-6">
      <v-card-title>
        {{ $t('settings.privacy') }}
      </v-card-title>
      <v-card-text>
        <v-switch
          v-model="form.show_online_status"
          :label="$t('settings.showOnlineStatus')"
          density="comfortable"
          hide-details
          class="mb-4"
        />
        
        <v-switch
          v-model="form.show_read_receipts"
          :label="$t('settings.showReadReceipts')"
          density="comfortable"
          hide-details
        />
      </v-card-text>
    </v-card>

    <!-- Botón de guardar -->
    <v-btn
      color="primary"
      size="large"
      :loading="loading"
      @click="handleSave"
      block
    >
      <v-icon icon="mdi-content-save" start />
      {{ $t('common.save') }}
    </v-btn>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import { useUserStore } from '@/stores/userStore';
import api from '@/services/api';

// ============================================
// STORES
// ============================================

const themeStore = useThemeStore();
const userStore = useUserStore();

// ============================================
// ESTADO LOCAL
// ============================================

const loading = ref(false);
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');
const languageOptions = ref([]);

const form = ref({
  theme: '',
  language: '',
  notifications_enabled: true,
  notification_sound: true,
  notification_vibration: true,
  auto_translate: true,
  show_original: true,
  audio_quality: 'medium',
  play_audio_automatically: false,
  show_online_status: true,
  show_read_receipts: true,
});

const originalForm = ref({});

// ============================================
// COMPUTED
// ============================================

const themeOptions = computed(() => [
  { text: 'Sistema', value: 'system' },
  { text: 'Claro', value: 'light' },
  { text: 'Oscuro', value: 'dark' },
]);

const audioQualityOptions = computed(() => [
  { text: 'Baja', value: 'low' },
  { text: 'Media', value: 'medium' },
  { text: 'Alta', value: 'high' },
]);

// ============================================
// MÉTODOS
// ============================================

const fetchSettings = () => {
  const settings = userStore.settings || {};
  form.value = {
    theme: themeStore.currentTheme || 'system',
    language: themeStore.language || 'es',
    notifications_enabled: settings.notifications_enabled !== false,
    notification_sound: settings.notification_sound !== false,
    notification_vibration: settings.notification_vibration !== false,
    auto_translate: settings.auto_translate !== false,
    show_original: settings.show_original !== false,
    audio_quality: settings.audio_quality || 'medium',
    play_audio_automatically: settings.play_audio_automatically || false,
    show_online_status: settings.show_online_status !== false,
    show_read_receipts: settings.show_read_receipts !== false,
  };
  originalForm.value = { ...form.value };
};

const fetchLanguages = async () => {
  try {
    const response = await api.get('/api/languages');
    languageOptions.value = response.data.languages || [];
  } catch (error) {
    console.error('Error al cargar idiomas:', error);
    // Usar valores por defecto
    languageOptions.value = [
      { id: 1, name: 'Español', code: 'es' },
      { id: 2, name: 'English', code: 'en' },
      { id: 3, name: 'Français', code: 'fr' },
      { id: 4, name: 'Deutsch', code: 'de' },
    ];
  }
};

const changeTheme = (theme) => {
  themeStore.setTheme(theme);
  form.value.theme = theme;
};

const changeLanguage = (language) => {
  themeStore.setLanguage(language);
  form.value.language = language;
};

const handleSave = async () => {
  try {
    loading.value = true;
    
    await userStore.updateSettings(form.value);
    
    showSnackbarMessage('Preferencias guardadas correctamente', 'success');
    originalForm.value = { ...form.value };
  } catch (error) {
    console.error('Error al guardar preferencias:', error);
    showSnackbarMessage('Error al guardar preferencias', 'error');
  } finally {
    loading.value = false;
  }
};

const showSnackbarMessage = (text, color = 'info') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  fetchSettings();
  fetchLanguages();
});
</script>

<style lang="scss" scoped>
.preferences-settings-view {
  max-width: 600px;
  margin: 0 auto;
  
  .settings-header {
    margin-bottom: 16px;
  }
  
  :deep(.v-card) {
    border-radius: 12px;
    margin-bottom: 16px;
    
    .v-card-title {
      padding: 16px 20px 0;
    }
    
    .v-card-text {
      padding: 0 20px 16px;
      
      :deep(.v-switch) {
        .v-label {
          font-size: 0.9rem;
        }
      }
      
      :deep(.v-select) {
        .v-field {
          padding: 0 12px;
        }
      }
    }
  }
}
</style>
