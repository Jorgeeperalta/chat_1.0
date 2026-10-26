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
import { createI18n } from 'vue-i18n';
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

const messages = {
  en: {
    app: {
      name: 'Converxa',
      description: 'Real-time chat with AI translation',
    },
    auth: {
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      username: 'Username',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      firstName: 'First Name',
      lastName: 'Last Name',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      dontHaveAccount: "Don't have an account?",
      alreadyHaveAccount: 'Already have an account?',
      welcomeBack: 'Welcome back',
      createNewAccount: 'Create a new account',
      acceptTerms: 'I accept the terms and conditions',
      registrationSuccess: 'Your account was created successfully',
      allRightsReserved: 'All rights reserved.',
      poweredBy: 'Powered by',
      recoverAccount: 'Recover access to your account',
      forgotPasswordDescription: "Enter your email and we'll send you instructions to reset your password.",
      sendRecoveryEmail: 'Send recovery email',
      recoveryEmailSent: 'Recovery email sent',
      recoveryEmailResent: 'Recovery email resent',
      checkYourEmail: 'Check your email',
      didNotReceiveEmail: "Didn't receive the email?",
      resendEmail: 'Resend email',
      rememberPassword: 'Remember your password?',
      backToLogin: 'Back to login',
    },
    chat: {
      typeMessage: 'Type a message...',
      send: 'Send',
      newConversation: 'New Conversation',
      search: 'Search...',
      searchUsers: 'Search users...',
      searchByUsername: 'Search by username',
      usernameHint: 'To add someone new, type their full username',
      contacts: 'Your contacts',
      newContact: 'New contact',
      noContacts: "You don't have any contacts yet. Search for someone by username to start chatting.",
      userNotFound: "There is no user {'@'}{username}",
      noUsersFound: 'No users found',
      noUsersAvailable: 'No users available',
      online: 'Online',
      selected: 'Selected',
      startChat: 'Start chat',
      startAudioRecording: 'Hold to record audio',
      stopAudioRecording: 'Release to send',
      cancelAudioRecording: 'Cancel',
      audioRecording: 'Recording...',
      translations: 'Translations',
      original: 'Original',
      translated: 'Translated',
      chat: 'Chats',
      chats: 'Chats',
      noMessages: 'No messages',
      noConversations: "You don't have any chats yet",
      startNewConversation: 'Start a chat',
      offline: 'Offline',
      lastSeen: 'Last seen {time}',
      participants: '{n} participants',
      onlineCount: '{n} online',
      typing: 'typing…',
      backToChats: 'Back to chats',
      showTranslation: 'Show translation',
      transcription: 'Transcription',
      loadMoreMessages: 'Load earlier messages',
      attachFile: 'Attach file',
      emoji: 'Emoji',
      searchEmoji: 'Search emoji',
    },
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      recent: 'Recent',
      continue: 'Continue',
      home: 'Home',
      or: 'or',
    },
    pwa: {
      installPrompt: 'Install the app for quick access from your home screen',
      installIos: 'To install: tap Share and then "Add to Home Screen"',
      install: 'Install',
      later: 'Later',
      updateAvailable: 'A new version is available',
      update: 'Update',
    },
    settings: {
      title: 'Settings',
      profile: 'Profile',
      preferences: 'Preferences',
      language: 'Language',
      theme: 'Theme',
      notifications: 'Notifications',
      audio: 'Audio',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      notificationSound: 'Notification Sound',
      notificationVibration: 'Vibration',
      autoTranslate: 'Auto-translate Messages',
      showOriginal: 'Show Original Message',
      audioQuality: 'Audio Quality',
      playAutomatically: 'Play Audio Automatically',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
    errors: {
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      invalidPassword: 'Password must be at least 8 characters',
      invalidUsername: 'Username must be 3-50 characters',
      usernameExists: 'Username already exists',
      emailExists: 'Email already exists',
      invalidCredentials: 'Invalid credentials',
      accountDisabled: 'Account disabled',
      notAuthorized: 'Not authorized',
      notFound: 'Resource not found',
      serverError: 'Server error',
      loadUsersFailed: 'Could not load users',
    },
    validation: {
      maxLength: 'Maximum {0} characters',
      minLength: 'Minimum {0} characters',
    },
  },
  es: {
    app: {
      name: 'Converxa',
      description: 'Chat en tiempo real con traducción por IA',
    },
    auth: {
      login: 'Iniciar Sesión',
      register: 'Registrarse',
      logout: 'Cerrar Sesión',
      username: 'Nombre de usuario',
      email: 'Correo electrónico',
      password: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      firstName: 'Nombre',
      lastName: 'Apellido',
      rememberMe: 'Recuérdame',
      forgotPassword: '¿Olvidaste tu contraseña?',
      dontHaveAccount: '¿No tienes una cuenta?',
      alreadyHaveAccount: '¿Ya tienes una cuenta?',
      welcomeBack: 'Bienvenido de nuevo',
      createNewAccount: 'Crea una cuenta nueva',
      acceptTerms: 'Acepto los términos y condiciones',
      registrationSuccess: 'Tu cuenta se creó correctamente',
      allRightsReserved: 'Todos los derechos reservados.',
      poweredBy: 'Desarrollado con',
      recoverAccount: 'Recupera el acceso a tu cuenta',
      forgotPasswordDescription: 'Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.',
      sendRecoveryEmail: 'Enviar correo de recuperación',
      recoveryEmailSent: 'Correo de recuperación enviado',
      recoveryEmailResent: 'Correo de recuperación reenviado',
      checkYourEmail: 'Revisa tu correo',
      didNotReceiveEmail: '¿No recibiste el correo?',
      resendEmail: 'Reenviar correo',
      rememberPassword: '¿Recordaste tu contraseña?',
      backToLogin: 'Volver a iniciar sesión',
    },
    chat: {
      typeMessage: 'Escribe un mensaje...',
      send: 'Enviar',
      newConversation: 'Nueva Conversación',
      search: 'Buscar...',
      searchUsers: 'Buscar usuarios...',
      searchByUsername: 'Buscar por nombre de usuario',
      usernameHint: 'Para agregar a alguien nuevo, escribe su nombre de usuario completo',
      contacts: 'Tus contactos',
      newContact: 'Nuevo contacto',
      noContacts: 'Todavía no tienes contactos. Busca a alguien por su nombre de usuario para empezar a chatear.',
      userNotFound: "No existe ningún usuario {'@'}{username}",
      noUsersFound: 'No se encontraron usuarios',
      noUsersAvailable: 'No hay usuarios disponibles',
      online: 'En línea',
      selected: 'Seleccionado',
      startChat: 'Iniciar chat',
      startAudioRecording: 'Mantén presionado para grabar',
      stopAudioRecording: 'Suelta para enviar',
      cancelAudioRecording: 'Cancelar',
      audioRecording: 'Grabando...',
      translations: 'Traducciones',
      original: 'Original',
      translated: 'Traducido',
      chat: 'Chats',
      chats: 'Chats',
      noMessages: 'Sin mensajes',
      noConversations: 'Todavía no tienes chats',
      startNewConversation: 'Iniciar un chat',
      offline: 'Desconectado',
      lastSeen: 'Últ. vez {time}',
      participants: '{n} participantes',
      onlineCount: '{n} en línea',
      typing: 'escribiendo…',
      backToChats: 'Volver a los chats',
      showTranslation: 'Ver traducción',
      transcription: 'Transcripción',
      loadMoreMessages: 'Cargar mensajes anteriores',
      attachFile: 'Adjuntar archivo',
      emoji: 'Emoji',
      searchEmoji: 'Buscar emoji',
    },
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      back: 'Atrás',
      next: 'Siguiente',
      previous: 'Anterior',
      recent: 'Recientes',
      continue: 'Continuar',
      home: 'Inicio',
      or: 'o',
    },
    pwa: {
      installPrompt: 'Instala la app para abrirla desde tu pantalla de inicio',
      installIos: 'Para instalarla: toca Compartir y luego "Agregar a inicio"',
      install: 'Instalar',
      later: 'Más tarde',
      updateAvailable: 'Hay una versión nueva disponible',
      update: 'Actualizar',
    },
    settings: {
      title: 'Configuración',
      profile: 'Perfil',
      preferences: 'Preferencias',
      language: 'Idioma',
      theme: 'Tema',
      notifications: 'Notificaciones',
      audio: 'Audio',
      light: 'Claro',
      dark: 'Oscuro',
      system: 'Sistema',
      notificationSound: 'Sonido de notificación',
      notificationVibration: 'Vibración',
      autoTranslate: 'Traducir mensajes automáticamente',
      showOriginal: 'Mostrar mensaje original',
      audioQuality: 'Calidad de audio',
      playAutomatically: 'Reproducir audio automáticamente',
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
    },
    errors: {
      required: 'Este campo es obligatorio',
      invalidEmail: 'Correo electrónico no válido',
      invalidPassword: 'La contraseña debe tener al menos 8 caracteres',
      invalidUsername: 'El nombre de usuario debe tener entre 3 y 50 caracteres',
      usernameExists: 'El nombre de usuario ya existe',
      emailExists: 'El correo electrónico ya existe',
      invalidCredentials: 'Credenciales inválidas',
      accountDisabled: 'Cuenta desactivada',
      notAuthorized: 'No autorizado',
      notFound: 'Recurso no encontrado',
      serverError: 'Error del servidor',
      loadUsersFailed: 'No se pudieron cargar los usuarios',
    },
    validation: {
      maxLength: 'Máximo {0} caracteres',
      minLength: 'Mínimo {0} caracteres',
    },
  },
  fr: {
    app: {
      name: 'Converxa',
      description: 'Chat en temps réel avec traduction IA',
    },
    auth: {
      login: 'Connexion',
      register: "S'inscrire",
      logout: 'Déconnexion',
      username: "Nom d'utilisateur",
      email: 'Email',
      password: 'Mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      firstName: 'Prénom',
      lastName: 'Nom',
      rememberMe: 'Se souvenir de moi',
      forgotPassword: 'Mot de passe oublié ?',
      dontHaveAccount: "Vous n'avez pas de compte ?",
      alreadyHaveAccount: 'Vous avez déjà un compte ?',
    },
    // ... (otras traducciones para francés)
  },
  de: {
    app: {
      name: 'Converxa',
      description: 'Echtzeit-Chat mit KI-Übersetzung',
    },
    // ... (otras traducciones para alemán)
  },
};

const i18n = createI18n({
  legacy: false,
  locale: import.meta.env.VITE_DEFAULT_LANGUAGE || 'es',
  fallbackLocale: import.meta.env.VITE_FALLBACK_LANGUAGE || 'en',
  messages,
  datetimeFormats: {
    en: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
    },
    es: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
    },
  },
});

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
