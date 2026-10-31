-- ============================================
-- 003: Notificaciones push
-- ============================================
-- Una fila por cada teléfono/navegador donde el usuario activó las notificaciones.
--
-- La app crea esta tabla sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de CREATE:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX push_subscriptions_user_id (user_id),
    INDEX idx_push_endpoint (endpoint(191))
);
