/**
 * @file Modelo UserSession
 * @description Sesiones activas de usuarios para WebSocket tracking
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} UserSessionAttributes
 * @property {number} id - ID único
 * @property {number} user_id - ID del usuario
 * @property {string} session_id - ID de la sesión
 * @property {string} ip_address - Dirección IP
 * @property {string} user_agent - User Agent
 * @property {string} socket_id - ID del socket
 * @property {string} status - Estado: 'active', 'expired'
 * @property {Date} expires_at - Fecha de expiración
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo UserSession
 */
module.exports = (sequelize, DataTypes) => {
  const UserSession = sequelize.define(
    'UserSession',
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
        validate: {
          notNull: true,
        },
      },
      session_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'session_id',
        validate: {
          notEmpty: true,
        },
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        defaultValue: null,
        field: 'ip_address',
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: 'user_agent',
      },
      socket_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'socket_id',
      },
      status: {
        type: DataTypes.ENUM('active', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'expires_at',
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
      tableName: 'user_sessions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['session_id'],
        },
        {
          fields: ['user_id'],
        },
        {
          fields: ['socket_id'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['expires_at'],
        },
      ],
    }
  );

  /**
   * Crea o actualiza una sesión de usuario
   * @param {number} userId - ID del usuario
   * @param {string} sessionId - ID de la sesión
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<UserSession>}
   */
  UserSession.upsertSession = async function (userId, sessionId, options = {}) {
    const { ipAddress, userAgent, socketId, expiresAt } = options;
    
    const [session] = await this.findOrCreate({
      where: { session_id: sessionId },
      defaults: {
        user_id: userId,
        session_id: sessionId,
        ip_address: ipAddress,
        user_agent: userAgent,
        socket_id: socketId,
        status: 'active',
        expires_at: expiresAt,
      },
    });

    // Actualizar si existe
    if (session.ip_address !== ipAddress || 
        session.user_agent !== userAgent || 
        session.socket_id !== socketId) {
      await session.update({
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
        socket_id: socketId,
        status: 'active',
        expires_at: expiresAt,
        updated_at: new Date(),
      });
    }

    return session;
  };

  /**
   * Obtiene las sesiones activas de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<UserSession[]>}
   */
  UserSession.getActiveSessions = async function (userId) {
    return this.findAll({
      where: { user_id: userId, status: 'active' },
      order: [['updated_at', 'DESC']],
    });
  };

  /**
   * Obtiene una sesión por ID
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<UserSession|NULL>}
   */
  UserSession.findBySessionId = async function (sessionId) {
    return this.findOne({ where: { session_id: sessionId, status: 'active' } });
  };

  /**
   * Obtiene una sesión por socket ID
   * @param {string} socketId - ID del socket
   * @returns {Promise<UserSession|NULL>}
   */
  UserSession.findBySocketId = async function (socketId) {
    return this.findOne({ where: { socket_id: socketId, status: 'active' } });
  };

  /**
   * Expira una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<number>} Cantidad de sesiones afectadas
   */
  UserSession.expireSession = async function (sessionId) {
    return this.update(
      { status: 'expired', socket_id: null },
      { where: { session_id: sessionId } }
    );
  };

  /**
   * Expira todas las sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>} Cantidad de sesiones afectadas
   */
  UserSession.expireUserSessions = async function (userId) {
    return this.update(
      { status: 'expired', socket_id: null },
      { where: { user_id: userId, status: 'active' } }
    );
  };

  /**
   * Limpia sesiones expiradas
   * @returns {Promise<number>} Cantidad de sesiones eliminadas
   */
  UserSession.cleanupExpired = async function () {
    const now = new Date();
    
    // Primero expirar sesiones con fecha de expiración
    await this.update(
      { status: 'expired', socket_id: null },
      {
        where: {
          status: 'active',
          expires_at: { [sequelize.Op.lt]: now },
        },
      }
    );

    // Luego eliminar sesiones expiradas antiguas
    return this.destroy({
      where: {
        status: 'expired',
        updated_at: { [sequelize.Op.lt]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 días
      },
    });
  };

  /**
   * Actualiza el socket ID de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} socketId - ID del socket
   * @returns {Promise<UserSession|NULL>}
   */
  UserSession.updateSocketId = async function (sessionId, socketId) {
    const session = await this.findBySessionId(sessionId);
    if (session) {
      await session.update({ socket_id: socketId, updated_at: new Date() });
    }
    return session;
  };

  /**
   * Obtiene todos los usuarios online
   * @returns {Promise<number[]>} Array de IDs de usuarios
   */
  UserSession.getOnlineUserIds = async function () {
    const sessions = await this.findAll({
      where: { status: 'active' },
      attributes: ['user_id'],
      group: ['user_id'],
    });
    return sessions.map(s => s.user_id);
  };

  return UserSession;
};
