import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import MessageBubble from '../MessageBubble.vue';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
// jsdom no tiene visualViewport (lo usa el posicionamiento de v-menu)
globalThis.visualViewport ??= Object.assign(new EventTarget(), { width: 1024, height: 768, scale: 1, offsetLeft: 0, offsetTop: 0 });

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    es: {
      chat: { messageDeleted: 'Se eliminó este mensaje', edited: 'editado', you: 'Tú', voiceMessage: 'Mensaje de voz' },
      common: { reply: 'Responder', copy: 'Copiar', edit: 'Editar', delete: 'Eliminar' },
    },
  },
});

const ME = { id: 1, username: 'yo', first_name: 'Yo', last_name: '' };
const ANA = { id: 2, username: 'ana', first_name: 'Ana', last_name: 'García' };

const mountBubble = (message, props = {}) => mount(MessageBubble, {
  props: { message: { type: 'text', message_type: 'text', created_at: new Date().toISOString(), ...message }, ...props },
  attachTo: document.body,
  global: {
    plugins: [createVuetify({ components, directives }), i18n],
    provide: { snackbar: { show: vi.fn(), error: vi.fn() } },
  },
});

describe('MessageBubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = ME;
    document.body.innerHTML = '';
  });

  it('no interpreta HTML que escribe otro usuario', () => {
    const wrapper = mountBubble({ id: 10, sender_id: 2, sender: ANA, content: '<img src=x onerror=alert(1)> hola' });
    const text = wrapper.find('.message-text');
    expect(text.find('img').exists()).toBe(false);
    expect(text.text()).toContain('<img src=x onerror=alert(1)> hola');
  });

  it('sigue convirtiendo las URLs en enlaces', () => {
    const wrapper = mountBubble({ id: 10, sender_id: 2, sender: ANA, content: 'mira https://example.com' });
    expect(wrapper.find('.message-text a').attributes('href')).toBe('https://example.com');
  });

  it('muestra "Se eliminó este mensaje" en lugar del contenido', () => {
    const wrapper = mountBubble({ id: 10, sender_id: 2, sender: ANA, content: null, is_deleted: true });
    expect(wrapper.text()).toContain('Se eliminó este mensaje');
    expect(wrapper.find('.message-text').exists()).toBe(false);
  });

  it('muestra la cita del mensaje respondido y avisa para saltar a él', async () => {
    const wrapper = mountBubble({
      id: 11,
      sender_id: 2,
      sender: ANA,
      content: 'sí',
      replyTo: { id: 7, sender_id: 1, message_type: 'text', content: '¿Vienes mañana?' },
    });
    const quote = wrapper.find('.message-quote');
    expect(quote.text()).toContain('Tú');
    expect(quote.text()).toContain('¿Vienes mañana?');
    await quote.trigger('click');
    expect(wrapper.emitted('jump')[0]).toEqual([7]);
  });

  it('marca los mensajes editados', () => {
    const wrapper = mountBubble({ id: 10, sender_id: 1, content: 'hola', is_edited: true });
    expect(wrapper.find('.message-edited').text()).toBe('editado');
  });

  it('tocar el mensaje abre el menú con las acciones permitidas', async () => {
    const wrapper = mountBubble({ id: 10, sender_id: 1, content: 'hola' }, { canEdit: true, canDelete: false });
    await wrapper.find('.message-content').trigger('click');
    await flushPromises();
    const menu = document.body.textContent;
    expect(menu).toContain('Responder');
    expect(menu).toContain('Editar');
    expect(menu).not.toContain('Eliminar');

    const items = [...document.body.querySelectorAll('.v-list-item')];
    items.find(item => item.textContent.includes('Editar')).click();
    expect(wrapper.emitted('edit')).toHaveLength(1);
    wrapper.unmount();
  });
});
