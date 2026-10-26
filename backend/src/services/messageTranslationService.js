/**
 * @file Traducción de mensajes por receptor
 * @description Traduce un mensaje a cada idioma presente en la conversación y entrega a cada
 * usuario la traducción a SU idioma (en vivo por Socket.io y al cargar el historial).
 *
 * El mensaje guarda en `translated_content` solo la primera traducción (compatibilidad con el
 * esquema). Todas las traducciones quedan en `translation_cache`, de donde se leen al cargar
 * el historial para cada usuario.
 */

const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { models } = require('../models');
const translationService = require('./translationService');
const { userRoom } = require('../utils/socketRooms');

/**
 * Idioma en el que un usuario quiere leer los mensajes
 * @param {Object} user - Usuario con preferred_language_id / native_language_id
 * @returns {number|null}
 */
const getReadingLanguageId = (user) => user?.preferred_language_id || user?.native_language_id || null;

/**
 * Traduce un mensaje de texto a los idiomas de los demás participantes.
 * Cada idioma se traduce una sola vez, aunque lo compartan varios usuarios.
 * @param {Object} params
 * @param {Object} params.message - Instancia de Message recién creada
 * @param {string} params.content - Texto original
 * @param {Object|null} params.sourceLanguage - Instancia de Language del texto original
 * @param {Array} params.participants - UserConversation con `user` (id, preferred_language_id, native_language_id)
 * @param {number} params.senderId - ID del remitente
 * @param {Object} [params.io] - Instancia de Socket.io para avisar a cada receptor
 */
const translateForParticipants = async ({ message, content, sourceLanguage, participants, senderId, io }) => {
  if (!sourceLanguage) {
    logger.warn(`⚠️ Mensaje ${message.id} sin idioma de origen: no se traduce`);
    return;
  }

  // Agrupar receptores por idioma de lectura
  const recipientsByLanguage = new Map();
  for (const participant of participants) {
    const user = participant.user;
    if (!user || user.id === senderId) continue;

    const languageId = getReadingLanguageId(user);
    if (!languageId || languageId === sourceLanguage.id) continue;

    if (!recipientsByLanguage.has(languageId)) recipientsByLanguage.set(languageId, []);
    recipientsByLanguage.get(languageId).push(user.id);
  }

  if (recipientsByLanguage.size === 0) {
    logger.info(`ℹ️ No se requiere traducción del mensaje ${message.id}: todos leen en ${sourceLanguage.code}`);
    return;
  }

  let translatedCount = 0;

  for (const [languageId, userIds] of recipientsByLanguage) {
    const targetLanguage = await models.Language.findByPk(languageId);
    if (!targetLanguage) {
      logger.warn(`⚠️ Idioma ${languageId} no encontrado para el mensaje ${message.id}`);
      continue;
    }

    try {
      const result = await translationService.translate(
        content,
        sourceLanguage.code,
        targetLanguage.code,
        { useCache: true }
      );
      if (!result.translatedText) continue;

      // La primera traducción se guarda en el mensaje; las demás viven en translation_cache
      if (translatedCount === 0) {
        await message.update({
          translated_content: result.translatedText,
          target_language_id: targetLanguage.id,
          translation_status: 'completed',
          mistral_model: result.model,
          mistral_prompt_tokens: result.promptTokens,
          mistral_completion_tokens: result.completionTokens,
          mistral_response_time_ms: result.responseTimeMs,
        });
      }
      translatedCount += 1;

      logger.info(`🌐 Mensaje ${message.id} traducido a ${targetLanguage.code} para ${userIds.length} usuario(s)`);

      if (io) {
        const payload = {
          messageId: message.id,
          conversationId: message.conversation_id,
          translatedContent: result.translatedText,
          targetLanguageId: targetLanguage.id,
          translationStatus: 'completed',
        };
        for (const userId of userIds) {
          io.to(userRoom(userId)).emit('message_translation_updated', payload);
        }
      }
    } catch (error) {
      logger.warn(`⚠️ Error al traducir el mensaje ${message.id} a ${targetLanguage.code}: ${error.message}`);
    }
  }

  if (translatedCount === 0) {
    await message.update({ translation_status: 'failed' }).catch(() => {});
  }
};

/**
 * Reemplaza `translated_content` de cada mensaje por la traducción al idioma del lector,
 * tomándola de translation_cache. No guarda nada: solo cambia lo que se responde.
 * @param {Array} messages - Instancias de Message
 * @param {number} readerId - ID del usuario que pide los mensajes
 * @returns {Promise<Array>} Los mismos mensajes
 */
const localizeMessagesForReader = async (messages, readerId) => {
  if (!messages?.length) return messages;

  const reader = await models.User.findByPk(readerId, {
    attributes: ['id', 'preferred_language_id', 'native_language_id'],
  });
  const readerLanguageId = getReadingLanguageId(reader);
  if (!readerLanguageId) return messages;

  // Mensajes ajenos cuya traducción guardada no está en el idioma del lector
  const pending = messages.filter(message =>
    message.sender_id !== readerId &&
    message.content &&
    message.original_language_id &&
    message.original_language_id !== readerLanguageId &&
    message.target_language_id !== readerLanguageId
  );
  if (pending.length === 0) return messages;

  const hashOf = message => models.TranslationCache.generateHash(message.content.trim());
  const cached = await models.TranslationCache.findAll({
    where: {
      source_text_hash: { [Op.in]: [...new Set(pending.map(hashOf))] },
      target_language_id: readerLanguageId,
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
    },
  });

  const byKey = new Map(
    cached.map(entry => [`${entry.source_text_hash}:${entry.source_language_id}`, entry.translated_text])
  );

  for (const message of pending) {
    const translatedText = byKey.get(`${hashOf(message)}:${message.original_language_id}`);
    // Sin traducción a su idioma: no mostrar la de otro idioma
    message.setDataValue('translated_content', translatedText || null);
    message.setDataValue('target_language_id', translatedText ? readerLanguageId : null);
  }

  return messages;
};

module.exports = {
  translateForParticipants,
  localizeMessagesForReader,
};
