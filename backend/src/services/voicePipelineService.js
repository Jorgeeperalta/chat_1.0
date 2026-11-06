/**
 * @file Pipeline de notas de voz
 * @description Lo que pasa con una nota de voz después de enviarla:
 *   A. Transcripción (Voxtral) con el idioma del emisor guardado en la base.
 *   B. Traducción del texto a cada idioma de los receptores que no coincide con el del emisor.
 *   C. Voz sintetizada (Voxtral TTS) de cada traducción, con la voz que corresponde al género
 *      que eligió el emisor, para que cada receptor la escuche en su idioma.
 *
 * Corre en segundo plano: la nota de voz original llega al instante y lo demás se agrega
 * a medida que está listo (eventos 'message_transcribed' y 'voice_translation_ready').
 */

const config = require('../config');
const logger = require('../utils/logger');
const { models } = require('../models');
const mistralAudioService = require('./mistralAudioService');
const translationService = require('./translationService');
const storageService = require('./storageService');
const { getReadingLanguageId } = require('./messageTranslationService');
const { userRoom } = require('../utils/socketRooms');

/**
 * ¿Hay que procesar las notas de voz? (se puede apagar con VOICE_PIPELINE_ENABLED=false)
 * @returns {boolean}
 */
const isEnabled = () => config.mistral.voicePipelineEnabled && mistralAudioService.isConfigured;

/**
 * Traduce y pone voz a la transcripción para un idioma
 * @returns {Promise<Object>} Registro MessageVoiceTranslation
 */
const translateToLanguage = async ({ message, transcription, sourceLanguage, targetLanguage, voiceGender }) => {
  const { translatedText } = await translationService.translate(
    transcription,
    sourceLanguage.code,
    targetLanguage.code,
    { useCache: true }
  );

  // Sin voz para ese idioma (o si falla la síntesis) igual queda el texto traducido
  let audioUrl = null;
  let voiceId = null;
  try {
    voiceId = await mistralAudioService.pickVoice(targetLanguage.code, voiceGender);
    if (voiceId) {
      const audio = await mistralAudioService.synthesize(translatedText, voiceId);
      const saved = await storageService.saveFile(
        audio,
        `voz_${message.id}_${targetLanguage.code}.mp3`,
        'audio/mpeg',
        'audio/tts'
      );
      audioUrl = saved.url;
    } else {
      logger.info(`ℹ️ No hay voz de Mistral en ${targetLanguage.code}: la nota ${message.id} queda solo traducida en texto`);
    }
  } catch (error) {
    logger.warn(`⚠️ No se pudo sintetizar la voz de la nota ${message.id} en ${targetLanguage.code}: ${error.message}`);
  }

  const [record] = await models.MessageVoiceTranslation.upsert({
    message_id: message.id,
    language_id: targetLanguage.id,
    translated_text: translatedText,
    audio_url: audioUrl,
    voice_id: audioUrl ? voiceId : null,
    status: 'completed',
  });
  return record;
};

/**
 * Procesa una nota de voz recién guardada (pasos A, B y C)
 * @param {Object} params
 * @param {Object} params.message - Instancia de Message (tipo audio)
 * @param {Buffer} params.audioBuffer - Audio tal como lo grabó el emisor
 * @param {string} params.mimeType
 * @param {string} params.fileName - Con extensión
 * @param {Object} [params.io] - Socket.io, para avisar a cada uno cuando está listo
 */
