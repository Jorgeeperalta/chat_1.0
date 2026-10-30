/**
 * @file Configuración del Router
 * @description Configuración de Vue Router para la navegación
 * @author Arquitecto de Software Senior
 */

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSocketStore } from '@/stores/socketStore';

// Importar vistas
const Layout = () => import('@/components/layout/AppLayout.vue');
const AuthLayout = () => import('@/components/layout/AuthLayout.vue');

// Vistas de autenticación
const LoginView = () => import('@/views/auth/LoginView.vue');
const RegisterView = () => import('@/views/auth/RegisterView.vue');
const ForgotPasswordView = () => import('@/views/auth/ForgotPasswordView.vue');

// Vistas principales
const HomeView = () => import('@/views/HomeView.vue');
const ChatView = () => import('@/views/chat/ChatView.vue');
const ConversationView = () => import('@/views/chat/ConversationView.vue');
const NewConversationView = () => import('@/views/chat/NewConversationView.vue');
const SettingsView = () => import('@/views/settings/SettingsView.vue');
const ProfileSettingsView = () => import('@/views/settings/ProfileSettingsView.vue');
const PreferencesSettingsView = () => import('@/views/settings/PreferencesSettingsView.vue');

// Guardias de navegación
const routes = [
  {
    path: '/',
    name: 'root',
    redirect: { name: 'login' },
  },
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        name: 'login',
        component: LoginView,
        meta: { requiresGuest: true },
      },
      {
        path: 'register',
        name: 'register',
        component: RegisterView,
        meta: { requiresGuest: true },
      },
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: ForgotPasswordView,
        meta: { requiresGuest: true },
      },
    ],
  },
  {
    path: '/',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'home',
        name: 'home',
        component: HomeView,
        meta: { requiresAuth: true },
      },
      {
        path: 'chat',
        name: 'chat',
        component: ChatView,
        meta: { requiresAuth: true },
        children: [
          {
            path: ':conversationId',
            name: 'conversation',
            component: ConversationView,
            meta: { requiresAuth: true },
            props: true,
          },
          {
            path: 'new',
            name: 'new-conversation',
            component: NewConversationView,
            meta: { requiresAuth: true },
          },
        ],
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { requiresAuth: true },
        children: [
          {
            path: 'profile',
            name: 'profile-settings',
            component: ProfileSettingsView,
            meta: { requiresAuth: true },
          },
          {
            path: 'preferences',
            name: 'preferences-settings',
            component: PreferencesSettingsView,
            meta: { requiresAuth: true },
          },
        ],
      },
    ],
  },
  // Redirección para rutas no encontradas
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: { name: 'home' },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (to, from, savedPosition) => {
    // Comportamiento de scroll suave
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      };
    }
    
    if (savedPosition) {
      return savedPosition;
    }
    
    return { top: 0, behavior: 'smooth' };
  },
});

// Guardia global para autenticación
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const themeStore = useThemeStore();
  const socketStore = useSocketStore();
  
  // Inicializar stores
  themeStore.initialize();
  
  // Verificar si la ruta requiere autenticación
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirigir a login
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }
  
  // Verificar si la ruta requiere ser invitado (no autenticado)
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    // Redirigir a home
    next({ name: 'home' });
    return;
  }
  
  // Si está autenticado y va a login/register, redirigir a home
  if (authStore.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    next({ name: 'home' });
    return;
  }
  
  // Si está autenticado, conectar Socket.io
  if (authStore.isAuthenticated && !socketStore.isConnected) {
    socketStore.connect();
  }
  
  // Continuar con la navegación
  next();
});

// Guardia después de la navegación
router.afterEach((to, from) => {
  // Establecer título de la página
  setPageTitle(to);
});

/**
 * Establece el título de la página
 * @param {Object} route - Ruta actual
 */
const setPageTitle = (route) => {
  const appName = import.meta.env.VITE_APP_NAME || 'Converxa';
  let title = appName;
  
  if (route.meta.title) {
    title = `${route.meta.title} - ${appName}`;
  } else if (route.name) {
    const titles = {
      'login': 'Iniciar Sesión',
      'register': 'Registrarse',
      'home': 'Inicio',
      'chat': 'Chat',
      'conversation': 'Conversación',
      'new-conversation': 'Nueva Conversación',
      'settings': 'Configuración',
      'profile-settings': 'Perfil',
      'preferences-settings': 'Preferencias',
    };
    
    if (titles[route.name]) {
      title = `${titles[route.name]} - ${appName}`;
    }
  }
  
  document.title = title;
};

export default router;
