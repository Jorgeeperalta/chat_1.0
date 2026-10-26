<!--
 * @file AppLayout.vue
 * @description Layout principal de la aplicación (para usuarios autenticados)
 * @author Arquitecto de Software Senior
 -->

<template>
    <!-- Navbar superior -->
    <v-app-bar
      app
      :elevation="appBarElevation"
      color="primary"
      density="comfortable"
    >
      <!-- Botón para abrir el menú lateral (mobile) -->
      <v-app-bar-nav-icon
        v-if="isMobile"
        variant="text"
        color="white"
        @click="drawer = !drawer"
      />

      <!-- Logo -->
      <v-toolbar-title class="text-white font-weight-bold">
        <router-link :to="{ name: 'home' }" class="text-white text-decoration-none">
          {{ $t('app.name') }}
        </router-link>
      </v-toolbar-title>

      <!-- Spacer -->
      <v-spacer />

      <!-- Selector de idioma -->
      <v-menu
        :close-on-content-click="false"
        location="bottom end"
        transition="scale-transition"
      >
        <template v-slot:activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            :prepend-icon="currentLanguageIcon"
            class="text-white"
          >
            {{ currentLanguageName }}
          </v-btn>
        </template>
        <v-list density="compact" nav>
          <v-list-item
            v-for="lang in availableLanguages"
            :key="lang.value"
            :value="lang.value"
            @click="changeLanguage(lang.value)"
          >
            <template v-slot:prepend>
              <v-icon :icon="lang.icon" />
            </template>
            <v-list-item-title>{{ lang.text }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- Botón de notificaciones -->
      <v-btn
        variant="text"
        icon
        color="white"
        class="ml-2"
      >
        <v-icon icon="mdi-bell" />
        <v-badge
          v-if="unreadNotifications > 0"
          :content="unreadNotifications"
          color="error"
          floating
          offset-y="-2"
          offset-x="4"
        />
      </v-btn>

      <!-- Botón de configuración -->
      <v-btn
        variant="text"
        icon
        color="white"
        class="ml-2"
        :to="{ name: 'settings' }"
      >
        <v-icon icon="mdi-cog" />
      </v-btn>

      <!-- Menú de usuario -->
      <v-menu
        :close-on-content-click="false"
        location="bottom end"
        transition="scale-transition"
      >
        <template v-slot:activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            class="ml-2"
          >
            <v-avatar
              v-if="currentUser?.avatar_url"
              :image="currentUser.avatar_url"
              size="32"
            />
            <v-avatar
              v-else
              color="white"
              size="32"
            >
              <span class="text-primary text-h6 font-weight-bold">
                {{ currentUserInitials }}
              </span>
            </v-avatar>
            <span
              v-if="!isMobile"
              class="ml-2 text-white"
            >
              {{ currentUserFullName }}
            </span>
          </v-btn>
        </template>
        <v-card min-width="250">
          <v-list density="compact" nav>
            <v-list-item :to="{ name: 'profile-settings' }">
              <template v-slot:prepend>
                <v-icon icon="mdi-account" />
              </template>
              <v-list-item-title>{{ $t('settings.profile') }}</v-list-item-title>
            </v-list-item>
            <v-list-item :to="{ name: 'preferences-settings' }">
              <template v-slot:prepend>
                <v-icon icon="mdi-cog-outline" />
              </template>
              <v-list-item-title>{{ $t('settings.preferences') }}</v-list-item-title>
            </v-list-item>
            <v-divider class="my-2" />
            <v-list-item @click="logout">
              <template v-slot:prepend>
                <v-icon icon="mdi-logout" />
              </template>
              <v-list-item-title class="text-error">{{ $t('auth.logout') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Navigation Drawer (menú lateral) -->
    <v-navigation-drawer
      v-model="drawer"
      :temporary="isMobile"
      :permanent="!isMobile"
      :width="navigationWidth"
      :rail="!isMobile && rail"
      @update:rail="rail = $event"
    >
      <!-- Header del drawer -->
      <template v-slot:prepend>
        <v-list-item v-if="!isMobile || !rail" lines="two">
          <v-list-item-avatar
            v-if="currentUser?.avatar_url"
            :image="currentUser.avatar_url"
            rounded="0"
          />
          <v-list-item-avatar
            v-else
            color="primary"
            rounded="0"
          >
            <span class="text-white text-h6 font-weight-bold">
              {{ currentUserInitials }}
            </span>
          </v-list-item-avatar>
          <v-list-item-title class="font-weight-bold">
            {{ currentUserFullName }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ currentUser?.email }}
          </v-list-item-subtitle>
        </v-list-item>
      </template>

      <!-- Lista de navegación -->
      <v-list density="compact" nav>
        <v-list-item
          :to="{ name: 'home' }"
          :active="currentRoute.name === 'home'"
          prepend-icon="mdi-home"
        >
          <v-list-item-title>{{ $t('common.home') }}</v-list-item-title>
        </v-list-item>

        <v-list-item
          :to="{ name: 'chat' }"
          :active="['chat', 'conversation', 'new-conversation'].includes(currentRoute.name)"
          prepend-icon="mdi-message-text"
        >
          <v-list-item-title>{{ $t('chat.chat') }}</v-list-item-title>
        </v-list-item>

        <v-list-item
          :to="{ name: 'new-conversation' }"
          :active="currentRoute.name === 'new-conversation'"
          prepend-icon="mdi-message-plus"
        >
          <v-list-item-title>{{ $t('chat.newConversation') }}</v-list-item-title>
        </v-list-item>

        <v-divider class="my-2" />

        <v-list-subheader>{{ $t('common.recent') }}</v-list-subheader>
        
        <!-- Conversaciones recientes -->
        <v-list-item
          v-for="conversation in recentConversations"
          :key="conversation.id"
          :to="{ name: 'conversation', params: { conversationId: conversation.id } }"
          :active="currentRoute.name === 'conversation' && currentRoute.params.conversationId === conversation.id"
          :prepend-avatar="conversation.user?.avatar_url || getAvatarUrl(conversation.user)"
          lines="two"
          class="mt-1"
        >
          <v-list-item-title>
            {{ conversation.user?.first_name }} {{ conversation.user?.last_name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            <span v-if="conversation.last_message">{{ truncateMessage(conversation.last_message.content) }}</span>
            <span v-else class="text-grey">{{ $t('chat.noMessages') }}</span>
          </v-list-item-subtitle>
          <template v-slot:append>
            <v-chip
              v-if="conversation.unread_count > 0"
              :color="conversation.unread_count > 0 ? 'error' : 'grey'"
              size="x-small"
              class="mt-1"
            >
              {{ conversation.unread_count }}
            </v-chip>
            <span class="text-caption text-grey">{{ formatTime(conversation.updated_at) }}</span>
          </template>
        </v-list-item>
      </v-list>

      <!-- Botón para nueva conversación (mobile) -->
      <template v-slot:append v-if="isMobile">
        <div class="pa-2">
          <v-btn
            block
            color="primary"
            prepend-icon="mdi-plus"
            :to="{ name: 'new-conversation' }"
          >
            {{ $t('chat.newConversation') }}
          </v-btn>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- Contenido principal -->
    <v-main class="app-main">
      <div class="app-main__content" :class="{ 'is-chat': isChatRoute }">
        <router-view />
      </div>
    </v-main>

    <!-- Botón flotante para nueva conversación (desktop) -->
    <v-btn
      v-if="!isMobile && !['chat', 'conversation', 'new-conversation'].includes(currentRoute.name)"
      color="primary"
      icon="mdi-message-plus"
      size="large"
      class="fixed-bottom-right"
      :to="{ name: 'new-conversation' }"
      fab
    />
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useTranslationStore } from '@/stores/translationStore';
import { useUserStore } from '@/stores/userStore';
import api from '@/services/api';

// ============================================
// STORES
// ============================================

const router = useRouter();
const route = useRoute();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const conversationStore = useConversationStore();
const translationStore = useTranslationStore();
const userStore = useUserStore();
const { locale } = useI18n();

// ============================================
// INJECT
// ============================================

const device = inject('device');
const snackbar = inject('snackbar');

// ============================================
// ESTADO LOCAL
// ============================================

const drawer = ref(false);
const rail = ref(false);

// ============================================
// COMPUTED
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);

const navigationWidth = computed(() => {
  if (isMobile.value) return 300;
  return rail.value ? 72 : 300;
});

const appBarElevation = computed(() => {
  return themeStore.currentTheme === 'dark' ? 4 : 2;
});

const currentRoute = computed(() => route);

// Las vistas de chat manejan su propio scroll (mensajes) y mantienen el input fijo
const isChatRoute = computed(() => ['home', 'chat', 'conversation'].includes(route.name));

const currentUser = computed(() => authStore.user);

const currentUserInitials = computed(() => {
  if (!currentUser.value) return 'U';
  const firstName = currentUser.value.first_name || '';
  const lastName = currentUser.value.last_name || '';
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
});

const currentUserFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  return `${currentUser.value.first_name || ''} ${currentUser.value.last_name || ''}`.trim() || currentUser.value.username || 'Usuario';
});

