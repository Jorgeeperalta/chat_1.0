<!--
 * @file GroupMembersDialog.vue
 * @description Integrantes de un grupo. El administrador puede agregar y eliminar integrantes.
 -->

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    :fullscreen="smAndDown"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="group-members">
      <v-toolbar color="transparent" density="comfortable">
        <v-btn icon="mdi-close" variant="text" :aria-label="$t('common.close')" @click="close" />
        <v-toolbar-title>
          <div class="text-subtitle-1 font-weight-bold text-truncate">{{ conversation?.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ $t('chat.participants', { n: members.length }) }}</div>
        </v-toolbar-title>
      </v-toolbar>
      <v-divider />

      <v-card-text class="pa-0">
        <!-- Agregar integrantes (solo administradores) -->
        <template v-if="isAdmin">
          <v-list-item
            v-if="!adding"
            class="group-members__add"
            prepend-icon="mdi-account-plus"
            :title="$t('chat.addMembers')"
            base-color="primary"
            @click="startAdding"
          />
          <div v-else class="group-members__search">
            <v-text-field
              ref="searchField"
              v-model="searchQuery"
              :placeholder="$t('chat.searchByUsername')"
              :hint="$t('chat.usernameHint')"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              autocomplete="off"
              clearable
            />
            <v-list density="comfortable" class="py-0">
              <v-list-item
                v-for="user in candidates"
                :key="user.id"
                class="group-members__candidate"
                :title="displayName(user)"
                :subtitle="`@${user.username}`"
                :disabled="busyId != null"
                @click="addMember(user)"
              >
                <template #prepend>
                  <v-avatar size="40" class="mr-3" :color="user.avatar_url ? undefined : 'primary'">
                    <v-img v-if="user.avatar_url" :src="user.avatar_url" cover />
                    <span v-else class="text-white font-weight-bold">{{ getInitials(displayName(user)) }}</span>
                  </v-avatar>
                </template>
                <template #append>
                  <v-progress-circular v-if="busyId === user.id" indeterminate size="20" width="2" />
                  <v-icon v-else icon="mdi-plus" color="primary" />
                </template>
              </v-list-item>
            </v-list>
            <p v-if="searching" class="group-members__hint">
              <v-progress-circular indeterminate size="16" width="2" class="mr-2" />
            </p>
            <p v-else-if="notFoundUsername" class="group-members__hint">
              {{ $t('chat.userNotFound', { username: notFoundUsername }) }}
            </p>
            <p v-else-if="!candidates.length && !normalizedQuery" class="group-members__hint">
              {{ $t('chat.noContactsToAdd') }}
            </p>
          </div>
          <v-divider />
        </template>

        <!-- Integrantes -->
        <v-list density="comfortable">
          <v-list-subheader>{{ $t('chat.groupMembers') }}</v-list-subheader>
          <v-list-item
            v-for="member in members"
            :key="member.id"
            class="group-members__member"
            :title="isMe(member) ? $t('chat.you') : displayName(member)"
            :subtitle="`@${member.username}`"
          >
            <template #prepend>
              <v-avatar size="40" class="mr-3" :color="member.avatar_url ? undefined : 'primary'">
                <v-img v-if="member.avatar_url" :src="member.avatar_url" cover />
                <span v-else class="text-white font-weight-bold">{{ getInitials(displayName(member)) }}</span>
              </v-avatar>
            </template>
            <template #append>
              <v-chip v-if="member.UserConversation?.role === 'admin'" size="x-small" color="primary" variant="tonal" class="mr-1">
                {{ $t('chat.admin') }}
              </v-chip>
              <v-btn
                v-if="canRemove(member)"
                icon="mdi-account-remove"
                variant="text"
                size="small"
                color="error"
                :loading="busyId === member.id"
                :disabled="busyId != null"
                :aria-label="$t('chat.removeFromGroup')"
                :title="$t('chat.removeFromGroup')"
                @click="memberToRemove = member"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Confirmación para eliminar a un integrante -->
    <v-dialog :model-value="!!memberToRemove" max-width="360" @update:model-value="memberToRemove = null">
      <v-card>
        <v-card-title class="text-h6">{{ $t('chat.removeFromGroup') }}</v-card-title>
        <v-card-text>{{ $t('chat.removeMemberText', { name: displayName(memberToRemove) }) }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="memberToRemove = null">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="confirmRemove">{{ $t('common.delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, inject, onUnmounted } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import { getUserDisplayName, getInitials } from '@/utils/conversationDisplay';

// Igual que en NewConversationView: búsqueda exacta por nombre de usuario
const MIN_USERNAME_LENGTH = 3;
const LOOKUP_DELAY_MS = 400;

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  conversation: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { smAndDown } = useDisplay();
const authStore = useAuthStore();
const conversationStore = useConversationStore();
const snackbar = inject('snackbar', null);

const adding = ref(false);
const contacts = ref([]);
const searchQuery = ref('');
const searchField = ref(null);
const foundUser = ref(null);
const notFoundUsername = ref('');
const searching = ref(false);
const busyId = ref(null);
const memberToRemove = ref(null);

let lookupTimer = null;
let lookupSeq = 0;

const members = computed(() => props.conversation?.users || []);

const isMe = (user) => Number(user?.id) === Number(authStore.user?.id);

const isAdmin = computed(() => conversationStore.getMembership(props.conversation).role === 'admin');

// Igual que el backend: no a uno mismo (eso es "salir") ni al creador del grupo
const canRemove = (member) =>
  isAdmin.value && !isMe(member) && Number(member.id) !== Number(props.conversation?.created_by);

const displayName = (user) => getUserDisplayName(user) || user?.username || '';

const normalizedQuery = computed(() =>
  (searchQuery.value || '').trim().replace(/^@/, '').toLowerCase()
);

// Contactos que todavía no están en el grupo, filtrados por lo que se escribe,
// más el usuario encontrado por nombre exacto (puede no ser un contacto)
const candidates = computed(() => {
  const memberIds = new Set(members.value.map(member => Number(member.id)));
  const query = normalizedQuery.value;
  const list = contacts.value.filter(user =>
    !memberIds.has(Number(user.id)) && (!query || user.username.toLowerCase().includes(query))
  );
  const found = foundUser.value;
  if (found && !memberIds.has(Number(found.id)) && !list.some(user => user.id === found.id)) {
    list.unshift(found);
  }
  return list;
});

const lookupUser = async (username) => {
  const seq = ++lookupSeq;
  searching.value = true;
  try {
    const { data } = await api.get('/api/users/search', { params: { username } });
    if (seq !== lookupSeq) return; // llegó una búsqueda más nueva
    foundUser.value = data.user || null;
    // Solo avisar si tampoco hay contactos que coincidan
    notFoundUsername.value = !data.user && !candidates.value.length ? username : '';
  } catch (error) {
    if (seq === lookupSeq) {
      console.error('Error al buscar usuario:', error);
      foundUser.value = null;
    }
  } finally {
    if (seq === lookupSeq) searching.value = false;
  }
};

watch(normalizedQuery, (query) => {
  clearTimeout(lookupTimer);
  lookupSeq++;
  foundUser.value = null;
  notFoundUsername.value = '';
  searching.value = false;
  if (query.length >= MIN_USERNAME_LENGTH) {
    lookupTimer = setTimeout(() => lookupUser(query), LOOKUP_DELAY_MS);
  }
});

const startAdding = async () => {
  adding.value = true;
  await nextTick();
  searchField.value?.focus();
  try {
    const { data } = await api.get('/api/users');
    contacts.value = data.users || [];
  } catch (error) {
    console.error('Error al cargar contactos:', error);
  }
};

const errorMessage = (error) =>
  error?.response?.data?.details?.[0]?.msg || error?.response?.data?.message || t('errors.serverError');

const addMember = async (user) => {
  if (busyId.value != null) return;
  busyId.value = user.id;
  try {
    await conversationStore.addParticipants(props.conversation.id, [user.id]);
    searchQuery.value = '';
    snackbar?.show?.({ text: t('chat.memberAdded', { name: displayName(user) }), color: 'success' });
  } catch (error) {
    console.error('Error al agregar integrante:', error);
    snackbar?.error?.(errorMessage(error));
  } finally {
    busyId.value = null;
  }
};

const confirmRemove = async () => {
  const member = memberToRemove.value;
  memberToRemove.value = null;
  if (!member || busyId.value != null) return;
  busyId.value = member.id;
  try {
    await conversationStore.removeParticipant(props.conversation.id, member.id);
    snackbar?.show?.({ text: t('chat.memberRemoved', { name: displayName(member) }), color: 'success' });
  } catch (error) {
    console.error('Error al eliminar integrante:', error);
    snackbar?.error?.(errorMessage(error));
  } finally {
    busyId.value = null;
  }
};

const close = () => emit('update:modelValue', false);

// Al cerrar, la próxima vez se abre con la lista de integrantes
watch(() => props.modelValue, (open) => {
  if (!open) {
    adding.value = false;
    searchQuery.value = '';
  }
});

onUnmounted(() => {
  clearTimeout(lookupTimer);
});
</script>

<style lang="scss" scoped>
.group-members__search {
  padding: 12px 16px 4px;
}

.group-members__hint {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8px 0 12px;
  font-size: 0.85rem;
  color: var(--app-text-muted);
}
</style>
