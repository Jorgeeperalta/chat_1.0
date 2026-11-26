/**
 * @file Videollamadas con LiveKit
 * @description Una sala por conversación ("conv-<id>"). El servidor crea la sala, despacha el
 * agente de subtítulos (agent/) y firma los tokens de acceso. La clave secreta nunca sale de acá:
 * el navegador solo recibe la URL del servidor de LiveKit y un token con vencimiento.
 */

// livekit-server-sdk firma con WebCrypto global (Node 19+). En Node 18 no existe por defecto.
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto;
}

const {
  AccessToken,
  RoomServiceClient,
  AgentDispatchClient,
  EgressClient,
  EncodedFileOutput,
  S3Upload,
} = require('livekit-server-sdk');
const config = require('../config');
const logger = require('../utils/logger');

// Idiomas de subtítulos que ofrece la app
const SUBTITLE_LANGUAGES = ['es', 'en', 'fr', 'it', 'de', 'zh'];

// Atributo del participante con el idioma de subtítulos que quiere ver (lo lee el agente)
const CAPTIONS_LANGUAGE_ATTRIBUTE = 'captions_language';

const ROOM_PREFIX = 'conv-';

/** @returns {boolean} Si están URL, clave y secreto de LiveKit */
const isConfigured = () => Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);

/** @returns {boolean} Si hay dónde guardar las grabaciones */
const isRecordingConfigured = () => Boolean(config.livekit.recording.s3Bucket && config.livekit.recording.s3AccessKey);

/**
 * La API REST de LiveKit usa https:// aunque los clientes se conecten por wss://
 * @returns {string}
 */
const apiHost = () => config.livekit.url.replace(/^ws(s?):\/\//, 'http$1://');

const roomNameFor = (conversationId) => `${ROOM_PREFIX}${Number(conversationId)}`;

/**
 * @param {string} roomName
 * @returns {number|null} ID de la conversación, o null si el nombre no es de una sala de la app
 */
const conversationIdFromRoom = (roomName) => {
  const match = /^conv-(\d{1,10})$/.exec(String(roomName || ''));
  return match ? Number(match[1]) : null;
};

/**
 * Idioma de subtítulos de un usuario: el que eligió, o su idioma si está entre los ofrecidos
 * @param {Object} user - Con subtitle_language y, opcionalmente, preferredLanguage.code
 * @returns {string}
 */
const subtitleLanguageOf = (user) => {
  if (SUBTITLE_LANGUAGES.includes(user?.subtitle_language)) return user.subtitle_language;
  const own = String(user?.preferredLanguage?.code || '').slice(0, 2);
  return SUBTITLE_LANGUAGES.includes(own) ? own : 'en';
};

const displayName = (user) =>
  `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

/**
 * Token para entrar a una sala: identidad "user-<id>", nombre visible y el idioma de subtítulos
 * como atributo (así el agente sabe a qué idiomas traducir apenas entra).
 * @param {Object} user
 * @param {string} roomName
 * @returns {Promise<string>} JWT
 */
const createAccessToken = async (user, roomName) => {
  const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: `user-${user.id}`,
    name: displayName(user),
    ttl: config.livekit.tokenTtl,
    metadata: JSON.stringify({ userId: user.id, avatarUrl: user.avatar_url || null }),
    attributes: { [CAPTIONS_LANGUAGE_ATTRIBUTE]: subtitleLanguageOf(user) },
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Para cambiar el idioma de subtítulos durante la llamada (setAttributes)
    canUpdateOwnMetadata: true,
  });
  return token.toJwt();
};

/**
 * Crea la sala si no existe y se asegura de que el agente de subtítulos esté despachado.
 * Si el agente no se puede despachar, la llamada sigue igual (sin subtítulos).
 * @param {string} roomName
 * @param {Object} [options]
 * @param {boolean} [options.record] - Grabar la sala (solo si hay almacenamiento configurado)
 * @returns {Promise<{roomName: string, recording: boolean, captions: boolean}>}
 */
const ensureRoom = async (roomName, { record = false } = {}) => {
  const host = apiHost();
  const rooms = new RoomServiceClient(host, config.livekit.apiKey, config.livekit.apiSecret);
  await rooms.createRoom({
    name: roomName,
    emptyTimeout: config.livekit.emptyTimeoutSeconds,
    metadata: JSON.stringify({ conversationId: conversationIdFromRoom(roomName) }),
  });

  let captions = false;
  try {
    const dispatches = new AgentDispatchClient(host, config.livekit.apiKey, config.livekit.apiSecret);
    const existing = await dispatches.listDispatch(roomName);
    if (!existing.some(dispatch => dispatch.agentName === config.livekit.agentName)) {
      await dispatches.createDispatch(roomName, config.livekit.agentName);
      logger.info(`🎬 Agente de subtítulos despachado a ${roomName}`);
    }
    captions = true;
  } catch (error) {
    logger.warn(`⚠️ No se pudo despachar el agente de subtítulos a ${roomName}: ${error.message}`);
  }

  let recording = false;
  if (record) {
    recording = await startRecording(roomName);
  }
  return { roomName, recording, captions };
};

/**
 * Grabación de la sala completa en un bucket S3 (o compatible)
 * @param {string} roomName
 * @returns {Promise<boolean>}
 */
const startRecording = async (roomName) => {
  if (!isRecordingConfigured()) return false;
  const { s3Bucket, s3Region, s3AccessKey, s3Secret, s3Endpoint } = config.livekit.recording;
  try {
    const egress = new EgressClient(apiHost(), config.livekit.apiKey, config.livekit.apiSecret);
    const output = new EncodedFileOutput({
      filepath: `grabaciones/${roomName}/{time}.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          bucket: s3Bucket,
          region: s3Region || '',
          accessKey: s3AccessKey,
          secret: s3Secret,
          endpoint: s3Endpoint || '',
        }),
      },
    });
    await egress.startRoomCompositeEgress(roomName, output, { layout: 'grid' });
    logger.info(`⏺️ Grabación iniciada en ${roomName}`);
    return true;
  } catch (error) {
    logger.warn(`⚠️ No se pudo iniciar la grabación de ${roomName}: ${error.message}`);
    return false;
  }
};

module.exports = {
  SUBTITLE_LANGUAGES,
  CAPTIONS_LANGUAGE_ATTRIBUTE,
  isConfigured,
  isRecordingConfigured,
  roomNameFor,
  conversationIdFromRoom,
  subtitleLanguageOf,
  createAccessToken,
  ensureRoom,
};
