<!--
 * @file ProfilePhotoEditor.vue
 * @description Foto de perfil del usuario: verla, cambiarla (galería o cámara) o quitarla.
 * Se recorta cuadrada y se achica antes de subirla.
 -->

<template>
  <div class="profile-photo">
    <button
      type="button"
      class="profile-photo__avatar"
      :disabled="busy"
      :aria-label="$t('profile.changePhoto')"
      @click="pick('gallery')"
    >
      <v-avatar size="112" :color="photoUrl ? undefined : avatarColor">
        <v-img v-if="photoUrl" :src="photoUrl" :alt="$t('profile.photo')" cover />
        <span v-else class="text-white text-h4 font-weight-bold">{{ initials }}</span>
      </v-avatar>
      <span class="profile-photo__badge">
        <v-progress-circular v-if="busy" indeterminate size="18" width="2" color="white" />
        <v-icon v-else icon="mdi-camera" size="18" color="white" />
      </span>
    </button>

    <div class="profile-photo__actions">
      <v-menu location="bottom">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" color="primary" variant="tonal" prepend-icon="mdi-camera" :disabled="busy">
            {{ photoUrl ? $t('profile.changePhoto') : $t('profile.addPhoto') }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item prepend-icon="mdi-image" :title="$t('chat.attach.gallery')" @click="pick('gallery')" />
          <v-list-item prepend-icon="mdi-camera" :title="$t('chat.attach.camera')" @click="pick('camera')" />
        </v-list>
      </v-menu>
      <v-btn
        v-if="photoUrl"
        variant="text"
        color="error"
        prepend-icon="mdi-delete-outline"
        :disabled="busy"
        @click="confirmRemove = true"
      >
        {{ $t('profile.removePhoto') }}
      </v-btn>
    </div>

    <!-- Selectores ocultos. La cámara frontal ("user") es la natural para una foto de perfil -->
    <input ref="galleryInput" type="file" accept="image/*" hidden @change="handleFile" />
    <input ref="cameraInput" type="file" accept="image/*" capture="user" hidden @change="handleFile" />

    <v-dialog v-model="confirmRemove" max-width="340">
      <v-card>
        <v-card-title class="text-h6">{{ $t('profile.removePhoto') }}</v-card-title>
        <v-card-text>{{ $t('profile.removePhotoText') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmRemove = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="remove">{{ $t('common.delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';
import { cropSquareImage } from '@/utils/imageCompression';
import { getAvatarColor, getInitials, getUserDisplayName } from '@/utils/conversationDisplay';
import { resolveMediaUrl } from '@/utils/media';

const { t } = useI18n();
const authStore = useAuthStore();
const snackbar = inject('snackbar', null);

const galleryInput = ref(null);
const cameraInput = ref(null);
const busy = ref(false);
const confirmRemove = ref(false);

const user = computed(() => authStore.user);
const photoUrl = computed(() => resolveMediaUrl(user.value?.avatar_url));
const avatarColor = computed(() => getAvatarColor(user.value?.id));
const initials = computed(() => getInitials(getUserDisplayName(user.value)));

const pick = (source) => {
  (source === 'camera' ? cameraInput : galleryInput).value?.click();
};

const handleFile = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    snackbar?.error?.(t('profile.notAnImage'));
    return;
  }

  busy.value = true;
  try {
    await authStore.uploadAvatar(await cropSquareImage(file));
    snackbar?.show?.({ text: t('profile.photoUpdated'), color: 'success' });
  } catch (error) {
    console.error('Error al cambiar la foto de perfil:', error);
    snackbar?.error?.(t('profile.photoError'));
  } finally {
    busy.value = false;
  }
};

const remove = async () => {
  confirmRemove.value = false;
  busy.value = true;
  try {
    await authStore.removeAvatar();
    snackbar?.show?.({ text: t('profile.photoRemoved'), color: 'success' });
  } catch (error) {
    console.error('Error al quitar la foto de perfil:', error);
    snackbar?.error?.(t('profile.photoError'));
  } finally {
    busy.value = false;
  }
};
</script>

<style lang="scss" scoped>
.profile-photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.profile-photo__avatar {
  position: relative;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.profile-photo__badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 3px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}

.profile-photo__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
