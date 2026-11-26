import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Translator, baseLanguage } from '../src/translator.js';
import { buildCaptions, requestedLanguages } from '../src/captions.js';

// LLM falso: cuenta llamadas y devuelve "[idioma] texto"
const fakeLlm = ({ delayMs = 0, failFor = [] } = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const target = /a (\S+)/.exec(body.messages[0].content)[1].replace('.', '');
    calls.push({ url, target, text: body.messages[1].content, auth: init.headers.Authorization });
    await new Promise(resolve => setTimeout(resolve, delayMs));
    if (failFor.some(name => body.messages[0].content.includes(name))) {
      return new Response('boom', { status: 500 });
    }
    return Response.json({ choices: [{ message: { content: `[${target}] ${body.messages[1].content}` } }] });
  };
  return { calls, translator: new Translator({ baseUrl: 'https://llm.test/v1/', apiKey: 'k', model: 'm', fetchImpl }) };
};

test('requestedLanguages: solo los idiomas ofrecidos, sin repetir', () => {
  const languages = requestedLanguages([
    { attributes: { captions_language: 'fr' } },
    { attributes: { captions_language: 'fr' } },
    { attributes: { captions_language: 'zh-Hans' } },
    { attributes: { captions_language: 'pt' } },
    { attributes: {} },
  ]);
  assert.deepEqual([...languages].sort(), ['fr', 'zh']);
});

test('baseLanguage normaliza códigos de Deepgram', () => {
  assert.equal(baseLanguage('en-US'), 'en');
  assert.equal(baseLanguage('zh-CN'), 'zh');
  assert.equal(baseLanguage(undefined), '');
});

test('el idioma original pedido recibe la transcripción tal cual; los demás se traducen', async () => {
  const { calls, translator } = fakeLlm();
  const captions = await buildCaptions({ text: 'Hola a todos', detectedLanguage: 'es', targets: ['es', 'fr', 'zh'], translator });
  assert.deepEqual(captions.find(c => c.language === 'es'), { language: 'es', text: 'Hola a todos', translated: false });
  assert.equal(captions.find(c => c.language === 'fr').text, '[francés] Hola a todos');
  assert.equal(calls.length, 2, 'no traduce al idioma original');
  assert.equal(calls[0].url, 'https://llm.test/v1/chat/completions');
  assert.equal(calls[0].auth, 'Bearer k');
});

test('code-switching: el idioma dominante con región (es-419) cuenta como el mismo', async () => {
  const { calls, translator } = fakeLlm();
  const captions = await buildCaptions({ text: 'Hola, how are you?', detectedLanguage: 'es-419', targets: ['es', 'en'], translator });
  assert.equal(captions.find(c => c.language === 'es').translated, false);
  assert.equal(captions.find(c => c.language === 'en').text, '[inglés] Hola, how are you?');
  assert.equal(calls.length, 1);
});

test('las traducciones van en paralelo', async () => {
  const { translator } = fakeLlm({ delayMs: 200 });
  const started = Date.now();
  await buildCaptions({ text: 'Buenos días', detectedLanguage: 'es', targets: ['en', 'fr', 'it', 'de', 'zh'], translator });
  assert.ok(Date.now() - started < 400, `tardó ${Date.now() - started} ms (en serie serían 1000)`);
});

test('caché: una frase repetida no vuelve a llamar al LLM, y dos pedidos simultáneos hacen una sola llamada', async () => {
  const { calls, translator } = fakeLlm({ delayMs: 50 });
  await Promise.all([translator.translate('Sí', 'en'), translator.translate('sí ', 'en')]);
  await translator.translate('Sí', 'en');
  assert.equal(calls.length, 1);
  await translator.translate('Sí', 'fr');
  assert.equal(calls.length, 2, 'otro idioma sí es otra traducción');
});

test('si el LLM falla para un idioma, ese queda sin subtítulo y los demás siguen', async () => {
  const { translator } = fakeLlm({ failFor: ['francés'] });
  const errors = [];
  const captions = await buildCaptions({
    text: 'Hola', detectedLanguage: 'es', targets: ['es', 'fr', 'en'], translator,
    onError: (error, target) => errors.push(target),
  });
  assert.deepEqual(captions.map(c => c.language).sort(), ['en', 'es']);
  assert.deepEqual(errors, ['fr']);
});

test('sin LLM configurado: solo quienes eligieron el idioma original ven el subtítulo', async () => {
  const translator = new Translator({ baseUrl: '', apiKey: '', model: '' });
  const captions = await buildCaptions({ text: 'Hello', detectedLanguage: 'en', targets: ['en', 'es'], translator });
  assert.deepEqual(captions, [{ language: 'en', text: 'Hello', translated: false }]);
});

test('el LLM que tarda más que el límite se corta', async () => {
  const fetchImpl = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const translator = new Translator({ baseUrl: 'https://x', apiKey: 'k', model: 'm', timeoutMs: 100, fetchImpl });
  const started = Date.now();
  await assert.rejects(translator.translate('Hola', 'en'));
  assert.ok(Date.now() - started < 1000);
});
