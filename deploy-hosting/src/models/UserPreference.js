/**
 * @file Modelo UserPreference
 * @description Preferencias de usuario
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} UserPreferenceAttributes
 * @property {number} id - ID único
 * @property {number} user_id - ID del usuario
 * @property {string} theme - Tema: 'light', 'dark', 'system'
 * @property {boolean} notification_sound - Sonido de notificación
 * @property {boolean} notification_vibration - Vibración de notificación
 * @property {boolean} auto_translate_messages - Traducir automáticamente
 * @property {boolean} show_original_message - Mostrar mensaje original
 * @property {string} audio_quality - Calidad de audio: 'low', 'medium', 'high'
 * @property {boolean} play_audio_automatically - Reproducir audio automáticamente
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo UserPreference
 */
module.exports = (sequelize, DataTypes) => {
  const UserPreference = sequelize.define(
    'UserPreference',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'user_id',
        validate: {
          notNull: true,
        },
      },
      theme: {
        type: DataTypes.ENUM('light', 'dark', 'system'),
        allowNull: false,
        defaultValue: 'system',
      },
      notification_sound: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'notification_sound',
      },
      notification_vibration: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'notification_vibration',
      },
      auto_translate_messages: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'auto_translate_messages',
      },
      show_original_message: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'show_original_message',
      },
      audio_quality: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
        field: 'audio_quality',
      },
      play_audio_automatically: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'play_audio_automatically',
      },
    },
    {
      tableName: 'user_preferences',
      timestamps: false,
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['user_id'],
        },
      ],
    }
  );

  /**
   * Obtiene las preferencias de un usuario (crea por defecto si no existen)
   * @param {number} userId - ID del usuario
   * @returns {Promise<UserPreference>}
   */
  UserPreference.getOrCreate = async function (userId) {
    let preferences = await this.findOne({ where: { user_id: userId } });
    
    if (!preferences) {
      preferences = await this.create({ user_id: userId });
    }
    
    return preferences;
  };

  /**
   * Actualiza las preferencias de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} updates - Actualizaciones
   * @returns {Promise<UserPreference>}
   */
  UserPreference.updateForUser = async function (userId, updates) {
    const preferences = await this.getOrCreate(userId);
    return preferences.update(updates);
  };

  /**
   * Obtiene preferencias específicas
   * @param {number} userId - ID del usuario
   * @param {string[]} keys - Claves a obtener
   * @returns {Promise<Object>}
   */
  UserPreference.getPreferences = async function (userId, keys) {
    const preferences = await this.getOrCreate(userId);
    return keys.reduce((obj, key) => {
      obj[key] = preferences[key];
      return obj;
    }, {});
  };

  return UserPreference;
};
