/**
 * @file Modelo TranslationCache
 * @description Cache de traducciones para evitar llamadas repetidas a la API
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');
const crypto = require('crypto');

/**
 * @typedef {Object} TranslationCacheAttributes
 * @property {number} id - ID único
 * @property {string} source_text_hash - Hash SHA-256 del texto original
 * @property {number} source_language_id - ID del idioma de origen
 * @property {number} target_language_id - ID del idioma de destino
 * @property {string} translated_text - Texto traducido
 * @property {string} mistral_model - Modelo de Mistral utilizado
 * @property {Date} created_at - Fecha de creación
 * @property {Date} expires_at - Fecha de expiración
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo TranslationCache
 */
module.exports = (sequelize, DataTypes) => {
  const TranslationCache = sequelize.define(
    'TranslationCache',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      source_text_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'source_text_hash',
        validate: {
          notEmpty: true,
          len: [64, 64],
        },
      },
      source_language_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'source_language_id',
        validate: {
          notNull: true,
        },
      },
      target_language_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'target_language_id',
        validate: {
          notNull: true,
        },
      },
      translated_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'translated_text',
        validate: {
          notEmpty: true,
        },
      },
      mistral_model: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        field: 'mistral_model',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'expires_at',
      },
    },
    {
      tableName: 'translations_cache',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['source_text_hash', 'source_language_id', 'target_language_id'],
          name: 'uk_translation_cache',
        },
        {
          fields: ['source_text_hash'],
        },
        {
          fields: ['source_language_id', 'target_language_id'],
        },
        {
          fields: ['expires_at'],
        },
      ],
      
      hooks: {
        /**
         * Establecer fecha de expiración por defecto (7 días)
         * @param {TranslationCache} cache - Instancia del cache
         */
        beforeCreate: (cache) => {
          if (!cache.expires_at) {
            cache.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
          }
        },
      },
    }
  );

  /**
   * Genera hash SHA-256 para un texto
   * @param {string} text - Texto a hashear
   * @returns {string}
   */
  TranslationCache.generateHash = function (text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  };

  /**
   * Obtiene una traducción del cache
   * @param {string} sourceText - Texto original
   * @param {number} sourceLanguageId - ID del idioma de origen
   * @param {number} targetLanguageId - ID del idioma de destino
   * @returns {Promise<TranslationCache|NULL>}
   */
  TranslationCache.getCachedTranslation = async function (sourceText, sourceLanguageId, targetLanguageId) {
    const hash = this.generateHash(sourceText);
    
    return this.findOne({
      where: {
        source_text_hash: hash,
        source_language_id: sourceLanguageId,
        target_language_id: targetLanguageId,
      },
    });
  };

  /**
   * Guarda una traducción en el cache
   * @param {string} sourceText - Texto original
   * @param {number} sourceLanguageId - ID del idioma de origen
   * @param {number} targetLanguageId - ID del idioma de destino
   * @param {string} translatedText - Texto traducido
   * @param {string} model - Modelo de Mistral utilizado
   * @returns {Promise<TranslationCache>}
   */
  TranslationCache.cacheTranslation = async function (sourceText, sourceLanguageId, targetLanguageId, translatedText, model) {
    const hash = this.generateHash(sourceText);
    
    return this.create({
      source_text_hash: hash,
      source_language_id: sourceLanguageId,
      target_language_id: targetLanguageId,
      translated_text: translatedText,
      mistral_model: model,
    });
  };

  /**
   * Limpia el cache de traducciones expiradas
   * @returns {Promise<number>} Cantidad de entradas eliminadas
   */
  TranslationCache.cleanupExpired = async function () {
    const now = new Date();
    return this.destroy({ where: { expires_at: { [sequelize.Op.lt]: now } } });
  };

  /**
   * Obtiene estadísticas del cache
   * @returns {Promise<{total: number, active: number, expired: number}>}
   */
  TranslationCache.getStats = async function () {
    const now = new Date();
    
    const total = await this.count();
    const active = await this.count({ where: { expires_at: { [sequelize.Op.gt]: now } } });
    const expired = await this.count({ where: { expires_at: { [sequelize.Op.lte]: now } } });

    return { total, active, expired };
  };

  return TranslationCache;
};
