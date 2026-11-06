/**
 * @file Modelo PasswordResetToken
 * @description Enlace para restablecer la contraseña. Se guarda solo el hash SHA-256 del token:
 * quien lea la base no puede usar los enlaces que están en los correos.
 */

/**
 * @typedef {Object} PasswordResetTokenAttributes
 * @property {number} id - ID único
 * @property {number} user_id - Usuario que pidió el cambio
 * @property {string} token_hash - SHA-256 (hex) del token enviado por correo
 * @property {Date} expires_at - Vence a los pocos minutos
 * @property {Date|null} used_at - Cuándo se usó o se anuló (un enlace sirve una sola vez)
 * @property {string|null} request_ip - IP desde la que se pidió
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo PasswordResetToken
 */
module.exports = (sequelize, DataTypes) => {
  const PasswordResetToken = sequelize.define(
    'PasswordResetToken',
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
        field: 'user_id',
      },
      token_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
        field: 'token_hash',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'used_at',
      },
      request_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
        defaultValue: null,
        field: 'request_ip',
      },
    },
    {
      tableName: 'password_reset_tokens',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      indexes: [
        { unique: true, fields: ['token_hash'], name: 'uq_password_reset_token_hash' },
        { fields: ['user_id'] },
      ],
    }
  );

  return PasswordResetToken;
};
