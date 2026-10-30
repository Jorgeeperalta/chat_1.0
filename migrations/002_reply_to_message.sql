-- ============================================
-- 002: Respuestas a mensajes
-- ============================================
-- Agrega messages.reply_to_message_id (mensaje al que responde).
--
-- La app aplica este cambio sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de ALTER:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

ALTER TABLE messages
    ADD COLUMN reply_to_message_id INT DEFAULT NULL AFTER audio_transcription_language_id,
    ADD INDEX idx_reply_to_message_id (reply_to_message_id);

-- Antes no se podía editar desde la app, pero guardar la traducción marcaba el mensaje
-- como editado. Esas marcas son falsas: se limpian una sola vez.
UPDATE messages SET is_edited = FALSE WHERE is_edited = TRUE;
