/**
 * @file useLiveKitRoom
 * @description Conexión a una sala de LiveKit para Vue (no hay componentes oficiales de Vue):
 * conecta con el token del backend, publica cámara y micrófono, mantiene la lista de
 * participantes y reproduce el audio de los demás. Los videos los muestra ParticipantTile.
 */

import { ref, shallowRef, triggerRef, onBeforeUnmount } from 'vue';
import { Room, RoomEvent, Track, ConnectionState, VideoPresets } from 'livekit-client';

export function useLiveKitRoom() {
  const room = shallowRef(null);
  const state = ref('idle'); // idle | connecting | connected | reconnecting | disconnected | error
  const error = ref(null);
  const mediaError = ref(null); // cámara o micrófono sin permiso / no disponibles
  const participants = shallowRef([]); // el propio primero; sin el agente de subtítulos
  const activeSpeakers = ref(new Set());
  const micEnabled = ref(false);
  const cameraEnabled = ref(false);
  const screenSharing = ref(false);
  const audioBlocked = ref(false); // el navegador no deja reproducir audio hasta un toque
  const revision = ref(0);

  // Audio de los demás: un <audio> por pista, fuera de la vista
  const audioElements = new Map();
  let audioContainer = null;

  const refresh = () => {
    const current = room.value;
    if (!current) return;
    participants.value = [current.localParticipant, ...current.remoteParticipants.values()]
      .filter(participant => !participant.isAgent);
    micEnabled.value = current.localParticipant.isMicrophoneEnabled;
    cameraEnabled.value = current.localParticipant.isCameraEnabled;
    screenSharing.value = current.localParticipant.isScreenShareEnabled;
    // Las pistas cambian dentro de los mismos objetos: los videos se vuelven a enganchar con esto
    revision.value += 1;
    triggerRef(participants);
  };

  const attachAudio = (track, publication) => {
    if (track.kind !== Track.Kind.Audio) return;
    if (!audioContainer) {
      audioContainer = document.createElement('div');
      audioContainer.hidden = true;
      document.body.appendChild(audioContainer);
    }
    const element = track.attach();
    audioElements.set(publication.trackSid, element);
    audioContainer.appendChild(element);
  };

  const detachAudio = (track, publication) => {
    if (track.kind !== Track.Kind.Audio) return;
    track.detach().forEach(element => element.remove());
    audioElements.delete(publication.trackSid);
  };

  /**
   * @param {string} url - wss://... (lo devuelve el backend junto con el token)
   * @param {string} token
   * @param {Object} [options]
   * @param {boolean} [options.video=true]
   */
  const connect = async (url, token, { video = true } = {}) => {
    state.value = 'connecting';
    error.value = null;

    const current = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    room.value = current;

    current
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, (track, publication) => { attachAudio(track, publication); refresh(); })
      .on(RoomEvent.TrackUnsubscribed, (track, publication) => { detachAudio(track, publication); refresh(); })
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        activeSpeakers.value = new Set(speakers.map(speaker => speaker.identity));
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        audioBlocked.value = !current.canPlaybackAudio;
      })
      .on(RoomEvent.MediaDevicesError, (deviceError) => {
        mediaError.value = deviceError?.name || 'MediaError';
      })
      .on(RoomEvent.ConnectionStateChanged, (connectionState) => {
        if (connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting) {
          state.value = 'reconnecting';
        } else if (connectionState === ConnectionState.Connected) {
          state.value = 'connected';
        }
      })
      .on(RoomEvent.Disconnected, () => {
        state.value = 'disconnected';
        refresh();
      });

    try {
      await current.connect(url, token);
    } catch (connectError) {
      state.value = 'error';
      error.value = connectError;
      throw connectError;
    }
    state.value = 'connected';
    audioBlocked.value = !current.canPlaybackAudio;
    refresh();

    // Cámara y micrófono: si la cámara falla (sin permiso, ocupada) se sigue solo con audio
    try {
      if (video) await current.localParticipant.enableCameraAndMicrophone();
      else await current.localParticipant.setMicrophoneEnabled(true);
    } catch (publishError) {
      mediaError.value = publishError?.name || 'MediaError';
      if (video) {
        await current.localParticipant.setMicrophoneEnabled(true).catch(() => {});
      }
    }
    refresh();
  };

  const toggleMicrophone = async () => {
    const current = room.value;
    if (!current) return;
    await current.localParticipant.setMicrophoneEnabled(!current.localParticipant.isMicrophoneEnabled);
    refresh();
  };

  const toggleCamera = async () => {
    const current = room.value;
    if (!current) return;
    try {
      await current.localParticipant.setCameraEnabled(!current.localParticipant.isCameraEnabled);
    } catch (cameraError) {
      mediaError.value = cameraError?.name || 'MediaError';
    }
    refresh();
  };

  const toggleScreenShare = async () => {
    const current = room.value;
    if (!current) return;
    try {
      await current.localParticipant.setScreenShareEnabled(!current.localParticipant.isScreenShareEnabled, { audio: true });
    } catch (shareError) {
      // Cancelar el selector de pantalla también cae acá: no es un error para mostrar
      if (shareError?.name !== 'NotAllowedError') mediaError.value = shareError?.name || 'MediaError';
    }
    refresh();
  };

  /** Desbloquea el audio cuando el navegador lo bloqueó (requiere un toque del usuario) */
  const startAudio = async () => {
    await room.value?.startAudio();
    audioBlocked.value = !room.value?.canPlaybackAudio;
  };

  const leave = async () => {
    const current = room.value;
    if (!current) return;
    await current.disconnect();
    audioElements.forEach(element => element.remove());
    audioElements.clear();
    audioContainer?.remove();
    audioContainer = null;
    state.value = 'disconnected';
  };

  onBeforeUnmount(() => {
    leave();
  });

  return {
    room,
    state,
    error,
    mediaError,
    participants,
    activeSpeakers,
    micEnabled,
    cameraEnabled,
    screenSharing,
    audioBlocked,
    revision,
    connect,
    leave,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    startAudio,
  };
}

export { Track };
