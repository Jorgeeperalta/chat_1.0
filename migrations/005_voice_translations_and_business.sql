-- ============================================
-- 005: Notas de voz traducidas con voz sintetizada + cuentas empresariales (OCR)
-- ============================================
-- users.voice_gender: voz con la que se leen las notas de voz del usuario al traducirlas.
-- users.account_type: 'business' habilita el OCR de documentos.
-- message_voice_translations: texto y audio traducidos de cada nota de voz, por idioma.
--
-- La app aplica este cambio sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de ALTER:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

ALTER TABLE users
    ADD COLUMN voice_gender ENUM('female', 'male') DEFAULT NULL,
    ADD COLUMN account_type ENUM('personal', 'business') NOT NULL DEFAULT 'personal';

CREATE TABLE IF NOT EXISTS message_voice_translations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    language_id INT NOT NULL,
    translated_text TEXT DEFAULT NULL,
    audio_url VARCHAR(500) DEFAULT NULL,
    voice_id VARCHAR(100) DEFAULT NULL,
    status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_voice_translation_message_language (message_id, language_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para habilitar el OCR a una cuenta:
-- UPDATE users SET account_type = 'business' WHERE username = 'nombre_de_usuario';
