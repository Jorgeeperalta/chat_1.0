import { describe, it, expect } from 'vitest';
import { getMessagePreview } from '@/utils/conversationDisplay';

// Las etiquetas salen del idioma del navegador; en las pruebas (jsdom) es inglés
describe('getMessagePreview', () => {
  it('texto, voz, foto, video y documento', () => {
    expect(getMessagePreview({ message_type: 'text', content: 'hola' })).toBe('hola');
    expect(getMessagePreview({ message_type: 'audio' })).toBe('🎤 Voice message');
    expect(getMessagePreview({ message_type: 'image' })).toBe('📷 Photo');
    expect(getMessagePreview({ message_type: 'image', content: 'mirá esto' })).toBe('📷 mirá esto');
    expect(getMessagePreview({ message_type: 'video' })).toBe('🎥 Video');
    expect(getMessagePreview({ message_type: 'file', attachments: [{ file_name: 'informe.pdf' }] })).toBe('📎 informe.pdf');
  });

  it('mensaje eliminado', () => {
    expect(getMessagePreview({ message_type: 'image', is_deleted: true })).toBe('This message was deleted');
  });
});
