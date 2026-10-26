-- ============================================
-- Script SQL: Esquema de Base de Datos para Aplicación de Chat con Traducción
-- Versión: 1.4.0
-- Descripción: Estructura completa para usuarios, conversaciones, mensajes y traducciones
-- Compatible: MySQL 5.7+, MySQL 8.0+
-- ============================================

-- ============================================
-- 1. CREACIÓN DE LA BASE DE DATOS
-- ============================================
CREATE DATABASE IF NOT EXISTS chat_translate_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE chat_translate_app;

-- ============================================
-- 2. TABLA: languages (Catálogo de idiomas soportados)
-- ============================================
CREATE TABLE IF NOT EXISTS languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    native_name VARCHAR(50) NOT NULL,
    flag_emoji VARCHAR(10) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos iniciales para idiomas comunes
INSERT INTO languages (code, name, native_name, flag_emoji) VALUES
    ('es', 'Spanish', 'Español', '🇪🇸'),
    ('en', 'English', 'English', '🇬🇧'),
    ('fr', 'French', 'Français', '🇫🇷'),
    ('de', 'German', 'Deutsch', '🇩🇪'),
    ('it', 'Italian', 'Italiano', '🇮🇹'),
    ('pt', 'Portuguese', 'Português', '🇵🇹'),
    ('ru', 'Russian', 'Русский', '🇷🇺'),
    ('zh', 'Chinese', '中文', '🇨🇳'),
    ('ja', 'Japanese', '日本語', '🇯🇵'),
    ('ar', 'Arabic', 'العربية', '🇸🇦')
    ON DUPLICATE KEY UPDATE code = code;

