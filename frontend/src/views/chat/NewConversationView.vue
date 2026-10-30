<!--
 * @file NewConversationView.vue
 * @description Nuevo chat: búsqueda por nombre de usuario (chat privado) o creación de un grupo.
 * Los integrantes del grupo salen de la agenda (contactos) o de la búsqueda exacta.
 -->

<template>
  <div class="new-conversation-view">
    <!-- Encabezado -->
    <div class="nc-header">
      <v-btn variant="text" icon="mdi-arrow-left" :aria-label="$t('common.back')" @click="goBack" />
      <h1 class="text-h6 font-weight-bold">
        {{ isGroupMode ? $t('chat.newGroup') : $t('chat.newConversation') }}
      </h1>
    </div>

    <v-btn-toggle
      v-model="mode"
      mandatory
      color="primary"
      variant="outlined"
      density="comfortable"
      divided
      class="nc-mode mx-4 mb-2"
    >
      <v-btn value="private" prepend-icon="mdi-account">{{ $t('chat.newChat') }}</v-btn>
      <v-btn value="group" prepend-icon="mdi-account-group">{{ $t('chat.newGroup') }}</v-btn>
    </v-btn-toggle>

    <!-- Datos del grupo -->
    <div v-if="isGroupMode" class="nc-group px-4">
      <v-text-field
        v-model="groupName"
        :label="$t('chat.groupName')"
        variant="outlined"
        density="comfortable"
        maxlength="100"
        counter
        prepend-inner-icon="mdi-account-group"
      />
      <div v-if="selectedMembers.length" class="nc-selected">
        <v-chip
          v-for="user in selectedMembers"
          :key="user.id"
          closable
          color="primary"
          variant="tonal"
          class="nc-selected__chip"
          @click:close="toggleMember(user)"
        >
          {{ displayName(user) }}
        </v-chip>
      </div>
    </div>

    <!-- Buscador por nombre de usuario -->
    <div class="nc-search">
      <v-text-field
        v-model="searchQuery"
        :placeholder="isGroupMode ? $t('chat.addMember') : $t('chat.searchByUsername')"
        variant="solo-filled"
        flat
        rounded="lg"
        hide-details
        clearable
        :autofocus="!isGroupMode"
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
      <div v-if="searching" class="text-center py-4">
        <v-progress-circular color="primary" indeterminate size="24" />
      </div>

      <template v-else-if="foundUser">
        <v-list-subheader>{{ $t('chat.newContact') }}</v-list-subheader>
        <v-list-item lines="two" class="nc-user nc-user--found" @click="selectUser(foundUser)">
          <template v-slot:prepend>
            <UserAvatar :user="foundUser" />
          </template>
          <v-list-item-title class="font-weight-medium">{{ displayName(foundUser) }}</v-list-item-title>
          <v-list-item-subtitle>@{{ foundUser.username }}</v-list-item-subtitle>
          <template v-slot:append>
            <v-checkbox-btn v-if="isGroupMode" :model-value="isSelected(foundUser)" color="primary" readonly />
            <v-btn v-else color="primary" variant="flat" size="small" :loading="startingId === foundUser.id">
              {{ $t('chat.startChat') }}
            </v-btn>
          </template>
        </v-list-item>
      </template>

      <p
        v-else-if="notFoundUsername"
        class="text-body-2 text-medium-emphasis text-center py-6 px-4"
      >
        {{ $t('chat.userNotFound', { username: notFoundUsername }) }}
      </p>

      <!-- Grupo: elegir integrantes de la agenda -->
      <template v-if="isGroupMode && !searching">
        <v-list-subheader v-if="filteredContacts.length">{{ $t('chat.contacts') }}</v-list-subheader>
        <v-list-item
          v-for="user in filteredContacts"
          :key="user.id"
          lines="two"
          class="nc-user"
          @click="toggleMember(user)"
        >
          <template v-slot:prepend>
            <UserAvatar :user="user" show-status />
          </template>
          <v-list-item-title class="font-weight-medium">{{ displayName(user) }}</v-list-item-title>
          <v-list-item-subtitle>@{{ user.username }}</v-list-item-subtitle>
          <template v-slot:append>
            <v-checkbox-btn :model-value="isSelected(user)" color="primary" readonly />
          </template>
        </v-list-item>
        <p
          v-if="!contacts.length && !foundUser && !notFoundUsername"
          class="text-body-2 text-medium-emphasis text-center py-6 px-4"
        >
          {{ $t('chat.noContacts') }}
        </p>
      </template>

      <div v-else-if="!isGroupMode && !foundUser && !notFoundUsername && !searching" class="nc-empty text-center py-10 px-6">
        <v-icon icon="mdi-account-search" size="48" color="grey" />
        <p class="text-body-1 text-medium-emphasis mt-3 mb-0">
          {{ $t('chat.searchByUsername') }}
        </p>
      </div>
    </div>

    <!-- Crear el grupo -->
    <div v-if="isGroupMode" class="nc-footer">
      <span class="text-body-2 text-medium-emphasis">
        {{ $t('chat.selectedMembers', { n: selectedMembers.length }) }}
      </span>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-check"
        :loading="creatingGroup"
        :disabled="!canCreateGroup"
        @click="createGroup"
      >
        {{ $t('chat.createGroup') }}
      </v-btn>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { VAvatar, VBadge, VImg } from 'vuetify/components';
