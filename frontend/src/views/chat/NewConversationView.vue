<!--
 * @file NewConversationView.vue
 * @description Nuevo chat: la agenda del usuario (sus contactos) y búsqueda por nombre de usuario
 * para agregar a alguien nuevo. No se listan todos los usuarios de la app.
 -->

<template>
  <div class="new-conversation-view">
    <!-- Encabezado -->
    <div class="nc-header">
      <v-btn variant="text" icon="mdi-arrow-left" :aria-label="$t('common.back')" @click="goBack" />
      <h1 class="text-h6 font-weight-bold">{{ $t('chat.newConversation') }}</h1>
    </div>

    <!-- Buscador por nombre de usuario -->
    <div class="nc-search">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('chat.searchByUsername')"
        variant="solo-filled"
        flat
        rounded="lg"
        hide-details
        clearable
        autofocus
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        prepend-inner-icon="mdi-at"
        class="nc-search__field"
        @keydown.enter="lookupNow"
      />
      <p class="text-caption text-medium-emphasis mt-2 mb-0 px-1">
        {{ $t('chat.usernameHint') }}
      </p>
    </div>

    <div class="nc-body">
      <!-- Usuario encontrado que todavía no está en la agenda -->
      <template v-if="foundUser">
        <v-list-subheader>{{ $t('chat.newContact') }}</v-list-subheader>
        <v-list-item lines="two" class="nc-user nc-user--found" @click="startChat(foundUser)">
          <template v-slot:prepend>
            <UserAvatar :user="foundUser" />
          </template>
          <v-list-item-title class="font-weight-medium">{{ displayName(foundUser) }}</v-list-item-title>
          <v-list-item-subtitle>@{{ foundUser.username }}</v-list-item-subtitle>
          <template v-slot:append>
            <v-btn color="primary" variant="flat" size="small" :loading="startingId === foundUser.id">
              {{ $t('chat.startChat') }}
            </v-btn>
          </template>
        </v-list-item>
      </template>

      <!-- Buscando / no existe -->
      <div v-else-if="searching" class="text-center py-4">
        <v-progress-circular color="primary" indeterminate size="24" />
      </div>
      <p
        v-else-if="notFoundUsername && filteredContacts.length === 0"
        class="text-body-2 text-medium-emphasis text-center py-6 px-4"
      >
        {{ $t('chat.userNotFound', { username: notFoundUsername }) }}
      </p>

      <!-- Agenda: contactos con los que ya chateó -->
      <template v-if="filteredContacts.length > 0">
        <v-list-subheader>{{ $t('chat.contacts') }}</v-list-subheader>
        <v-list-item
          v-for="user in filteredContacts"
          :key="user.id"
          lines="two"
          class="nc-user"
          @click="startChat(user)"
        >
          <template v-slot:prepend>
            <UserAvatar :user="user" show-status />
          </template>
          <v-list-item-title class="font-weight-medium">{{ displayName(user) }}</v-list-item-title>
          <v-list-item-subtitle>
            @{{ user.username }}
            <span class="mx-1">·</span>
            <span :class="{ 'text-success font-weight-medium': user.status === 'online' }">
              {{ user.status === 'online' ? $t('chat.online') : $t('chat.offline') }}
            </span>
          </v-list-item-subtitle>
          <template v-if="startingId === user.id" v-slot:append>
            <v-progress-circular color="primary" indeterminate size="20" />
          </template>
        </v-list-item>
      </template>

      <!-- Cargando la agenda -->
      <div v-if="loadingContacts" class="text-center py-6">
        <v-progress-circular color="primary" indeterminate />
      </div>

      <!-- Agenda vacía -->
      <div
        v-else-if="contacts.length === 0 && !searchQuery"
        class="nc-empty text-center py-10 px-6"
      >
        <v-icon icon="mdi-account-search" size="48" color="grey" />
        <p class="text-body-1 text-medium-emphasis mt-3 mb-0">{{ $t('chat.noContacts') }}</p>
      </div>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { VAvatar, VBadge, VImg } from 'vuetify/components';
import api from '@/services/api';
import { useConversationStore } from '@/stores/conversationStore';
import { getUserDisplayName, getInitials } from '@/utils/conversationDisplay';

// Mismo formato que la sanitización del backend (GET /api/users/search)
const MIN_USERNAME_LENGTH = 3;
const LOOKUP_DELAY_MS = 400;

const router = useRouter();
const { t } = useI18n();
const conversationStore = useConversationStore();

const searchQuery = ref('');
const contacts = ref([]);
const loadingContacts = ref(false);
const foundUser = ref(null);
const notFoundUsername = ref('');
const searching = ref(false);
const startingId = ref(null);
const snackbar = ref({ show: false, text: '', color: 'error' });

