/**
 * @file Punto de Entrada de la Aplicación
 * @description Configuración inicial de Vue 3, Vuetify y plugins
 * @author Arquitecto de Software Senior
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import WebFont from 'webfontloader';

// Importar estilos
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import './assets/scss/main.scss';

// Importar App y Router
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

// ============================================
// CONFIGURACIÓN DE I18N (Internacionalización)
// ============================================

import { i18n } from './i18n';

// ============================================
// CONFIGURACIÓN DE VUETIFY
// ============================================

const lightTheme = {
  dark: false,
  colors: {
    primary: import.meta.env.VITE_LIGHT_THEME_PRIMARY || '#1867C0',
    secondary: import.meta.env.VITE_LIGHT_THEME_SECONDARY || '#5CBBF6',
    accent: import.meta.env.VITE_LIGHT_THEME_ACCENT || '#42D692',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    background: '#F5F5F5',
    surface: '#FFFFFF',
  },
};

const darkTheme = {
  dark: true,
  colors: {
    primary: import.meta.env.VITE_DARK_THEME_PRIMARY || '#1867C0',
    secondary: import.meta.env.VITE_DARK_THEME_SECONDARY || '#5CBBF6',
    accent: import.meta.env.VITE_DARK_THEME_ACCENT || '#42D692',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    background: '#121212',
    surface: '#1E1E1E',
  },
};

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: import.meta.env.VITE_DEFAULT_THEME || 'system',
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
  },
  defaults: {
    global: {
      ripple: true,
    },
    VBtn: {
      rounded: 'lg',
      elevation: 0,
    },
    VCard: {
      rounded: 'lg',
      elevation: 2,
    },
    VTextField: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VTextarea: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VSelect: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VNavigationDrawer: {
      width: 300,
      temporary: false,
      floating: true,
    },
  },
});

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================

const app = createApp(App);

// Registrar plugins
app.use(createPinia());
app.use(vuetify);
app.use(i18n);
app.use(router);

// Cargar fuentes
WebFont.load({
  google: {
    families: ['Roboto:100,300,400,500,700,900&display=swap'],
  },
});

// Configurar tema inicial
const themeStore = useThemeStore();
const authStore = useAuthStore();

// Sincronizar con el almacenamiento local
themeStore.initialize();
authStore.initialize();

// Montar la aplicación
app.mount('#app');

// Exportar para pruebas
export { app, i18n, vuetify, router };
