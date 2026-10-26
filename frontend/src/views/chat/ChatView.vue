<!--
 * @file ChatView.vue
 * @description Vista principal del chat
 * @author Arquitecto de Software Senior
 -->

<template>
  <div class="chat-view">
    <!-- Esta vista actúa como contenedor para las vistas de conversación
         y nueva conversación, que se renderizan dentro del layout -->

    <router-view v-slot="{ Component, route }">
      <transition name="chat-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
// Esta vista simplemente renderiza las vistas hijas (ConversationView, NewConversationView)
</script>

<style lang="scss" scoped>
.chat-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > :deep(*) {
    flex: 1 1 auto;
    min-height: 0;
  }
}

// Transiciones
.chat-fade-enter-from,
.chat-fade-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.chat-fade-enter-active,
.chat-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
</style>
