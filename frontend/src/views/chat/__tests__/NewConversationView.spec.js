import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createRouter, createMemoryHistory } from 'vue-router';
import NewConversationView from '../NewConversationView.vue';
import { useConversationStore } from '@/stores/conversationStore';
import api from '@/services/api';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    es: {
      chat: {
        newConversation: 'Nueva Conversación',
        searchByUsername: 'Buscar por nombre de usuario',
        usernameHint: 'Para agregar a alguien nuevo, escribe su nombre de usuario completo',
        contacts: 'Tus contactos',
        newContact: 'Nuevo contacto',
        userNotFound: "No existe ningún usuario {'@'}{username}",
        startChat: 'Iniciar chat',
        newChat: 'Chat',
        newGroup: 'Nuevo grupo',
        groupName: 'Nombre del grupo',
        createGroup: 'Crear grupo',
        selectedMembers: '{n} seleccionados',
      },
    },
  },
});

// Agenda: usuarios con los que ya hay un chat
const CONTACTS = [
  { id: 2, username: 'ana', first_name: 'Ana', last_name: 'García', status: 'online' },
  { id: 3, username: 'bruno', first_name: '', last_name: '', status: 'offline' },
];

// Usuarios que existen en la app (el buscador solo los encuentra por nombre exacto)
const EXISTING = { carla: { id: 4, username: 'carla', first_name: 'Carla', last_name: '', is_contact: false } };

let router;

const mountView = async (path = '/chat/new') => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/chat/new', name: 'new-conversation', component: NewConversationView },
      { path: '/chat/:conversationId', name: 'conversation', component: { template: '<div />' } },
    ],
  });
  router.push(path);
  await router.isReady();
  const wrapper = mount(NewConversationView, {
    global: { plugins: [createVuetify({ components, directives }), i18n, router] },
  });
  await flushPromises();
  return wrapper;
};

const type = async (wrapper, text) => {
  await wrapper.find('.nc-search input').setValue(text);
  await vi.advanceTimersByTimeAsync(500); // espera de la búsqueda
  await flushPromises();
};

describe('NewConversationView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    const store = useConversationStore();
    store.fetchConversations = vi.fn(async () => {});
    store.createPrivateConversation = vi.fn(async (userId) => ({ id: 100 + userId }));
    store.createConversation = vi.fn(async () => ({ id: 500 }));
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation(async (url, config) => {
      if (url === '/api/users') return { data: { users: CONTACTS } };
      if (url === '/api/users/search') return { data: { user: EXISTING[config.params.username] || null } };
      throw new Error(`URL inesperada ${url}`);
    });
  });

  it('encuentra a un usuario por su nombre exacto y abre el chat con él', async () => {
    const wrapper = await mountView();
    await type(wrapper, '@Carla');
    expect(api.get).toHaveBeenCalledWith('/api/users/search', { params: { username: 'carla' } });
    const found = wrapper.find('.nc-user--found');
    expect(found.text()).toContain('@carla');
    expect(found.text()).toContain('Iniciar chat');

    await found.trigger('click');
    await flushPromises();
    expect(useConversationStore().createPrivateConversation).toHaveBeenCalledWith(4);
    await vi.runAllTimersAsync();
    expect(router.currentRoute.value.fullPath).toBe('/chat/104');
  });

  it('avisa cuando el usuario no existe', async () => {
    const wrapper = await mountView();
    await type(wrapper, 'nadie');
    expect(wrapper.text()).toContain('No existe ningún usuario @nadie');
  });

  it('no busca en el servidor con menos de 3 letras', async () => {
    const wrapper = await mountView();
    await type(wrapper, 'an');
    expect(api.get).not.toHaveBeenCalledWith('/api/users/search', expect.anything());
  });

  it('modo grupo: lista la agenda, permite elegir integrantes y crea el grupo', async () => {
    const wrapper = await mountView('/chat/new?mode=group');
    expect(api.get).toHaveBeenCalledWith('/api/users');

    const items = wrapper.findAll('.nc-user');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('@ana');

    // Sin nombre ni integrantes no se puede crear
    const createButton = () => wrapper.findAll('button').find(b => b.text().includes('Crear grupo'));
    expect(createButton().attributes('disabled')).toBeDefined();

    await items[0].trigger('click');
    await wrapper.find('.nc-group input').setValue('Familia');
    expect(wrapper.text()).toContain('1 seleccionados');

    // Un usuario que no está en la agenda se agrega buscándolo
    await type(wrapper, 'carla');
    await wrapper.find('.nc-user--found').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('2 seleccionados');

    await createButton().trigger('click');
    await flushPromises();
    expect(useConversationStore().createConversation).toHaveBeenCalledWith({
      type: 'group',
      name: 'Familia',
      participant_ids: [2, 4],
    });
    await vi.runAllTimersAsync();
    expect(router.currentRoute.value.fullPath).toBe('/chat/500');
  });
});