import api from '@/services/api';
import { useConversationStore } from '@/stores/conversationStore';
import { getUserDisplayName, getInitials } from '@/utils/conversationDisplay';

// Mismo formato que la validación del backend (POST /api/users/search).
const MIN_USERNAME_LENGTH = 3;
const LOOKUP_DELAY_MS = 400;

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const conversationStore = useConversationStore();

// 'private' = chat con una persona, 'group' = nuevo grupo (/chat/new?mode=group)
const mode = ref(route.query.mode === 'group' ? 'group' : 'private');
const isGroupMode = computed(() => mode.value === 'group');
const groupName = ref('');
const selectedMembers = ref([]);
const contacts = ref([]);
const creatingGroup = ref(false);

const searchQuery = ref('');
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

const displayName = (user) => getUserDisplayName(user) || user.username;

// Busca el usuario exacto en el servidor para iniciar una conversación.
const lookupUser = async (username) => {
  const seq = ++lookupSeq;
  searching.value = true;
  try {
    let response;
    try {
      response = await api.post('/api/users/search', { query: username });
    } catch (error) {
      // Compatibilidad temporal con backends que todavía exponen solo GET.
      // Una vez todos los entornos estén actualizados, puede quitarse este fallback.
      if (error?.response?.status !== 404) throw error;
      response = await api.get('/api/users/search', { params: { username } });
    }
    const { data } = response;
    if (seq !== lookupSeq) return; // llegó una búsqueda más nueva

    if (data.user) {
      foundUser.value = data.user;
      notFoundUsername.value = '';
    } else {
      foundUser.value = null;
      notFoundUsername.value = username;
    }
  } catch (error) {
    if (seq === lookupSeq) {
      console.error('Error al buscar usuario:', error);
      foundUser.value = null;
      notFoundUsername.value = username;
    }
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
  if (username.length < MIN_USERNAME_LENGTH) {
    resetLookup();
    return;
  }

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

// ---- Grupos ----

const isSelected = (user) => selectedMembers.value.some(member => member.id === user.id);

const toggleMember = (user) => {
  selectedMembers.value = isSelected(user)
    ? selectedMembers.value.filter(member => member.id !== user.id)
    : [...selectedMembers.value, user];
};

// Contactos filtrados por lo que se escribe en el buscador (solo nombre de usuario)
const filteredContacts = computed(() => {
  const query = normalizedQuery.value;
  return contacts.value.filter(user =>
    !query || user.username.toLowerCase().includes(query)
  ).filter(user => user.id !== foundUser.value?.id);
});

const canCreateGroup = computed(() =>
  groupName.value.trim().length > 0 && selectedMembers.value.length > 0 && !creatingGroup.value
);

const createGroup = async () => {
  if (!groupName.value.trim()) return showError(t('chat.groupNeedsName'));
  if (!selectedMembers.value.length) return showError(t('chat.groupNeedsMembers'));

  creatingGroup.value = true;
  try {
    const conversation = await conversationStore.createConversation({
      type: 'group',
      name: groupName.value.trim(),
      participant_ids: selectedMembers.value.map(user => user.id),
    });
    router.push({ name: 'conversation', params: { conversationId: conversation.id } });
  } catch (error) {
    console.error('Error al crear grupo:', error);
    const details = error?.response?.data?.details;
    showError(details?.[0]?.msg || error?.response?.data?.message || t('errors.serverError'));
  } finally {
    creatingGroup.value = false;
  }
};

const loadContacts = async () => {
  try {
    const { data } = await api.get('/api/users');
    contacts.value = data.users || [];
  } catch (error) {
    console.error('Error al cargar contactos:', error);
  }
};

// En modo grupo, tocar un usuario lo agrega/quita; en modo chat, abre el chat
const selectUser = (user) => {
  if (isGroupMode.value) {
    toggleMember(user);
    searchQuery.value = '';
  } else {
    startChat(user);
  }
};

watch(mode, (value) => {
  router.replace({ query: value === 'group' ? { mode: 'group' } : {} });
  if (value === 'group' && contacts.value.length === 0) loadContacts();
});

const showError = (text) => {
  snackbar.value = { show: true, text, color: 'error' };
};

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push({ name: 'home' });
};

onMounted(async () => {
  // La lista de chats sirve para reusar un chat existente en vez de duplicarlo.
  if (conversationStore.conversations.length === 0) {
    conversationStore.fetchConversations().catch(() => {});
  }
  if (isGroupMode.value) loadContacts();
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

.nc-mode {
  display: flex;

  .v-btn {
    flex: 1 1 0;
  }
}

.nc-group {
  padding-top: 8px;
}

.nc-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

// Botón de crear grupo siempre visible abajo
.nc-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: rgb(var(--v-theme-background));
  border-top: 1px solid var(--app-border);
}
</style>
