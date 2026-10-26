<!--
 * @file LoginView.vue
 * @description Vista de inicio de sesión
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="login-view">
    <!-- Header -->
    <div class="login-header text-center mb-4 mb-sm-6">
      <v-avatar
        color="primary"
        :size="smAndUp ? 72 : 56"
        class="mb-3 mx-auto"
      >
        <v-icon icon="mdi-login" :size="smAndUp ? 36 : 28" color="white" />
      </v-avatar>
      <h1 class="text-h5 text-sm-h4 font-weight-bold">
        {{ $t('auth.login') }}
      </h1>
      <p class="text-body-2 text-sm-subtitle-1 text-grey mb-0">
        {{ $t('auth.welcomeBack') }}
      </p>
    </div>

    <!-- Formulario de login -->
    <v-form
      ref="loginForm"
      v-model="isValid"
      lazy-validation
      @submit.prevent="handleLogin"
      class="login-form"
    >
      <!-- Campo de email/usuario -->
      <v-text-field
        v-model="form.username"
        :label="$t('auth.username')"
        :placeholder="$t('auth.username')"
        :rules="usernameRules"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-account"
        clearable
        autocomplete="username"
        class="mb-4"
      />

      <!-- Campo de contraseña -->
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
        autocomplete="current-password"
        @click:append-inner="showPassword = !showPassword"
        class="mb-2"
      />

      <!-- Enlace para olvidé contraseña -->
      <div class="forgot-password mb-4">
        <v-btn
          variant="text"
          color="primary"
          size="small"
          :to="{ name: 'forgot-password' }"
        >
          {{ $t('auth.forgotPassword') }}
        </v-btn>
      </div>

      <!-- Botón de iniciar sesión -->
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
        <v-icon icon="mdi-login" start />
        {{ $t('auth.login') }}
      </v-btn>

      <!-- Opciones de login -->
      <div class="login-options">
        <div class="divider d-flex align-center text-caption text-grey">
          <v-divider flex-grow="1" />
          <span class="px-2">{{ $t('common.or') }}</span>
          <v-divider flex-grow="1" />
        </div>

        <!-- Botones de redes sociales (futuro) -->
        <div class="social-login d-flex justify-center gap-4 my-4">
          <v-btn
            variant="outlined"
            color="grey"
            size="small"
            :disabled="true"
          >
            <v-icon icon="mdi-google" start />
            Google
          </v-btn>
          <v-btn
            variant="outlined"
            color="grey"
            size="small"
            :disabled="true"
          >
            <v-icon icon="mdi-facebook" start />
            Facebook
          </v-btn>
        </div>
      </div>

      <!-- Enlace a registrar -->
      <div class="register-link text-center">
        <p class="text-body-2 text-grey">
          {{ $t('auth.dontHaveAccount') }}
          <v-btn
            variant="text"
            color="primary"
            :to="{ name: 'register' }"
            class="pa-0"
          >
            {{ $t('auth.register') }}
          </v-btn>
        </p>
      </div>
    </v-form>

    <!-- Diálogo de error -->
    <v-dialog v-model="errorDialog" max-width="400">
      <v-card>
        <v-card-title class="headline error">
          {{ $t('errors.notAuthorized') }}
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
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

// ============================================
// STORES
// ============================================

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { t } = useI18n();
const { smAndUp } = useDisplay();

// ============================================
// ESTADO LOCAL
// ============================================

const loginForm = ref(null);
const isValid = ref(false);
const loading = ref(false);
const showPassword = ref(false);
const errorDialog = ref(false);
const errorMessage = ref('');

const form = ref({
  username: '',
  password: '',
});

// ============================================
// REGLAS DE VALIDACIÓN
// ============================================

const usernameRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 3) || t('errors.invalidUsername'),
  v => (v && v.length <= 50) || t('validation.maxLength', [50]),
]);

const passwordRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v && v.length >= 8) || t('errors.invalidPassword'),
]);

// ============================================
// MÉTODOS
// ============================================

const handleLogin = async () => {
  try {
    // Validar formulario
    const { valid } = await loginForm.value?.validate();
    if (!valid) return;

    loading.value = true;

    await authStore.login({
      username: form.value.username.trim(),
      password: form.value.password,
    });

    // Redirigir al home o a la ruta guardada
    const redirect = router.currentRoute.value.query.redirect;
    router.push(redirect ? { path: redirect } : { name: 'home' });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    
    // Mostrar mensaje de error
    errorMessage.value = error?.response?.data?.message || 
      error?.message || 
      t('errors.invalidCredentials');
    errorDialog.value = true;
  } finally {
    loading.value = false;
  }
};

const handleKeyPress = (event) => {
  if (event.key === 'Enter' && isValid.value && !loading.value) {
    handleLogin();
  }
};

// ============================================
// MONTAJE
// ============================================

import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  window.addEventListener('keypress', handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener('keypress', handleKeyPress);
});
</script>

<style lang="scss" scoped>
.login-view {
  .login-header {
    .v-avatar {
      border-radius: 50%;
    }
  }

  .login-form {
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

    .forgot-password {
      text-align: right;
    }

    .divider {
      color: rgba(0, 0, 0, 0.54);
      margin: 16px 0;
    }

    .social-login {
      .v-btn {
        flex: 1;
        min-width: 120px;
        
        .v-icon {
          margin-right: 4px;
        }
      }
    }

    .register-link {
      margin-top: 16px;
    }
  }

  // Diálogo de error
  :deep(.error) {
    background-color: rgba(244, 67, 54, 0.1);
    color: #FF5252;
  }
}

// Responsive
@media (max-width: 768px) {
  .login-view {
    .social-login {
      flex-direction: column;
      gap: 8px;
    }
  }
}
</style>
