# Guía de Configuración del Proyecto Chat con Traducción

## 📋 Tabla de Contenidos

1. [Introducción](#-introducción)
2. [Pre-requisitos](#-pre-requisitos)
3. [Estructura del Proyecto](#-estructura-del-proyecto)
4. [Configuración del Backend](#-configuración-del-backend)
   - [Instalar dependencias](#instalar-dependencias)
   - [Configurar variables de entorno](#configurar-variables-de-entorno)
   - [Inicializar la base de datos](#inicializar-la-base-de-datos)
   - [Ejecutar el servidor](#ejecutar-el-servidor)
5. [Configuración del Frontend](#-configuración-del-frontend)
   - [Instalar dependencias](#instalar-dependencias-1)
   - [Configurar variables de entorno](#configurar-variables-de-entorno-1)
   - [Ejecutar la aplicación](#ejecutar-la-aplicación)
6. [Configuración de la API de Mistral AI](#-configuración-de-la-api-de-mistral-ai)
7. [Configuración de MySQL](#-configuración-de-mysql)
8. [Uso del Sistema](#-uso-del-sistema)
9. [Solución de Problemas](#-solución-de-problemas)

---

## 📌 Introducción

Este documento proporciona una guía paso a paso para configurar y ejecutar la aplicación de chat con traducción en tiempo real utilizando Vue.js, Node.js, WebSockets y la API de Mistral AI.

---

## 📋 Pre-requisitos

Asegúrate de tener instalados los siguientes requisitos antes de continuar:

- **Node.js** v18 o superior (recomendado v20)
- **npm** o **yarn** (recomendado npm v9+)
- **MySQL** v8.0 o superior
- **Git**
- Un navegador moderno (Chrome, Firefox, Edge, Safari)
- Una clave API de Mistral AI

### Verificar versiones

```bash
# Verificar versión de Node.js
node -v

# Verificar versión de npm
npm -v

# Verificar versión de MySQL
mysql --version
```

---

## 📁 Estructura del Proyecto

```
chat_1.0/
├── backend/                 # Backend de la aplicación
│   ├── src/
│   │   ├── config/        # Configuraciones
│   │   ├── controllers/   # Controladores REST
│   │   ├── middleware/    # Middleware
│   │   ├── migrations/    # Migraciones de base de datos
│   │   ├── models/        # Modelos de Sequelize
│   │   ├── routes/        # Rutas REST
│   │   ├── services/      # Servicios (traducción, almacenamiento, etc.)
│   │   ├── utils/         # Utilidades
│   │   └── index.js      # Punto de entrada del backend
│   ├── .env.example       # Ejemplo de variables de entorno
│   ├── package.json
│   └── ...
│
├── frontend/               # Frontend de la aplicación
│   ├── public/            # Archivos estáticos
│   ├── src/
│   │   ├── assets/        # Recursos estáticos
│   │   ├── components/    # Componentes Vue
│   │   │   ├── chat/     # Componentes de chat
│   │   │   ├── common/   # Componentes comunes
│   │   │   └── layout/   # Layouts
│   │   ├── router/        # Configuración del router
│   │   ├── services/      # Servicios API
│   │   ├── stores/        # Stores de Pinia
│   │   ├── views/         # Vistas
│   │   │   ├── auth/     # Vistas de autenticación
│   │   │   ├── chat/     # Vistas de chat
│   │   │   └── settings/ # Vistas de configuración
│   │   ├── App.vue        # Componente principal
│   │   └── main.js        # Punto de entrada del frontend
│   ├── .env.example       # Ejemplo de variables de entorno
│   ├── vite.config.js     # Configuración de Vite
│   └── ...
│
├── docs/                  # Documentación
│   └── CONFIGURACION.md   # Esta guía
│
├── migrations/            # Migraciones de base de datos SQL
│   └── 001_create_database.sql
│
└── README.md             # Documentación principal
```

---

## ⚙️ Configuración del Backend

### Instalar dependencias

1. Navega al directorio del backend:

```bash
cd backend
```

2. Instala las dependencias:

```bash
npm install
```

### Configurar variables de entorno

1. Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus configuraciones:

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de la base de datos MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chat_translate
DB_USER=root
DB_PASSWORD=your_mysql_password

# Configuración de JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Configuración de Mistral AI
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_API_URL=https://api.mistral.ai/v1

# Configuración de Socket.io
SOCKET_CORS_ORIGIN=http://localhost:5173

# Configuración de almacenamiento (opcional)
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./uploads
# AWS_S3_ACCESS_KEY_ID=
# AWS_S3_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET_NAME=

# Configuración de logging
LOG_LEVEL=info
```

3. Genera una clave JWT segura:

```bash
# Puedes generar una clave aleatoria usando Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Inicializar la base de datos

1. Asegúrate de que MySQL esté en ejecución:

```bash
# En Linux/Mac
sudo systemctl start mysql

# En Windows
net start MySQL80
```

2. Crea la base de datos y el usuario:

```bash
mysql -u root -p
```

Dentro de MySQL, ejecuta:

```sql
-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS chat_translate 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Crear un usuario (opcional, puedes usar root)
CREATE USER IF NOT EXISTS 'chat_user'@'localhost' 
  IDENTIFIED BY 'your_password';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON chat_translate.* TO 'chat_user'@'localhost';

-- Aplicar cambios
FLUSH PRIVILEGES;

-- Salir
EXIT;
```

3. Ejecuta las migraciones de la base de datos:

```bash
# Asegúrate de tener MySQL ejecutándose
# Luego ejecuta el script SQL
mysql -u root -p chat_translate < ../migrations/001_create_database.sql
```

Opcionalmente, puedes importar el script desde MySQL Workbench o cualquier otra herramienta.

### Ejecutar el servidor

1. Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

2. Para producción:

```bash
npm run build
npm start
```

El servidor estará disponible en `http://localhost:3000` (o el puerto que hayas configurado).

---

## 🖥️ Configuración del Frontend

### Instalar dependencias

1. Navega al directorio del frontend:

```bash
cd ../frontend
```

2. Instala las dependencias:

```bash
npm install
```

### Configurar variables de entorno

1. Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus configuraciones:

```env
# Configuración de la aplicación
VITE_APP_NAME=Chat Translate
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=Chat en tiempo real con traducción por IA

# Configuración de la API
VITE_API_BASE_URL=http://localhost:3000

# Configuración de Socket.io
VITE_SOCKET_URL=http://localhost:3000
VITE_SOCKET_PATH=/socket.io

# Configuración de tema
VITE_DEFAULT_THEME=system
VITE_DEFAULT_LANGUAGE=es
VITE_FALLBACK_LANGUAGE=en

# Colores del tema claro
VITE_LIGHT_THEME_PRIMARY=#1867C0
VITE_LIGHT_THEME_SECONDARY=#5CBBF6
VITE_LIGHT_THEME_ACCENT=#42D692

# Colores del tema oscuro
VITE_DARK_THEME_PRIMARY=#1867C0
VITE_DARK_THEME_SECONDARY=#5CBBF6
VITE_DARK_THEME_ACCENT=#42D692

# Configuración de Base URL para el router
VITE_BASE_URL=/
```

### Ejecutar la aplicación

1. Inicia la aplicación en modo desarrollo:

```bash
npm run dev
```

2. Para producción:

```bash
npm run build
npm run preview
```

La aplicación estará disponible en `http://localhost:5173` (por defecto de Vite).

---

## 🔬 Configuración de la API de Mistral AI

### Obtener la clave API

1. Ve a [Mistral AI Platform](https://console.mistral.ai/)
2. Regístrate o inicia sesión
3. Ve a la sección "API Keys"
4. Genera una nueva clave API
5. Copia la clave y pégala en el `.env` del backend:

```env
MISTRAL_API_KEY=your_api_key_here
MISTRAL_API_URL=https://api.mistral.ai/v1
```

### Modelos disponibles

La aplicación usa el modelo `mistral-tiny` por defecto para traducción, pero puedes configurar otros modelos editando el servicio de traducción en `backend/src/services/translationService.js`.

Modelos recomendados:
- `mistral-tiny`: Rápido y económico (recomendado para traducción)
- `mistral-small`: Más preciso pero más lento
- `mistral-medium`: Mejor calidad, ideal para traducciones complejas

---

## 🐘 Configuración de MySQL

### Optimización recomendada

Para mejorar el rendimiento de la aplicación, se recomienda:

1. **Configurar índices**: El script SQL ya incluye índices para las tablas principales.

2. **Optimizar la configuración de MySQL**:

```ini
# /etc/mysql/my.cnf o my.ini
[mysqld]
max_connections = 200
wait_timeout = 28800
interactive_timeout = 28800
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
```

3. **Crear un usuario específico**:

```sql
-- Conectarse como root
mysql -u root -p

-- Crear usuario
CREATE USER 'chat_app'@'%' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON chat_translate.* TO 'chat_app'@'%';
FLUSH PRIVILEGES;
```

### Backup de la base de datos

Para hacer backup de la base de datos:

```bash
# Hacer backup
mysqldump -u root -p chat_translate > chat_translate_backup_$(date +%Y-%m-%d).sql

# Restaurar backup
mysql -u root -p chat_translate < chat_translate_backup.sql
```

---

## 🚀 Uso del Sistema

### Pasos para probar la aplicación

1. **Iniciar el backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Iniciar el frontend** (en otra terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Acceder a la aplicación**:
   - Abre tu navegador y ve a `http://localhost:5173`
   - Regístrate como nuevo usuario
   - Inicia sesión con tus credenciales

4. **Probar el chat**:
   - Abre otra pestaña en modo incógnito o otro navegador
   - Regístrate como otro usuario
   - Inicia una conversación entre ambos usuarios
   - Prueba enviar mensajes de texto
   - Prueba grabar mensajes de voz
   - Verifica que la traducción funciona automáticamente

### Funcionalidades principales

| Funcionalidad | Descripción | Estado |
|--------------|-------------|--------|
| Registro de usuarios | Creación de cuentas con idioma preferido | ✅ |
| Inicio de sesión | Autenticación segura con JWT | ✅ |
| Chat 1:1 | Comunicación directa entre usuarios | ✅ |
| Chat grupal | Creación de salas de chat grupales | ✅ |
| Traducción de texto | Traducción automática usando Mistral AI | ✅ |
| Mensajes de voz | Grabación y reproducción de audio | ✅ |
| Traducción de voz | Transcripción y traducción de mensajes de voz | ✅ |
| Notificaciones en tiempo real | Notificaciones de nuevos mensajes | ✅ |
| Historial de conversaciones | Guardado y recuperación de mensajes | ✅ |

---

## 🐛 Solución de Problemas

### Problemas comunes

#### Backend no inicia

**Síntoma**: `Error: ER_ACCESS_DENIED_ERROR: Access denied for user`

**Solución**:
1. Verifica las credenciales de MySQL en `.env`
2. Asegúrate de que el usuario tenga permisos sobre la base de datos
3. Verifica que MySQL esté en ejecución

```bash
# Probar conexión a MySQL
mysql -u root -p
# Si funciona, prueba con las credenciales del .env
mysql -u DB_USER -pDB_PASSWORD -h DB_HOST
```

#### Frontend no se conecta al backend

**Síntoma**: Error de CORS o conexión fallida

**Solución**:
1. Verifica que `VITE_API_BASE_URL` apunte a la URL correcta del backend
2. Verifica que `SOCKET_CORS_ORIGIN` en el backend incluya la URL del frontend
3. Asegúrate de que ambos servicios estén en ejecución

#### La traducción no funciona

**Síntoma**: Los mensajes no se traducen

**Solución**:
1. Verifica que `MISTRAL_API_KEY` esté configurado correctamente
2. Verifica que tengas créditos disponibles en tu cuenta de Mistral AI
3. Revisa los logs del backend para ver errores de la API
4. Prueba la API de Mistral directamente:

```bash
curl -X POST "https://api.mistral.ai/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral-tiny", "messages": [{"role": "user", "content": "Translate to English: Hola, ¿cómo estás?"}]}'
```

#### Los mensajes de voz no funcionan

**Síntoma**: No se puede grabar o reproducir audio

**Solución**:
1. Verifica que el navegador tenga permiso para usar el micrófono
2. Asegúrate de estar usando HTTPS en producción o localhost en desarrollo
3. Prueba en Chrome o Firefox (mejor soporte para MediaRecorder API)

#### Problemas de autenticación

**Síntoma**: No se puede iniciar sesión o el token expira rápidamente

**Solución**:
1. Verifica que `JWT_SECRET` sea el mismo en todos los entornos
2. Asegúrate de que `JWT_EXPIRES_IN` tenga un valor adecuado (ej: `1d`)
3. Verifica que el cliente envíe el token en el header `Authorization: Bearer <token>`

---

## 📊 Monitorización

### Logs del backend

El backend genera logs en la consola y en archivos (si está configurado).

Niveles de log:
- `error`: Errores críticos
- `warn`: Advertencias
- `info`: Información general
- `debug`: Depuración detallada

Para cambiar el nivel de log:

```env
LOG_LEVEL=debug
```

### Métricas (futuro)

Puedes implementar Prometheus o Grafana para monitorear:
- Número de usuarios activos
- Mensajes por minuto
- Tiempo de respuesta de la API
- Uso de la API de Mistral

---

## 🔒 Seguridad

### Recomendaciones

1. **Claves API**: Nunca expongas tus claves API en código público
2. **Variables de entorno**: Usa siempre variables de entorno para configuraciones sensibles
3. **HTTPS**: Usa HTTPS en producción para proteger las credenciales
4. **CORS**: Configura CORS adecuadamente para restringir el acceso
5. **JWT**: Usa tokens con tiempo de expiración corto y refresh tokens
6. **MySQL**: No uses el usuario root en producción
7. **Backups**: Realiza backups regulares de la base de datos

### Configuración de CORS

Edita `backend/src/index.js` para configurar CORS:

```javascript
app.use(cors({
  origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));
```

---

## 📦 Despliegue

### Despliegue local con Docker (opcional)

Puedes crear un archivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=chat_translate
      - DB_USER=chat_user
      - DB_PASSWORD=password
      - JWT_SECRET=your_jwt_secret
      - MISTRAL_API_KEY=your_api_key
      - SOCKET_CORS_ORIGIN=http://localhost:5173
    depends_on:
      - mysql
    restart: always

  # MySQL
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=chat_translate
      - MYSQL_USER=chat_user
      - MYSQL_PASSWORD=password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    restart: always

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: always

volumes:
  mysql_data:
```

### Despliegue en producción

Para despliegue en producción, considera:

1. **Nginx como proxy inverso**:
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     
     location / {
       proxy_pass http://localhost:5173;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
     
     location /api/ {
       proxy_pass http://localhost:3000/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
     
     location /socket.io/ {
       proxy_pass http://localhost:3000/socket.io/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

2. **Usar PM2 para el backend**:
   ```bash
   npm install -g pm2
   pm2 start backend/src/index.js --name chat-backend
   pm2 save
   pm2 startup
   ```

3. **Construir el frontend para producción**:
   ```bash
   npm run build
   # Copiar los archivos de dist/ a tu servidor web
   ```

---

## 📝 Notas Adicionales

### Limitaciones conocidas

1. **Mistral AI**: La API de Mistral AI tiene límites de uso (consulta tu plan)
2. **Browser Support**: Algunos navegadores antiguos pueden no soportar todas las funcionalidades
3. **Mobile**: La grabación de audio puede tener limitaciones en algunos dispositivos móviles

### Futuras mejoras

- [ ] Implementar chat grupal con WebSockets
- [ ] Añadir soporte para video llamadas
- [ ] Implementar búsqueda avanzada de mensajes
- [ ] Añadir soporte para adjuntos de archivos
- [ ] Implementar notificaciones push
- [ ] Añadir autenticación de dos factores
- [ ] Implementar cifrado de extremo a extremo

---

## 🙏 Agradecimientos

Este proyecto utiliza las siguientes tecnologías:

- **Frontend**: Vue.js 3, Vuetify 3, Pinia, Vite
- **Backend**: Node.js, Express, Sequelize, Socket.io
- **Base de Datos**: MySQL
- **IA**: Mistral AI

---

## 📞 Soporte

Si tienes problemas o preguntas, puedes:

1. Revisar esta guía de configuración
2. Consultar los logs de la aplicación
3. Verificar los archivos `.env` en backend y frontend
4. Revisar la consola del navegador (F12)
5. Contactar al equipo de desarrollo

---

**Versión del documento**: 1.0.0
**Última actualización**: 23 de octubre de 2026
