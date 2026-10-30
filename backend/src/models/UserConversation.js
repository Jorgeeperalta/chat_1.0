/**
 * @file Modelo UserConversation
 * @description Relación muchos-a-muchos entre usuarios y conversaciones
 * @author Arquitecto de Software Senior
 */

const { DataTypes, Op } = require('sequelize');

/**
 * @typedef {Object} UserConversationAttributes
 * @property {number} id - ID único
 * @property {number} user_id - ID del usuario
 * @property {number} conversation_id - ID de la conversación
 * @property {string} nickname - Apodo en la conversación (opcional)
 * @property {string} role - Rol: 'admin', 'member', 'moderator'
 * @property {Date} joined_at - Fecha de unión
 * @property {Date} left_at - Fecha de salida (null si sigue en la conversación)
 * @property {boolean} is_muted - Si está silenciado
 * @property {boolean} is_pinned - Si está fijado
 * @property {number} unread_count - Cantidad de mensajes no leídos
 * @property {number} last_read_message_id - ID del último mensaje leído
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo UserConversation
 */
module.exports = (sequelize, DataTypes) => {
  const UserConversation = sequelize.define(
    'UserConversation',
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
      conversation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'conversation_id',
        validate: {
          notNull: true,
        },
      },
      nickname: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: DataTypes.ENUM('admin', 'member', 'moderator'),
        allowNull: false,
        defaultValue: 'member',
      },
      joined_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'joined_at',
      },
      left_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'left_at',
      },
      is_muted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_muted',
      },
      is_pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_pinned',
      },
      unread_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'unread_count',
        validate: {
          min: 0,
        },
      },
      last_read_message_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'last_read_message_id',
      },
    },
    {
      tableName: 'user_conversations',
      timestamps: false,
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'conversation_id'],
          name: 'uk_user_conversation',
        },
        {
          fields: ['conversation_id', 'user_id'],
        },
        {
          fields: ['user_id'],
        },
        {
          fields: ['unread_count'],
        },
        {
          fields: ['is_pinned'],
        },
      ],
    }
  );

  /**
   * Verifica si un usuario es miembro de una conversación
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<boolean>}
   */
  UserConversation.isMember = async function (userId, conversationId) {
    const result = await this.findOne({
      where: { user_id: userId, conversation_id: conversationId, left_at: null },
    });
    return !!result;
  };

  /**
   * Obtiene la relación usuario-conversación
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<UserConversation|NULL>}
   */
  UserConversation.findUserConversation = async function (userId, conversationId) {
    return this.findOne({
      where: { user_id: userId, conversation_id: conversationId },
    });
  };

  /**
   * Obtiene el contador de mensajes no leídos para un usuario
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<number>}
   */
  UserConversation.getUnreadCount = async function (userId, conversationId) {
    const uc = await this.findOne({
      where: { user_id: userId, conversation_id: conversationId },
    });
    return uc ? uc.unread_count : 0;
  };

  /**
   * Incrementa el contador de mensajes no leídos
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<void>}
   */
  UserConversation.incrementUnreadCount = async function (userId, conversationId) {
    await this.increment('unread_count', {
      where: { user_id: userId, conversation_id: conversationId },
    });
  };

  /**
   * Resetea el contador de mensajes no leídos
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @returns {Promise<void>}
   */
  UserConversation.resetUnreadCount = async function (userId, conversationId) {
    await this.update(
      { unread_count: 0 },
      { where: { user_id: userId, conversation_id: conversationId } }
    );
  };

  /**
   * Actualiza el último mensaje leído
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @param {number} messageId - ID del último mensaje leído
   * @returns {Promise<void>}
   */
  UserConversation.updateLastReadMessage = async function (userId, conversationId, messageId) {
    await this.update(
      { last_read_message_id: messageId, unread_count: 0 },
      { where: { user_id: userId, conversation_id: conversationId } }
    );
  };

  /**
   * Silencia/activa un usuario en una conversación
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @param {boolean} isMuted - Estado de silencio
   * @returns {Promise<void>}
   */
  UserConversation.toggleMute = async function (userId, conversationId, isMuted) {
    await this.update(
      { is_muted: isMuted },
      { where: { user_id: userId, conversation_id: conversationId } }
    );
  };

  /**
   * Fija/desfija una conversación para un usuario
   * @param {number} userId - ID del usuario
   * @param {number} conversationId - ID de la conversación
   * @param {boolean} isPinned - Estado de fijado
   * @returns {Promise<void>}
   */
  UserConversation.togglePin = async function (userId, conversationId, isPinned) {
    await this.update(
      { is_pinned: isPinned },
      { where: { user_id: userId, conversation_id: conversationId } }
    );
  };

  /**
   * Contactos de un usuario: quienes comparten alguna conversación con él.
   * Es su "agenda": se agrega alguien al iniciar un chat con él.
   * @param {number} userId - ID del usuario
   * @returns {Promise<number[]>} IDs de los contactos (sin repetir, sin el propio usuario)
   */
  UserConversation.findContactIds = async function (userId) {
    // Solo membresías vigentes (quien salió del chat no cuenta)
    const memberships = await this.findAll({
      where: { user_id: userId, left_at: null },
      attributes: ['conversation_id'],
    });
    if (memberships.length === 0) return [];

    const contacts = await this.findAll({
      where: {
        conversation_id: { [Op.in]: memberships.map(m => m.conversation_id) },
        user_id: { [Op.ne]: userId },
        left_at: null,
      },
      attributes: ['user_id'],
    });
    return [...new Set(contacts.map(c => c.user_id))];
  };

  return UserConversation;
};
