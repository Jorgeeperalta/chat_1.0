<!--
 * @file RegisterView.vue
 * @description Vista de registro de usuario
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="register-view">
    <!-- Header -->
    <div class="register-header text-center mb-6">
      <v-avatar
        color="primary"
        size="80"
        class="mb-4 mx-auto"
      >
        <v-icon icon="mdi-account-plus" size="40" color="white" />
      </v-avatar>
      <h1 class="text-h4 font-weight-bold">
        {{ $t('auth.register') }}
      </h1>
      <p class="text-subtitle-1 text-grey">
        {{ $t('auth.createNewAccount') }}
      </p>
    </div>

    <!-- Formulario de registro -->
    <v-form
      ref="registerForm"
      v-model="isValid"
      lazy-validation
      @submit.prevent="handleRegister"
      class="register-form"
    >
      <!-- Nombre -->
      <v-text-field
        v-model="form.first_name"
        :label="$t('auth.firstName')"
        :placeholder="$t('auth.firstName')"
        :rules="nameRules"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-account-outline"
        clearable
        autocomplete="given-name"
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
        prepend-inner-icon="mdi-account-outline"
        clearable
        autocomplete="family-name"
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
        prepend-inner-icon="mdi-at"
        clearable
        autocomplete="username"
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
        prepend-inner-icon="mdi-email"
        clearable
        autocomplete="email"
        class="mb-4"
      />

      <!-- Contraseña -->
      <v-text-field
        v-model="form.password"
        :label="$t('auth.password')"
        :placeholder="$t('auth.password')"
        :rules="passwordRules"
        :type="showPassword ? 'text' : 'password'"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-lock"
        :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
        autocomplete="new-password"
        @click:append-inner="showPassword = !showPassword"
        class="mb-4"
      />

      <!-- Confirmar contraseña -->
      <v-text-field
        v-model="form.confirmPassword"
        :label="$t('auth.confirmPassword')"
        :placeholder="$t('auth.confirmPassword')"
        :rules="confirmPasswordRules"
        :type="showPassword ? 'text' : 'password'"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-lock-check"
        :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
        autocomplete="new-password"
        @click:append-inner="showPassword = !showPassword"
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
        prepend-inner-icon="mdi-flag"
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
        prepend-inner-icon="mdi-translate"
        clearable
        class="mb-4"
      />

      <!-- Botón de registrar -->
      <v-btn
        type="submit"
        color="primary"
        block
        size="large"
        :loading="loading"
        :disabled="!isValid || loading"
        rounded
        class="mb-4"
      >
        <v-icon icon="mdi-account-plus" start />
        {{ $t('auth.register') }}
      </v-btn>

      <!-- Términos y condiciones -->
      <div class="terms-and-conditions">
        <v-checkbox
          v-model="form.acceptTerms"
          :label="$t('auth.acceptTerms')"
          density="compact"
          hide-details
          class="mt-0 pt-0"
        />
      </div>

      <!-- Enlace a iniciar sesión -->
      <div class="login-link text-center mt-4">
        <p class="text-body-2 text-grey">
          {{ $t('auth.alreadyHaveAccount') }}
          <v-btn
            variant="text"
            color="primary"
            :to="{ name: 'login' }"
            class="pa-0"
          >
            {{ $t('auth.login') }}
          </v-btn>
        </p>
      </div>
    </v-form>

    <!-- Diálogo de éxito -->
    <v-dialog v-model="successDialog" max-width="400">
      <v-card>
        <v-card-title class="headline success">
          {{ $t('common.success') }}
        </v-card-title>
        <v-card-text>
          {{ $t('auth.registrationSuccess') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="goToHome">
            {{ $t('common.continue') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo de error -->
    <v-dialog v-model="errorDialog" max-width="400">
      <v-card>
        <v-card-title class="headline error">
          {{ $t('errors.serverError') }}
        </v-card-title>
        <v-card-text>
          {{ errorMessage }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="errorDialog = false">
            {{ $t('common.close') }}
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
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';

// ============================================
// STORES
// ============================================

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { t } = useI18n();

// ============================================
// ESTADO LOCAL
// ============================================

const registerForm = ref(null);
const isValid = ref(false);
const loading = ref(false);
const showPassword = ref(false);
const successDialog = ref(false);
const errorDialog = ref(false);
const errorMessage = ref('');
const languageOptions = ref([]);

const form = ref({
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  native_language_id: null,
  preferred_language_id: null,
  acceptTerms: false,
});

// ============================================
// REGLAS DE VALIDACIÓN
// ============================================

const nameRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 2) || 'El nombre debe tener al menos 2 caracteres',
  v => (v && v.length <= 50) || 'El nombre debe tener máximo 50 caracteres',
  v => /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s-']+$/.test(v) || 'El nombre solo puede contener letras y guiones',
]);

const usernameRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 3) || t('errors.invalidUsername'),
  v => (v && v.length <= 50) || t('validation.maxLength', [50]),
  v => /^[a-zA-Z0-9_-]+$/.test(v) || 'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos',
]);