const recentConversations = computed(() => {
  return conversationStore.sortedConversations.slice(0, 5);
});

const unreadNotifications = computed(() => {
  return 0; // TODO: Implementar notificaciones
});

// Idiomas disponibles
const availableLanguages = computed(() => [
  { value: 'es', text: 'Español', icon: 'mdi-flag-outline-es' },
  { value: 'en', text: 'English', icon: 'mdi-flag-outline-us' },
  { value: 'fr', text: 'Français', icon: 'mdi-flag-outline-fr' },
  { value: 'de', text: 'Deutsch', icon: 'mdi-flag-outline-de' },
  { value: 'it', text: 'Italiano', icon: 'mdi-flag-outline-it' },
  { value: 'pt', text: 'Português', icon: 'mdi-flag-outline-pt' },
]);

const currentLanguage = computed(() => {
  const preferredLanguage = translationStore.languages.find(
    language => language.id === Number(authStore.user?.preferred_language_id)
  );
  return authStore.user?.preferredLanguage?.code || preferredLanguage?.code || locale.value || 'es';
});

const currentLanguageName = computed(() => {
  const lang = availableLanguages.value.find(l => l.value === currentLanguage.value);
  return lang ? lang.text : 'Español';
});

const currentLanguageIcon = computed(() => {
  const lang = availableLanguages.value.find(l => l.value === currentLanguage.value);
  return lang ? lang.icon : 'mdi-flag-outline-es';
});

