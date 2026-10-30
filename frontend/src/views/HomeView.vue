<!--
 * @file HomeView.vue
 * @description Inicio: lista de chats con el estado en línea de cada contacto
 -->

<template>
  <div class="home-view">
    <div class="home-content">
      <!-- Encabezado -->
      <div class="home-header">
        <h1 class="text-h5 font-weight-bold">{{ $t('chat.chats') }}</h1>
        <v-spacer />
        <v-btn
          variant="text"
          icon="mdi-account-multiple-plus"
          class="mr-1"
          :aria-label="$t('chat.newGroup')"
          :title="$t('chat.newGroup')"
          :to="{ name: 'new-conversation', query: { mode: 'group' } }"
        />
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-message-plus"
          :to="{ name: 'new-conversation' }"
        >
          <span class="d-none d-sm-inline">{{ $t('chat.newConversation') }}</span>
          <span class="d-sm-none">{{ $t('chat.startChat') }}</span>
        </v-btn>
      </div>

      <!-- Cargando (solo la primera vez, sin datos todavía) -->
      <div v-if="loading && chats.length === 0" class="text-center py-12">
        <v-progress-circular color="primary" indeterminate />
      </div>

      <!-- Sin chats -->
      <div v-else-if="chats.length === 0" class="home-empty text-center py-12">
        <v-icon icon="mdi-message-text-outline" size="56" color="grey" />
        <p class="text-subtitle-1 text-grey mt-3 mb-4">
          {{ $t('chat.noConversations') }}
        </p>
        <v-btn color="primary" prepend-icon="mdi-message-plus" :to="{ name: 'new-conversation' }">
          {{ $t('chat.startNewConversation') }}
        </v-btn>
      </div>

      <!-- Lista de chats -->
      <v-list v-else lines="two" class="chat-list" bg-color="transparent">
        <v-list-item
          v-for="chat in chats"
          :key="chat.id"
          :to="{ name: 'conversation', params: { conversationId: chat.id } }"
          class="chat-item"
        >
          <template v-slot:prepend>
            <v-badge
              :model-value="!chat.isGroup"
              dot
              bordered
              location="bottom end"
              offset-x="4"
              offset-y="4"
              :color="chat.online ? 'success' : 'grey-lighten-1'"
              class="mr-4"
            >
              <v-avatar size="48" :color="chat.avatarUrl ? undefined : 'primary'">
                <v-img v-if="chat.avatarUrl" :src="chat.avatarUrl" cover />
                <v-icon v-else-if="chat.isGroup" icon="mdi-account-group" color="white" />
                <span v-else class="text-white text-subtitle-1 font-weight-bold">{{ chat.initials }}</span>
              </v-avatar>
            </v-badge>
          </template>

          <v-list-item-title class="chat-item__title">
            <span class="text-truncate">{{ chat.title }}</span>
            <v-chip
              v-if="chat.unread > 0"
              color="primary"
              size="x-small"
              variant="flat"
              class="ml-2 flex-shrink-0"
            >
              {{ chat.unread > 99 ? '99+' : chat.unread }}
            </v-chip>
          </v-list-item-title>

          <v-list-item-subtitle class="chat-item__subtitle">
            <span v-if="chat.username" class="chat-item__username">@{{ chat.username }}</span>
            <span v-if="chat.username" class="mx-1">·</span>
            <span :class="{ 'text-success font-weight-medium': chat.online }">{{ chat.statusText }}</span>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import {
  getOtherUser,
  getConversationTitle,
  getInitials,
  formatRelativeTime,
} from '@/utils/conversationDisplay';

const { t, locale } = useI18n();
const authStore = useAuthStore();
const conversationStore = useConversationStore();

const loading = ref(false);

// "Últ. vez hace X min" debe avanzar aunque no lleguen eventos
const now = ref(Date.now());
let clock = null;

const currentUserId = computed(() => authStore.user?.id);

const statusText = (user) => {
  if (user?.status === 'online') return t('chat.online');
  if (!user?.last_seen_at) return t('chat.offline');
  return t('chat.lastSeen', { time: formatRelativeTime(user.last_seen_at, locale.value, now.value) });
};

const chats = computed(() =>
  conversationStore.sortedConversations
    .filter(conversation => !conversation.is_archived)
    .map(conversation => {
      const isGroup = conversation.type === 'group';
      const title = getConversationTitle(conversation, currentUserId.value);

      if (isGroup) {
        const members = conversation.users || [];
        const onlineCount = members.filter(user =>
          Number(user.id) !== Number(currentUserId.value) && user.status === 'online'
        ).length;
        return {
          id: conversation.id,
          isGroup,
          title,
          initials: getInitials(title),
          avatarUrl: conversation.avatar_url || '',
          username: '',
          online: onlineCount > 0,
          statusText: onlineCount > 0
            ? `${t('chat.participants', { n: members.length })} · ${t('chat.onlineCount', { n: onlineCount })}`
            : t('chat.participants', { n: members.length }),
          unread: conversation.unread_count || 0,
        };
      }

      const user = getOtherUser(conversation, currentUserId.value);
      return {
        id: conversation.id,
        isGroup,
        title,
        initials: getInitials(title),
        avatarUrl: user?.avatar_url || '',
        username: user?.username || '',
        online: user?.status === 'online',
        statusText: statusText(user),
        unread: conversation.unread_count || 0,
      };
    })
);

onMounted(async () => {
  clock = setInterval(() => { now.value = Date.now(); }, 60 * 1000);

  // Siempre recargar: trae el estado en línea actual de cada contacto
  loading.value = true;
  try {
    await conversationStore.fetchConversations();
  } catch (error) {
    console.error('Error al cargar los chats:', error);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  clearInterval(clock);
});
</script>

<style lang="scss" scoped>
.home-view {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.home-content {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 12px 88px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 12px;
}

.chat-list {
  padding: 0;
}

.chat-item {
  border-radius: 12px;
  margin-bottom: 2px;
  min-height: 72px;
}

.chat-item__title {
  display: flex;
  align-items: center;
  font-weight: 600;
}

.chat-item__subtitle {
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
}

.chat-item__username {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
