/**
 * @file Empaquetado para el hosting (SmarterASP.NET / IIS + iisnode)
 * @description Compila el frontend y arma la carpeta deploy-hosting/ lista para subir por FTP
 *
 * Uso (desde la raíz del repo):  node scripts/build-deploy.js
 *
 * Resultado (deploy-hosting/):
 *   web.config          configuración de IIS + iisnode
 *   .env                copia de backend/.env.production (si existe)
 *   package.json        dependencias del backend
 *   node_modules/       solo dependencias de producción
 *   src/                código del backend
 *   public/             build del frontend (Vite)
 *   uploads/ logs/      carpetas que la app necesita poder escribir
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');
const outDir = path.join(root, 'deploy-hosting');

const run = (command, cwd) => {
  console.log(`\n> ${command}  (${path.relative(root, cwd) || '.'})`);
  execSync(command, { cwd, stdio: 'inherit' });
};

const copy = (from, to) => {
  fs.cpSync(from, to, { recursive: true });
  console.log(`  copiado ${path.relative(root, from)} -> ${path.relative(root, to)}`);
};

// 1. Compilar el frontend con .env.production (URLs relativas al mismo origen)
run('npm run build', frontendDir);

// 2. Carpeta de salida limpia
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 3. Backend
copy(path.join(backendDir, 'src'), path.join(outDir, 'src'));
for (const file of ['package.json', 'package-lock.json', 'web.config']) {
  copy(path.join(backendDir, file), path.join(outDir, file));
}

// 4. Frontend compilado -> public/ (lo sirve Express)
copy(path.join(frontendDir, 'dist'), path.join(outDir, 'public'));

// 5. Carpetas con permiso de escritura en el hosting
for (const dir of ['uploads/audio', 'uploads/images', 'uploads/files', 'logs']) {
  fs.mkdirSync(path.join(outDir, dir), { recursive: true });
}

// 6. Variables de entorno de producción
const envProduction = path.join(backendDir, '.env.production');
if (fs.existsSync(envProduction)) {
  copy(envProduction, path.join(outDir, '.env'));
} else {
  console.warn(
    '\n⚠️  No existe backend/.env.production: copia backend/.env.production.example,' +
    ' completa los valores y vuelve a ejecutar (o sube el .env a mano).'
  );
}

// 7. Dependencias de producción (sin devDependencies)
run('npm ci --omit=dev --no-audit --no-fund', outDir);

console.log(`\n✅ Listo: sube el contenido de ${path.relative(root, outDir)}/ a la raíz del sitio por FTP.`);
