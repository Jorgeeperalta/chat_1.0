/**
 * @file Modelo Message
 * @description Representa un mensaje en una conversación
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} MessageAttributes
 * @property {number} id - ID único
 * @property {number} conversation_id - ID de la conversación
 * @property {number} sender_id - ID del usuario que envió el mensaje
 * @property {string} message_type - Tipo: 'text', 'audio', 'image', 'video', 'file'
 * @property {string} content - Contenido del mensaje (texto)
 * @property {number} original_language_id - ID del idioma original
 * @property {string} translated_content - Contenido traducido
 * @property {number} target_language_id - ID del idioma de destino
 * @property {string} translation_status - Estado: 'pending', 'completed', 'failed'
 * @property {string} audio_url - URL del audio
 * @property {number} audio_duration - Duración en segundos
 * @property {string} audio_transcription - Transcripción del audio
 * @property {number} audio_transcription_language_id - ID del idioma de transcripción
 * @property {number} mistral_prompt_tokens - Tokens del prompt de Mistral
 * @property {number} mistral_completion_tokens - Tokens de la respuesta de Mistral
 * @property {string} mistral_model - Modelo de Mistral utilizado
 * @property {number} mistral_response_time_ms - Tiempo de respuesta en ms
 * @property {boolean} is_edited - Si el mensaje fue editado
 * @property {boolean} is_deleted - Si el mensaje fue eliminado
 * @property {boolean} is_delivered - Si el mensaje fue entregado
 * @property {boolean} is_read - Si el mensaje fue leído
 * @property {number} reply_to_message_id - ID del mensaje al que responde
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo Message
 */
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      conversation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'conversation_id',
        validate: {
          notNull: true,
        },
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'sender_id',
        validate: {
          notNull: true,
        },
      },
      message_type: {
        type: DataTypes.ENUM('text', 'audio', 'image', 'video', 'file'),
        allowNull: false,
        defaultValue: 'text',
        field: 'message_type',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: 'content',
      },
      original_language_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'original_language_id',
      },
      translated_content: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: 'translated_content',
      },
      target_language_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'target_language_id',
      },
      translation_status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: true,
        defaultValue: null,
        field: 'translation_status',
      },
      audio_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'audio_url',
      },
      audio_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'audio_duration',
        comment: 'Duración en segundos',
      },
      audio_transcription: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: 'audio_transcription',
      },
      audio_transcription_language_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'audio_transcription_language_id',
      },
      mistral_prompt_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'mistral_prompt_tokens',
      },
      mistral_completion_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'mistral_completion_tokens',
      },
      mistral_model: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        field: 'mistral_model',
      },
      mistral_response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'mistral_response_time_ms',
      },
      reply_to_message_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'reply_to_message_id',
      },
      is_edited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_edited',
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_deleted',
      },
      is_delivered: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_delivered',
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_read',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      tableName: 'messages',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          fields: ['conversation_id'],
        },
        {
          fields: ['sender_id'],
        },
        {
          fields: ['created_at'],
        },
        {
          fields: ['message_type'],
        },
        {
          fields: ['original_language_id'],
        },
        {
          fields: ['target_language_id'],
        },
        {
          fields: ['conversation_id', 'created_at'],
        },
      ],
      
      hooks: {
        /**
         * Marcar como editado si el contenido cambia.
         * La traducción no cuenta: se guarda después de enviar y no es una edición.
         * @param {Message} message - Instancia del mensaje
         */
        beforeUpdate: (message) => {
          if (message.changed('content') && !message.is_deleted) {
            message.is_edited = true;
          }
        },
      },
    }
  );

  /**
   * Crea un mensaje de texto
   * @param {Object} data - Datos del mensaje
   * @returns {Promise<Message>}
   */
  /**
   * Actualiza el último mensaje de la conversación.
   * También lo hace el trigger after_message_insert, pero en hostings compartidos
   * los triggers pueden no estar permitidos, así que no se depende de él.
   * @param {Message} message - Mensaje recién creado
   */
  Message.touchConversation = async function (message) {
    const { models } = require('./index');
    await models.Conversation.update(
      {
        last_message_id: message.id,
        last_message_at: message.created_at || new Date(),
      },
      { where: { id: message.conversation_id } }
    );
  };

  /**
   * Include del mensaje citado (respuesta): solo lo necesario para mostrar la cita
   * @returns {Object}
   */
  Message.replyToInclude = function () {
    const { models } = require('./index');
    return {
      model: Message,
      as: 'replyTo',
      attributes: ['id', 'sender_id', 'message_type', 'content', 'audio_duration', 'is_deleted'],
      include: [
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'username', 'first_name', 'last_name'],
        },
      ],
    };
  };

  /**
   * Valida que el mensaje citado exista y sea de la misma conversación
   * @param {number|string|null} replyToMessageId - ID del mensaje citado
   * @param {number|string} conversationId - ID de la conversación
   * @returns {Promise<number|null>} ID válido, o null si no es una respuesta
   */
  Message.resolveReplyTo = async function (replyToMessageId, conversationId) {
    if (replyToMessageId == null || replyToMessageId === '') return null;

    const original = await this.findByPk(replyToMessageId, {
      attributes: ['id', 'conversation_id'],
    });
    if (!original || String(original.conversation_id) !== String(conversationId)) {
      throw new Error('El mensaje al que respondes no pertenece a esta conversación');
    }
    return original.id;
  };

  Message.createTextMessage = async function (data) {
    const message = await this.create({
      conversation_id: data.conversationId,
      sender_id: data.senderId,
      message_type: 'text',
      content: data.content,
      original_language_id: data.originalLanguageId,
      reply_to_message_id: data.replyToMessageId || null,
      ...(data.translatedContent && { translated_content: data.translatedContent }),
      ...(data.targetLanguageId && { target_language_id: data.targetLanguageId }),
      ...(data.translationStatus && { translation_status: data.translationStatus }),
    });

    await this.touchConversation(message);
    return message;
  };

  /**
   * Crea un mensaje de audio
   * @param {Object} data - Datos del mensaje
   * @returns {Promise<Message>}
   */
  Message.createAudioMessage = async function (data) {
    const message = await this.create({
      conversation_id: data.conversationId,
      sender_id: data.senderId,
      message_type: 'audio',
      audio_url: data.audioUrl,
      audio_duration: data.audioDuration,
      audio_transcription: data.audioTranscription,
      audio_transcription_language_id: data.audioTranscriptionLanguageId,
      original_language_id: data.originalLanguageId,
      reply_to_message_id: data.replyToMessageId || null,
      ...(data.translatedContent && { translated_content: data.translatedContent }),
      ...(data.targetLanguageId && { target_language_id: data.targetLanguageId }),
      ...(data.translationStatus && { translation_status: data.translationStatus }),
    });

    await this.touchConversation(message);
    return message;
  };

  /**
   * Obtiene los mensajes de una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{messages: Message[], total: number}>}
   */
  Message.findConversationMessages = async function (conversationId, options = {}) {
    const { models } = require('./index');
    const { limit = 50, offset = 0, beforeId = null, afterId = null } = options;

    const where = { conversation_id: conversationId };
    if (beforeId) where.id = { [sequelize.Op.lt]: beforeId };
    if (afterId) where.id = { [sequelize.Op.gt]: afterId };

    const include = [
      {
        model: models.User,
        as: 'sender',
        attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url', 'status'],
      },
      {
        model: models.Language,
        as: 'originalLanguage',
        attributes: ['id', 'code', 'name'],
      },
      {
        model: models.Language,
        as: 'targetLanguage',
        attributes: ['id', 'code', 'name'],
      },
      {
        model: models.MessageAttachment,
        as: 'attachments',
        attributes: ['id', 'file_name', 'file_url', 'file_type', 'file_size', 'mime_type'],
      },
      this.replyToInclude(),
    ];

    // Sin afterId se paginan desde los más recientes (offset 0 = últimos mensajes)
    // y se devuelven en orden cronológico.
    const newestFirst = !afterId;
    const { count, rows } = await this.findAndCountAll({
      where,
      include,
      limit,
      offset,
      distinct: true,
      order: [['id', newestFirst ? 'DESC' : 'ASC']],
    });

    return { messages: newestFirst ? rows.reverse() : rows, total: count };
  };

  /**
   * Obtiene un mensaje por ID con detalles
   * @param {number} id - ID del mensaje
   * @returns {Promise<Message|NULL>}
   */
  Message.findByIdWithDetails = async function (id) {
    const { models } = require('./index');

    return this.findOne({
      where: { id },
      include: [
        {
          model: models.Conversation,
          as: 'conversation',
          attributes: ['id', 'type', 'name'],
        },
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url'],
        },
        {
          model: models.Language,
          as: 'originalLanguage',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: models.Language,
          as: 'targetLanguage',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: models.MessageAttachment,
          as: 'attachments',
        },
        this.replyToInclude(),
      ],
    });
  };

  /**
   * Actualiza el estado de traducción
   * @param {number} id - ID del mensaje
   * @param {string} status - Estado: 'pending', 'completed', 'failed'
   * @param {string} translatedContent - Contenido traducido
   * @returns {Promise<Message>}
   */
  Message.updateTranslationStatus = async function (id, status, translatedContent = null) {
    const updateData = { translation_status: status };
    if (translatedContent) {
      updateData.translated_content = translatedContent;
    }

    await this.update(updateData, { where: { id } });
    return this.findByPk(id);
  };

  /**
   * Marca un mensaje como leído
   * @param {number} id - ID del mensaje
   * @returns {Promise<Message>}
   */
  Message.markAsRead = async function (id) {
    await this.update({ is_read: true }, { where: { id } });
    return this.findByPk(id);
  };

  /**
   * Marca un mensaje como entregado
   * @param {number} id - ID del mensaje
   * @returns {Promise<Message>}
   */
  Message.markAsDelivered = async function (id) {
    await this.update({ is_delivered: true }, { where: { id } });
    return this.findByPk(id);
  };

  /**
   * Elimina un mensaje (marca como eliminado).
   * Se borran el texto, la traducción y el audio: los demás solo ven "Mensaje eliminado".
   * @param {number} id - ID del mensaje
   * @returns {Promise<Message>}
   */
  Message.softDelete = async function (id) {
    await this.update(
      {
        is_deleted: true,
        content: null,
        translated_content: null,
        audio_url: null,
        audio_transcription: null,
      },
      { where: { id } }
    );
    return this.findByPk(id);
  };

  /**
   * Obtiene mensajes no leídos para un usuario en una conversación
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<Message[]>}
   */
  Message.getUnreadMessages = async function (userId, conversationId) {
    const { models } = require('./index');

    // Obtener el último mensaje leído
    const uc = await models.UserConversation.findOne({
      where: { user_id: userId, conversation_id: conversationId },
    });

    if (!uc || !uc.last_read_message_id) {
      // Si no hay último mensaje leído, todos son no leídos
      return this.findAll({
        where: { conversation_id: conversationId, is_deleted: false },
        order: [['id', 'ASC']],
      });
    }

    // Obtener mensajes después del último leído
    return this.findAll({
      where: {
        conversation_id: conversationId,
        id: { [sequelize.Op.gt]: uc.last_read_message_id },
        is_deleted: false,
      },
      order: [['id', 'ASC']],
    });
  };

  return Message;
};
