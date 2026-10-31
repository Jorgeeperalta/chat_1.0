/**
 * @file Modelo PushSubscription
 * @description Suscripción a notificaciones push (Web Push) de un navegador/teléfono.
 * Un usuario puede tener varias: una por cada dispositivo donde activó las notificaciones.
 */

/**
 * @typedef {Object} PushSubscriptionAttributes
 * @property {number} id - ID único
 * @property {number} user_id - ID del usuario
 * @property {string} endpoint - URL del servicio push del navegador (única por dispositivo)
 * @property {string} p256dh - Clave pública del navegador
 * @property {string} auth - Secreto de autenticación del navegador
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo PushSubscription
 */
module.exports = (sequelize, DataTypes) => {
  const PushSubscription = sequelize.define(
    'PushSubscription',
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
      endpoint: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'endpoint',
      },
      p256dh: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'p256dh',
      },
      auth: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'auth',
      },
    },
    {
      tableName: 'push_subscriptions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      indexes: [
        { fields: ['user_id'] },
        // Sin UNIQUE: un VARCHAR(500) excede el largo de clave de algunos MySQL.
        // Los repetidos se evitan en el código (ver pushRoutes).
        { fields: [{ name: 'endpoint', length: 191 }], name: 'idx_push_endpoint' },
      ],
    }
  );

  return PushSubscription;
};
