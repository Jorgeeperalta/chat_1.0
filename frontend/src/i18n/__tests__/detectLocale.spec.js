import { describe, it, expect } from 'vitest';
import { detectLocale, messages } from '@/i18n';

describe('detectLocale', () => {
  it('usa el idioma del navegador sin la región', () => {
    expect(detectLocale(['es-AR', 'en-US'])).toBe('es');
    expect(detectLocale(['pt-BR'])).toBe('pt');
    expect(detectLocale(['de'])).toBe('de');
  });

  it('toma el primero que la app tenga', () => {
    expect(detectLocale(['ja-JP', 'fr-FR', 'en'])).toBe('fr');
  });

  it('si no tiene ninguno, usa inglés', () => {
    expect(detectLocale(['ja-JP', 'zh'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('todos los idiomas tienen las mismas etiquetas que el inglés', () => {
    const flat = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
      typeof value === 'object' ? flat(value, `${prefix}${key}.`) : [`${prefix}${key}`]
    );
    const reference = flat(messages.en).sort();
    for (const [locale, localeMessages] of Object.entries(messages)) {
      expect(flat(localeMessages).sort(), `etiquetas de ${locale}`).toEqual(reference);
    }
  });
});
