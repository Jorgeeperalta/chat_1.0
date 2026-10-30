-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: MYSQL5050.site4now.net:3306
-- Tiempo de generación: 30-10-2026 a las 08:42:44
-- Versión del servidor: 8.0.37
-- Versión de PHP: 8.3.36

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;


-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `messages`
--

CREATE TABLE `messages` (
  `id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `message_type` enum('text','audio','image','video','file') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `content` text COLLATE utf8mb4_unicode_ci,
  `original_language_id` int DEFAULT NULL,
  `translated_content` text COLLATE utf8mb4_unicode_ci,
  `target_language_id` int DEFAULT NULL,
  `translation_status` enum('pending','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_duration` int DEFAULT NULL COMMENT 'Duración en segundos',
  `audio_transcription` text COLLATE utf8mb4_unicode_ci,
  `audio_transcription_language_id` int DEFAULT NULL,
  `reply_to_message_id` int DEFAULT NULL,
  `mistral_prompt_tokens` int DEFAULT NULL,
  `mistral_completion_tokens` int DEFAULT NULL,
  `mistral_model` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mistral_response_time_ms` int DEFAULT NULL,
  `is_edited` tinyint(1) NOT NULL DEFAULT '0',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `is_delivered` tinyint(1) NOT NULL DEFAULT '0',
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-
--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conversation_id` (`conversation_id`),
  ADD KEY `idx_sender_id` (`sender_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_message_type` (`message_type`),
  ADD KEY `idx_original_language` (`original_language_id`),
  ADD KEY `idx_target_language` (`target_language_id`),
  ADD KEY `idx_conversation_created` (`conversation_id`,`created_at`),
  ADD KEY `messages_conversation_id` (`conversation_id`),
  ADD KEY `messages_sender_id` (`sender_id`),
  ADD KEY `messages_created_at` (`created_at`),
  ADD KEY `messages_message_type` (`message_type`),
  ADD KEY `messages_original_language_id` (`original_language_id`),
  ADD KEY `messages_target_language_id` (`target_language_id`),
  ADD KEY `messages_conversation_id_created_at` (`conversation_id`,`created_at`),
  ADD KEY `audio_transcription_language_id` (`audio_transcription_language_id`),
  ADD KEY `idx_reply_to_message_id` (`reply_to_message_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=399;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_255` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_256` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_257` FOREIGN KEY (`original_language_id`) REFERENCES `languages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_258` FOREIGN KEY (`target_language_id`) REFERENCES `languages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_259` FOREIGN KEY (`audio_transcription_language_id`) REFERENCES `languages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
