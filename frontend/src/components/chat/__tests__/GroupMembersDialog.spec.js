import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import GroupMembersDialog from '../GroupMembersDialog.vue';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import api from '@/services/api';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.visualViewport ??= Object.assign(new EventTarget(), { width: 1024, height: 768, scale: 1, offsetLeft: 0, offsetTop: 0 });

const i18n = createI18n({ legacy: false, locale: 'es', missingWarn: false, fallbackWarn: false, messages: { es: {} } });

const member = (id, username, role = 'member') => ({ id, username, first_name: username, last_name: '', UserConversation: { role } });

// Ana creó el grupo y es admin; Beto también es admin; Caro es integrante
const GROUP = {
  id: 9,
  type: 'group',
  name: 'Familia',
  created_by: 1,
  users: [member(1, 'ana', 'admin'), member(2, 'beto', 'admin'), member(3, 'caro')],
};

const mountDialog = () => mount(GroupMembersDialog, {
  props: { modelValue: true, conversation: GROUP },
  attachTo: document.body,
  global: {
    plugins: [createVuetify({ components, directives }), i18n],
    provide: { snackbar: { show: vi.fn(), error: vi.fn() } },
  },
});

const rows = () => [...document.querySelectorAll('.group-members__member')];
const removeButtons = () => rows().filter(row => row.querySelector('button')).map(row => row.textContent);

describe('GroupMembersDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { users: [member(3, 'caro'), member(4, 'dani')] } });
  });

  it('un integrante común ve la lista pero no puede agregar ni eliminar', async () => {
    useAuthStore().user = { id: 3 };
    mountDialog();
    await flushPromises();
    expect(rows()).toHaveLength(3);
    expect(document.querySelector('.group-members__add')).toBeNull();
    expect(removeButtons()).toHaveLength(0);
  });

  it('un admin puede eliminar a los demás, pero no a sí mismo ni al creador', async () => {
    useAuthStore().user = { id: 2 };
    mountDialog();
    await flushPromises();
    const removable = removeButtons();
    expect(removable).toHaveLength(1);
    expect(removable[0]).toContain('@caro');
  });

  it('agregar muestra solo los contactos que no están en el grupo', async () => {
    useAuthStore().user = { id: 1 };
    const store = useConversationStore();
    store.addParticipants = vi.fn(async () => ({}));
    mountDialog();
    await flushPromises();

    document.querySelector('.group-members__add').click();
    await flushPromises();
    const candidates = [...document.querySelectorAll('.group-members__candidate')];
    expect(candidates).toHaveLength(1);
    expect(candidates[0].textContent).toContain('@dani');

    candidates[0].click();
    await flushPromises();
    expect(store.addParticipants).toHaveBeenCalledWith(9, [4]);
  });
});
