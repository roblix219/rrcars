/* ============================================================
   RR CARS · Panel de administrador: configuración, respaldos y PWA
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatDateTime, formatBytes, isValidEmail, isValidPhone,
  applyTheme, getStoredTheme, setFieldError, clearFieldErrors, passwordIssues,
  todayISO, APP_VERSION,
} from '../core/utils.js';
import { loadingBlock, toast, toastError, confirmDialog, setButtonLoading, bindPasswordMeter } from '../core/ui.js';
import { updateAccount, changePassword, getSessionInfo, SESSION_DURATION_TEXT } from '../core/auth.js';
import {
  downloadBackup, readBackupFile, inspectBackup, restoreBackup, getLastBackupAt,
} from '../core/backup.js';
import { getStorageEstimate, requestPersistentStorage, getDatabaseSummary, deleteDatabase } from '../core/db.js';
import { isStandalone, canInstall, pwaState } from '../core/pwa.js';
import { handleInstallClick } from '../core/install.js';
import { getRoute } from '../core/router.js';
import { pageHead } from './partials.js';

export async function renderAdminSettings(root, ctx) {
  const route = getRoute();
  const activeSection = route.query.get('section') || 'perfil';
  let storage = { usage: 0, quota: 0 };
  let summary = { users: 0, vehicles: 0, orders: 0, photos: 0, events: 0 };
  let lastBackup = null;
  let persistent = false;
  let includePhotos = true;

  root.innerHTML = loadingBlock('Cargando configuración…');

  try {
    [storage, summary, lastBackup] = await Promise.all([
      getStorageEstimate(),
      getDatabaseSummary(),
      getLastBackupAt(),
    ]);
    persistent = Boolean(await navigator.storage?.persisted?.());
  } catch (error) {
    toastError(error);
    root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    return;
  }

  const user = ctx.user;
  const session = getSessionInfo();
  const usagePercent = storage.quota ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0;
  const usedByPhotosApprox = summary.photos * 0; // se recalcula abajo si hay datos

  root.innerHTML = `
    ${pageHead({
      eyebrow: 'Configuración',
      title: 'Ajustes del sistema',
      subtitle: 'Administra tu cuenta, seguridad, respaldos, preferencias y la instalación de la aplicación.',
      actions: `<button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>`,
    })}

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Secciones de configuración">
        <a href="#perfil" data-settings-link="perfil" class="${activeSection === 'perfil' ? 'active' : ''}">${icon('user', 16)} Perfil</a>
        <a href="#seguridad" data-settings-link="seguridad" class="${activeSection === 'seguridad' ? 'active' : ''}">${icon('lock', 16)} Seguridad</a>
        <a href="#preferencias" data-settings-link="preferencias" class="${activeSection === 'preferencias' ? 'active' : ''}">${icon('palette', 16)} Preferencias</a>
        <a href="#respaldo" data-settings-link="respaldo" class="${activeSection === 'respaldo' ? 'active' : ''}">${icon('database', 16)} Respaldos</a>
        <a href="#pwa" data-settings-link="pwa" class="${activeSection === 'pwa' ? 'active' : ''}">${icon('install', 16)} Instalación</a>
        <a href="#limites" data-settings-link="limites" class="${activeSection === 'limites' ? 'active' : ''}">${icon('shield', 16)} Seguridad local</a>
        <a href="#acerca" data-settings-link="acerca" class="${activeSection === 'acerca' ? 'active' : ''}">${icon('info', 16)} Acerca de</a>
        <a href="#peligro" data-settings-link="peligro" class="${activeSection === 'peligro' ? 'active' : ''}" style="color:var(--red)">${icon('alertTriangle', 16)} Zona de riesgo</a>
      </nav>

      <div class="settings-content">
        <!-- PERFIL -->
        <section id="perfil" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('user', 19)}</div>
            <div><h2>Perfil del administrador</h2><p>Datos de la única cuenta con control total del taller.</p></div>
          </div>
          <div class="settings-body">
            <form id="profile-form" class="col" style="gap:16px" novalidate>
              <div class="form-grid">
                <div class="field">
                  <label for="set-name">Nombre completo <span class="req">*</span></label>
                  <input class="input" id="set-name" name="name" maxlength="90" value="${escapeHtml(user.name)}" autocomplete="name" />
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="set-phone">Teléfono del taller</label>
                  <input class="input" id="set-phone" name="phone" maxlength="30" value="${escapeHtml(user.phone || '')}" autocomplete="tel" />
                  <span class="error-text"></span>
                </div>
                <div class="field span-2">
                  <label for="set-email">Correo de acceso <span class="req">*</span></label>
                  <input class="input" id="set-email" name="email" type="email" maxlength="120" value="${escapeHtml(user.email)}" autocomplete="username" />
                  <span class="hint">Es el correo con el que inicias sesión. Si lo cambias, úsalo la próxima vez.</span>
                  <span class="error-text"></span>
                </div>
              </div>
              <div class="row" style="justify-content:flex-end">
                <button class="btn btn-primary" type="submit" data-profile-save>${icon('save', 16)} Guardar perfil</button>
              </div>
            </form>
          </div>
        </section>

        <!-- SEGURIDAD -->
        <section id="seguridad" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('lock', 19)}</div>
            <div><h2>Contraseña y sesión</h2><p>La contraseña se guarda con hash PBKDF2-SHA256; nunca en texto plano.</p></div>
          </div>
          <div class="settings-body col" style="gap:18px">
            <div class="info-list">
              <div class="info-row"><span class="k">Sesión iniciada</span><span class="v">${session ? formatDateTime(session.issuedAt) : '—'}</span></div>
              <div class="info-row"><span class="k">Expira</span><span class="v">${session ? formatDateTime(session.expiresAt) : '—'}</span></div>
              <div class="info-row"><span class="k">Duración configurada</span><span class="v">${escapeHtml(SESSION_DURATION_TEXT)}</span></div>
              <div class="info-row"><span class="k">Cuenta</span><span class="v">Administrador único</span></div>
            </div>
            <form id="password-form" class="col" style="gap:14px;border-top:1px solid var(--border);padding-top:18px" novalidate>
              <div class="form-grid">
                <div class="field span-2">
                  <label for="pw-current">Contraseña actual <span class="req">*</span></label>
                  <input class="input" id="pw-current" name="current" type="password" autocomplete="current-password" />
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="pw-new">Nueva contraseña <span class="req">*</span></label>
                  <input class="input" id="pw-new" name="next" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" />
                  <div class="pw-meter" data-pw-meter><span></span><span></span><span></span><span></span></div>
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="pw-confirm">Confirmar nueva contraseña <span class="req">*</span></label>
                  <input class="input" id="pw-confirm" name="confirm" type="password" autocomplete="new-password" />
                  <span class="error-text"></span>
                </div>
              </div>
              <div class="row" style="justify-content:flex-end">
                <button class="btn btn-primary" type="submit" data-pw-save>${icon('key', 16)} Cambiar contraseña</button>
              </div>
            </form>
          </div>
        </section>

        <!-- PREFERENCIAS -->
        <section id="preferencias" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('palette', 19)}</div>
            <div><h2>Apariencia</h2><p>Elige el tema visual de RR CARS. La preferencia se guarda en este navegador.</p></div>
          </div>
          <div class="settings-body">
            <div class="field-label">Tema de la interfaz</div>
            <div class="segmented" role="group" aria-label="Tema">
              <button type="button" data-theme-set="dark" class="${getStoredTheme() === 'dark' ? 'active' : ''}">${icon('moon', 14)} Oscuro</button>
              <button type="button" data-theme-set="light" class="${getStoredTheme() === 'light' ? 'active' : ''}">${icon('sun', 14)} Claro</button>
            </div>
            <p class="hint mt-2">El tema también puede cambiarse desde el botón de la barra superior o la pantalla de acceso.</p>
          </div>
        </section>

        <!-- RESPALDO -->
        <section id="respaldo" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('database', 19)}</div>
            <div><h2>Respaldo y restauración</h2><p>Los datos viven únicamente en este equipo. Exporta un JSON con frecuencia.</p></div>
          </div>
          <div class="settings-body col" style="gap:16px">
            <div class="info-list">
              <div class="info-row"><span class="k">Último respaldo</span><span class="v ${lastBackup ? '' : 'text-red'}">${lastBackup ? formatDateTime(lastBackup) : 'Nunca generado'}</span></div>
              <div class="info-row"><span class="k">Clientes y usuarios</span><span class="v">${summary.users}</span></div>
              <div class="info-row"><span class="k">Vehículos</span><span class="v">${summary.vehicles}</span></div>
              <div class="info-row"><span class="k">Órdenes</span><span class="v">${summary.orders}</span></div>
              <div class="info-row"><span class="k">Fotografías</span><span class="v">${summary.photos}</span></div>
              <div class="info-row"><span class="k">Movimientos de historial</span><span class="v">${summary.events}</span></div>
            </div>

            <div>
              <div class="field-label">Almacenamiento del navegador</div>
              <div class="progress storage-bar"><span style="width:${usagePercent}%"></span></div>
              <div class="storage-meta">
                <span>${formatBytes(storage.usage)} usados${storage.quota ? ` de ${formatBytes(storage.quota)}` : ''}</span>
                <span>${persistent ? 'Almacenamiento persistente concedido' : 'Almacenamiento no persistente'}</span>
              </div>
              ${!persistent ? `<button class="btn btn-sm btn-outline mt-2" type="button" data-persist>${icon('shield', 14)} Solicitar almacenamiento persistente</button>` : ''}
            </div>

            <label class="checkbox">
              <input type="checkbox" id="include-photos" ${includePhotos ? 'checked' : ''} />
              <span>Incluir fotografías en el respaldo</span>
            </label>

            <div class="backup-actions">
              <button class="btn btn-primary" type="button" data-backup>${icon('download', 16)} Descargar respaldo JSON</button>
              <button class="btn btn-outline" type="button" data-restore>${icon('upload', 16)} Restaurar desde archivo</button>
              <input type="file" id="restore-input" accept="application/json,.json" style="display:none" />
            </div>

            <div class="backup-hint">
              ${icon('info', 16)}
              <div>El respaldo incluye usuarios (con contraseñas protegidas por hash), vehículos, órdenes, costos, fotografías y bitácora. Guárdalo en un lugar seguro fuera de este equipo. Restaurar un respaldo reemplaza <strong>toda</strong> la información actual.</div>
            </div>
            <div class="backup-hint">
              ${icon('alertTriangle', 16)}
              <div>No edites el archivo JSON ni compartas respaldos con terceros: contienen información personal de tus clientes y hashes de contraseñas. Se recomienda respaldar al menos una vez por semana.</div>
            </div>
          </div>
        </section>

        <!-- PWA -->
        <section id="pwa" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('install', 19)}</div>
            <div><h2>Instalación en Windows</h2><p>Convierte RR CARS en una aplicación de escritorio y úsala sin conexión.</p></div>
          </div>
          <div class="settings-body">
            <div class="install-card">
              <div class="install-ico">${icon('install', 22)}</div>
              <div class="install-text">
                <h4>${isStandalone() ? 'RR CARS está instalada' : canInstall() ? 'Lista para instalar en este equipo' : 'Instala desde Chrome o Edge'}</h4>
                <p>${isStandalone() ? 'La estás usando como aplicación instalada.' : 'Se creará un acceso directo en el escritorio y menú de Windows. Requiere localhost o HTTPS.'}</p>
              </div>
              <button class="btn ${isStandalone() ? 'btn-outline' : 'btn-primary'}" type="button" data-install>${icon('install', 16)} ${isStandalone() ? 'Ver estado' : 'Instalar aplicación'}</button>
            </div>
            <div class="info-list mt-2">
              <div class="info-row"><span class="k">Modo de ejecución</span><span class="v">${isStandalone() ? 'Aplicación instalada (standalone)' : 'Navegador'}</span></div>
              <div class="info-row"><span class="k">Service Worker</span><span class="v">${pwaState.registration ? 'Activo · soporte sin conexión' : 'Registrando o no disponible'}</span></div>
              <div class="info-row"><span class="k">Actualización pendiente</span><span class="v">${pwaState.updateAvailable ? 'Sí, cierra y vuelve a abrir' : 'No'}</span></div>
            </div>
          </div>
        </section>

        <!-- LÍMITES -->
        <section id="limites" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('shield', 19)}</div>
            <div><h2>Seguridad y limitaciones del almacenamiento local</h2><p>Importante para entender el alcance real de la protección.</p></div>
          </div>
          <div class="settings-body">
            <div class="limit-list">
              <div class="limit-item">${icon('alertTriangle', 17)}<div><strong>No es un servidor:</strong> toda la información vive en IndexedDB dentro de este navegador. No hay sincronización entre equipos ni respaldo automático en la nube.</div></div>
              <div class="limit-item">${icon('alertTriangle', 17)}<div><strong>El control de roles es local:</strong> las sesiones, contraseñas y permisos protegen la interfaz, pero una persona con acceso físico al equipo y conocimientos técnicos (DevTools, edición de IndexedDB o del código) podría alterar los datos o saltarse restricciones. No uses esta app para información que exija seguridad de grado bancario.</div></div>
              <div class="limit-item">${icon('alertTriangle', 17)}<div><strong>Borrar datos del navegador elimina el taller:</strong> si se limpia el almacenamiento de Chrome, se usa modo incógnito o se reinstala el navegador, la base de datos puede perderse. Mantén respaldos JSON actualizados.</div></div>
              <div class="limit-item">${icon('alertTriangle', 17)}<div><strong>Las contraseñas están protegidas, no cifradas de extremo a extremo:</strong> se usa PBKDF2-SHA256 con sal aleatoria, pero el resto de los datos se guarda sin cifrar en el equipo.</div></div>
              <div class="limit-item">${icon('checkCircle', 17)}<div><strong>Recomendaciones:</strong> usa una cuenta de Windows protegida, bloquea el equipo al ausentarte, no compartas el usuario administrador y genera respaldos semanales en una unidad externa.</div></div>
              <div class="limit-item">${icon('info', 17)}<div><strong>Para seguridad real multiusuario</strong> se necesitaría un backend con autenticación centralizada, base de datos remota y control de acceso del lado del servidor. Esta versión está diseñada para operar el taller en un solo equipo de confianza.</div></div>
            </div>
          </div>
        </section>

        <!-- ACERCA DE -->
        <section id="acerca" class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('info', 19)}</div>
            <div><h2>Acerca de RR CARS</h2><p>Sistema local de gestión para taller de hojalatería y pintura.</p></div>
          </div>
          <div class="settings-body">
            <div class="about-brand">
              <span class="brand-mark">RR</span>
              <div>
                <h3>RR CARS</h3>
                <p>Hojalatería &amp; Pintura · Versión ${escapeHtml(APP_VERSION)}</p>
              </div>
            </div>
            <div class="info-list">
              <div class="info-row"><span class="k">Tecnologías</span><span class="v">HTML5 · CSS3 · JavaScript (ES Modules)</span></div>
              <div class="info-row"><span class="k">Base de datos</span><span class="v">IndexedDB (rrcars_db)</span></div>
              <div class="info-row"><span class="k">Preferencias</span><span class="v">localStorage</span></div>
              <div class="info-row"><span class="k">Funcionamiento</span><span class="v">100% local, sin servidor ni dependencias</span></div>
              <div class="info-row"><span class="k">Fecha del sistema</span><span class="v">${formatDate(todayISO())}</span></div>
            </div>
          </div>
        </section>

        <!-- PELIGRO -->
        <section id="peligro" class="card danger-zone">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('alertTriangle', 19)}</div>
            <div><h2>Zona de riesgo</h2><p>Acciones irreversibles sobre la base de datos local.</p></div>
          </div>
          <div class="settings-body col" style="gap:14px">
            <div class="alert alert-danger">
              ${icon('alertTriangle', 18)}
              <div><strong>Reiniciar la aplicación borra todo.</strong> Se eliminarán el administrador, clientes, vehículos, órdenes, fotografías, historial y configuración de este navegador. La app volverá a la pantalla de configuración inicial.</div>
            </div>
            <div class="backup-actions">
              <button class="btn btn-outline" type="button" data-backup-first>${icon('download', 16)} Descargar respaldo antes de reiniciar</button>
              <button class="btn btn-danger" type="button" data-reset>${icon('trash', 16)} Reiniciar RR CARS</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  bind();
  if (activeSection) scrollToSection(activeSection);
  void usedByPhotosApprox;

  function scrollToSection(id) {
    const target = root.querySelector(`#${id}`);
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function bind() {
    root.querySelector('[data-refresh]')?.addEventListener('click', () => ctx.refresh());

    root.querySelectorAll('[data-settings-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        root.querySelectorAll('[data-settings-link]').forEach((l) => l.classList.toggle('active', l === link));
        scrollToSection(link.dataset.settingsLink);
      });
    });

    root.querySelectorAll('[data-theme-set]').forEach((button) => {
      button.addEventListener('click', () => {
        applyTheme(button.dataset.themeSet);
        root.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.toggle('active', b === button));
      });
    });

    // Perfil
    const profileForm = root.querySelector('#profile-form');
    profileForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors(profileForm);
      const save = profileForm.querySelector('[data-profile-save]');
      const fd = new FormData(profileForm);
      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      let valid = true;
      if (name.length < 3) { setFieldError(profileForm.elements.name, 'Escribe el nombre completo.'); valid = false; }
      if (!isValidEmail(email)) { setFieldError(profileForm.elements.email, 'Escribe un correo válido.'); valid = false; }
      if (phone && !isValidPhone(phone)) { setFieldError(profileForm.elements.phone, 'El teléfono debe tener al menos 10 dígitos.'); valid = false; }
      if (!valid) return;
      try {
        setButtonLoading(save, true);
        await updateAccount(user.id, { name, email, phone });
        toast('Perfil actualizado correctamente.', { type: 'success' });
        await ctx.refresh();
      } catch (error) {
        setButtonLoading(save, false);
        toastError(error);
      }
    });

    // Contraseña
    const passwordForm = root.querySelector('#password-form');
    const meter = root.querySelector('[data-pw-meter]');
    bindPasswordMeter(passwordForm?.elements.next, meter);
    passwordForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors(passwordForm);
      const save = passwordForm.querySelector('[data-pw-save]');
      const fd = new FormData(passwordForm);
      const current = String(fd.get('current') || '');
      const next = String(fd.get('next') || '');
      const confirm = String(fd.get('confirm') || '');
      let valid = true;
      if (!current) { setFieldError(passwordForm.elements.current, 'Escribe tu contraseña actual.'); valid = false; }
      const issues = passwordIssues(next);
      if (issues.length) { setFieldError(passwordForm.elements.next, `La nueva contraseña debe tener ${issues.join(', ')}.`); valid = false; }
      if (next !== confirm) { setFieldError(passwordForm.elements.confirm, 'Las contraseñas no coinciden.'); valid = false; }
      if (next && next === current) { setFieldError(passwordForm.elements.next, 'La nueva contraseña debe ser diferente a la actual.'); valid = false; }
      if (!valid) return;
      try {
        setButtonLoading(save, true);
        await changePassword(user.id, current, next);
        passwordForm.reset();
        meter?.setAttribute('data-score', '0');
        toast('Contraseña actualizada. Úsala en tu próximo inicio de sesión.', { type: 'success' });
      } catch (error) {
        setButtonLoading(save, false);
        toastError(error);
      }
    });

    // Respaldos
    root.querySelector('#include-photos')?.addEventListener('change', (event) => {
      includePhotos = event.target.checked;
    });
    root.querySelector('[data-backup]')?.addEventListener('click', doBackup);
    root.querySelector('[data-backup-first]')?.addEventListener('click', doBackup);

    async function doBackup() {
      try {
        const result = await downloadBackup({ includePhotos });
        lastBackup = new Date().toISOString();
        toast(`Respaldo descargado: ${result.counts.users} usuario(s), ${result.counts.orders} orden(es) y ${result.counts.photos} fotografía(s).`, { type: 'success', duration: 7000 });
        const row = root.querySelector('#respaldo .info-row .v');
        if (row) row.textContent = formatDateTime(lastBackup);
        if (row) row.classList.remove('text-red');
      } catch (error) {
        toastError(error);
      }
    }

    root.querySelector('[data-persist]')?.addEventListener('click', async () => {
      try {
        const granted = await requestPersistentStorage();
        persistent = granted;
        if (granted) toast('El navegador concedió almacenamiento persistente para RR CARS.', { type: 'success' });
        else toast('El navegador no concedió almacenamiento persistente. Instala la app y mantén respaldos frecuentes.', { type: 'warning', duration: 6000 });
        ctx.refresh();
      } catch (error) {
        toastError(error);
      }
    });

    const restoreInput = root.querySelector('#restore-input');
    root.querySelector('[data-restore]')?.addEventListener('click', () => restoreInput?.click());
    restoreInput?.addEventListener('change', async () => {
      const file = restoreInput.files?.[0];
      restoreInput.value = '';
      if (!file) return;
      let parsed;
      let summaryData;
      try {
        parsed = await readBackupFile(file);
        summaryData = inspectBackup(parsed);
      } catch (error) {
        toastError(error);
        return;
      }
      const ok = await confirmDialog({
        title: 'Restaurar respaldo',
        message: 'Se reemplazará <strong>toda la información actual</strong> de RR CARS por el contenido del archivo. Se cerrará tu sesión al finalizar.',
        details: `
          <div class="col" style="gap:4px">
            <div><strong>Archivo:</strong> ${escapeHtml(file.name)}</div>
            <div><strong>Administrador del respaldo:</strong> ${escapeHtml(summaryData.admin.name)} · ${escapeHtml(summaryData.admin.email)}</div>
            <div><strong>Exportado:</strong> ${summaryData.exportedAt ? escapeHtml(formatDateTime(summaryData.exportedAt)) : 'Fecha desconocida'}</div>
            <div><strong>Contenido:</strong> ${summaryData.counts.clients} cliente(s), ${summaryData.counts.vehicles} vehículo(s), ${summaryData.counts.orders} orden(es), ${summaryData.counts.photos} foto(s), ${summaryData.counts.events} movimiento(s).</div>
            ${summaryData.includePhotos ? '' : '<div style="color:var(--amber)">El respaldo no incluye fotografías.</div>'}
          </div>`,
        confirmText: 'Restaurar y reemplazar todo',
        danger: true,
        requireText: 'RESTAURAR',
        requireLabel: 'Escribe RESTAURAR para confirmar',
      });
      if (!ok) return;
      try {
        await restoreBackup(parsed);
        toast('Respaldo restaurado correctamente. Inicia sesión con la cuenta de administrador del respaldo.', { type: 'success', duration: 8000 });
        await ctx.logout();
      } catch (error) {
        toastError(error);
      }
    });

    root.querySelector('[data-install]')?.addEventListener('click', () => handleInstallClick());

    root.querySelector('[data-reset]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Reiniciar RR CARS',
        message: 'Se eliminará <strong>permanentemente</strong> la base de datos completa de este navegador: administrador, clientes, vehículos, órdenes, fotografías, historial y configuración.',
        details: 'Asegúrate de haber descargado un respaldo JSON. La aplicación volverá al asistente de configuración inicial y no podrá recuperarse sin un respaldo.',
        confirmText: 'Borrar todo y reiniciar',
        danger: true,
        requireText: 'REINICIAR',
        requireLabel: 'Escribe REINICIAR para confirmar',
      });
      if (!ok) return;
      try {
        await deleteDatabase();
        try {
          Object.keys(localStorage)
            .filter((key) => key.startsWith('rrcars.'))
            .forEach((key) => localStorage.removeItem(key));
        } catch { /* ignore */ }
        toast('Aplicación reiniciada. Configura una nueva cuenta de administrador.', { type: 'success', duration: 7000 });
        location.hash = '#/setup';
        setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        toastError(error);
      }
    });
  }
}
