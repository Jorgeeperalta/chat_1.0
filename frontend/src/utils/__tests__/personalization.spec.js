import { describe, it, expect } from 'vitest';
import { getAvatarColor, getConversationColor } from '@/utils/conversationDisplay';
import { CHAT_BACKGROUNDS, getChatBackground } from '@/utils/chatBackgrounds';

describe('colores de avatar', () => {
  it('siempre el mismo color para la misma persona', () => {
    expect(getAvatarColor(7)).toBe(getAvatarColor(7));
    expect(getAvatarColor(7)).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('personas distintas tienen colores variados', () => {
    const colors = new Set(Array.from({ length: 30 }, (_, id) => getAvatarColor(id + 1)));
    expect(colors.size).toBeGreaterThan(6);
  });

  it('un chat privado usa el color del otro; un grupo, el suyo', () => {
    const privado = { id: 1, type: 'private', users: [{ id: 1 }, { id: 9 }] };
    expect(getConversationColor(privado, 1)).toBe(getAvatarColor(9));
    expect(getConversationColor({ id: 4, type: 'group' }, 1)).toBe(getAvatarColor('g4'));
  });
});

describe('fondos del chat', () => {
  it('cada fondo tiene versión clara y oscura', () => {
    for (const option of CHAT_BACKGROUNDS) {
      expect(option.light, option.id).toBeTruthy();
      expect(option.dark, option.id).toBeTruthy();
    }
  });

  it('un fondo desconocido vuelve al clásico', () => {
    expect(getChatBackground('no-existe', false)).toBe(CHAT_BACKGROUNDS[0].light);
    expect(getChatBackground('ocean', true)).toBe(CHAT_BACKGROUNDS.find(b => b.id === 'ocean').dark);
  });
});
