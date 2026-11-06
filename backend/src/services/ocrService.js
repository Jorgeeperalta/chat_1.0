/**
 * @file OCR de documentos con Mistral
 * @description Extrae el texto de PDFs e imágenes escaneadas (POST /v1/ocr). El archivo viaja
 * en la misma petición (data URI en base64): no se guarda en el servidor ni se sube a Mistral
 * como archivo aparte.
 */

const config = require('../config');
const logger = require('../utils/logger');
const translationService = require('./translationService');

// Tipos aceptados y cómo empiezan sus bytes: un archivo con la extensión cambiada no pasa
const DOCUMENT_TYPES = {
  'application/pdf': { kind: 'document', signature: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { kind: 'image', signature: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { kind: 'image', signature: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { kind: 'image', signature: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

// Para traducir, cada página va por separado y el total tiene un tope (costo y tiempo acotados)
const MAX_TRANSLATED_CHARS = 30000;
const TRANSLATION_MAX_TOKENS = 4000;

/**
 * @param {string} mimeType
 * @param {Buffer} buffer
 * @returns {boolean} Si es un PDF o una imagen aceptada, y el contenido lo confirma
 */
const isSupportedDocument = (mimeType, buffer) => {
  const type = DOCUMENT_TYPES[mimeType];
  return Boolean(type && buffer?.length >= 12 && type.signature(buffer));
};

/**
 * Texto de un documento, página por página (en Markdown: conserva títulos y tablas)
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{pages: Array<{index: number, text: string}>, pagesProcessed: number}>}
 */
const extractText = async (buffer, mimeType) => {
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const document = DOCUMENT_TYPES[mimeType].kind === 'document'
    ? { type: 'document_url', document_url: dataUri }
    : { type: 'image_url', image_url: dataUri };

  const send = () => fetch(`${config.mistral.baseUrl}/ocr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mistral.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.mistral.ocrModel,
      document,
      // Sin table_format las tablas vienen dentro del texto (en Markdown); con él vienen aparte
      include_image_base64: false,
    }),
    signal: AbortSignal.timeout(config.mistral.ocrTimeoutMs),
  });
  let response;
  try {
    response = await send();
  } catch (error) {
    // Corte de red (no un error de la API): un reintento
    logger.warn(`⚠️ Mistral OCR: ${error.cause?.code || error.message}, se reintenta`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    response = await send();
  }
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`Mistral OCR respondió ${response.status}: ${body.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }

  const result = JSON.parse(body);
  const pages = (result.pages || []).map(page => ({
    index: page.index,
    text: String(page.markdown || '').trim(),
  }));
  return { pages, pagesProcessed: result.usage_info?.pages_processed ?? pages.length };
};

/**
 * Traduce las páginas (el idioma de origen lo detecta el modelo)
 * @param {Array<{index: number, text: string}>} pages
 * @param {string} targetLanguageCode
 * @returns {Promise<{pages: Array, truncated: boolean}>} Las mismas páginas con `translated_text`
 */
const translatePages = async (pages, targetLanguageCode) => {
  let budget = MAX_TRANSLATED_CHARS;
  let truncated = false;
  const translated = [];

  for (const page of pages) {
    if (!page.text) {
      translated.push({ ...page, translated_text: '' });
      continue;
    }
    if (budget <= 0) {
      truncated = true;
      translated.push({ ...page, translated_text: null });
      continue;
    }
    const text = page.text.slice(0, budget);
    truncated ||= text.length < page.text.length;
    budget -= text.length;

    const result = await translationService.translate(text, 'auto', targetLanguageCode, {
      useCache: false,
      maxTokens: TRANSLATION_MAX_TOKENS,
      temperature: 0.2,
    });
    translated.push({ ...page, translated_text: result.translatedText });
  }
  return { pages: translated, truncated };
};

/**
 * Procesa un documento completo: OCR y, si se pide, traducción
 * @param {Object} file - Archivo de multer (buffer, mimetype, originalname)
 * @param {Object} [options]
 * @param {string} [options.translateTo] - Código de idioma
 * @returns {Promise<Object>}
 */
const processDocument = async (file, { translateTo } = {}) => {
  const startedAt = Date.now();
  const { pages, pagesProcessed } = await extractText(file.buffer, file.mimetype);

  let result = { pages, truncated: false };
  if (translateTo) {
    try {
      result = await translatePages(pages, translateTo);
    } catch (error) {
      // El texto extraído sirve igual: se devuelve sin traducir
      logger.warn(`⚠️ OCR: no se pudo traducir ${file.originalname}: ${error.message}`);
      result = { pages, truncated: false, translationError: true };
    }
  }

  const join = (key) => result.pages.map(page => page[key]).filter(Boolean).join('\n\n');
  logger.info(`📄 OCR: ${file.originalname} (${pagesProcessed} pág.) en ${Date.now() - startedAt} ms`);

  return {
    file_name: file.originalname,
    mime_type: file.mimetype,
    pages_processed: pagesProcessed,
    pages: result.pages,
    text: join('text'),
    ...(translateTo && {
      translated_text: result.translationError ? null : join('translated_text'),
      translated_to: translateTo,
      translation_truncated: result.truncated,
    }),
  };
};

/**
 * Corre `worker` sobre cada elemento, con a lo sumo `limit` a la vez (y en el mismo orden)
 * @returns {Promise<Array>}
 */
const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
};

module.exports = {
  DOCUMENT_TYPES,
  isSupportedDocument,
  extractText,
  translatePages,
  processDocument,
  mapWithConcurrency,
};