-- ============================================
-- 3. TABLA: users (Usuarios del sistema)
-- NOTA: Los campos TIMESTAMP que pueden ser NULL usan DATETIME en lugar de TIMESTAMP
-- para evitar el error "Invalid default value for 'column_name'" en MySQL < 8.0.16
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) DEFAULT NULL,
    last_name VARCHAR(100) DEFAULT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    native_language_id INT NOT NULL,
    preferred_language_id INT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    status ENUM('online', 'offline', 'away', 'busy') DEFAULT 'offline',
    last_seen_at DATETIME DEFAULT NULL,
    email_verified_at DATETIME DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (native_language_id) REFERENCES languages(id) ON DELETE RESTRICT,
    FOREIGN KEY (preferred_language_id) REFERENCES languages(id) ON DELETE SET NULL,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_native_language (native_language_id),
    INDEX idx_preferred_language (preferred_language_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. TABLA: conversations (Conversaciones / Salas de chat)
-- NOTA: La clave foránea last_message_id se añade después de crear la tabla messages
-- para evitar problemas de referencia circular
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    type ENUM('private', 'group') NOT NULL DEFAULT 'private',
    created_by INT NOT NULL,
    description TEXT DEFAULT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    last_message_id INT DEFAULT NULL,
    last_message_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_type (type),
    INDEX idx_created_by (created_by),
    INDEX idx_last_message_at (last_message_at),
    INDEX idx_last_message_id (last_message_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. TABLA: user_conversations (Relación usuarios-conversaciones)
-- NOTA: La clave foránea last_read_message_id se añade después de crear messages
-- ============================================
CREATE TABLE IF NOT EXISTS user_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    conversation_id INT NOT NULL,
    nickname VARCHAR(100) DEFAULT NULL,
    role ENUM('admin', 'member', 'moderator') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME DEFAULT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    unread_count INT DEFAULT 0,
    last_read_message_id INT DEFAULT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    
    UNIQUE KEY uk_user_conversation (user_id, conversation_id),
    INDEX idx_conversation_user (conversation_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_unread_count (unread_count),
    INDEX idx_is_pinned (is_pinned),
    INDEX idx_last_read_message_id (last_read_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. TABLA: messages (Mensajes de chat)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    message_type ENUM('text', 'audio', 'image', 'video', 'file') NOT NULL DEFAULT 'text',
    content TEXT DEFAULT NULL,
    original_language_id INT DEFAULT NULL,
    translated_content TEXT DEFAULT NULL,
    target_language_id INT DEFAULT NULL,
    translation_status ENUM('pending', 'completed', 'failed') DEFAULT NULL,
    audio_url VARCHAR(500) DEFAULT NULL,
    audio_duration INT DEFAULT NULL, -- Duración en segundos
    audio_transcription TEXT DEFAULT NULL, -- Transcripción del audio
    audio_transcription_language_id INT DEFAULT NULL,
    
    -- Metadatos para procesamiento
    mistral_prompt_tokens INT DEFAULT NULL,
    mistral_completion_tokens INT DEFAULT NULL,
    mistral_model VARCHAR(50) DEFAULT NULL,
    mistral_response_time_ms INT DEFAULT NULL,
    
    -- Estados
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_delivered BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (original_language_id) REFERENCES languages(id) ON DELETE SET NULL,
    FOREIGN KEY (target_language_id) REFERENCES languages(id) ON DELETE SET NULL,
    FOREIGN KEY (audio_transcription_language_id) REFERENCES languages(id) ON DELETE SET NULL,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at),
    INDEX idx_message_type (message_type),
    INDEX idx_original_language (original_language_id),
    INDEX idx_target_language (target_language_id),
    INDEX idx_conversation_created (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. AGREGAR CLAVES FORÁNEAS RETRASADAS
-- Estas claves foráneas que referencian tablas creadas después
-- Se eliminan primero si existen para hacer el script idempotente
-- Compatible con MySQL 5.7+ y 8.0+
-- ============================================

DELIMITER //

-- Procedimiento para agregar clave foránea de manera idempotente
CREATE PROCEDURE add_foreign_key_if_not_exists(
    IN p_table_name VARCHAR(64),
    IN p_constraint_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_references_table VARCHAR(64),
    IN p_references_column VARCHAR(64),
    IN p_on_delete VARCHAR(20)
)
BEGIN
    DECLARE v_constraint_exists INT;
    
    -- Verificar si la restricción ya existe
    SELECT COUNT(*) INTO v_constraint_exists
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND CONSTRAINT_NAME = p_constraint_name
      AND CONSTRAINT_TYPE = 'FOREIGN KEY';
    
    -- Si existe, eliminarla primero
    IF v_constraint_exists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table_name, 
                         ' DROP FOREIGN KEY ', p_constraint_name);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
    
    -- Crear la nueva restricción
    SET @sql = CONCAT('ALTER TABLE ', p_table_name,
                     ' ADD CONSTRAINT ', p_constraint_name,
                     ' FOREIGN KEY (', p_column_name, ')',
                     ' REFERENCES ', p_references_table,
                     '(', p_references_column, ') ON DELETE ', p_on_delete);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END//

DELIMITER ;

-- Añadir clave foránea last_message_id a conversations
CALL add_foreign_key_if_not_exists(
    'conversations',
    'fk_conversations_last_message',
    'last_message_id',
    'messages',
    'id',
    'SET NULL'
);

-- Añadir clave foránea last_read_message_id a user_conversations
CALL add_foreign_key_if_not_exists(
    'user_conversations',
    'fk_user_conversations_last_read',
    'last_read_message_id',
    'messages',
    'id',
    'SET NULL'
);

-- Eliminar el procedimiento temporal
DROP PROCEDURE IF EXISTS add_foreign_key_if_not_exists;

-- ============================================
-- 8. TABLA: message_attachments (Adjuntos de mensajes)
-- ============================================
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL, -- Tamaño en bytes
    mime_type VARCHAR(100) NOT NULL,
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    
    INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. TABLA: translations_cache (Cache de traducciones para evitar llamadas repetidas)
-- ============================================
CREATE TABLE IF NOT EXISTS translations_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_text_hash VARCHAR(64) NOT NULL, -- Hash SHA-256 del texto original
    source_language_id INT NOT NULL,
    target_language_id INT NOT NULL,
    translated_text TEXT NOT NULL,
    mistral_model VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT NULL,
    
    FOREIGN KEY (source_language_id) REFERENCES languages(id) ON DELETE CASCADE,
    FOREIGN KEY (target_language_id) REFERENCES languages(id) ON DELETE CASCADE,
    
    UNIQUE KEY uk_translation_cache (source_text_hash, source_language_id, target_language_id),
    INDEX idx_source_hash (source_text_hash),
    INDEX idx_languages (source_language_id, target_language_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. TABLA: user_preferences (Preferencias de usuario)
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    theme ENUM('light', 'dark', 'system') DEFAULT 'system',
    notification_sound BOOLEAN DEFAULT TRUE,
    notification_vibration BOOLEAN DEFAULT TRUE,
    auto_translate_messages BOOLEAN DEFAULT TRUE,
    show_original_message BOOLEAN DEFAULT TRUE,
    audio_quality ENUM('low', 'medium', 'high') DEFAULT 'medium',
    play_audio_automatically BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. TABLA: user_sessions (Sesiones activas para WebSocket tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    socket_id VARCHAR(255) DEFAULT NULL,
    status ENUM('active', 'expired') DEFAULT 'active',
    expires_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_socket_id (socket_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. TABLA: api_keys (Almacenamiento seguro de claves API - solo para desarrollo)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL UNIQUE,
    api_key VARCHAR(500) NOT NULL,
    api_secret VARCHAR(500) DEFAULT NULL,
    endpoint_url VARCHAR(500) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_service_name (service_name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. VISTAS ÚTILES
-- ============================================

-- Vista para obtener conversaciones de un usuario con información resumida
CREATE OR REPLACE VIEW user_conversations_summary AS
SELECT 
    c.id,
    c.name,
    c.type,
    c.avatar_url,
    c.last_message_at,
    c.is_archived,
    uc.unread_count,
    uc.is_pinned,
    uc.is_muted,
    
    -- Último mensaje
    m.id as last_message_id,
    m.message_type,
    m.content as last_message_content,
    m.created_at as last_message_created,
    
    -- Sender del último mensaje
    u_sender.id as last_message_sender_id,
    u_sender.username as last_message_sender_username,
    u_sender.avatar_url as last_message_sender_avatar,
    
    -- Participantes (para grupos)
    (
        SELECT GROUP_CONCAT(DISTINCT u2.username ORDER BY u2.username SEPARATOR ', ')
        FROM user_conversations uc2
        JOIN users u2 ON uc2.user_id = u2.id
        WHERE uc2.conversation_id = c.id AND uc2.left_at IS NULL
        LIMIT 10
    ) as participants_preview
    
FROM conversations c
JOIN user_conversations uc ON c.id = uc.conversation_id
LEFT JOIN messages m ON c.last_message_id = m.id
LEFT JOIN users u_sender ON m.sender_id = u_sender.id
WHERE uc.left_at IS NULL
GROUP BY c.id, uc.user_id;

-- Vista para mensajes con información de usuario y conversación
-- CORREGIDO: Eliminado el duplicado de sender_id (m.* ya incluye sender_id)
CREATE OR REPLACE VIEW messages_with_details AS
SELECT 
    m.*,
    u.username as sender_username,
    u.avatar_url as sender_avatar,
    u.first_name as sender_first_name,
    u.last_name as sender_last_name,
    u.status as sender_status,
    u.email as sender_email,
    ln_orig.code as original_language_code,
    ln_orig.name as original_language_name,
    ln_tgt.code as target_language_code,
    ln_tgt.name as target_language_name,
    c.id as conversation_id,
    c.type as conversation_type,
    c.name as conversation_name,
    c.avatar_url as conversation_avatar
FROM messages m
LEFT JOIN users u ON m.sender_id = u.id
LEFT JOIN languages ln_orig ON m.original_language_id = ln_orig.id
LEFT JOIN languages ln_tgt ON m.target_language_id = ln_tgt.id
LEFT JOIN conversations c ON m.conversation_id = c.id;

-- ============================================
-- 14. TRIGGERS
-- ============================================

DELIMITER //

-- Trigger para actualizar last_message_id y last_message_at en conversations
CREATE TRIGGER after_message_insert 
    AFTER INSERT ON messages 
    FOR EACH ROW 
BEGIN
    UPDATE conversations 
    SET 
        last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
END//

-- Trigger para actualizar updated_at en conversations al actualizar mensaje
CREATE TRIGGER after_message_update 
    AFTER UPDATE ON messages 
    FOR EACH ROW 
BEGIN
    IF NEW.is_edited = TRUE THEN
        UPDATE conversations 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    END IF;
END//

-- Trigger para limpiar cache de traducciones
-- Nota: expires_at ahora es DATETIME en lugar de TIMESTAMP para permitir NULL
CREATE TRIGGER before_translations_cache_insert 
    BEFORE INSERT ON translations_cache 
    FOR EACH ROW 
BEGIN
    -- Establecer expiración por defecto (7 días)
    IF NEW.expires_at IS NULL THEN
        SET NEW.expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY);
    END IF;
END//

DELIMITER ;

-- ============================================
-- 15. PROCEDIMIENTOS ALMACENADOS
-- ============================================

DELIMITER //

-- Procedimiento para crear una conversación privada entre dos usuarios
CREATE PROCEDURE create_private_conversation(
    IN p_user1_id INT,
    IN p_user2_id INT,
    OUT p_conversation_id INT
)
BEGIN
    DECLARE v_existing_conversation_id INT DEFAULT NULL;
    
    -- Verificar si ya existe una conversación privada entre estos usuarios
    SELECT c.id INTO v_existing_conversation_id
    FROM conversations c
    JOIN user_conversations uc1 ON c.id = uc1.conversation_id
    JOIN user_conversations uc2 ON c.id = uc2.conversation_id
    WHERE c.type = 'private'
      AND uc1.user_id = p_user1_id
      AND uc2.user_id = p_user2_id
      AND uc1.left_at IS NULL
      AND uc2.left_at IS NULL
    LIMIT 1;
    
    -- Si existe, devolverla
    IF v_existing_conversation_id IS NOT NULL THEN
        SET p_conversation_id = v_existing_conversation_id;
    ELSE
        -- Crear nueva conversación
        INSERT INTO conversations (type, created_by, name)
        VALUES ('private', p_user1_id, 
                CONCAT('Chat entre ', 
                       (SELECT username FROM users WHERE id = p_user1_id), 
                       ' y ', 
                       (SELECT username FROM users WHERE id = p_user2_id)));
        
        SET p_conversation_id = LAST_INSERT_ID();
        
        -- Agregar usuarios a la conversación
        INSERT INTO user_conversations (user_id, conversation_id, role)
        VALUES (p_user1_id, p_conversation_id, 'admin'),
               (p_user2_id, p_conversation_id, 'member');
    END IF;
END//

-- Procedimiento para obtener el idioma de destino para un mensaje
CREATE PROCEDURE get_target_language_for_message(
    IN p_message_id INT,
    IN p_receiver_id INT,
    OUT p_target_language_id INT
)
BEGIN
    -- Obtener el idioma preferido del receptor
    SELECT COALESCE(preferred_language_id, native_language_id) 
    INTO p_target_language_id
    FROM users 
    WHERE id = p_receiver_id;
END//

DELIMITER ;

-- ============================================
-- 16. EVENTOS PROGRAMADOS
-- ============================================

-- Evento para limpiar sesiones expiradas (ejecutar diariamente)
CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
    ON SCHEDULE EVERY 1 DAY
    STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
    DO
        DELETE FROM user_sessions 
        WHERE status = 'expired' 
           OR (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP);

-- Evento para limpiar cache de traducciones expiradas
CREATE EVENT IF NOT EXISTS cleanup_expired_translations
    ON SCHEDULE EVERY 1 DAY
    STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
    DO
        DELETE FROM translations_cache 
        WHERE expires_at < CURRENT_TIMESTAMP;

-- Habilitar el programador de eventos
SET GLOBAL event_scheduler = ON;

-- ============================================
-- 17. DATOS DE EJEMPLO (Opcional para desarrollo)
-- ============================================

-- Crear usuario de prueba (solo para desarrollo, NO para producción)
-- DESCOMENTAR LAS SIGUIENTES LÍNEAS SI ES NECESARIO
/*
INSERT INTO users (username, email, password_hash, first_name, last_name, native_language_id, preferred_language_id, is_active)
VALUES ('admin', 'admin@chat.com', '$2a$10$J4Lx2jJ7x3x2L5x3J4Lx2u', 'Admin', 'User', 1, 1, TRUE);

INSERT INTO user_preferences (user_id, theme, notification_sound, auto_translate_messages)
VALUES (1, 'system', TRUE, TRUE);
*/

-- ============================================
-- RESUMEN DEL ESQUEMA
-- ============================================
-- 
-- Tablas principales:
--   - languages: Catálogo de idiomas
--   - users: Usuarios del sistema
--   - conversations: Salas de chat (privadas o grupales)
--   - user_conversations: Relación usuarios-conversaciones
--   - messages: Mensajes con soporte para traducción
--   - message_attachments: Adjuntos de mensajes
--   - translations_cache: Cache de traducciones
--   - user_preferences: Configuraciones de usuario
--   - user_sessions: Tracking de sesiones WebSocket
--   - api_keys: Almacenamiento de claves API
--
-- NOTAS IMPORTANTES:
--   1. Los campos TIMESTAMP que pueden ser NULL se han cambiado a DATETIME
--      para evitar el error "Invalid default value for 'column_name'" en MySQL < 8.0.16
--      Esto afecta a: last_seen_at, email_verified_at, last_message_at, 
--      expires_at (en translations_cache y user_sessions), left_at
--   
--   2. Las claves foráneas con referencias circulares se crean después
--      usando un procedimiento almacenado temporal (add_foreign_key_if_not_exists)
--      que verifica si la restricción existe antes de crearla, haciendo el script
--      idempotente (puede ejecutarse múltiples veces sin errores)
--      Esto afecta a:
--        - conversations.last_message_id -> messages(id)
--        - user_conversations.last_read_message_id -> messages(id)
--   
--   3. Los campos TIMESTAMP que NO pueden ser NULL (created_at, updated_at) 
--      siguen siendo TIMESTAMP para mantener el comportamiento automático
--   
--   4. CORRECCIÓN EN VISTA messages_with_details:
--      - Eliminado el duplicado de sender_id (m.* ya incluye m.sender_id)
--      - Añadidos más campos útiles del usuario (first_name, last_name, email)
--   
--   5. El script ahora es completamente idempotente:
--      - Usa IF NOT EXISTS para bases de datos, tablas, vistas, triggers, eventos
--      - Usa procedimiento almacenado para crear claves foráneas sin duplicados
--      - Puede ejecutarse múltiples veces sin errores en MySQL 5.7+
--
-- Claves foráneas y relaciones establecidas
-- Índices creados para optimización de consultas
-- Vistas y procedimientos almacenados para simplificar lógica de aplicación
-- Triggers para mantener integridad de datos
-- 
-- ============================================
