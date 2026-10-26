/**
 * @file Servicio de Almacenamiento
 * @description Servicio para manejar el almacenamiento de archivos (local o S3)
 * @author Arquitecto de Software Senior
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

class StorageService {
  constructor() {
    this.storageType = config.storage.type;
    this.localConfig = config.storage.local;
    this.s3Config = config.storage.s3;

    // Asegurar que el directorio de uploads existe
    if (this.storageType === 'local') {
      this.ensureUploadsDir();
    }
  }

  /**
   * Asegura que el directorio de uploads existe
   */
  async ensureUploadsDir() {
    try {
      await fs.access(this.localConfig.uploadsDir);
    } catch {
      await fs.mkdir(this.localConfig.uploadsDir, { recursive: true });
      logger.info(`📁 Directorio de uploads creado: ${this.localConfig.uploadsDir}`);
    }
  }

  /**
   * Genera un nombre de archivo único
   * @param {string} originalName - Nombre original del archivo
   * @returns {string}
   */
  generateFileName(originalName) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    
    // Limpiar el nombre del archivo
    const cleanBaseName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 50);

    return `${cleanBaseName}_${timestamp}_${random}${ext}`;
  }

  /**
   * Guarda un archivo
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} originalName - Nombre original del archivo
   * @param {string} mimeType - Tipo MIME
   * @param {string} [subDir] - Subdirectorio opcional
   * @returns {Promise<{url: string, fileName: string, size: number}>}
   */
  async saveFile(buffer, originalName, mimeType, subDir = '') {
    const fileName = this.generateFileName(originalName);
    const fileSize = buffer.length;

    if (this.storageType === 'local') {
      return this.saveFileLocal(buffer, fileName, subDir);
    } else if (this.storageType === 's3') {
      return this.saveFileS3(buffer, fileName, mimeType, subDir);
    } else {
      throw new Error(`Tipo de almacenamiento no soportado: ${this.storageType}`);
    }
  }

  /**
   * Guarda un archivo en almacenamiento local
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} fileName - Nombre del archivo
   * @param {string} [subDir] - Subdirectorio opcional
   * @returns {Promise<{url: string, fileName: string, size: number}>}
   */
  async saveFileLocal(buffer, fileName, subDir = '') {
    let fullPath = this.localConfig.uploadsDir;
    
    if (subDir) {
      fullPath = path.join(fullPath, subDir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    fullPath = path.join(fullPath, fileName);

    await fs.writeFile(fullPath, buffer);

    // URL relativa para desarrollo
    const url = `/uploads/${subDir ? `${subDir}/` : ''}${fileName}`;

    logger.info(`💾 Archivo guardado localmente: ${url}`);

    return {
      url,
      fileName,
      size: buffer.length,
      path: fullPath,
    };
  }

  /**
   * Guarda un archivo en AWS S3
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} fileName - Nombre del archivo
   * @param {string} mimeType - Tipo MIME
   * @param {string} [subDir] - Subdirectorio opcional
   * @returns {Promise<{url: string, fileName: string, size: number}>}
   */
  async saveFileS3(buffer, fileName, mimeType, subDir = '') {
    // Implementación para AWS S3
    // Requeriría el paquete @aws-sdk/client-s3
    
    throw new Error('Almacenamiento S3 no implementado');
  }

  /**
   * Elimina un archivo
   * @param {string} url - URL del archivo
   * @returns {Promise<boolean>}
   */
  async deleteFile(url) {
    if (this.storageType === 'local') {
      return this.deleteFileLocal(url);
    } else if (this.storageType === 's3') {
      return this.deleteFileS3(url);
    }
    return false;
  }

  /**
   * Elimina un archivo del almacenamiento local
   * @param {string} url - URL del archivo
   * @returns {Promise<boolean>}
   */
  async deleteFileLocal(url) {
    try {
      // Convertir URL a path local
      const filePath = path.join(this.localConfig.uploadsDir, url.replace('/uploads/', ''));
      
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      logger.info(`🗑️ Archivo eliminado: ${url}`);
      return true;
    } catch (error) {
      logger.error(`❌ Error al eliminar archivo ${url}:`, error.message);
      return false;
    }
  }

  /**
   * Elimina un archivo de AWS S3
   * @param {string} url - URL del archivo
   * @returns {Promise<boolean>}
   */
  async deleteFileS3(url) {
    // Implementación para AWS S3
    throw new Error('Eliminación de S3 no implementada');
  }

  /**
   * Valida el tipo MIME de un archivo
   * @param {string} mimeType - Tipo MIME
   * @param {string[]} allowedTypes - Tipos permitidos
   * @returns {boolean}
   */
  validateMimeType(mimeType, allowedTypes) {
    return allowedTypes.includes(mimeType);
  }

  /**
   * Valida el tamaño de un archivo
   * @param {number} size - Tamaño en bytes
   * @returns {boolean}
   */
  validateFileSize(size) {
    const maxSizeBytes = this.localConfig.maxFileSizeMB * 1024 * 1024;
    return size <= maxSizeBytes;
  }

  /**
   * Obtiene el tipo de archivo a partir del MIME type
   * @param {string} mimeType - Tipo MIME
   * @returns {string}
   */
  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
  }

  /**
   * Genera una URL de miniatura para archivos de imagen
   * @param {string} fileUrl - URL del archivo
   * @returns {string}
   */
  generateThumbnailUrl(fileUrl) {
    if (this.storageType === 'local') {
      const baseName = path.basename(fileUrl);
      const dir = path.dirname(fileUrl);
      return `${dir}/thumbnails/${baseName}`;
    }
    return fileUrl;
  }

  /**
   * Guarda un archivo de audio
   * @param {Buffer} buffer - Buffer del audio
   * @param {string} originalName - Nombre original
   * @param {string} mimeType - Tipo MIME
   * @returns {Promise<Object>}
   */
  async saveAudioFile(buffer, originalName, mimeType) {
    // Validar MIME type
    if (!this.validateMimeType(mimeType, this.localConfig.allowedAudioTypes)) {
      throw new Error(`Tipo MIME no permitido para audio: ${mimeType}`);
    }

    // Validar tamaño
    if (!this.validateFileSize(buffer.length)) {
      throw new Error(`Archivo de audio demasiado grande: ${buffer.length} bytes`);
    }

    return this.saveFile(buffer, originalName, mimeType, 'audio');
  }

  /**
   * Guarda un archivo de imagen
   * @param {Buffer} buffer - Buffer de la imagen
   * @param {string} originalName - Nombre original
   * @param {string} mimeType - Tipo MIME
   * @returns {Promise<Object>}
   */
  async saveImageFile(buffer, originalName, mimeType) {
    // Validar MIME type
    if (!this.validateMimeType(mimeType, this.localConfig.allowedImageTypes)) {
      throw new Error(`Tipo MIME no permitido para imagen: ${mimeType}`);
    }

    // Validar tamaño
    if (!this.validateFileSize(buffer.length)) {
      throw new Error(`Archivo de imagen demasiado grande: ${buffer.length} bytes`);
    }

    const result = await this.saveFile(buffer, originalName, mimeType, 'images');
    
    // Generar URL de miniatura
    result.thumbnailUrl = this.generateThumbnailUrl(result.url);
    
    return result;
  }

  /**
   * Obtiene la URL completa de un archivo
   * @param {string} url - URL relativa
   * @returns {string}
   */
  getFullUrl(url) {
    if (this.storageType === 's3' && this.s3Config.publicUrl) {
      return `${this.s3Config.publicUrl}/${url}`;
    }
    return url;
  }
}

// Exportar instancia singleton
const storageService = new StorageService();

module.exports = storageService;
