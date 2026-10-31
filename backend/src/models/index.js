/**
 * @file Índice de Modelos de Sequelize
 * @description Centraliza todos los modelos y sus relaciones
 * @author Arquitecto de Software Senior
 */

const path = require('path');
const fs = require('fs');
const Sequelize = require('sequelize');
const config = require('../config');

// Crear instancia de Sequelize
const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    pool: config.database.pool,
    logging: config.database.logging ? console.log : false,
    timezone: config.database.timezone,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: false,
      freezeTableName: true,
    },
  }
);

// Objeto para almacenar modelos
const models = {};

// Cargar modelos automáticamente desde el directorio
const modelsDir = path.join(__dirname);
const files = fs.readdirSync(modelsDir).filter(
  file => 
    file !== 'index.js' && 
    file.endsWith('.js') && 
    !file.startsWith('.')
);

// Cargar cada modelo
files.forEach(file => {
  const model = require(path.join(modelsDir, file))(sequelize, Sequelize.DataTypes);
  models[model.name] = model;
});

// ============================================
// DEFINIR RELACIONES ENTRE MODELOS
// ============================================

// Relaciones de Language
if (models.Language) {
  models.Language.hasMany(models.User, { foreignKey: 'native_language_id', as: 'nativeUsers' });
  models.Language.hasMany(models.User, { foreignKey: 'preferred_language_id', as: 'preferredUsers' });
  models.Language.hasMany(models.Message, { foreignKey: 'original_language_id', as: 'originalMessages' });
  models.Language.hasMany(models.Message, { foreignKey: 'target_language_id', as: 'targetMessages' });
  models.Language.hasMany(models.Message, { foreignKey: 'audio_transcription_language_id', as: 'transcriptionMessages' });
  models.Language.hasMany(models.TranslationCache, { foreignKey: 'source_language_id', as: 'sourceTranslations' });
  models.Language.hasMany(models.TranslationCache, { foreignKey: 'target_language_id', as: 'targetTranslations' });
}

// Relaciones de User
if (models.User) {
  models.User.belongsTo(models.Language, { foreignKey: 'native_language_id', as: 'nativeLanguage' });
  models.User.belongsTo(models.Language, { foreignKey: 'preferred_language_id', as: 'preferredLanguage' });
  models.User.hasMany(models.Conversation, { foreignKey: 'created_by', as: 'createdConversations' });
  models.User.hasMany(models.UserConversation, { foreignKey: 'user_id', as: 'userConversations' });
  models.User.hasMany(models.Message, { foreignKey: 'sender_id', as: 'sentMessages' });
  models.User.hasMany(models.UserSession, { foreignKey: 'user_id', as: 'sessions' });
  models.User.hasOne(models.UserPreference, { foreignKey: 'user_id', as: 'preferences' });
  
  // Relación N:M entre User y Conversation a través de UserConversation
  models.User.belongsToMany(models.Conversation, {
    through: models.UserConversation,
    foreignKey: 'user_id',
    otherKey: 'conversation_id',
    as: 'conversations'
  });
}

// Relaciones de Conversation
if (models.Conversation) {
  models.Conversation.hasMany(models.UserConversation, { foreignKey: 'conversation_id', as: 'participants' });
  models.Conversation.hasMany(models.Message, { foreignKey: 'conversation_id', as: 'messages' });
  models.Conversation.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  models.Conversation.belongsTo(models.Message, { foreignKey: 'last_message_id', as: 'lastMessage' });
  
  // Relación N:M entre Conversation y User a través de UserConversation
  models.Conversation.belongsToMany(models.User, {
    through: models.UserConversation,
    foreignKey: 'conversation_id',
    otherKey: 'user_id',
    as: 'users'
  });
}

// Relaciones de UserConversation
if (models.UserConversation) {
  models.UserConversation.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.UserConversation.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
  models.UserConversation.belongsTo(models.Message, { foreignKey: 'last_read_message_id', as: 'lastReadMessage' });
}

// Relaciones de Message
if (models.Message) {
  models.Message.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
  models.Message.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
  models.Message.belongsTo(models.Language, { foreignKey: 'original_language_id', as: 'originalLanguage' });
  models.Message.belongsTo(models.Language, { foreignKey: 'target_language_id', as: 'targetLanguage' });
  models.Message.belongsTo(models.Language, { foreignKey: 'audio_transcription_language_id', as: 'transcriptionLanguage' });
  models.Message.hasMany(models.MessageAttachment, { foreignKey: 'message_id', as: 'attachments' });
  models.Message.belongsTo(models.Message, { foreignKey: 'reply_to_message_id', as: 'replyTo', constraints: false });
}

// Relaciones de MessageAttachment
if (models.MessageAttachment) {
  models.MessageAttachment.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
}

// Relaciones de TranslationCache
if (models.TranslationCache) {
  models.TranslationCache.belongsTo(models.Language, { foreignKey: 'source_language_id', as: 'sourceLanguage' });
  models.TranslationCache.belongsTo(models.Language, { foreignKey: 'target_language_id', as: 'targetLanguage' });
}

// Relaciones de UserPreference
if (models.UserPreference) {
  models.UserPreference.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
}

// Relaciones de UserSession
if (models.UserSession) {
  models.UserSession.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
}

// Relaciones de PushSubscription
if (models.PushSubscription) {
  models.PushSubscription.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
}

// Relaciones de ApiKey
if (models.ApiKey) {
  // No tiene relaciones con otros modelos
}

// Sincronizar modelos con la base de datos
const sync = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✅ Modelos sincronizados con la base de datos');
    return sequelize;
  } catch (error) {
    console.error('❌ Error al sincronizar modelos:', error);
    throw error;
  }
};

/**
 * Aplica los cambios de esquema que el código necesita y que una base existente puede no tener
 * (equivale a migrations/002_reply_to_message.sql y 003_push_subscriptions.sql). Es idempotente: si ya están, no hace nada.
 * Así basta con subir el código al hosting, sin correr SQL a mano.
 */
const ensureSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const messageColumns = await queryInterface.describeTable('messages');

  if (!messageColumns.reply_to_message_id) {
    await queryInterface.addColumn('messages', 'reply_to_message_id', {
      type: Sequelize.DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      after: 'audio_transcription_language_id',
    });
    await queryInterface.addIndex('messages', ['reply_to_message_id'], {
      name: 'idx_reply_to_message_id',
    });

    // Antes no se podía editar desde la app, pero guardar la traducción marcaba el
    // mensaje como editado: esas marcas son falsas. Se limpian una sola vez, junto con
    // esta migración (si la columna ya existía, no se vuelve a ejecutar).
    await sequelize.query('UPDATE messages SET is_edited = FALSE WHERE is_edited = TRUE');
    console.log('✅ Columna messages.reply_to_message_id creada');
  }

  // Notificaciones push: sync() solo crea la tabla si no existe (no modifica una existente)
  await models.PushSubscription.sync();
};

// Verificar conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión a la base de datos:', error);
    return false;
  }
};

// Cerrar conexión
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('✅ Conexión a la base de datos cerrada');
  } catch (error) {
    console.error('❌ Error al cerrar conexión:', error);
  }
};

module.exports = {
  sequelize,
  models,
  sync,
  ensureSchema,
  testConnection,
  closeConnection,
  ...models,
};