// ============================================
// MÉTODOS
// ============================================

const changeLanguage = async (lang) => {
  try {
    if (!translationStore.languages.length) {
      await translationStore.fetchLanguages();
    }
    const language = translationStore.languages.find(item => item.code === lang);
    if (!language) throw new Error(`Idioma no disponible: ${lang}`);

    const response = await api.patch('/api/auth/me', {
      preferred_language_id: language.id,
    });
    authStore.user = response.data.user;
    userStore.setUser(response.data.user);
    localStorage.setItem('chat_app_user', JSON.stringify(response.data.user));
    themeStore.setLanguage(lang);
    snackbar?.show({ text: 'Idioma cambiado correctamente', color: 'success' });
  } catch (error) {
    console.error('Error al cambiar idioma:', error);
    snackbar?.error('Error al cambiar idioma');
  }
};

const logout = async () => {
  try {
    await authStore.logout();
    router.push({ name: 'login' });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};

const getAvatarUrl = (user) => {
  if (!user) return '';
  if (user.avatar_url) return user.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name + ' ' + user.last_name)}&background=random`;
};

const truncateMessage = (message) => {
  if (!message) return '';
  if (message.length > 40) {
    return message.substring(0, 40) + '...';
  }
  return message;
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  conversationStore.initialize();
  translationStore.initialize();
  userStore.fetchSettings(authStore.user?.id).catch((error) => {
    console.error('Error al cargar preferencias:', error);
  });
});
</script>

<style lang="scss" scoped>
// Área principal: ocupa exactamente el alto de la ventana (menos la app-bar)
// para que el scroll ocurra dentro de cada vista y no en la página.
.app-main {
  height: 100vh;
  height: 100dvh;
  background-color: var(--app-bg);
}

.app-main__content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  // En el chat, el scroll lo maneja la lista de mensajes
  &.is-chat {
    overflow: hidden;
  }

  > :deep(*) {
    flex: 1 1 auto;
    min-height: 0;
  }
}

// Posición del botón flotante
.fixed-bottom-right {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

// Transiciones para el drawer
:deep(.v-navigation-drawer) {
  transition: transform 0.3s ease, width 0.3s ease;
}

// Estilos para los items de la lista
:deep(.v-navigation-drawer .v-list-item) {
  border-radius: var(--app-radius-sm);
}

:deep(.v-navigation-drawer .v-list-item--active) {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

// Estilos para el avatar en el drawer
:deep(.v-list-item-avatar) {
  border-radius: 4px;
}

// Estilos para el subheader
:deep(.v-list-subheader) {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03125em;
  color: var(--app-text-muted);
}

// Estilos para el botón de nueva conversación
:deep(.v-btn--block) {
  margin-top: 8px;
}
</style>
