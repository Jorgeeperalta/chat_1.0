# Despliegue en SmarterASP.NET

Sitio: http://jorgeperalta-001-site4.itempurl.com/

Todo corre en una sola app de Node, detrás de IIS + iisnode. La API (`/api`), Socket.io (`/socket.io`), los archivos subidos (`/uploads`) y el frontend (`public/`) comparten el mismo origen, así que no hace falta configurar CORS entre ellos.

## 1. Preparar el panel (una sola vez)

1. **Node.js**: en *Websites → jorgeperalta-001-site4 → Node.js* (o *Web Server Settings*), habilitar Node.js y elegir la versión más nueva disponible (mínimo 18).
2. **Permisos de escritura**: en *File Manager*, dar permiso de escritura (*Read/Write*) a las carpetas `uploads`, `logs` e `iisnode` del sitio.
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

Subir **el contenido** de `deploy-hosting/` a la raíz del sitio (`/site4/` o la carpeta que indique el panel) por FTP o con el *File Manager*. No hay que subir la carpeta `deploy-hosting` en sí, sino lo que tiene adentro.

En las siguientes actualizaciones alcanza con subir `src/`, `public/` y, si cambió, `package.json` junto con `node_modules/`. Después hay que reciclar el sitio (*Recycle App Pool* en el panel).

## 4. Verificar

- `http://jorgeperalta-001-site4.itempurl.com/health` debe responder `{"status":"ok", "database":"connected", ...}`.
- Si la app no arranca:
  - Los errores de iisnode quedan en la carpeta `iisnode/`.
  - Los de la app quedan en `logs/app.log`.
  - Se leen por FTP.

## Importante: https y micrófono

Los navegadores solo permiten grabar audio (`getUserMedia`) en sitios **https**. Por `http://...itempurl.com` el chat de texto funciona, pero el botón de micrófono muestra un aviso.

Para habilitarlo hay que activar SSL en el panel (*SSL Certificate*, por ejemplo Let's Encrypt, normalmente sobre un dominio propio) y después poner `FORCE_HTTPS=true` en el `.env`.
