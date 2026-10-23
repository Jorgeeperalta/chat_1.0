<!--
 * @file ForgotPasswordView.vue
 * @description Vista para recuperar contraseña
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="forgot-password-view">
    <!-- Header -->
    <div class="forgot-header text-center mb-6">
      <v-avatar
        color="primary"
        size="80"
        class="mb-4 mx-auto"
      >
        <v-icon icon="mdi-key" size="40" color="white" />
      </v-avatar>
      <h1 class="text-h4 font-weight-bold">
        {{ $t('auth.forgotPassword') }}
      </h1>
      <p class="text-subtitle-1 text-grey">
        {{ $t('auth.recoverAccount') }}
      </p>
    </div>

    <!-- Formulario de recuperación -->
    <template v-if="!emailSent">
      <v-form
        ref="forgotForm"
        v-model="isValid"
        lazy-validation
        @submit.prevent="handleForgotPassword"
        class="forgot-form"
      >
        <p class="text-body-2 text-grey mb-6">
          {{ $t('auth.forgotPasswordDescription') }}
        </p>

        <!-- Campo de email -->
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

        <!-- Botón de enviar -->
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
          <v-icon icon="mdi-email-send" start />
          {{ $t('auth.sendRecoveryEmail') }}
        </v-btn>

        <!-- Enlace a iniciar sesión -->
        <div class="login-link text-center">
          <p class="text-body-2 text-grey">
            {{ $t('auth.rememberPassword') }}
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
    </template>

    <!-- Confirmación de email enviado -->
    <template v-else>
      <div class="success-message text-center">
        <v-avatar
          color="success"
          size="80"
          class="mb-4 mx-auto"
        >
          <v-icon icon="mdi-email-check" size="40" color="white" />
        </v-avatar>
        
        <h2 class="text-h5 font-weight-bold mb-2">
          {{ $t('auth.checkYourEmail') }}
        </h2>
        
        <p class="text-body-1 text-grey mb-6">
          {{ $t('auth.recoveryEmailSent', { email: form.email }) }}
        </p>
        
        <p class="text-body-2 text-grey mb-6">
          {{ $t('auth.didNotReceiveEmail') }}
        </p>
        
        <v-btn
          color="primary"
          size="large"
          @click="resendEmail"
          :loading="loading"
          rounded
          class="mb-4"
        >
          <v-icon icon="mdi-email-sync" start />
          {{ $t('auth.resendEmail') }}
        </v-btn>
        
        <v-btn
          variant="text"
          color="primary"
          :to="{ name: 'login' }"
        >
          {{ $t('auth.backToLogin') }}
        </v-btn>
      </div>
    </template>

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
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';

// ============================================
// STORES
// ============================================

const router = useRouter();
const themeStore = useThemeStore();
const { t } = useI18n();

// ============================================
// ESTADO LOCAL
// ============================================

const forgotForm = ref(null);
const isValid = ref(false);
const loading = ref(false);
const emailSent = ref(false);
const errorDialog = ref(false);
const errorMessage = ref('');

const form = ref({
  email: '',
});

// ============================================
// REGLAS DE VALIDACIÓN
// ============================================

const emailRules = computed(() => [
  v => !!v || t('errors.required'),
  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('errors.invalidEmail'),
]);

// ============================================
// MÉTODOS
// ============================================

const handleForgotPassword = async () => {
  try {
    // Validar formulario
    const { valid } = await forgotForm.value?.validate();
    if (!valid) return;

    loading.value = true;

    await api.post('/api/auth/forgot-password', {
      email: form.value.email.trim(),
    });

    // Marcar email como enviado
    emailSent.value = true;
  } catch (error) {
    console.error('Error al recuperar contraseña:', error);
    
    // Mostrar mensaje de error
    errorMessage.value = error?.response?.data?.message || 
      error?.message || 
      t('errors.serverError');
    errorDialog.value = true;
  } finally {
    loading.value = false;
  }
};

const resendEmail = async () => {
  try {
    loading.value = true;
    
    await api.post('/api/auth/forgot-password', {
      email: form.value.email.trim(),
    });
    
    // Mostrar mensaje de éxito
    t('auth.recoveryEmailResent');
  } catch (error) {
    console.error('Error al reenviar email:', error);
    errorMessage.value = error?.response?.data?.message || 
      error?.message || 
      t('errors.serverError');
    errorDialog.value = true;
  } finally {
    loading.value = false;
  }
};

const backToLogin = () => {
  router.push({ name: 'login' });
};
</script>

<style lang="scss" scoped>
.forgot-password-view {
  .forgot-header,
  .forgot-form,
  .success-message {
    .v-avatar {
      border-radius: 50%;
    }
  }

  .forgot-form {
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

    .login-link {
      margin-top: 16px;
    }
  }

  .success-message {
    padding: 16px;
    
    h2 {
      color: #4CAF50;
    }
  }

  // Diálogo de error
  :deep(.error) {
    background-color: rgba(244, 67, 54, 0.1);
    color: #FF5252;
  }
}
</style>
