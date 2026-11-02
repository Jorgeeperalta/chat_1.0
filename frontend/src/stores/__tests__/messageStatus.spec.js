import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

// Ana (1) envía; en el grupo 10 están Beto (2) y Caro (3)
const mine = (id) => ({ id, conversation_id: 10, sender_id: 1 });
const receipt = (userId, delivered, read) => ({
  conversationId: 10,
  receipt: { user_id: userId, last_delivered_message_id: delivered, last_read_message_id: read },
});

describe('estado de los mensajes propios', () => {
  let chat;
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = { id: 1 };
    chat = useChatStore();
  });

  it('mientras se envía, y si falla', () => {
    expect(chat.getMessageStatus({ tempId: 'x', conversation_id: 10, status: 'sending' })).toBe('sending');
    expect(chat.getMessageStatus({ tempId: 'x', conversation_id: 10, status: 'failed' })).toBe('failed');
  });

  it('enviado → entregado → visto (chat privado)', () => {
    chat.applyReceipt(receipt(2, null, null));
    expect(chat.getMessageStatus(mine(5))).toBe('sent');
    chat.applyReceipt(receipt(2, 5, null));
    expect(chat.getMessageStatus(mine(5))).toBe('delivered');
    expect(chat.getMessageStatus(mine(6))).toBe('sent');
    chat.applyReceipt(receipt(2, 5, 5));
    expect(chat.getMessageStatus(mine(5))).toBe('read');
    expect(chat.getMessageStatus(mine(4))).toBe('read');
  });

  it('en un grupo, "visto" recién cuando lo vieron todos', () => {
    chat.applyReceipt(receipt(2, 8, 8));
    chat.applyReceipt(receipt(3, 8, null));
    expect(chat.getMessageStatus(mine(8))).toBe('delivered');
    chat.applyReceipt(receipt(3, 8, 8));
    expect(chat.getMessageStatus(mine(8))).toBe('read');
  });

  it('quien salió del grupo ya no cuenta', () => {
    chat.applyReceipt(receipt(2, 8, 8));
    chat.applyReceipt(receipt(3, null, null));
    useConversationStore().conversationsById[10] = { id: 10, users: [{ id: 1 }, { id: 2 }] };
    expect(chat.getMessageStatus(mine(8))).toBe('read');
  });
});
