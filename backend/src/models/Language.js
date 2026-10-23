/**
 * @file Modelo Language
 * @description Representa un idioma soportado por la aplicación
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} LanguageAttributes
 * @property {number} id - ID único
 * @property {string} code - Código ISO del idioma (ej: 'es', 'en')
 * @property {string} name - Nombre del idioma en inglés
 * @property {string} native_name - Nombre nativo del idioma
 * @property {string} flag_emoji - Emoji de la bandera
 * @property {boolean} is_active - Si el idioma está activo
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo Language
 */
module.exports = (sequelize, DataTypes) => {
  const Language = sequelize.define(
    'Language',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          len: [2, 10],
        },
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      native_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      flag_emoji: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW,
      },
    },
    {
      tableName: 'languages',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['code'],
        },
        {
          fields: ['is_active'],
        },
      ],
    }
  );

  /**
   * Obtiene el idioma por código
   * @param {string} code - Código del idioma
   * @returns {Promise<Language|NULL>}
   */
  Language.findByCode = async function (code) {
    return this.findOne({ where: { code, is_active: true } });
  };

  /**
   * Obtiene todos los idiomas activos
   * @returns {Promise<Language[]>}
   */
  Language.findAllActive = async function () {
    return this.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  };

  /**
   * Verifica si un código de idioma es válido
   * @param {string} code - Código a verificar
   * @returns {Promise<boolean>}
   */
  Language.isValidCode = async function (code) {
    const language = await this.findByCode(code);
    return !!language;
  };

  return Language;
};
