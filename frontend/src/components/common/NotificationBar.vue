<!--
 * @file NotificationBar.vue
 * @description Barra de notificaciones globales
 * @author Arquitecto de Software Senior
 -->

<template>
  <!-- Contenedor de notificaciones -->
  <div class="notification-container">
    <!-- Notificaciones toast -->
    <transition-group name="notification" tag="div">
      <v-alert
        v-for="(notification, index) in activeNotifications"
        :key="notification.id"
        :type="notification.type"
        :title="notification.title"
        :text="notification.message"
        :closable="notification.closable"
        border="start"
        class="notification-toast mb-2"
        :class="[notification.type, { 'notification-error': notification.type === 'error' }]"
        :elevation="3"
        @click:close="closeNotification(notification.id)"
      >
        <template v-slot:prepend v-if="notification.icon">
          <v-icon :icon="notification.icon" />
        </template>
        
        <template v-slot:append v-if="notification.duration">
          <v-progress-linear
            :model-value="getProgress(notification)"
            color="white"
            height="3"
            class="notification-progress"
          />
        </template>
      </v-alert>
    </transition-group>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { useNotificationStore } from '@/stores/notificationStore';

// ============================================
// STORE
// ============================================

const notificationStore = useNotificationStore();

// ============================================
// ESTADO LOCAL
// ============================================

// Almacenar el tiempo de inicio para calcular el progreso
const notificationTimers = ref({});

// ============================================
// COMPUTED
// ============================================

const activeNotifications = computed(() => {
  return notificationStore.notifications.filter(n => n.show);
});

// ============================================
// MÉTODOS
// ============================================

/**
 * Obtiene el progreso de la barra para una notificación
 * @param {Object} notification - Notificación
 * @returns {number} - Porcentaje de progreso (0-100)
 */
const getProgress = (notification) => {
  if (!notification.duration) return 0;
  
  const startTime = notificationTimers.value[notification.id];
  if (!startTime) return 0;
  
  const elapsed = (Date.now() - startTime) / 1000;
  const total = notification.duration / 1000;
  
  return Math.min((elapsed / total) * 100, 100);
};

/**
 * Cierra una notificación
 * @param {string} id - ID de la notificación
 */
const closeNotification = (id) => {
  notificationStore.removeNotification(id);
  delete notificationTimers.value[id];
};

/**
 * Inicia el temporizador para una notificación
 * @param {Object} notification - Notificación
 */
const startNotificationTimer = (notification) => {
  if (!notification.duration) return;
  
  notificationTimers.value[notification.id] = Date.now();
  
  setTimeout(() => {
    closeNotification(notification.id);
  }, notification.duration);
};

// ============================================
// MONTAJE
// ============================================

onMounted(() => {
  // Iniciar temporizadores para las notificaciones actuales
  activeNotifications.value.forEach(notification => {
    startNotificationTimer(notification);
  });
});

// ============================================
// WATCHERS
// ============================================

import { watch } from 'vue';

watch(activeNotifications, (newNotifications) => {
  newNotifications.forEach(notification => {
    if (!notificationTimers.value[notification.id]) {
      startNotificationTimer(notification);
    }
  });
}, { deep: true });

// ============================================
// LIMPIEZA
// ============================================

onUnmounted(() => {
  // Limpiar todos los temporizadores
  Object.keys(notificationTimers.value).forEach(id => {
    clearTimeout(id);
  });
  notificationTimers.value = {};
});
</script>

<style lang="scss" scoped>
// Contenedor de notificaciones
.notification-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  max-width: 400px;
  width: 100%;
}

// Toast de notificación
.notification-toast {
  cursor: pointer;
  animation: slideIn 0.3s ease-out;
  
  &:hover {
    opacity: 0.95;
  }
}

// Transiciones
.notification-move,
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease-out;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  opacity: 1;
  transform: translateX(0);
}

// Barra de progreso
.notification-progress {
  margin-left: 8px;
  border-radius: 2px;
}

// Estilos específicos por tipo
:deep(.v-alert__content) {
  align-items: center;
  gap: 8px;
}

// Estilos para el icono
:deep(.v-alert__prepend) {
  align-self: center;
}

// Estilos para la barra de progreso
:deep(.notification-progress) {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0;
  border-radius: 0 0 4px 4px;
}
</style>
