-- ============================================
-- 004: Estados de los mensajes (enviado / entregado / visto)
-- ============================================
-- Cada integrante guarda hasta qué mensaje le llegó (last_delivered_message_id)
-- y hasta cuál vio (last_read_message_id, que ya existía).
--
-- La app aplica este cambio sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de ALTER:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

ALTER TABLE user_conversations
    ADD COLUMN last_delivered_message_id INT DEFAULT NULL AFTER last_read_message_id;

-- Los mensajes que ya existían se consideran entregados
UPDATE user_conversations uc
  JOIN conversations c ON c.id = uc.conversation_id
   SET uc.last_delivered_message_id = c.last_message_id;
