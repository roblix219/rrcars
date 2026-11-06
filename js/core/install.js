/* ============================================================
   RR CARS · Instalación de la PWA desde Chrome / Edge
   ============================================================ */

import { openModal, toast } from './ui.js';
import { icon } from './icons.js';
import { canInstall, promptInstall, isStandalone } from './pwa.js';

export { canInstall };

export async function handleInstallClick() {
  if (isStandalone()) {
    toast('RR CARS ya está abierta como aplicación instalada.', { type: 'info' });
    return;
  }
  if (canInstall()) {
    try {
      const choice = await promptInstall();
      if (choice.outcome === 'accepted') {
        toast('Instalación iniciada. Busca el acceso directo de RR CARS en el menú de Windows.', { type: 'success', duration: 6000 });
      } else {
        toast('Puedes instalar RR CARS más tarde desde el menú de Chrome.', { type: 'info' });
      }
    } catch (error) {
      toast('No se pudo abrir el instalador. Intenta desde el menú de Chrome.', { type: 'warning' });
      console.warn(error);
    }
    return;
  }
  showInstallHelp();
}

export function showInstallHelp() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  openModal({
    title: 'Instalar RR CARS en Windows',
    subtitle: 'Conviértela en una aplicación de escritorio con acceso directo.',
    size: 'lg',
    body: `
      <div class="col" style="gap:16px;font-size:0.87rem;line-height:1.6;color:var(--text-2)">
        ${!secure ? `
          <div class="alert alert-warning">${icon('alertTriangle', 17)}<div>
            La instalación PWA requiere abrir la app desde <strong>http://localhost</strong> o HTTPS.
            Si abriste el archivo con doble clic (file://), inicia un servidor local primero.
          </div></div>` : ''}
        <div>
          <h4 style="margin-bottom:6px">Desde Google Chrome</h4>
          <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:5px">
            <li>Verifica que la barra de direcciones muestre <strong>localhost</strong> (no file://).</li>
            <li>Haz clic en el ícono de <strong>instalación</strong> (monitor con flecha) en la barra de direcciones.</li>
            <li>Si no aparece, abre el menú <strong>⋮</strong> → <strong>Transmitir, guardar y compartir</strong> → <strong>Instalar RR CARS</strong>.</li>
            <li>Confirma con <strong>Instalar</strong>. Se creará un acceso directo en el escritorio y menú de Windows.</li>
          </ol>
        </div>
        <div>
          <h4 style="margin-bottom:6px">Desde Microsoft Edge</h4>
          <p>Menú <strong>…</strong> → <strong>Aplicaciones</strong> → <strong>Instalar este sitio como aplicación</strong>.</p>
        </div>
        <div class="alert alert-info">${icon('info', 17)}<div>
          La app funciona sin conexión una vez cargada. Los datos se guardan en el almacenamiento local del navegador,
          por lo que la instalación no crea una base de datos “en la nube”. Realiza respaldos JSON con frecuencia.
        </div></div>
      </div>
    `,
    footer: '<button class="btn btn-primary" type="button" data-close>Entendido</button>',
    onMount: (modal, close) => modal.querySelector('[data-close]').addEventListener('click', close),
  });
}
