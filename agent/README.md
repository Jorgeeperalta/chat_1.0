# Agente de subtítulos (LiveKit Agents)

Entra a cada videollamada de Converxar, transcribe a cada participante con Deepgram Nova-3
(multilingüe) y publica cada frase en el text stream `lk.transcription`, traducida solo a los
idiomas que eligieron los participantes (atributo `captions_language`: es, en, fr, it, de, zh).

Corre aparte del backend: el hosting de la app (IIS) no sirve para procesos que quedan conectados.

## Probar en la PC

```bash
cd agent
npm install
cp .env.example .env    # completar LIVEKIT_*, DEEPGRAM_API_KEY y TRANSLATION_API_KEY
npm run dev
```

## Publicar en LiveKit Cloud

Con la [CLI de LiveKit](https://docs.livekit.io/home/cli/) (`lk`), autenticada en el mismo
proyecto que usa el backend:

```bash
cd agent
lk agent create --secrets-file .env    # la primera vez: crea el agente y sube los secretos
lk agent deploy                        # para publicar cambios
```

El nombre del agente (`LIVEKIT_AGENT_NAME`, por defecto `converxar-captions`) tiene que ser el
mismo en el backend: el backend lo despacha a cada sala al crearla (`POST /api/rooms`).

## Atributos de cada subtítulo

| Atributo | Valor |
| --- | --- |
| `language` | idioma del subtítulo (el que eligió quien lo recibe) |
| `original_language` | idioma detectado de la frase |
| `translated` | `false` si la frase ya estaba en ese idioma |
| `speaker_identity`, `speaker_name` | quién habló |
| `lk.segment_id`, `lk.transcribed_track_id`, `lk.transcription_final` | segmento y pista |

## Si algo falla

- Sin `DEEPGRAM_API_KEY`, o si Deepgram se cae: la llamada sigue, sin subtítulos.
- Si el LLM falla para un idioma: ese idioma se queda sin esa frase; los demás siguen.
- `npm test` prueba la lógica de traducción (sin red).
