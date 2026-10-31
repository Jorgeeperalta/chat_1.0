# Despliegue de Converxa en SmarterASP.NET

Sitio: http://jorgeperalta-001-site4.itempurl.com/

Todo corre en una sola app de Node. IIS la lanza con **HttpPlatformHandler** (`node src\index.js`) y le reenvía todas las peticiones. La API (`/api`), Socket.io (`/socket.io`), los archivos subidos (`/uploads`) y el frontend (`public/`) comparten el mismo origen, así que no hace falta configurar CORS entre ellos.

El sitio vive en la carpeta `www\whatsapp` del hosting.

## 1. Preparar el panel (una sola vez)

1. **Node.js**: en *Aplicación y tiempo de ejecución → Aplicación Node.js*, elegir *Habilitar Node.JS* y poner `src/index.js` como archivo de inicio.
   - Al guardar, el panel **reescribe el `web.config`**. Después hay que volver a subir el de `backend/web.config`, que agrega el límite de 15 MB para audios, WebSockets y el bloqueo de `.env`.
2. **Permisos de escritura**: en *File Manager*, dar permiso de escritura (*Read/Write*) a las carpetas `uploads` y `logs` del sitio.
3. **Base de datos**: la app usa la base MySQL `db_a47d48_chat` en `mysql5050.site4now.net`. Ya tiene las tablas creadas desde desarrollo. En una base nueva, importar `migrations/001_create_database.sql` sin las líneas `CREATE DATABASE`/`USE` ni la sección de `EVENT`s.

## 2. Generar el paquete

```bash
cp backend/.env.production.example backend/.env.production   # una sola vez
# completar DB_PASSWORD, JWT_SECRET y MISTRAL_API_KEY en backend/.env.production
node scripts/build-deploy.js
```

El script deja todo en `deploy-hosting/`:

- `web.config`
- `.env`
- `package.json`
- `node_modules/` (solo dependencias de producción)
- `src/` (backend)
- `public/` (frontend compilado)
- `uploads/` y `logs/`

## 3. Subir

Subir **el contenido** de `deploy-hosting/` a `www\whatsapp` por FTP o con el *File Manager*. No hay que subir la carpeta `deploy-hosting` en sí, sino lo que tiene adentro.

- **Carpetas grandes** (`node_modules/`, `public/`): comprimirlas en ZIP, subir el ZIP y extraerlo con el *File Manager*. Es mucho más rápido que subir miles de archivos sueltos por FTP. Antes de extraer, borrar la carpeta vieja en el servidor.
- **Actualizaciones**: alcanza con subir `src/`, `public/` y, si cambió, `package.json` junto con `node_modules/`. Después hay que reciclar el sitio (*Recycle App Pool* en el panel). Si solo cambió `public/`, no hace falta reciclar.
- **`.env` de producción**: vive solo en el servidor. Si `backend/.env.production` no existe, el script no genera `.env`. En ese caso no hay que borrar el `.env` del servidor al subir.

### Cambios de base de datos

Al arrancar, la app agrega sola las columnas nuevas que necesita (`ensureSchema` en `backend/src/models/index.js`). Por ejemplo, la versión con respuestas a mensajes crea `messages.reply_to_message_id`. No hay que correr SQL a mano.

Si el usuario de la base no tuviera permiso de `ALTER`, Node no arranca y `log.txt` (o `logs/app.log`) lo indica. En ese caso, ejecutar `migrations/002_reply_to_message.sql` desde phpMyAdmin y reciclar el sitio.

## 4. Verificar

- `http://jorgeperalta-001-site4.itempurl.com/health` debe responder `{"status":"ok", "database":"connected", ...}`.
- Si la app no arranca:
  - Lo que imprime Node al arrancar (por ejemplo `Cannot find module` o `Variables de entorno faltantes`) queda en `log.txt`, en la raíz del sitio.
  - Los errores de la app, una vez que arrancó, quedan en `logs/app.log`.
  - Se leen por FTP o con el *File Manager*. IIS no los sirve por web.
  - Un 500 con cuerpo vacío en todas las rutas casi siempre significa que Node no arrancó. Revisar `log.txt`.

## Importante: https y micrófono

Los navegadores solo permiten grabar audio (`getUserMedia`) en sitios **https**. Por `http://...itempurl.com` el chat de texto funciona, pero el botón de micrófono muestra un aviso.

Para habilitarlo hay que activar SSL en el panel (*SSL Certificate*, por ejemplo Let's Encrypt, normalmente sobre un dominio propio) y después poner `FORCE_HTTPS=true` en el `.env`.

## Notificaciones push (sonido y vibración con la app cerrada)

Cuando alguien no tiene la app a la vista (cerrada, en segundo plano o con la pantalla bloqueada), los mensajes nuevos le llegan como notificación del sistema, con sonido y vibración. Necesitan https.

1. **Claves VAPID** (una sola vez). Generarlas con `npx web-push generate-vapid-keys` (en `backend/`) y agregarlas al `.env` del servidor:

   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:admin@converxar.com
   ```

   No cambiarlas después: las suscripciones están atadas a la clave pública y todos tendrían que volver a activar las notificaciones. Sin estas variables la app funciona igual, pero sin notificaciones push (`logs/app.log` lo avisa al arrancar).
2. **Tabla**: la app crea `push_subscriptions` sola al arrancar. Si el usuario de la base no tuviera permiso de `CREATE`, ejecutar `migrations/003_push_subscriptions.sql` desde phpMyAdmin.
3. **En cada teléfono**: en la pantalla de chats aparece "Activar notificaciones". El permiso solo se puede pedir con un toque del usuario.
   - **Android**: funciona desde Chrome, aunque la app no esté instalada.
   - **iPhone (iOS 16.4 o más nuevo)**: solo con la app agregada a la pantalla de inicio (Compartir → Agregar a inicio) y abierta desde ahí.

No se envía notificación al remitente, a quien tiene la app a la vista, a quien silenció el chat ni a quien salió del grupo. El sonido y la vibración siguen las preferencias de cada usuario (Ajustes → Notificaciones).
