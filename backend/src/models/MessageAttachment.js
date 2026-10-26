/**
 * @file Modelo MessageAttachment
 * @description Representa un archivo adjunto a un mensaje
 * @author Arquitecto de Software Senior
 */

const { DataTypes } = require('sequelize');

/**
 * @typedef {Object} MessageAttachmentAttributes
 * @property {number} id - ID único
 * @property {number} message_id - ID del mensaje
 * @property {string} file_name - Nombre del archivo
 * @property {string} file_url - URL del archivo
 * @property {string} file_type - Tipo del archivo
 * @property {number} file_size - Tamaño en bytes
 * @property {string} mime_type - Tipo MIME
 * @property {string} thumbnail_url - URL de la miniatura (opcional)
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 * @returns {import('sequelize').Model} Modelo MessageAttachment
 */
module.exports = (sequelize, DataTypes) => {
  const MessageAttachment = sequelize.define(
    'MessageAttachment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      message_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'message_id',
        validate: {
          notNull: true,
        },
      },
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'file_name',
        validate: {
          notEmpty: true,
        },
      },
      file_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'file_url',
        validate: {
          notEmpty: true,
          isUrl: true,
        },
      },
      file_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'file_type',
        validate: {
          notEmpty: true,
        },
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'file_size',
        validate: {
          min: 0,
        },
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'mime_type',
        validate: {
          notEmpty: true,
        },
      },
      thumbnail_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
        field: 'thumbnail_url',
      },
    },
    {
      tableName: 'message_attachments',
      timestamps: false,
      underscored: true,
      freezeTableName: true,
      
      indexes: [
        {
          fields: ['message_id'],
        },
      ],
    }
  );

  /**
   * Crea adjuntos para un mensaje
   * @param {number} messageId - ID del mensaje
   * @param {Array} attachments - Array de adjuntos
   * @returns {Promise<MessageAttachment[]>}
   */
  MessageAttachment.createForMessage = async function (messageId, attachments) {
    return this.bulkCreate(
      attachments.map(attach => ({
        message_id: messageId,
        file_name: attach.fileName,
        file_url: attach.fileUrl,
        file_type: attach.fileType,
        file_size: attach.fileSize,
        mime_type: attach.mimeType,
        thumbnail_url: attach.thumbnailUrl || null,
      }))
    );
  };

  /**
   * Obtiene adjuntos de un mensaje
   * @param {number} messageId - ID del mensaje
   * @returns {Promise<MessageAttachment[]>}
   */
  MessageAttachment.findByMessageId = async function (messageId) {
    return this.findAll({ where: { message_id: messageId } });
  };

  /**
   * Elimina adjuntos de un mensaje
   * @param {number} messageId - ID del mensaje
   * @returns {Promise<number>} Cantidad de adjuntos eliminados
   */
  MessageAttachment.deleteByMessageId = async function (messageId) {
    return this.destroy({ where: { message_id: messageId } });
  };

  return MessageAttachment;
};
