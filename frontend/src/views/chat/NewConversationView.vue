<!--
 * @file NewConversationView.vue
 * @description Vista para crear nueva conversación
 * @author Arquitecto de Software Senior
 -->

<template>
  <v-container fluid class="new-conversation-view fill-height pa-0">
    <!-- Header -->
    <v-app-bar
      density="comfortable"
      color="transparent"
      flat
      class="app-bar"
    >
      <v-btn
        variant="text"
        icon
        @click="goBack"
      >
        <v-icon icon="mdi-arrow-left" />
      </v-btn>
      
      <v-toolbar-title class="font-weight-medium">
        {{ $t('chat.newConversation') }}
      </v-toolbar-title>
      
      <v-spacer />
      
      <!-- Filtro de idioma -->
      <v-menu
        :close-on-content-click="false"
        location="bottom end"
        transition="scale-transition"
      >
        <template v-slot:activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            icon
          >
            <v-icon icon="mdi-filter" />
            <v-tooltip activator="parent" location="bottom">
              {{ $t('common.filter') }}
            </v-tooltip>
          </v-btn>
        </template>
        <v-list density="compact" nav>
          <v-list-item @click="filterByAll">
            <v-list-item-title>{{ $t('common.all') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="filterByOnline">
            <template v-slot:prepend>
              <v-icon icon="mdi-circle" size="small" color="success" />
            </template>
            <v-list-item-title>{{ $t('chat.online') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="filterByLanguage">
            <template v-slot:prepend>
              <v-icon :icon="currentLanguageIcon" />
            </template>
            <v-list-item-title>{{ $t('settings.language') }}: {{ currentLanguageName }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Barra de búsqueda -->
    <div class="search-bar px-4 py-2">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('chat.searchUsers')"
        density="comfortable"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-magnify"
        clearable
        @update:modelValue="searchUsers"
      />
    </div>

    <!-- Lista de usuarios -->
    <v-list density="comfortable" nav class="user-list">
      <!-- Usuario seleccionado -->
      <template v-if="selectedUser">
        <v-list-item
          class="selected-user"
          :prepend-avatar="getUserAvatar(selectedUser)"
          lines="two"
        >
          <template v-slot:title>
            <strong>{{ getUserName(selectedUser) }}</strong>
          </template>
          <template v-slot:subtitle>
            <span class="text-caption">
              {{ selectedUser.username }} | {{ $t('chat.selected') }}
            </span>
          </template>
          <template v-slot:append>
            <v-btn
              color="primary"
              variant="elevated"
              size="small"
              @click="createConversation"
            >
              {{ $t('chat.startChat') }}
            </v-btn>
          </template>
        </v-list-item>
        <v-divider class="my-2" />
      </template>

      <!-- Usuarios -->
      <template v-for="user in filteredUsers" :key="user.id">
        <v-list-item
          v-if="user.id !== currentUserId"
          @click="selectUser(user)"
          :active="selectedUser?.id === user.id"
          :prepend-avatar="getUserAvatar(user)"
          lines="two"
        >
          <template v-slot:title>
            {{ getUserName(user) }}
          </template>
          <template v-slot:subtitle>
            <span class="text-caption">
              {{ user.username }} | {{ getUserLanguage(user) }}
            </span>
          </template>
          <template v-slot:append>
            <v-chip
              v-if="isOnline(user)"
              color="success"
              variant="tonal"
              size="x-small"
              class="ml-2"
            >
              {{ $t('chat.online') }}
            </v-chip>
          </template>
        </v-list-item>
      </template>

      <!-- Indicador de carga -->
      <div
        v-if="loading"
        class="text-center py-4"
      >
        <v-progress-circular
          color="primary"
          indeterminate
          size="24"
        />
      </div>

      <!-- Mensaje de no hay usuarios -->
      <div
        v-if="!loading && filteredUsers.length === 0"
        class="no-users text-center py-8"
      >
        <v-icon icon="mdi-account-search" size="40" color="grey" />
        <p class="text-subtitle-1 text-grey mt-2">
          {{ searchQuery ? $t('chat.noUsersFound') : $t('chat.noUsersAvailable') }}
        </p>
      </div>
    </v-list>

    <!-- Diálogo de crear conversación grupal -->
    <v-dialog v-model="groupDialog" max-width="500">
      <v-card>
        <v-card-title>
          <span class="text-h5 font-weight-bold">{{ $t('chat.createGroup') }}</span>
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="groupName"
            :label="$t('chat.groupName')"
            :placeholder="$t('chat.groupName')"
            density="comfortable"
            variant="outlined"
            class="mb-4"
          />
          
          <v-select
            v-model="selectedUsers"
            :label="$t('chat.addMembers')"
            :placeholder="$t('chat.addMembers')"
            :items="availableUsers"
            item-title="name"
            item-value="id"
            multiple
            chips
            density="comfortable"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="groupDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!groupName.trim() || selectedUsers.length === 0"
            @click="createGroup"
          >
            {{ $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useConversationStore } from '@/stores/conversationStore';
import api from '@/services/api';

// ============================================
// INJECT
// ============================================

const device = inject('device');

// ============================================
// STORES
// ============================================

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const userStore = useUserStore();
const conversationStore = useConversationStore();

// ============================================
// ESTADO LOCAL
// ============================================

const isMobile = computed(() => device?.isMobile?.value || false);
const searchQuery = ref('');
const loading = ref(false);
const users = ref([]);
const selectedUser = ref(null);
const filterType = ref('all'); // all, online, language
const groupDialog = ref(false);
const groupName = ref('');
const selectedUsers = ref([]);
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');

// ============================================
// COMPUTED
// ============================================

const currentUserId = computed(() => authStore.user?.id);

const filteredUsers = computed(() => {
  let filtered = users.value;
  
  // Filtrar por búsqueda
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(user => {
      const name = getUserName(user).toLowerCase();
      const username = user.username?.toLowerCase() || '';
      return name.includes(query) || username.includes(query);
    });
  }
  
  // Filtrar por tipo
  switch (filterType.value) {
    case 'online':
      filtered = filtered.filter(user => isOnline(user));
      break;
    case 'language':
      const currentLang = userStore.preferredLanguage || userStore.user?.preferred_language_id || 'es';
      filtered = filtered.filter(user => user.preferred_language_id === currentLang);
      break;
  }
  
  // Excluir el usuario actual
  return filtered.filter(user => user.id !== currentUserId.value);
});

const availableUsers = computed(() => {
  return filteredUsers.value.map(user => ({
    id: user.id,
    name: getUserName(user),
  }));
});

const currentLanguage = computed(() => {
  return userStore.preferredLanguage || userStore.user?.preferred_language_id || 'es';
});

const currentLanguageIcon = computed(() => {
  const languages = userStore.languages;
  if (!languages) return 'mdi-flag-outline-es';
  const lang = languages.find(l => l.id === currentLanguage.value || l.code === currentLanguage.value);
  return lang?.flag || 'mdi-flag-outline-es';
});

const currentLanguageName = computed(() => {
  const languages = userStore.languages;
  if (!languages) return 'Idioma';
  const lang = languages.find(l => l.id === currentLanguage.value || l.code === currentLanguage.value);
  return lang?.name || 'Idioma';
});

// ============================================
// MÉTODOS
// ============================================

const goBack = () => {
  router.go(-1);
};

const fetchUsers = async () => {
  try {
    loading.value = true;
    const response = await api.get('/api/users', {
      params: {
        limit: 100,
        exclude: currentUserId.value,
      },
    });
    users.value = response.data.users || [];
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    showSnackbarMessage(t('errors.loadUsersFailed'), 'error');
  } finally {
    loading.value = false;
  }
};

const searchUsers = () => {
  // La filtración se hace automáticamente en la propiedad computada
};

const selectUser = (user) => {
  selectedUser.value = user;
};

const createConversation = async () => {
  if (!selectedUser.value) return;
  
  try {
    loading.value = true;
    const conversation = await conversationStore.createPrivateConversation(
      selectedUser.value.id
    );
    
    // Redirigir a la conversación
    router.push({
      name: 'conversation',
      params: { conversationId: conversation.id },
    });
  } catch (error) {
    console.error('Error al crear conversación:', error);
    const errorMessage = error?.response?.data?.message || 
      error?.message || 
      'Error al crear conversación';
    showSnackbarMessage(errorMessage, 'error');
  } finally {
    loading.value = false;
  }
};

const createGroup = async () => {
  try {
    loading.value = true;
    
    const response = await api.post('/api/conversations/group', {
      name: groupName.value.trim(),
      user_ids: selectedUsers.value,
    });
    
    const conversation = response.data.conversation;
    
    // Añadir al store
    conversationStore.addConversation(conversation);
    
    // Cerrar diálogo y redirigir
    groupDialog.value = false;
    groupName.value = '';
    selectedUsers.value = [];
    
    router.push({
      name: 'conversation',
      params: { conversationId: conversation.id },
    });
    
    showSnackbarMessage('Grupo creado correctamente', 'success');
  } catch (error) {
    console.error('Error al crear grupo:', error);
    const errorMessage = error?.response?.data?.message || 
      error?.message || 
      'Error al crear grupo';
    showSnackbarMessage(errorMessage, 'error');
  } finally {
    loading.value = false;
  }
};

const filterByAll = () => {
  filterType.value = 'all';
};

const filterByOnline = () => {
  filterType.value = 'online';
};

const filterByLanguage = () => {
  filterType.value = 'language';
};

const isOnline = (user) => {
  return userStore.isUserOnline(user.id);
};

const getUserName = (user) => {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Usuario';
};

const getUserAvatar = (user) => {
  if (!user) return '';
  return user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserName(user))}&background=random`;
};

const getUserLanguage = (user) => {
  if (!user.preferred_language_id) return '';
  const languages = userStore.languages;
  if (!languages) return '';
  const lang = languages.find(l => l.id === user.preferred_language_id || l.code === user.preferred_language_id);
  return lang?.name || user.preferred_language_id;
};

const showSnackbarMessage = (text, color = 'info') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  fetchUsers();
});
</script>

<style lang="scss" scoped>
.new-conversation-view {
  display: flex;
  flex-direction: column;
  background-color: #FFFFFF;
  
  .app-bar {
    background-color: #FFFFFF;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
  
  .search-bar {
    background-color: #F5F5F5;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
  
  .user-list {
    flex: 1;
    overflow-y: auto;
    background-color: #FFFFFF;
    
    // Scrollbar custom
    &::-webkit-scrollbar {
      width: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 2px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4);
    }
    
    .v-list-item {
      padding: 12px 16px;
      
      :deep(.v-list-item__prepend) {
        margin-right: 16px;
        
        .v-avatar {
          border-radius: 50%;
        }
      }
      
      :deep(.v-list-item__title) {
        font-weight: 500;
      }
      
      :deep(.v-list-item__subtitle) {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      &:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
      
      // Estado seleccionado
      &.v-list-item--active {
        background-color: rgba(24, 103, 192, 0.1);
      }
    }
    
    .selected-user {
      background-color: rgba(24, 103, 192, 0.1);
      border-radius: 8px;
      margin: 8px 12px;
      
      :deep(.v-list-item__title) {
        color: #1867C0;
      }
    }
    
    .no-users {
      color: rgba(0, 0, 0, 0.54);
      
      .v-icon {
        opacity: 0.6;
      }
    }
  }
  
  // Diálogo de grupo
  :deep(.v-dialog) {
    .v-card {
      border-radius: 12px;
    }
    
    .v-card-text {
      padding: 20px;
    }
  }
}

// Transiciones
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.v-list-item {
  animation: slideIn 0.2s ease-out;
}

// Responsive
@media (max-width: 768px) {
  .new-conversation-view {
    .search-bar {
      padding: 8px 12px;
    }
    
    .user-list {
      .v-list-item {
        padding: 10px 12px;
      }
    }
  }
}
</style>
