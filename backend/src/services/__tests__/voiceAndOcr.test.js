const { selectVoice, FALLBACK_VOICES } = require('../mistralAudioService');
const { isSupportedDocument, mapWithConcurrency } = require('../ocrService');

// Muestra del catálogo real de GET /v1/audio/voices (oct. 2026)
const CATALOG = [
  { slug: 'voice_3150', languages: ['en_us'], gender: 'male', type: 'preset', kind: 'pvc' },
  { slug: 'voice_478', languages: ['en_us'], gender: 'female', type: 'preset', kind: 'pvc' },
  { slug: 'en_paul_angry', languages: ['en_us'], gender: 'male', type: 'preset', kind: 'ivc' },
  { slug: 'fr_marie_neutral', languages: ['fr_fr'], gender: 'female', type: 'preset', kind: 'ivc' },
  { slug: 'voice_592', languages: ['fr'], gender: 'female', type: 'preset', kind: 'pvc' },
  { slug: 'voice_483', languages: ['es'], gender: 'female', type: 'preset', kind: 'pvc' },
  { slug: 'voice_482', languages: ['it'], gender: 'male', type: 'preset', kind: 'pvc' },
];

describe('selectVoice', () => {
  it('elige por idioma y género', () => {
    expect(selectVoice(CATALOG, 'en', 'male')).toBe('voice_3150');
    expect(selectVoice(CATALOG, 'en', 'female')).toBe('voice_478');
  });

  it('el idioma manda: si no hay voz del género pedido, usa la que haya en ese idioma', () => {
    expect(selectVoice(CATALOG, 'es', 'male')).toBe('voice_483');
    expect(selectVoice(CATALOG, 'it', 'female')).toBe('voice_482');
  });

  it('acepta códigos con región y prefiere Voxtral 3 a las voces viejas', () => {
    expect(selectVoice(CATALOG, 'fr-FR', 'female')).toBe('voice_592');
  });

  it('nunca elige una variante de emoción', () => {
    const onlyOld = CATALOG.filter(voice => voice.slug.startsWith('en_paul'));
    expect(selectVoice(onlyOld, 'en', 'male')).toBeNull();
  });

  it('una voz guardada en la cuenta gana a las de Mistral', () => {
    const custom = { id: 'abc-123', languages: ['es'], gender: 'male', type: 'custom', kind: 'ivc' };
    expect(selectVoice([...CATALOG, custom], 'es', 'male')).toBe('abc-123');
  });

  it('respeta las voces configuradas (MISTRAL_TTS_VOICES)', () => {
    expect(selectVoice(CATALOG, 'es', 'male', { es: { male: 'mi-voz' } })).toBe('mi-voz');
    expect(selectVoice(CATALOG, 'es', null, { es: { default: 'otra' } })).toBe('otra');
  });

  it('sin voz para el idioma devuelve null', () => {
    expect(selectVoice(CATALOG, 'xx', 'male')).toBeNull();
  });

  it('el catálogo incluido cubre los idiomas de la app', () => {
    for (const language of ['es', 'en', 'pt', 'fr', 'de', 'it']) {
      expect(selectVoice(FALLBACK_VOICES, language, null)).toBeTruthy();
    }
  });
});

describe('isSupportedDocument', () => {
  const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

  it('acepta PDF e imágenes cuyo contenido coincide con el tipo', () => {
    expect(isSupportedDocument('application/pdf', pad('%PDF-1.7'))).toBe(true);
    expect(isSupportedDocument('image/jpeg', pad([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isSupportedDocument('image/png', pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(isSupportedDocument('image/webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))).toBe(true);
  });

  it('rechaza un archivo con el tipo cambiado o no permitido', () => {
    expect(isSupportedDocument('application/pdf', pad('<html><script>'))).toBe(false);
    expect(isSupportedDocument('image/svg+xml', pad('<svg'))).toBe(false);
    expect(isSupportedDocument('application/pdf', Buffer.from('%PDF'))).toBe(false);
  });
});

describe('mapWithConcurrency', () => {
  it('respeta el límite y conserva el orden', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, index) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, ms));
      running -= 1;
      return index;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });
});
