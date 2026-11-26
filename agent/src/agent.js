/**
 * Agente de subtítulos de Converxar (LiveKit Agents, Node.js)
 *
 * Entra a cada videollamada (dispatch explícito: el backend lo pide al crear la sala), escucha a
 * cada participante con Deepgram Nova-3 multilingüe y publica cada frase terminada en el text
 * stream "lk.transcription", traducida SOLO a los idiomas que eligieron los participantes
 * (atributo "captions_language").
 *
 * Si Deepgram o el LLM fallan, la llamada sigue igual: solo faltan esos subtítulos.
 *
 *   node src/agent.js dev     (desarrollo)
 *   node src/agent.js start   (producción / LiveKit Cloud)
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AutoSubscribe, ServerOptions, cli, defineAgent, stt } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { AudioStream, ParticipantKind, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { SUBTITLE_LANGUAGES, Translator } from './translator.js';
import { CAPTIONS_LANGUAGE_ATTRIBUTE, CAPTIONS_TOPIC, buildCaptions, requestedLanguages } from './captions.js';

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || 'converxar-captions';
// Un corte del STT se reintenta unas veces; después ese participante queda sin subtítulos
const STT_MAX_RESTARTS = 5;

const log = (...args) => console.log(new Date().toISOString(), '[captions]', ...args);

const createTranslator = () => new Translator({
  baseUrl: process.env.TRANSLATION_API_BASE_URL || 'https://api.mistral.ai/v1',
  apiKey: process.env.TRANSLATION_API_KEY || process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY,
  model: process.env.TRANSLATION_MODEL || 'mistral-small-latest',
  timeoutMs: Number(process.env.TRANSLATION_TIMEOUT_MS) || 4000,
});

const createStt = () => new deepgram.STT({
  apiKey: process.env.DEEPGRAM_API_KEY,
  model: 'nova-3',
  language: 'multi',
  languageHint: SUBTITLE_LANGUAGES,
  punctuate: true,
  smartFormat: true,
  // Silencio que cierra una frase: corto, para que el subtítulo llegue rápido
  endpointing: Number(process.env.DEEPGRAM_ENDPOINTING_MS) || 300,
});

export default defineAgent({
  entry: async (ctx) => {
    const room = ctx.room;

    const translator = createTranslator();
    if (!translator.isConfigured) log('⚠️ sin clave del LLM: solo se mostrará cada frase en su idioma original');

    let sttEngine = null;
    if (process.env.DEEPGRAM_API_KEY) {
      try {
        sttEngine = createStt();
      } catch (error) {
        log('⚠️ no se pudo iniciar Deepgram, la llamada sigue sin subtítulos:', error.message);
      }
    } else {
      log('⚠️ falta DEEPGRAM_API_KEY: la llamada sigue sin subtítulos');
    }

    const humans = () => [...room.remoteParticipants.values()]
      .filter(participant => participant.kind !== ParticipantKind.AGENT);

    // Idioma pedido -> identidades que lo pidieron
    const audienceByLanguage = () => {
      const audience = new Map();
      for (const participant of humans()) {
        const [language] = requestedLanguages([participant]);
        if (!language) continue;
        if (!audience.has(language)) audience.set(language, []);
        audience.get(language).push(participant.identity);
      }
      return audience;
    };

    const publish = async ({ speaker, trackSid, text, detectedLanguage }) => {
      const audience = audienceByLanguage();
      if (audience.size === 0) return;
      const startedAt = Date.now();
      const segmentId = `SG_${randomUUID().slice(0, 12)}`;
      const captions = await buildCaptions({
        text,
        detectedLanguage,
        targets: audience.keys(),
        translator,
        onError: (error, target) => log(`⚠️ traducción a ${target} falló:`, error.message),
      });
      await Promise.all(captions.map(caption =>
        room.localParticipant.sendText(caption.text, {
          topic: CAPTIONS_TOPIC,
          // Solo a quienes pidieron ese idioma (el cliente igual filtra por "language")
          destinationIdentities: audience.get(caption.language),
          attributes: {
            'lk.transcription_final': 'true',
            'lk.segment_id': segmentId,
            'lk.transcribed_track_id': trackSid || '',
            speaker_identity: speaker.identity,
            speaker_name: speaker.name || speaker.identity,
            original_language: detectedLanguage || '',
            language: caption.language,
            translated: String(caption.translated),
          },
        }).catch(error => log('⚠️ no se pudo publicar un subtítulo:', error.message))
      ));
      log(`🗣️ ${speaker.identity} [${detectedLanguage}] → ${captions.map(c => c.language).join(',') || '-'} en ${Date.now() - startedAt} ms`);
    };

    // Una transcripción por participante que habla
    const sessions = new Map();

    const transcribe = async (session, track, publication, participant) => {
      let restarts = 0;
      // Si el participante se fue (o volvió a publicar su micrófono), esta sesión ya no es la vigente
      while (sessions.get(participant.identity) === session) {
        const sttStream = sttEngine.stream();
        session.stream = sttStream;
        sttStream.updateInputStream(new AudioStream(track, 16000, 1));
        try {
          for await (const event of sttStream) {
            if (event.type !== stt.SpeechEventType.FINAL_TRANSCRIPT) continue;
            const alternative = event.alternatives?.[0];
            const text = alternative?.text?.trim();
            if (!text) continue;
            publish({
              speaker: participant,
              trackSid: publication.sid,
              text,
              detectedLanguage: alternative.language,
            }).catch(error => log('⚠️ error al procesar un segmento:', error.message));
          }
          return; // el stream terminó normalmente (se cerró)
        } catch (error) {
          restarts += 1;
          log(`⚠️ STT de ${participant.identity} se cortó (${restarts}/${STT_MAX_RESTARTS}):`, error.message);
          if (restarts >= STT_MAX_RESTARTS) return;
          await new Promise(resolve => setTimeout(resolve, 1000 * restarts));
        }
      }
    };

    const stop = (identity) => {
      const session = sessions.get(identity);
      if (!session) return;
      sessions.delete(identity);
      try { session.stream?.close(); } catch { /* ya cerrado */ }
    };

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (!sttEngine || track.kind !== TrackKind.KIND_AUDIO) return;
      if (participant.kind === ParticipantKind.AGENT) return;
      stop(participant.identity);
      const session = { stream: null };
      sessions.set(participant.identity, session);
      log(`🎙️ escuchando a ${participant.identity}`);
      transcribe(session, track, publication, participant).catch(error => log('⚠️', error.message));
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind === TrackKind.KIND_AUDIO) stop(participant.identity);
    });
    room.on(RoomEvent.ParticipantDisconnected, participant => stop(participant.identity));
    room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
      if (CAPTIONS_LANGUAGE_ATTRIBUTE in changed) {
        log(`🌐 ${participant.identity} quiere subtítulos en ${changed[CAPTIONS_LANGUAGE_ATTRIBUTE]}`);
      }
    });

    ctx.addShutdownCallback(async () => {
      for (const identity of [...sessions.keys()]) stop(identity);
      log(`fin de la sala ${room.name}`);
    });

    // Recién ahora, con los eventos ya escuchados: así no se pierde el audio de quienes ya estaban
    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);
    log(`en la sala ${room.name}`);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // Dispatch explícito: solo entra a las salas que pide el backend (POST /api/rooms)
    agentName: AGENT_NAME,
  }));
}
