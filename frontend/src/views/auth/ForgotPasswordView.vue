<!--
 * @file ForgotPasswordView.vue
 * @description "¿Olvidaste tu contraseña?": pide el correo y envía un enlace para restablecerla.
 * El mensaje de confirmación es siempre el mismo, exista o no la cuenta.
 -->

<template>
  <div class="forgot-password-view">
    <div class="auth-header text-center mb-4 mb-sm-6">
      <v-avatar color="primary" :size="smAndUp ? 72 : 56" class="mb-3 mx-auto">
        <v-icon :icon="sent ? 'mdi-email-check-outline' : 'mdi-lock-reset'" :size="smAndUp ? 36 : 28" color="white" />
      </v-avatar>
      <h1 class="text-h5 text-sm-h4 font-weight-bold">
        {{ sent ? $t('auth.checkYourEmail') : $t('auth.recoverAccount') }}
      </h1>
    </div>

    <!-- Enviado -->
    <template v-if="sent">
      <v-alert type="success" variant="tonal" class="mb-4">
        {{ $t('auth.resetLinkSentNeutral') }}
      </v-alert>
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ $t('auth.resetLinkHint', { minutes: 30 }) }}
      </p>
      <v-btn variant="text" color="primary" block :disabled="loading" @click="sent = false">
        {{ $t('auth.didNotReceiveEmail') }} {{ $t('auth.resendEmail') }}
      </v-btn>
    </template>

    <!-- Pedir el correo -->
    <v-form v-else ref="formRef" @submit.prevent="submit">
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ $t('auth.forgotPasswordDescription') }}
      </p>
      <v-text-field
        v-model="email"
        :label="$t('auth.email')"
        :rules="emailRules"
        type="email"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-email-outline"
        autocomplete="email"
        autofocus
        class="mb-2"
      />
      <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
        {{ errorMessage }}
      </v-alert>
      <v-btn type="submit" color="primary" block size="large" rounded :loading="loading" class="mb-4">
        <v-icon icon="mdi-send" start />
        {{ $t('auth.sendResetLink') }}
      </v-btn>
    </v-form>

    <div class="text-center">
      <v-btn variant="text" color="primary" prepend-icon="mdi-arrow-left" :to="{ name: 'login' }">
        {{ $t('auth.backToLogin') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import api from '@/services/api';

const { t } = useI18n();
const { smAndUp } = useDisplay();

const formRef = ref(null);
const email = ref('');
const loading = ref(false);
const sent = ref(false);
const errorMessage = ref('');

const emailRules = computed(() => [
  v => !!v?.trim() || t('errors.required'),
  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v?.trim() || '') || t('errors.invalidEmail'),
]);

const submit = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await api.post('/api/auth/forgot-password', { email: email.value.trim() });
    sent.value = true;
  } catch (error) {
    errorMessage.value = error.response?.status === 429
      ? t('auth.tooManyAttempts')
      : t('errors.serverError');
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.forgot-password-view .auth-header .v-avatar {
  border-radius: 50%;
}
</style>
