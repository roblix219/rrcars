/* ============================================================
   RR CARS · Service Worker
   ------------------------------------------------------------
   Estrategia:
   - App shell (HTML/CSS/JS/iconos): caché primero, con
     actualización en segundo plano.
   - Navegación: red primero y respaldo en caché para funcionar
     completamente sin conexión.
   - No se cachean respuestas externas ni solicitudes no-GET.
   ============================================================ */

const VERSION = '1.0.0';
const CACHE_NAME = `rrcars-shell-v${VERSION}`;

const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/views.css',
  './js/app.js',
  './js/services.js',
  './js/core/auth.js',
  './js/core/backup.js',
  './js/core/charts.js',
  './js/core/constants.js',
  './js/core/crypto.js',
  './js/core/db.js',
  './js/core/export.js',
  './js/core/icons.js',
  './js/core/install.js',
  './js/core/pdf.js',
  './js/core/pwa.js',
  './js/core/router.js',
  './js/core/ui.js',
  './js/core/utils.js',
  './js/views/admin-clients.js',
  './js/views/admin-dashboard.js',
  './js/views/admin-history.js',
  './js/views/admin-order-detail.js',
  './js/views/admin-orders.js',
  './js/views/admin-reports.js',
  './js/views/admin-settings.js',
  './js/views/admin-vehicles.js',
  './js/views/auth-views.js',
  './js/views/client-account.js',
  './js/views/client-dashboard.js',
  './js/views/client-history.js',
  './js/views/client-order-detail.js',
  './js/views/client-orders.js',
  './js/views/client-vehicles.js',
  './js/views/order-modal.js',
  './js/views/partials.js',
  './js/views/vehicle-modal.js',
  './icons/favicon.svg',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .catch((error) => {
        console.warn('RR CARS SW: no se pudo precachear todo el shell:', error);
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('rrcars-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('./index.html') || await cache.match('./');
    if (shell) return shell;
    return new Response(
      '<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>RR CARS</title>'
      + '<body style="background:#0b0d10;color:#eef1f5;font-family:Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0">'
      + '<div style="text-align:center"><h1>RR CARS</h1><p>Sin conexión y sin copia local disponible.</p>'
      + '<p style="color:#96a1b1">Abre la aplicación al menos una vez con conexión para habilitar el modo offline.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // Actualiza en segundo plano sin bloquear la respuesta.
    fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Recurso no disponible sin conexión.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
