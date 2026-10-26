/**
 * @file Modelo Conversation
 * @description Representa una conversación o sala de chat
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} ConversationAttributes
 * @property {number} id - ID único
 * @property {string} name - Nombre de la conversación (opcional para grupos)
 * @property {string} type - Tipo: 'private' o 'group'
 * @property {number} created_by - ID del usuario creador
 * @property {string} description - Descripción
 * @property {string} avatar_url - URL del avatar
 * @property {boolean} is_archived - Si está archivada
 * @property {number} last_message_id - ID del último mensaje
 * @property {Date} last_message_at - Fecha del último mensaje
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo Conversation
 */
module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define(
    'Conversation',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        validate: {
          len: [0, 255],
        },
      },
      type: {
        type: DataTypes.ENUM('private', 'group'),
        allowNull: false,
        defaultValue: 'private',
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'created_by',
        validate: {
          notNull: true,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'avatar_url',
      },
      is_archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_archived',
      },
      last_message_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: 'last_message_id',
      },
      last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'last_message_at',
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
      tableName: 'conversations',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          fields: ['type'],
        },
        {
          fields: ['created_by'],
        },
        {
          fields: ['last_message_at'],
        },
        {
          fields: ['created_at'],
        },
      ],
    }
  );

  /**
   * Crea una conversación privada entre dos usuarios
   * @param {number} userId1 - ID del primer usuario
   * @param {number} userId2 - ID del segundo usuario
   * @returns {Promise<Conversation>}
   */
  Conversation.createPrivate = async function (userId1, userId2) {
    const { models } = require('./index');
    
    // Verificar si ya existe una conversación privada
    const memberships = await models.UserConversation.findAll({
      attributes: ['conversation_id', 'user_id'],
      where: {
        user_id: [userId1, userId2],
        left_at: null,
      },
      include: [
        {
          model: models.Conversation,
          as: 'conversation',
          attributes: [],
          where: { type: 'private' },
        },
      ],
    });
    const membershipsByConversation = new Map();

    for (const membership of memberships) {
      const participantIds = membershipsByConversation.get(membership.conversation_id) || new Set();
      participantIds.add(membership.user_id);
      membershipsByConversation.set(membership.conversation_id, participantIds);
    }

    const existingConversationId = [...membershipsByConversation].find(([, participantIds]) =>
      participantIds.has(userId1) && participantIds.has(userId2)
    )?.[0];

    if (existingConversationId) {
      return this.findByPk(existingConversationId);
    }

    // Crear nueva conversación
    const conversation = await this.create({
      type: 'private',
      created_by: userId1,
    });

    // Agregar usuarios
    await models.UserConversation.bulkCreate([
      { user_id: userId1, conversation_id: conversation.id, role: 'admin' },
      { user_id: userId2, conversation_id: conversation.id, role: 'member' },
    ]);

    return conversation;
  };

  /**
   * Obtiene las conversaciones de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<{conversations: Conversation[], total: number}>}
   */
  Conversation.findUserConversations = async function (userId, options = {}) {
    const { models } = require('./index');
    const { limit = 20, offset = 0, type, search, archived = false } = options;

    const where = { is_archived: archived || false };
    if (type) where.type = type;
    if (search) {
      where[sequelize.Op.or] = [
        { name: { [sequelize.Op.iLike]: `%${search}%` } },
        { description: { [sequelize.Op.iLike]: `%${search}%` } },
      ];
    }

    const include = [
      // Solo las conversaciones de las que el usuario es miembro
      {
        model: models.UserConversation,
        as: 'participants',
        where: { user_id: userId },
        attributes: ['user_id'],
        required: true,
      },
      // Todos los participantes (la lista muestra al otro usuario y si está en línea).
      // Campos explícitos: nunca enviar password_hash ni datos internos.
      {
        model: models.User,
        as: 'users',
        attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url', 'status', 'last_seen_at'],
        through: { attributes: ['role', 'is_muted', 'is_pinned', 'unread_count', 'last_read_message_id'] },
      },
      {
        model: models.User,
        as: 'creator',
        attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url'],
      },
      {
        model: models.Message,
        as: 'lastMessage',
        attributes: ['id', 'message_type', 'content', 'created_at', 'sender_id'],
        include: [
          {
            model: models.User,
            as: 'sender',
            attributes: ['id', 'username', 'avatar_url'],
          },
        ],
      },
    ];

    const { count, rows } = await this.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['last_message_at', 'DESC']],
      distinct: true,
    });

    return { conversations: rows, total: count };
  };

  /**
   * Obtiene una conversación por ID con sus participantes
   * @param {number} id - ID de la conversación
   * @returns {Promise<Conversation|NULL>}
   */
  Conversation.findByIdWithParticipants = async function (id) {
    const { models } = require('./index');

    return this.findOne({
      where: { id },
      include: [
        {
          model: models.User,
          as: 'users',
          through: { attributes: ['role', 'nickname', 'is_muted', 'joined_at'] },
          attributes: ['id', 'username', 'first_name', 'last_name', 'avatar_url', 'status', 'last_seen_at'],
        },
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'username'],
        },
      ],
    });
  };

  /**
   * Archiva/desarchiva una conversación para un usuario
   * @param {number} conversationId - ID de la conversación
   * @param {number} userId - ID del usuario
   * @param {boolean} isArchived - Estado de archivo
   * @returns {Promise<Conversation>}
   */
  Conversation.toggleArchive = async function (conversationId, userId, isArchived) {
    const { models } = require('./index');

    await models.UserConversation.update(
      { is_archived: isArchived },
      { where: { conversation_id: conversationId, user_id: userId } }
    );

    return this.findByPk(conversationId);
  };

  return Conversation;
};
