/**
 * @file Configuración de Vite
 * @description Configuración del bundler Vite para Vue.js 3
 * @author Arquitecto de Software Senior
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Rutas que atiende el backend: el service worker nunca debe responderlas con index.html
const BACKEND_ROUTES = [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//, /^\/health$/];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    // PWA: manifiesto + service worker (instalable y con la interfaz disponible sin red).
    // Los navegadores solo registran el service worker en https o en localhost.
    VitePWA({
      // El usuario decide cuándo recargar (no cortar una conversación a mitad): ver PwaPrompts.vue
      registerType: 'prompt',
      // Íconos generados con scripts/generate-icons.ps1 a partir de frontend/branding/converxa.jpeg
      includeAssets: ['icons/favicon-64x64.png', 'icons/apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Converxa',
        short_name: 'Converxa',
        description: 'Chat en tiempo real con traducción por IA',
        lang: 'es',
        start_url: '/home',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1867C0',
        // Pantalla de carga al abrir la app instalada: mismo azul oscuro que el ícono
        background_color: '#050A2A',
        categories: ['social', 'communication'],
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache de la interfaz. De las fuentes de íconos basta woff2 (la soportan todos los navegadores actuales)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: BACKEND_ROUTES,
        // Notificaciones push (sonido/vibración con la app cerrada): public/push-sw.js
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Imágenes y audios subidos: no cambian una vez subidos
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              // Los <audio> piden rangos de bytes
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  // vue-i18n: compilar mensajes con JIT (sin new Function), así funciona con la CSP de helmet sin 'unsafe-eval'
  define: {
    __INTLIFY_JIT_COMPILATION__: true,
    __INTLIFY_DROP_MESSAGE_COMPILER__: false,
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: true,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: true,
    // Sin sourcemaps en producción: no exponer el código fuente en el hosting
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia', 'vuetify'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Vuetify importa sus .css desde JS: tiene que pasar por Vite también en los tests
    server: {
      deps: { inline: ['vuetify'] },
    },
  },
});
