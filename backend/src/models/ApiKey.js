/**
 * @file Modelo ApiKey
 * @description Almacenamiento seguro de claves API
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} ApiKeyAttributes
 * @property {number} id - ID único
 * @property {string} service_name - Nombre del servicio
 * @property {string} api_key - Clave API
 * @property {string} api_secret - Secreto API (opcional)
 * @property {string} endpoint_url - URL del endpoint (opcional)
 * @property {boolean} is_active - Si la clave está activa
 * @property {number} rate_limit_per_minute - Límite de solicitudes por minuto
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo ApiKey
 */
module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define(
    'ApiKey',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      service_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        field: 'service_name',
        validate: {
          notEmpty: true,
        },
      },
      api_key: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'api_key',
        validate: {
          notEmpty: true,
        },
      },
      api_secret: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'api_secret',
      },
      endpoint_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'endpoint_url',
        validate: {
          isUrl: true,
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      rate_limit_per_minute: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'rate_limit_per_minute',
        validate: {
          min: 0,
        },
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
      tableName: 'api_keys',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['service_name'],
        },
        {
          fields: ['is_active'],
        },
      ],
    }
  );

  /**
   * Obtiene una clave API por nombre del servicio
   * @param {string} serviceName - Nombre del servicio
   * @returns {Promise<ApiKey|NULL>}
   */
  ApiKey.findByServiceName = async function (serviceName) {
    return this.findOne({ where: { service_name: serviceName, is_active: true } });
  };

  /**
   * Verifica si una clave API existe y está activa
   * @param {string} serviceName - Nombre del servicio
   * @returns {Promise<boolean>}
   */
  ApiKey.isActive = async function (serviceName) {
    const apiKey = await this.findByServiceName(serviceName);
    return !!apiKey;
  };

  /**
   * Obtiene todas las claves API activas
   * @returns {Promise<ApiKey[]>}
   */
  ApiKey.findAllActive = async function () {
    return this.findAll({ where: { is_active: true }, order: [['service_name', 'ASC']] });
  };

  /**
   * Crea o actualiza una clave API
   * @param {string} serviceName - Nombre del servicio
   * @param {Object} data - Datos de la clave
   * @returns {Promise<ApiKey>}
   */
  ApiKey.upsertKey = async function (serviceName, data) {
    const [apiKey] = await this.findOrCreate({
      where: { service_name: serviceName },
      defaults: {
        service_name: serviceName,
        api_key: data.apiKey,
        api_secret: data.apiSecret || null,
        endpoint_url: data.endpointUrl || null,
        is_active: data.isActive || true,
        rate_limit_per_minute: data.rateLimitPerMinute || null,
      },
    });

    // Actualizar si existe
    if (apiKey.api_key !== data.apiKey ||
        apiKey.api_secret !== (data.apiSecret || null) ||
        apiKey.endpoint_url !== (data.endpointUrl || null) ||
        apiKey.is_active !== (data.isActive || true) ||
        apiKey.rate_limit_per_minute !== (data.rateLimitPerMinute || null)) {
      await apiKey.update({
        api_key: data.apiKey,
        api_secret: data.apiSecret || null,
        endpoint_url: data.endpointUrl || null,
        is_active: data.isActive || true,
        rate_limit_per_minute: data.rateLimitPerMinute || null,
      });
    }

    return apiKey;
  };

  return ApiKey;
};
