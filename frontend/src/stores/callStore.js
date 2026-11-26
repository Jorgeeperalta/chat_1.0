/**
 * @file Store de videollamadas entrantes
 * @description El servidor avisa por Socket.io ("call_started") cuando alguien inicia una
 * videollamada en una conversación tuya. Se muestra el aviso hasta que se atiende, se rechaza
 * o pasan 45 segundos.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

const RING_MS = 45 * 1000;

export const useCallStore = defineStore('call', () => {
  const incoming = ref(null);
  let timer = null;

  /**
   * @param {{conversationId: number, roomName: string, caller: Object, conversationType: string, conversationName: string|null}} invite
   */
  const receiveInvite = (invite) => {
    incoming.value = invite;
    clearTimeout(timer);
    timer = setTimeout(() => { incoming.value = null; }, RING_MS);
    try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { /* sin vibración */ }
  };

  /** Quita el aviso (todos, o solo el de esa conversación) */
  const dismiss = (conversationId) => {
    if (conversationId && Number(incoming.value?.conversationId) !== Number(conversationId)) return;
    incoming.value = null;
    clearTimeout(timer);
  };

  return { incoming, receiveInvite, dismiss };
});
