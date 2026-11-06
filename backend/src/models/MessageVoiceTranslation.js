/**
 * @file Modelo MessageVoiceTranslation
 * @description Una nota de voz traducida a un idioma: el texto traducido y el audio sintetizado
 * con la voz elegida. Hay una por cada idioma de los receptores distinto al del emisor.
 */

/**
 * @typedef {Object} MessageVoiceTranslationAttributes
 * @property {number} id - ID único
 * @property {number} message_id - Nota de voz original
 * @property {number} language_id - Idioma de la traducción
 * @property {string} translated_text - Transcripción traducida
 * @property {string|null} audio_url - MP3 con la traducción hablada (null si no hay voz para ese idioma)
 * @property {string|null} voice_id - Voz de Mistral usada
 * @property {string} status - completed | failed
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo MessageVoiceTranslation
 */
module.exports = (sequelize, DataTypes) => {
  const MessageVoiceTranslation = sequelize.define(
    'MessageVoiceTranslation',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      message_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'message_id',
      },
      language_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'language_id',
      },
      translated_text: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: 'translated_text',
      },
      audio_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'audio_url',
      },
      voice_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
        field: 'voice_id',
      },
      status: {
        type: DataTypes.ENUM('completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed',
      },
    },
    {
      tableName: 'message_voice_translations',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      indexes: [
        { unique: true, fields: ['message_id', 'language_id'], name: 'uq_voice_translation_message_language' },
      ],
    }
  );

  return MessageVoiceTranslation;
};
