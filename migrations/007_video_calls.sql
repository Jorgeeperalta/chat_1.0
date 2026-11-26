-- ============================================
-- 007: Videollamadas con subtítulos traducidos
-- ============================================
-- users.subtitle_language: idioma en el que cada usuario ve los subtítulos (es/en/fr/it/de/zh).
-- NULL = el idioma de su cuenta, si está entre esos; si no, inglés.
--
-- La app aplica este cambio sola al arrancar (ensureSchema en backend/src/models/index.js).
-- Este archivo queda por si el usuario de la base no tiene permiso de ALTER:
-- en ese caso, ejecutarlo una vez desde phpMyAdmin y reciclar el sitio.

ALTER TABLE users
    ADD COLUMN subtitle_language ENUM('es', 'en', 'fr', 'it', 'de', 'zh') DEFAULT NULL;
