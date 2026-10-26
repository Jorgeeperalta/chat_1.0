<!--
 * @file ProfileSettingsView.vue
 * @description Vista de configuración del perfil
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="profile-settings-view">
    <!-- Header -->
    <div class="settings-header mb-6">
      <h2 class="text-h5 font-weight-bold">
        {{ $t('settings.profile') }}
      </h2>
      <p class="text-subtitle-1 text-grey">
        {{ $t('settings.profileDescription') }}
      </p>
    </div>

    <!-- Avatar -->
    <v-card class="avatar-card mb-6">
      <v-card-text class="text-center py-6">
        <v-avatar
          :image="form.avatar_url"
          :size="120"
          color="primary"
          class="mb-4"
        >
          <span v-if="!form.avatar_url" class="text-white text-h4 font-weight-bold">
            {{ avatarInitials }}
          </span>
        </v-avatar>
        <h3 class="text-h6 font-weight-medium">
          {{ form.first_name }} {{ form.last_name }}
        </h3>
        <p class="text-caption text-grey">
          @{{ form.username }}
        </p>
        
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          prepend-icon="mdi-camera"
          class="mt-4"
          @click="triggerFileInput"
        >
          {{ $t('settings.changeAvatar') }}
        </v-btn>
        
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          style="display: none;"
          @change="handleAvatarChange"
        />
      </v-card-text>
    </v-card>

    <!-- Formulario de perfil -->
    <v-form
      ref="profileForm"
      v-model="isValid"
      lazy-validation
      @submit.prevent="handleSave"
      class="profile-form"
    >
      <!-- Nombre -->
      <v-text-field
        v-model="form.first_name"
        :label="$t('auth.firstName')"
        :placeholder="$t('auth.firstName')"
        :rules="nameRules"
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Apellido -->
      <v-text-field
        v-model="form.last_name"
        :label="$t('auth.lastName')"
        :placeholder="$t('auth.lastName')"
        :rules="nameRules"
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Nombre de usuario -->
      <v-text-field
        v-model="form.username"
        :label="$t('auth.username')"
        :placeholder="$t('auth.username')"
        :rules="usernameRules"
        density="comfortable"
        variant="outlined"
        clearable
        :disabled="true"
        class="mb-4"
      />

      <!-- Email -->
      <v-text-field
        v-model="form.email"
        :label="$t('auth.email')"
        :placeholder="$t('auth.email')"
        :rules="emailRules"
        density="comfortable"
        variant="outlined"
        clearable
        :disabled="true"
        class="mb-4"
      />

      <!-- Bio -->
      <v-textarea
        v-model="form.bio"
        :label="$t('settings.bio')"
        :placeholder="$t('settings.bioPlaceholder')"
        :rows="3"
        auto-grow
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Idioma nativo -->
      <v-select
        v-model="form.native_language_id"
        :label="$t('settings.language') + ' (Native)'"
        :placeholder="$t('settings.language')"
        :rules="languageRules"
        :items="languageOptions"
        item-title="name"
        item-value="id"
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Idioma preferido -->
      <v-select
        v-model="form.preferred_language_id"
        :label="$t('settings.language') + ' (Preferred)'"
        :placeholder="$t('settings.language')"
        :rules="languageRules"
        :items="languageOptions"
        item-title="name"
        item-value="id"
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Botones de acción -->
      <div class="form-actions d-flex gap-4">
        <v-btn
          color="primary"
          size="large"
          :loading="loading"
          :disabled="!isValid || !changed || loading"
          type="submit"
        >
          <v-icon icon="mdi-content-save" start />
          {{ $t('common.save') }}
        </v-btn>
        
        <v-btn
          color="grey"
          variant="text"
          size="large"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ $t('common.cancel') }}
        </v-btn>
      </div>
    </v-form>

    <!-- Botón para cambiar contraseña -->
    <v-card class="mt-6">
      <v-card-title>
        {{ $t('settings.security') }}
      </v-card-title>
      <v-card-text class="pb-0">
        <v-btn
          color="primary"
          variant="text"
          prepend-icon="mdi-lock-reset"
          :to="{ name: 'change-password' }"
        >
          {{ $t('settings.changePassword') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Diálogo de confirmación -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card>
        <v-card-title class="headline">
          {{ $t('common.confirm') }}
        </v-card-title>
        <v-card-text>
          {{ $t('settings.discardChanges') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" @click="discardChanges">
            {{ $t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';

// ============================================
// STORES
// ============================================

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();
const themeStore = useThemeStore();
const { t } = useI18n();

// ============================================
// ESTADO LOCAL
// ============================================

const profileForm = ref(null);
const isValid = ref(false);
const loading = ref(false);
const changed = ref(false);
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');
const confirmDialog = ref(false);
const avatarInput = ref(null);

const form = ref({
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  bio: '',
  native_language_id: null,
  preferred_language_id: null,
  avatar_url: '',
});

const originalForm = ref({});

const languageOptions = ref([]);

// ============================================
// COMPUTED
// ============================================

const avatarInitials = computed(() => {
  return (form.value.first_name.charAt(0) + form.value.last_name.charAt(0)).toUpperCase();
});

const nameRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 2) || 'El nombre debe tener al menos 2 caracteres',
  v => (v && v.length <= 50) || 'El nombre debe tener máximo 50 caracteres',
]);

const usernameRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 3) || t('errors.invalidUsername'),
]);

