/**
 * @file Modelo User
 * @description Representa un usuario del sistema
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

/**
 * @typedef {Object} UserAttributes
 * @property {number} id - ID único
 * @property {string} username - Nombre de usuario único
 * @property {string} email - Correo electrónico único
 * @property {string} password_hash - Hash de la contraseña
 * @property {string} first_name - Nombre
 * @property {string} last_name - Apellido
 * @property {string} avatar_url - URL del avatar
 * @property {number} native_language_id - ID del idioma nativo
 * @property {number} preferred_language_id - ID del idioma preferido
 * @property {string} bio - Biografía
 * @property {string} status - Estado del usuario
 * @property {Date} last_seen_at - Última vez visto
 * @property {boolean} is_active - Si el usuario está activo
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo User
 */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 50],
          is: /^[a-zA-Z0-9_-]+$/, // Solo letras, números, guiones y guiones bajos
        },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
          isEmail: true,
        },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash',
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
        field: 'first_name',
        validate: {
          len: [0, 100],
        },
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
        field: 'last_name',
        validate: {
          len: [0, 100],
        },
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'avatar_url',
      },
      native_language_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'native_language_id',
        validate: {
          notNull: true,
        },
      },
      preferred_language_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'preferred_language_id',
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM('online', 'offline', 'away', 'busy'),
        allowNull: false,
        defaultValue: 'offline',
      },
      last_seen_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'last_seen_at',
      },
      email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'email_verified_at',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
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
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,

      indexes: [
        {
          unique: true,
          fields: ['username'],
        },
        {
          unique: true,
          fields: ['email'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['native_language_id'],
        },
        {
          fields: ['preferred_language_id'],
        },
        {
          fields: ['created_at'],
        },
      ],

      hooks: {
        /**
         * Hash de la contraseña antes de crear/actualizar
         * @param {User} user - Instancia del usuario
         */
        beforeCreate: async (user) => {
          if (user.password_hash) {
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(user.password_hash, salt);
          }
        },

        /**
         * Hash de la contraseña antes de actualizar
         * @param {User} user - Instancia del usuario
         */
        beforeUpdate: async (user) => {
          if (user.changed('password_hash') && user.password_hash) {
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(user.password_hash, salt);
          }
        },
      },
    }
  );

  /**
   * Verifica si la contraseña es correcta
   * @param {string} password - Contraseña a verificar
   * @returns {Promise<boolean>}
   */
  User.prototype.verifyPassword = async function (password) {
    return bcrypt.compare(password, this.password_hash);
  };

  /**
   * Obtiene el nombre completo del usuario
   * @returns {string}
   */
  User.prototype.getFullName = function () {
    return [this.first_name, this.last_name].filter(Boolean).join(' ') || this.username;
  };

  /**
   * Obtiene el idioma preferido o nativo
   * @returns {Promise<string>} Código del idioma
   */
  User.prototype.getPreferredLanguageCode = async function () {
    if (this.preferred_language_id) {
      const preferredLang = await this.getPreferredLanguage();
      if (preferredLang) return preferredLang.code;
    }
    const nativeLang = await this.getNativeLanguage();
    return nativeLang ? nativeLang.code : 'en';
  };

  /**
   * Busca un usuario por email
   * @param {string} email - Correo electrónico
   * @returns {Promise<User|NULL>}
   */
  User.findByEmail = async function (email) {
    return this.findOne({ where: { email, is_active: true } });
  };

  /**
   * Busca un usuario por username
   * @param {string} username - Nombre de usuario
   * @returns {Promise<User|NULL>}
   */
  User.findByUsername = async function (username) {
    return this.findOne({ where: { username, is_active: true } });
  };

  /**
   * Verifica si el email ya existe
   * @param {string} email - Correo electrónico
   * @returns {Promise<boolean>}
   */
  User.emailExists = async function (email) {
    const user = await this.findByEmail(email);
    return !!user;
  };

  /**
   * Verifica si el username ya existe
   * @param {string} username - Nombre de usuario
   * @returns {Promise<boolean>}
   */
  User.usernameExists = async function (username) {
    const user = await this.findByUsername(username);
    return !!user;
  };

  /**
   * Obtiene usuarios por IDs
   * @param {number[]} userIds - Array de IDs de usuarios
   * @returns {Promise<User[]>}
   */
  User.findByIds = async function (userIds) {
    return this.findAll({
      where: { id: userIds, is_active: true },
      order: [['username', 'ASC']],
    });
  };

  return User;
};
