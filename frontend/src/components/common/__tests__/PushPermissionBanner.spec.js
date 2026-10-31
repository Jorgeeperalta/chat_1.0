import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import PushPermissionBanner from '../PushPermissionBanner.vue';
import * as push from '@/services/pushNotifications';

vi.mock('@/services/pushNotifications', () => ({
  getPushPermission: vi.fn(),
  needsInstallForPush: vi.fn(() => false),
  enablePushNotifications: vi.fn(),
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  missingWarn: false,
  messages: {
    es: {
      push: {
        ask: 'Activa las notificaciones',
        enable: 'Activar notificaciones',
        enabled: 'Notificaciones activadas',
        denied: 'Las notificaciones están bloqueadas',
        install: 'En iPhone, agrega Converxa a la pantalla de inicio',
      },
    },
  },
});

const mountBanner = () => mount(PushPermissionBanner, {
  global: {
    plugins: [createVuetify({ components, directives }), i18n],
    provide: { snackbar: { show: vi.fn(), error: vi.fn() } },
  },
});

describe('PushPermissionBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(push.needsInstallForPush).mockReturnValue(false);
  });

  it('invita a activarlas y las activa al tocar el botón', async () => {
    vi.mocked(push.getPushPermission).mockReturnValue('default');
    vi.mocked(push.enablePushNotifications).mockResolvedValue('granted');
    const wrapper = mountBanner();
    expect(wrapper.text()).toContain('Activa las notificaciones');

    await wrapper.find('button.v-btn--variant-flat').trigger('click');
    await flushPromises();
    expect(push.enablePushNotifications).toHaveBeenCalled();
    expect(wrapper.find('.push-banner').exists()).toBe(false);
  });

  it('no aparece si ya están activadas', () => {
    vi.mocked(push.getPushPermission).mockReturnValue('granted');
    expect(mountBanner().find('.push-banner').exists()).toBe(false);
  });

  it('avisa si están bloqueadas', () => {
    vi.mocked(push.getPushPermission).mockReturnValue('denied');
    expect(mountBanner().text()).toContain('bloqueadas');
  });

  it('en iPhone sin instalar explica cómo agregar la app al inicio', () => {
    vi.mocked(push.getPushPermission).mockReturnValue('unsupported');
    vi.mocked(push.needsInstallForPush).mockReturnValue(true);
    expect(mountBanner().text()).toContain('pantalla de inicio');
  });

  it('cerrado una vez, no vuelve a aparecer', async () => {
    vi.mocked(push.getPushPermission).mockReturnValue('default');
    const wrapper = mountBanner();
    await wrapper.find('.v-alert__close button, .v-alert__close .v-btn').trigger('click');
    expect(wrapper.find('.push-banner').exists()).toBe(false);
    expect(mountBanner().find('.push-banner').exists()).toBe(false);
  });
});
