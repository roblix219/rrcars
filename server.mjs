#!/usr/bin/env node
/* ============================================================
   RR CARS · Servidor local mínimo (sin dependencias)
   ------------------------------------------------------------
   La aplicación es una PWA y debe abrirse desde http://localhost
   o HTTPS; abrir index.html con file:// desactiva el service
   worker, el manifest y la instalación.

   Uso:
     node server.mjs            → http://127.0.0.1:8080
     node server.mjs --open     → abre el navegador
     node server.mjs --port 3000
   ============================================================ */

import http from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

function argValue(flag, fallback) {
  const index = argv.indexOf(flag);
  if (index === -1 || index === argv.length - 1) return fallback;
  return argv[index + 1];
}

const PORT = Number(argValue('--port', process.env.PORT || 8080));
const HOST = argValue('--host', '127.0.0.1');
const OPEN = argv.includes('--open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

async function serveFile(req, res, file) {
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
  const ext = path.extname(file).toLowerCase();
  const noCache = ['.html', '.js', '.mjs', '.css', '.webmanifest', '.json'].includes(ext);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Método no permitido');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const file = path.resolve(ROOT, `.${pathname}`);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      send(res, 403, 'Acceso denegado');
      return;
    }

    try {
      await serveFile(req, res, file);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    // Navegación directa a una ruta sin archivo: entrega el app shell.
    // Las rutas reales de la app usan hash (#/...), esto es solo un respaldo.
    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (wantsHtml && !path.extname(pathname)) {
      await serveFile(req, res, path.join(ROOT, 'index.html'));
      return;
    }
    send(res, 404, 'Recurso no encontrado');
  } catch (error) {
    console.error('Error al servir la solicitud:', error);
    if (!res.headersSent) send(res, 500, 'Error interno del servidor');
    else res.destroy();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nEl puerto ${PORT} ya está ocupado.`);
    console.error(`Cierra el otro proceso o ejecuta: node server.mjs --port ${PORT + 1}\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('\n  RR CARS · Hojalatería y Pintura');
  console.log('  ---------------------------------');
  console.log(`  Servidor local: ${url}`);
  console.log('  Detén el servidor con Ctrl+C\n');
  if (OPEN) openBrowser(url);
});

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? { file: 'cmd', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { file: 'open', args: [url] }
      : { file: 'xdg-open', args: [url] };
  try {
    const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Si no se puede abrir automáticamente, el usuario puede copiar la URL.
  }
}

process.on('SIGINT', () => {
  console.log('\nServidor detenido.');
  server.close(() => process.exit(0));
});