let lookupTimer = null;
let lookupSeq = 0;

// Avatar con iniciales y, opcionalmente, el punto de "en línea"
const UserAvatar = (props) => {
  const name = getUserDisplayName(props.user);
  const avatar = h(
    VAvatar,
    { size: 44, color: props.user.avatar_url ? undefined : 'primary' },
    () => props.user.avatar_url
      ? h(VImg, { src: props.user.avatar_url, cover: true })
      : h('span', { class: 'text-white font-weight-bold' }, getInitials(name))
  );
  if (!props.showStatus) return h('div', { class: 'mr-4' }, [avatar]);
  return h(VBadge, {
    dot: true,
    bordered: true,
    location: 'bottom end',
    offsetX: 3,
    offsetY: 3,
    color: props.user.status === 'online' ? 'success' : 'grey-lighten-1',
    class: 'mr-4',
  }, () => avatar);
};
UserAvatar.props = ['user', 'showStatus'];

const normalizedQuery = computed(() =>
  (searchQuery.value || '').trim().replace(/^@/, '').toLowerCase()
);

// Solo se busca por nombre de usuario
const filteredContacts = computed(() => {
  const q = normalizedQuery.value;
  if (!q) return contacts.value;
  return contacts.value.filter(user => user.username?.toLowerCase().includes(q));
});

const displayName = (user) => getUserDisplayName(user) || user.username;

const fetchContacts = async () => {
  loadingContacts.value = true;
  try {
    const { data } = await api.get('/api/users');
    contacts.value = data.users || [];
  } catch (error) {
    console.error('Error al cargar contactos:', error);
    showError(t('errors.loadUsersFailed'));
  } finally {
    loadingContacts.value = false;
  }
};

// Busca el usuario exacto en el servidor (solo si no es ya un contacto)
const lookupUser = async (username) => {
  const seq = ++lookupSeq;
  searching.value = true;
  try {
    const { data } = await api.get('/api/users/search', { params: { username } });
    if (seq !== lookupSeq) return; // llegó una búsqueda más nueva
    const user = data.user;
    if (user && !user.is_contact) {
      foundUser.value = user;
    } else if (!user) {
      notFoundUsername.value = username;
    }
  } catch (error) {
    if (seq === lookupSeq) console.error('Error al buscar usuario:', error);
  } finally {
    if (seq === lookupSeq) searching.value = false;
  }
};

const resetLookup = () => {
  clearTimeout(lookupTimer);
  lookupSeq++;
  foundUser.value = null;
  notFoundUsername.value = '';
  searching.value = false;
};

const lookupNow = () => {
  const username = normalizedQuery.value;
  if (username.length < MIN_USERNAME_LENGTH) return;
  if (contacts.value.some(user => user.username?.toLowerCase() === username)) return;
  clearTimeout(lookupTimer);
  lookupUser(username);
};

watch(normalizedQuery, () => {
  resetLookup();
  if (normalizedQuery.value.length >= MIN_USERNAME_LENGTH) {
    lookupTimer = setTimeout(lookupNow, LOOKUP_DELAY_MS);
  }
});

// Abre el chat existente con el usuario o crea uno nuevo (así queda en la agenda)
const startChat = async (user) => {
  if (startingId.value) return;
  startingId.value = user.id;
  try {
    const conversation = await conversationStore.createPrivateConversation(user.id);
    router.push({ name: 'conversation', params: { conversationId: conversation.id } });
  } catch (error) {
    console.error('Error al crear conversación:', error);
    showError(error?.response?.data?.message || t('errors.serverError'));
  } finally {
    startingId.value = null;
  }
};

const showError = (text) => {
  snackbar.value = { show: true, text, color: 'error' };
};

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push({ name: 'home' });
};

onMounted(async () => {
  // La lista de chats sirve para reusar un chat existente en vez de duplicarlo
  if (conversationStore.conversations.length === 0) {
    conversationStore.fetchConversations().catch(() => {});
  }
  await fetchContacts();
});

onUnmounted(() => {
  clearTimeout(lookupTimer);
});
</script>

<style lang="scss" scoped>
.new-conversation-view {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 760px;
  margin: 0 auto;
  padding-bottom: 24px;
}

.nc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 4px;
}

.nc-search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 16px 12px;
  background: rgb(var(--v-theme-background));
}

// Buscador grande y fácil de tocar
.nc-search__field :deep(.v-field) {
  min-height: 56px;
  font-size: 1.05rem;
}

.nc-search__field :deep(input) {
  min-height: 56px;
}

.nc-body {
  padding: 0 8px;
}

.nc-user {
  border-radius: 12px;
  min-height: 68px;
  margin-bottom: 2px;
}

.nc-user--found {
  background: rgba(var(--v-theme-primary), 0.08);
}
</style>
