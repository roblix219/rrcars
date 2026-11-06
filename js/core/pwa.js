/* ============================================================
   RR CARS · Soporte PWA: instalación, service worker y conexión
   ============================================================ */

export const pwaState = {
  installPrompt: null,
  registration: null,
  updateAvailable: false,
  installed: false,
  offlineReady: false,
};

let updateCallback = null;
let refreshing = false;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.startsWith('android-app://');
}

export function isOnline() {
  return navigator.onLine !== false;
}

export function initPWA({ onUpdateAvailable } = {}) {
  updateCallback = onUpdateAvailable || null;
  pwaState.installed = isStandalone();

  // Instalación desde Chrome / Edge
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pwaState.installPrompt = event;
    window.dispatchEvent(new CustomEvent('rrcars:installable', { detail: true }));
  });

  window.addEventListener('appinstalled', () => {
    pwaState.installPrompt = null;
    pwaState.installed = true;
    window.dispatchEvent(new CustomEvent('rrcars:installed'));
  });

  window.addEventListener('online', () => window.dispatchEvent(new CustomEvent('rrcars:connection', { detail: true })));
  window.addEventListener('offline', () => window.dispatchEvent(new CustomEvent('rrcars:connection', { detail: false })));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        pwaState.registration = registration;
        pwaState.offlineReady = true;
        window.dispatchEvent(new CustomEvent('rrcars:pwa-ready'));

        const notifyUpdate = () => {
          pwaState.updateAvailable = true;
          updateCallback?.();
          window.dispatchEvent(new CustomEvent('rrcars:update-available'));
        };

        if (registration.waiting && navigator.serviceWorker.controller) notifyUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
          });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        registration.update().catch(() => {});
      } catch (error) {
        console.warn('Service Worker no disponible:', error);
      }
    });
  }
}

export async function promptInstall() {
  if (!pwaState.installPrompt) {
    return { outcome: 'unavailable' };
  }
  const prompt = pwaState.installPrompt;
  pwaState.installPrompt = null;
  prompt.prompt();
  const choice = await prompt.userChoice;
  window.dispatchEvent(new CustomEvent('rrcars:installable', { detail: false }));
  return choice;
}

export function applyUpdate() {
  const waiting = pwaState.registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function canInstall() {
  return Boolean(pwaState.installPrompt) && !pwaState.installed;
}
