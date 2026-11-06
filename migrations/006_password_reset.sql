-- ============================================
-- 006: Recuperar contraseña
-- ============================================
-- password_reset_tokens: enlaces enviados por correo (solo se guarda el hash SHA-256 del token).
-- users.password_changed_at: las sesiones iniciadas antes de un cambio de contraseña dejan de valer.
--
-- La app aplica este cambio sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de ALTER:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

ALTER TABLE users
    ADD COLUMN password_changed_at DATETIME DEFAULT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    request_ip VARCHAR(45) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_password_reset_token_hash (token_hash),
    KEY idx_password_reset_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