const emailRules = computed(() => [
  v => !!v || t('errors.required'),
  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('errors.invalidEmail'),
]);

const passwordRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 8) || t('errors.invalidPassword'),
  v => /[A-Z]/.test(v) || 'Debe contener al menos una letra mayúscula',
  v => /[a-z]/.test(v) || 'Debe contener al menos una letra minúscula',
  v => /[0-9]/.test(v) || 'Debe contener al menos un número',
]);

const confirmPasswordRules = computed(() => [
  v => !!v || t('errors.required'),
  v => v === form.value.password || 'Las contraseñas no coinciden',
]);

const languageRules = computed(() => [
  v => !!v || t('errors.required'),
]);

// ============================================
// MÉTODOS
// ============================================

const handleRegister = async () => {
  try {
    // Validar formulario
    const { valid } = await registerForm.value?.validate();
    if (!valid || !form.value.acceptTerms) return;

    loading.value = true;

    await authStore.register({
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      username: form.value.username.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      native_language_id: form.value.native_language_id,
      preferred_language_id: form.value.preferred_language_id,
    });

    // Mostrar diálogo de éxito
    successDialog.value = true;
  } catch (error) {
    console.error('Error al registrar:', error);
    
    // Mostrar mensaje de error
    errorMessage.value = error?.response?.data?.message ||
      error?.response?.data?.details?.[0]?.msg ||
      error?.message ||
      t('errors.serverError');
    errorDialog.value = true;
  } finally {
    loading.value = false;
  }
};

const goToHome = () => {
  successDialog.value = false;
  const redirect = router.currentRoute.value.query.redirect;
  router.push(redirect ? { path: redirect } : { name: 'home' });
};

const fetchLanguages = async () => {
  try {
    const response = await api.get('/api/languages');
    languageOptions.value = response.data.languages || [];
    
    // Establecer valores por defecto
    if (languageOptions.value.length > 0) {
      const defaultLanguage = languageOptions.value.find(l => l.code === 'es');
      if (defaultLanguage) {
        form.value.native_language_id = defaultLanguage.id;
        form.value.preferred_language_id = defaultLanguage.id;
      } else {
        form.value.native_language_id = languageOptions.value[0].id;
        form.value.preferred_language_id = languageOptions.value[0].id;
      }
    }
  } catch (error) {
    console.error('Error al cargar idiomas:', error);
    // Usar valores por defecto
    languageOptions.value = [
      { id: 1, name: 'Español', code: 'es' },
      { id: 2, name: 'English', code: 'en' },
      { id: 3, name: 'Français', code: 'fr' },
    ];
    form.value.native_language_id = 1;
    form.value.preferred_language_id = 1;
  }
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  fetchLanguages();
});
</script>

<style lang="scss" scoped>
.register-view {
  .register-header {
    .v-avatar {
      border-radius: 50%;
    }
  }

  .register-form {
    :deep(.v-text-field) {
      .v-field {
        padding: 0 12px;
      }
      
      .v-field__input {
        input {
          font-size: 0.95rem;
        }
      }
    }

    :deep(.v-select) {
      .v-field {
        padding: 0 12px;
      }
    }

    .terms-and-conditions {
      :deep(.v-checkbox) {
        .v-label {
          font-size: 0.85rem;
          color: rgba(0, 0, 0, 0.6);
        }
      }
    }

    .login-link {
      margin-top: 16px;
    }
  }

  // Diálogos
  :deep(.success) {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4CAF50;
  }

  :deep(.error) {
    background-color: rgba(244, 67, 54, 0.1);
    color: #FF5252;
  }
}

// Responsive
@media (max-width: 768px) {
  .register-view {
    .register-form {
      :deep(.v-text-field) {
        .v-field {
          padding: 0 8px;
        }
      }
    }
  }
}
</style>