const emailRules = computed(() => [
  v => !!v || t('errors.required'),
  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('errors.invalidEmail'),
]);

const languageRules = computed(() => [
  v => !!v || t('errors.required'),
]);

// ============================================
// MÉTODOS
// ============================================

const fetchUser = () => {
  const user = authStore.user;
  if (user) {
    form.value = {
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      email: user.email || '',
      bio: user.bio || '',
      native_language_id: user.native_language_id || null,
      preferred_language_id: user.preferred_language_id || null,
      avatar_url: user.avatar_url || '',
    };
    originalForm.value = { ...form.value };
  }
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
    ];
  }
};

const triggerFileInput = () => {
  if (avatarInput.value) {
    avatarInput.value.click();
  }
};

const handleAvatarChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    loading.value = true;
    
    // Crear FormData
    const formData = new FormData();
    formData.append('avatar', file);
    
    // Subir avatar
    const response = await api.patch('/api/auth/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Actualizar formulario
    form.value.avatar_url = response.data.avatar_url;
    changed.value = true;
    
    showSnackbarMessage('Avatar actualizado correctamente', 'success');
  } catch (error) {
    console.error('Error al subir avatar:', error);
    showSnackbarMessage('Error al subir avatar', 'error');
  } finally {
    loading.value = false;
    // Limpiar el input
    if (avatarInput.value) {
      avatarInput.value.value = '';
    }
  }
};

const handleSave = async () => {
  try {
    // Validar formulario
    const { valid } = await profileForm.value?.validate();
    if (!valid) return;

    loading.value = true;

    await authStore.updateProfile({
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      bio: form.value.bio.trim(),
      native_language_id: form.value.native_language_id,
      preferred_language_id: form.value.preferred_language_id,
    });

    // Actualizar store de usuario
    userStore.setUser(authStore.user);
    
    showSnackbarMessage('Perfil actualizado correctamente', 'success');
    originalForm.value = { ...form.value };
    changed.value = false;
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    showSnackbarMessage('Error al actualizar perfil', 'error');
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  if (changed.value) {
    confirmDialog.value = true;
  } else {
    goBack();
  }
};

const discardChanges = () => {
  confirmDialog.value = false;
  form.value = { ...originalForm.value };
  changed.value = false;
  goBack();
};

const goBack = () => {
  router.go(-1);
};

const showSnackbarMessage = (text, color = 'info') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

// ============================================
// MONTAJE
// ============================================

import { watch } from 'vue';

onMounted(() => {
  fetchUser();
  fetchLanguages();
});

// Observar cambios en el formulario
watch(form, (newValue) => {
  changed.value = JSON.stringify(newValue) !== JSON.stringify(originalForm.value);
}, { deep: true });
</script>

<style lang="scss" scoped>
.profile-settings-view {
  max-width: 600px;
  margin: 0 auto;
  
  .settings-header {
    margin-bottom: 16px;
  }
  
  .avatar-card {
    background-color: var(--app-bg);
    border-radius: 12px;
    
    .v-avatar {
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
  
  .profile-form {
    :deep(.v-text-field) {
      .v-field {
        padding: 0 12px;
      }
    }
    
    :deep(.v-select) {
      .v-field {
        padding: 0 12px;
      }
    }
    
    :deep(.v-textarea) {
      .v-field {
        padding: 0 12px;
      }
    }
    
    .form-actions {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--app-border);
    }
  }
  
  // Card de seguridad
  :deep(.v-card) {
    border-radius: 12px;
    margin-bottom: 16px;
    
    .v-card-title {
      padding: 16px 20px 0;
    }
    
    .v-card-text {
      padding: 0 20px 16px;
    }
  }
}
</style>
