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

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

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
        noContacts: 'Todavía no tienes contactos.',
        userNotFound: "No existe ningún usuario {'@'}{username}",
        startChat: 'Iniciar chat',
        online: 'En línea',
        offline: 'Desconectado',
      },
    },
  },
});

const CONTACTS = [
  { id: 2, username: 'ana', first_name: 'Ana', last_name: 'García', status: 'online' },
  { id: 3, username: 'bruno', first_name: '', last_name: '', status: 'offline' },
];

// Usuarios que existen en la app (el buscador solo los encuentra por nombre exacto)
const EXISTING = { carla: { id: 4, username: 'carla', first_name: 'Carla', last_name: '', is_contact: false } };

let router;

const mountView = async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/chat/new', name: 'new-conversation', component: NewConversationView },
      { path: '/chat/:conversationId', name: 'conversation', component: { template: '<div />' } },
    ],
  });
  const wrapper = mount(NewConversationView, {
    global: { plugins: [createVuetify({ components, directives }), i18n, router] },
  });
  await flushPromises();
  return wrapper;
};

const type = async (wrapper, text) => {
  await wrapper.find('input').setValue(text);
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
    api.get.mockReset();
    api.get.mockImplementation(async (url, config) => {
      if (url === '/api/users') return { data: { users: CONTACTS } };
      if (url === '/api/users/search') return { data: { user: EXISTING[config.params.username] || null } };
      throw new Error(`URL inesperada ${url}`);
    });
  });

  it('sin buscar muestra solo la agenda (contactos), no todos los usuarios', async () => {
    const wrapper = await mountView();
    const items = wrapper.findAll('.nc-user');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('Ana García');
    expect(items[0].text()).toContain('@ana');
    expect(items[0].text()).toContain('En línea');
    expect(items[1].text()).toContain('Desconectado');
    expect(api.get).not.toHaveBeenCalledWith('/api/users/search', expect.anything());
  });

  it('filtra los contactos solo por nombre de usuario', async () => {
    const wrapper = await mountView();
    await type(wrapper, 'bru');
    let items = wrapper.findAll('.nc-user');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain('@bruno');

    // El nombre real no cuenta: "García" no es un nombre de usuario
    await type(wrapper, 'garc');
    items = wrapper.findAll('.nc-user');
    expect(items).toHaveLength(0);
  });

  it('encuentra a un usuario nuevo por su nombre exacto y permite agregarlo', async () => {
    const wrapper = await mountView();
    await type(wrapper, '@Carla');
    expect(api.get).toHaveBeenCalledWith('/api/users/search', { params: { username: 'carla' } });
    expect(wrapper.text()).toContain('Nuevo contacto');
    const found = wrapper.find('.nc-user--found');
    expect(found.text()).toContain('@carla');
    expect(found.text()).toContain('Iniciar chat');
  });

  it('avisa cuando el usuario no existe', async () => {
    const wrapper = await mountView();
    await type(wrapper, 'nadie');
    expect(wrapper.text()).toContain('No existe ningún usuario @nadie');
  });

  it('no busca en el servidor con menos de 3 letras ni si ya es contacto', async () => {
    const wrapper = await mountView();
    await type(wrapper, 'an');
    await type(wrapper, 'ana');
    expect(api.get).not.toHaveBeenCalledWith('/api/users/search', expect.anything());
  });

  it('tocar un contacto abre (o crea) el chat con él', async () => {
    const wrapper = await mountView();
    await wrapper.findAll('.nc-user')[0].trigger('click');
    await flushPromises();
    expect(useConversationStore().createPrivateConversation).toHaveBeenCalledWith(2);
    expect(router.currentRoute.value.fullPath).toBe('/chat/102');
  });
});
