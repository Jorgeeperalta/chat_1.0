<!--
 * @file PreferencesSettingsView.vue
 * @description Vista de preferencias del usuario
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="preferences-settings-view">
    <div class="settings-header">
      <h2 class="text-h5 font-weight-bold">{{ $t('settings.preferences') }}</h2>
    </div>

    <!-- Foto de perfil (se guarda al instante) -->
    <v-card id="profile-photo">
      <v-card-title>{{ $t('profile.photo') }}</v-card-title>
      <v-card-text>
        <ProfilePhotoEditor />
      </v-card-text>
    </v-card>

    <!-- Apariencia: tema y fondo del chat (se aplican al instante, en este dispositivo) -->
    <v-card>
      <v-card-title>{{ $t('settings.appearance') }}</v-card-title>
      <v-card-text>
        <v-select
          v-model="form.theme"
          :label="$t('settings.theme')"
          :items="themeOptions"
          item-title="text"
          item-value="value"
          density="comfortable"
          variant="outlined"
          @update:model-value="changeTheme"
        />

        <div class="text-subtitle-2 mb-1">{{ $t('settings.chatBackground') }}</div>
        <div class="text-caption text-medium-emphasis mb-3">{{ $t('settings.chatBackgroundHint') }}</div>
        <div class="background-grid" role="radiogroup" :aria-label="$t('settings.chatBackground')">
          <button
            v-for="option in backgroundOptions"
            :key="option.id"
            type="button"
            role="radio"
            class="background-option"
            :class="{ 'is-selected': themeStore.chatBackground === option.id }"
            :aria-checked="themeStore.chatBackground === option.id"
            :aria-label="$t(`settings.backgrounds.${option.id}`)"
            @click="themeStore.setChatBackground(option.id)"
          >
            <span class="background-option__preview" :style="{ background: option.preview }">
              <span class="background-option__bubble background-option__bubble--in" />
              <span class="background-option__bubble background-option__bubble--out" />
              <v-icon
                v-if="themeStore.chatBackground === option.id"
                icon="mdi-check-circle"
                color="primary"
                class="background-option__check"
              />
            </span>
            <span class="background-option__name">{{ $t(`settings.backgrounds.${option.id}`) }}</span>
          </button>
        </div>
      </v-card-text>
    </v-card>

    <!-- Notificaciones (también las push, con la app cerrada) -->
    <v-card>
      <v-card-title>{{ $t('settings.notifications') }}</v-card-title>
      <v-card-text>
        <v-switch
          v-model="form.notification_sound"
          :label="$t('settings.notificationSound')"
          color="primary"
          density="comfortable"
          hide-details
        />
        <v-switch
          v-model="form.notification_vibration"
          :label="$t('settings.notificationVibration')"
          color="primary"
          density="comfortable"
          hide-details
        />
      </v-card-text>
    </v-card>

    <!-- Chat -->
    <v-card>
      <v-card-title>{{ $t('chat.chat') }}</v-card-title>
      <v-card-text>
        <v-switch
          v-model="form.play_audio_automatically"
          :label="$t('settings.playAutomatically')"
          color="primary"
          density="comfortable"
          hide-details
        />
        <!-- Se aplica al instante (no depende del botón Guardar) -->
        <v-switch
          :model-value="themeStore.dualView"
          :label="$t('settings.dualView')"
          :hint="$t('settings.dualViewHint')"
          persistent-hint
          color="primary"
          density="comfortable"
          @update:model-value="themeStore.setDualView"
        />
      </v-card-text>
    </v-card>

    <v-btn color="primary" size="large" :loading="loading" block @click="handleSave">
      <v-icon icon="mdi-content-save" start />
      {{ $t('common.save') }}
    </v-btn>

    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { CHAT_BACKGROUNDS } from '@/utils/chatBackgrounds';
import ProfilePhotoEditor from '@/components/common/ProfilePhotoEditor.vue';

const themeStore = useThemeStore();
const { t } = useI18n();
const userStore = useUserStore();
const authStore = useAuthStore();

const loading = ref(false);
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');

// Solo lo que la app usa de verdad (los demás interruptores no tenían efecto y se quitaron)
const form = ref({
  theme: themeStore.currentTheme || 'system',
  notification_sound: true,
  notification_vibration: true,
  play_audio_automatically: false,
});

const themeOptions = computed(() => [
  { text: t('settings.system'), value: 'system' },
  { text: t('settings.light'), value: 'light' },
  { text: t('settings.dark'), value: 'dark' },
]);

// Muestra de cada fondo en la versión del tema actual
const backgroundOptions = computed(() =>
  CHAT_BACKGROUNDS.map(option => ({ id: option.id, preview: themeStore.isDark ? option.dark : option.light }))
);

const fetchSettings = async () => {
  try {
    await userStore.fetchSettings(authStore.user?.id);
  } catch (error) {
    console.error('Error al cargar preferencias:', error);
  }
  const settings = userStore.settings || {};
  form.value = {
    theme: themeStore.currentTheme || 'system',
    notification_sound: settings.notification_sound !== false,
    notification_vibration: settings.notification_vibration !== false,
    play_audio_automatically: settings.play_audio_automatically || false,
  };
};

const changeTheme = (theme) => {
  themeStore.setTheme(theme);
};

const handleSave = async () => {
  try {
    loading.value = true;
    await userStore.updateSettings({ ...form.value }, authStore.user?.id);
    showSnackbarMessage(t('settings.saved'), 'success');
  } catch (error) {
    console.error('Error al guardar preferencias:', error);
    showSnackbarMessage(t('settings.saveError'), 'error');
  } finally {
    loading.value = false;
  }
};

const showSnackbarMessage = (text, color = 'info') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

onMounted(() => {
  fetchSettings();
});
</script>

<style lang="scss" scoped>
.preferences-settings-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px 12px 32px;

  .settings-header {
    margin-bottom: 16px;
  }

  :deep(.v-card) {
    border-radius: 12px;
    margin-bottom: 16px;

    .v-card-title {
      padding: 16px 20px 8px;
    }

    .v-card-text {
      padding: 0 20px 16px;
    }
  }
}

// Fondos: cada muestra lleva dos burbujas, como se vería el chat
.background-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 10px;
}

.background-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;

  &__preview {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 5;
    border: 2px solid var(--app-border);
    border-radius: 12px;
    overflow: hidden;
  }

  &.is-selected &__preview {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.25);
  }

  &__bubble {
    position: absolute;
    height: 14px;
    border-radius: 7px;

    &--in {
      top: 24%;
      left: 10%;
      width: 55%;
      background: var(--app-bubble-received, #fff);
      border: 1px solid var(--app-border);
    }

    &--out {
      top: 50%;
      right: 10%;
      width: 50%;
      background: rgb(var(--v-theme-primary));
    }
  }

  &__check {
    position: absolute;
    right: 6px;
    bottom: 6px;
    border-radius: 50%;
    background: rgb(var(--v-theme-surface));
  }

  &__name {
    font-size: 0.78rem;
    text-align: center;
  }
}
</style>