const processVoiceMessage = async ({ message, audioBuffer, mimeType, fileName, io }) => {
  const conversationRoom = String(message.conversation_id);
  const notifyTranscription = (payload) => io?.to(conversationRoom).emit('message_transcribed', {
    messageId: message.id,
    conversationId: message.conversation_id,
    ...payload,
  });

  try {
    const sender = await models.User.findByPk(message.sender_id, {
      attributes: ['id', 'preferred_language_id', 'native_language_id', 'voice_gender'],
    });
    const sourceLanguageId = getReadingLanguageId(sender);
    const sourceLanguage = sourceLanguageId ? await models.Language.findByPk(sourceLanguageId) : null;

    // A. Transcripción con el idioma del emisor
    const { text: transcription } = await mistralAudioService.transcribe(audioBuffer, {
      fileName,
      mimeType,
      languageCode: sourceLanguage?.code,
    });

    // Si la borraron mientras se transcribía, no se le vuelve a poner texto
    await message.reload();
    if (message.is_deleted) return;

    await message.update({
      audio_transcription: transcription || null,
      audio_transcription_language_id: sourceLanguage?.id ?? message.audio_transcription_language_id,
      original_language_id: sourceLanguage?.id ?? message.original_language_id,
      // Silencio o ruido: no hay nada que traducir
      translation_status: transcription ? 'pending' : 'completed',
    });
    notifyTranscription({
      transcription,
      originalLanguageId: sourceLanguage?.id ?? null,
      translationStatus: transcription ? 'pending' : 'completed',
    });
    logger.info(`🎙️ Nota de voz ${message.id} transcrita (${transcription.length} caracteres)`);
    if (!transcription || !sourceLanguage) return;

    // B. ¿Quién la escucha en otro idioma? Un grupo por idioma: cada idioma se procesa una vez
    const participants = await models.UserConversation.findAll({
      where: { conversation_id: message.conversation_id },
      include: [{ model: models.User, as: 'user', attributes: ['id', 'preferred_language_id', 'native_language_id'] }],
    });
    const recipientsByLanguage = new Map();
    for (const { user } of participants) {
      if (!user || user.id === message.sender_id) continue;
      const languageId = getReadingLanguageId(user);
      if (!languageId || languageId === sourceLanguage.id) continue;
      if (!recipientsByLanguage.has(languageId)) recipientsByLanguage.set(languageId, []);
      recipientsByLanguage.get(languageId).push(user.id);
    }

    let completed = 0;
    let firstTranslation = null;
    await Promise.all([...recipientsByLanguage].map(async ([languageId, userIds]) => {
      const targetLanguage = await models.Language.findByPk(languageId);
      if (!targetLanguage) return;
      try {
        // B + C. Traducción y voz en el idioma del receptor
        const record = await translateToLanguage({
          message,
          transcription,
          sourceLanguage,
          targetLanguage,
          voiceGender: sender?.voice_gender || null,
        });
        completed += 1;
        firstTranslation ??= record;

        const payload = {
          messageId: message.id,
          conversationId: message.conversation_id,
          translatedContent: record.translated_text,
          targetLanguageId: targetLanguage.id,
          translatedAudioUrl: record.audio_url,
          translationStatus: 'completed',
        };
        for (const userId of userIds) io?.to(userRoom(userId)).emit('voice_translation_ready', payload);
        logger.info(`🌐 Nota de voz ${message.id} → ${targetLanguage.code}${record.audio_url ? ' con voz' : ''}`);
      } catch (error) {
        logger.warn(`⚠️ Error al traducir la nota de voz ${message.id} a ${targetLanguage.code}: ${error.message}`);
      }
    }));

    // Igual que con los textos: la primera traducción también queda en el mensaje
    const allFailed = recipientsByLanguage.size > 0 && completed === 0;
    await message.update({
      translation_status: allFailed ? 'failed' : 'completed',
      ...(firstTranslation && {
        translated_content: firstTranslation.translated_text,
        target_language_id: firstTranslation.language_id,
      }),
    });
    // Fin del proceso para todos: el emisor y quienes leen en su mismo idioma no reciben
    // 'voice_translation_ready', y sin este aviso se quedaban con "Traduciendo la voz…"
    notifyTranscription({ transcription, translationStatus: allFailed ? 'failed' : 'completed' });
  } catch (error) {
    logger.error(`❌ Error al procesar la nota de voz ${message.id}: ${error.message}`);
    await message.update({ translation_status: 'failed' }).catch(() => {});
    notifyTranscription({ translationStatus: 'failed' });
  }
};

/**
 * Lanza el pipeline sin demorar la respuesta al emisor
 * @param {Object} params - Ver processVoiceMessage
 */
const processInBackground = (params) => {
  if (!isEnabled()) return;
  setImmediate(() => {
    processVoiceMessage(params).catch(error =>
      logger.error(`❌ Error inesperado en el pipeline de voz: ${error.message}`));
  });
};

/**
 * Agrega a las notas de voz ajenas la traducción (texto y audio) al idioma del lector.
 * No guarda nada: solo cambia lo que se responde.
 * @param {Array} messages - Instancias de Message
 * @param {number} readerId
 * @returns {Promise<Array>} Los mismos mensajes
 */
const attachVoiceTranslations = async (messages, readerId) => {
  const voiceMessages = (messages || []).filter(message =>
    message.message_type === 'audio' && message.sender_id !== readerId);
  if (voiceMessages.length === 0) return messages;

  const reader = await models.User.findByPk(readerId, {
    attributes: ['id', 'preferred_language_id', 'native_language_id'],
  });
  const languageId = getReadingLanguageId(reader);
  if (!languageId) return messages;

  const records = await models.MessageVoiceTranslation.findAll({
    where: { message_id: voiceMessages.map(message => message.id), language_id: languageId },
  });
  const byMessage = new Map(records.map(record => [record.message_id, record]));

  for (const message of voiceMessages) {
    const record = byMessage.get(message.id);
    message.setDataValue('translated_audio_url', record?.audio_url || null);
    // La traducción guardada en el mensaje puede ser a otro idioma: se muestra solo la del lector
    // (y si habla el idioma del emisor, ninguna)
    message.setDataValue('translated_content', record?.translated_text || null);
    message.setDataValue('target_language_id', record ? languageId : null);
  }
  return messages;
};

module.exports = {
  isEnabled,
  processVoiceMessage,
  processInBackground,
  attachVoiceTranslations,
};
