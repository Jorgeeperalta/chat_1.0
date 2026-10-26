import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createRouter, createMemoryHistory } from 'vue-router';
import HomeView from '../HomeView.vue';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';

// jsdom no trae ResizeObserver (Vuetify lo usa)
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  messages: {
    es: {
      chat: {
        chats: 'Chats',
        newConversation: 'Nueva Conversación',
        startChat: 'Iniciar chat',
        noConversations: 'Todavía no tienes chats',
        startNewConversation: 'Iniciar un chat',
        online: 'En línea',
        offline: 'Desconectado',
        lastSeen: 'Últ. vez {time}',
        participants: '{n} participantes',
        onlineCount: '{n} en línea',
      },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/chat/:conversationId', name: 'conversation', component: { template: '<div />' } },
    { path: '/chat/new', name: 'new-conversation', component: { template: '<div />' } },
  ],
});

const ME = { id: 1, username: 'yo', first_name: 'Yo', last_name: '' };
const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();

const conversations = () => [
  {
    id: 10, type: 'private', last_message_at: '2026-10-26T12:00:00Z', unread_count: 3,
    users: [ME, { id: 2, username: 'ana', first_name: 'Ana', last_name: 'García', status: 'online' }],
  },
  {
    id: 11, type: 'private', last_message_at: '2026-10-26T11:00:00Z', unread_count: 0,
    users: [ME, { id: 3, username: 'bruno', first_name: '', last_name: '', status: 'offline', last_seen_at: hace5min }],
  },
  {
    id: 12, type: 'group', name: 'Equipo', last_message_at: '2026-10-26T10:00:00Z', unread_count: 0,
    users: [ME, { id: 2, status: 'online' }, { id: 3, status: 'offline' }],
  },
  { id: 13, type: 'private', is_archived: true, users: [ME, { id: 4, username: 'archivado' }] },
];

const mountHome = async () => {
  const wrapper = mount(HomeView, {
    global: { plugins: [createVuetify({ components, directives }), i18n, router] },
  });
  await flushPromises();
  return wrapper;
};

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = ME;
    const store = useConversationStore();
    store.fetchConversations = vi.fn(async () => store.setConversations(conversations()));
  });

  it('muestra solo la lista de chats, sin campo para escribir mensajes', async () => {
    const wrapper = await mountHome();
    expect(wrapper.findAll('.chat-item')).toHaveLength(3); // el archivado no aparece
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('muestra nombre, @usuario y estado de cada contacto', async () => {
    const items = (await mountHome()).findAll('.chat-item');

    expect(items[0].text()).toContain('Ana García');
    expect(items[0].text()).toContain('@ana');
    expect(items[0].text()).toContain('En línea');
    expect(items[0].text()).toContain('3'); // no leídos

    // Sin nombre: se usa el nombre de usuario
    expect(items[1].text()).toContain('bruno');
    expect(items[1].text()).toContain('@bruno');
    expect(items[1].text()).toContain('Últ. vez hace 5 minutos');

    expect(items[2].text()).toContain('Equipo');
    expect(items[2].text()).toContain('3 participantes · 1 en línea');
  });

  it('cada chat abre su conversación', async () => {
    const link = (await mountHome()).find('.chat-item');
    expect(link.attributes('href')).toBe('/chat/10');
  });

  it('actualiza el estado en vivo cuando llega user_status_changed', async () => {
    const wrapper = await mountHome();
    const store = useConversationStore();

    store.handleUserStatusChanged({ userId: '2', status: 'offline', lastSeenAt: new Date().toISOString() });
    store.handleUserStatusChanged({ userId: 3, status: 'online' });
    await flushPromises();

    const items = wrapper.findAll('.chat-item');
    expect(items[0].text()).toContain('Últ. vez');
    expect(items[1].text()).toContain('En línea');
  });

  it('sin chats muestra el aviso para iniciar uno', async () => {
    useConversationStore().fetchConversations = vi.fn(async () => {});
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain('Todavía no tienes chats');
  });
});
