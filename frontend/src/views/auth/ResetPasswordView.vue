<!--
 * @file ResetPasswordView.vue
 * @description Enlace del correo (/auth/reset-password?token=...): valida el enlace y, si sirve,
 * pide la nueva contraseña. Al guardarla, el enlace deja de servir y hay que volver a entrar.
 -->

<template>
  <div class="reset-password-view">
    <div class="auth-header text-center mb-4 mb-sm-6">
      <v-avatar :color="state === 'invalid' ? 'error' : 'primary'" :size="smAndUp ? 72 : 56" class="mb-3 mx-auto">
        <v-icon :icon="headerIcon" :size="smAndUp ? 36 : 28" color="white" />
      </v-avatar>
      <h1 class="text-h5 text-sm-h4 font-weight-bold">{{ title }}</h1>
    </div>

    <!-- Revisando el enlace -->
    <div v-if="state === 'checking'" class="text-center py-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Enlace vencido, usado o incompleto -->
    <template v-else-if="state === 'invalid'">
      <v-alert type="error" variant="tonal" class="mb-4">{{ $t('auth.resetLinkInvalid') }}</v-alert>
      <v-btn color="primary" block size="large" rounded :to="{ name: 'forgot-password' }" class="mb-2">
        {{ $t('auth.requestNewLink') }}
      </v-btn>
    </template>

    <!-- Listo -->
    <template v-else-if="state === 'done'">
      <v-alert type="success" variant="tonal" class="mb-4">{{ $t('auth.passwordResetDone') }}</v-alert>
      <v-btn color="primary" block size="large" rounded @click="goToLogin">
        <v-icon icon="mdi-login" start />
        {{ $t('auth.login') }}
      </v-btn>
    </template>

    <!-- Nueva contraseña -->
    <v-form v-else ref="formRef" @submit.prevent="submit">
      <v-text-field
        v-model="password"
        :label="$t('auth.newPassword')"
        :rules="passwordRules"
        :type="showPassword ? 'text' : 'password'"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-lock"
        :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
        autocomplete="new-password"
        autofocus
        class="mb-2"
        @click:append-inner="showPassword = !showPassword"
      />
      <v-text-field
        v-model="confirmation"
        :label="$t('auth.confirmPassword')"
        :rules="confirmationRules"
        :type="showPassword ? 'text' : 'password'"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-lock-check"
        autocomplete="new-password"
        class="mb-2"
      />
      <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
        {{ errorMessage }}
      </v-alert>
      <v-btn type="submit" color="primary" block size="large" rounded :loading="loading" class="mb-4">
        <v-icon icon="mdi-content-save" start />
        {{ $t('auth.saveNewPassword') }}
      </v-btn>
    </v-form>

    <div v-if="state !== 'done'" class="text-center">
      <v-btn variant="text" color="primary" prepend-icon="mdi-arrow-left" @click="goToLogin">
        {{ $t('auth.backToLogin') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const { t } = useI18n();
const { smAndUp } = useDisplay();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = String(route.query.token || '');
const state = ref('checking'); // checking | form | invalid | done
const formRef = ref(null);
const password = ref('');
const confirmation = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const headerIcon = computed(() => ({
  invalid: 'mdi-link-variant-off',
  done: 'mdi-check',
}[state.value] || 'mdi-lock-reset'));

const title = computed(() => ({
  invalid: t('auth.resetLinkInvalidTitle'),
  done: t('auth.passwordResetDoneTitle'),
}[state.value] || t('auth.newPasswordTitle')));

const passwordRules = computed(() => [
  v => !!v || t('errors.required'),
  v => (v?.length || 0) >= 8 || t('errors.invalidPassword'),
]);
const confirmationRules = computed(() => [
  v => v === password.value || t('auth.passwordsDoNotMatch'),
]);

onMounted(async () => {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    state.value = 'invalid';
    return;
  }
  try {
    const response = await api.post('/api/auth/reset-password/verify', { token });
    state.value = response.data.valid ? 'form' : 'invalid';
  } catch {
    state.value = 'invalid';
  }
});

const submit = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await api.post('/api/auth/reset-password', { token, password: password.value });
    state.value = 'done';
  } catch (error) {
    const status = error.response?.status;
    if (status === 400 && error.response?.data?.error === 'InvalidToken') {
      state.value = 'invalid';
    } else {
      errorMessage.value = status === 429 ? t('auth.tooManyAttempts') : t('errors.serverError');
    }
  } finally {
    loading.value = false;
  }
};

// Si cambió la contraseña, la sesión que hubiera abierta en este dispositivo ya no vale
const goToLogin = () => {
  if (state.value === 'done' && authStore.isAuthenticated) authStore.clearAuth();
  router.push({ name: authStore.isAuthenticated ? 'home' : 'login' });
};
</script>

<style lang="scss" scoped>
.reset-password-view .auth-header .v-avatar {
  border-radius: 50%;
}
</style>
