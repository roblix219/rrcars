/* ============================================================
   RR CARS · Portal del cliente: mi cuenta y preferencias
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatDateTime, isValidEmail, isValidPhone,
  passwordIssues, setFieldError, clearFieldErrors, getStoredTheme, applyTheme,
} from '../core/utils.js';
import {
  loadingBlock, toast, toastError, setButtonLoading, bindPasswordMeter,
} from '../core/ui.js';
import { updateAccount, changePassword, getSessionInfo, SESSION_DURATION_TEXT } from '../core/auth.js';
import { getClientDashboard } from '../services.js';
import { handleInstallClick } from '../core/install.js';
import { isStandalone, canInstall, pwaState } from '../core/pwa.js';
import { pageHead } from './partials.js';

export async function renderClientAccount(root, ctx) {
  root.innerHTML = loadingBlock('Cargando los datos de tu cuenta…');

  let stats = { vehicles: 0, active: 0, finished: 0, total: 0 };
  try {
    const data = await getClientDashboard(ctx.user.id);
    stats = data.stats;
  } catch (error) {
    toastError(error);
  }

  const user = ctx.user;
  const session = getSessionInfo();

  root.innerHTML = `
    ${pageHead({
      eyebrow: 'Mi cuenta',
      title: 'Datos y preferencias',
      subtitle: 'Actualiza tu información de contacto, cambia tu contraseña y revisa la seguridad de tu cuenta.',
      actions: `<button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>`,
    })}

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Secciones de mi cuenta">
        <a href="#perfil" class="active">${icon('user', 16)} Perfil</a>
        <a href="#seguridad">${icon('lock', 16)} Seguridad</a>
        <a href="#preferencias">${icon('palette', 16)} Apariencia</a>
        <a href="#app">${icon('install', 16)} Instalación</a>
        <a href="#privacidad">${icon('shield', 16)} Privacidad</a>
      </nav>

      <div class="settings-content">
        <section class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('user', 19)}</div>
            <div><h2>Datos personales</h2><p>Esta información es visible para el taller al gestionar tus órdenes.</p></div>
          </div>
          <div class="settings-body">
            <div class="row" style="gap:14px;margin-bottom:18px;flex-wrap:wrap">
              <span class="avatar accent" style="width:46px;height:46px;font-size:1rem">${escapeHtml((user.name || 'RR').slice(0, 2).toUpperCase())}</span>
              <div style="flex:1;min-width:150px">
                <div class="strong">${escapeHtml(user.name)}</div>
                <div class="tiny muted">${escapeHtml(user.email)}</div>
              </div>
              <span class="badge badge-active">Cuenta autorizada</span>
            </div>

            <div class="info-list" style="margin-bottom:18px">
              <div class="info-row"><span class="k">Miembro desde</span><span class="v">${formatDate(user.createdAt)}</span></div>
              <div class="info-row"><span class="k">Vehículos registrados</span><span class="v">${stats.vehicles}</span></div>
              <div class="info-row"><span class="k">Órdenes activas</span><span class="v">${stats.active}</span></div>
              <div class="info-row"><span class="k">Órdenes concluidas</span><span class="v">${stats.finished}</span></div>
            </div>

            <form id="client-profile-form" class="col" style="gap:16px;border-top:1px solid var(--border);padding-top:18px" novalidate>
              <div class="form-grid">
                <div class="field">
                  <label for="acc-name">Nombre completo <span class="req">*</span></label>
                  <input class="input" id="acc-name" name="name" maxlength="90" value="${escapeHtml(user.name)}" autocomplete="name" />
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="acc-phone">Teléfono <span class="req">*</span></label>
                  <input class="input" id="acc-phone" name="phone" type="tel" maxlength="30" value="${escapeHtml(user.phone || '')}" autocomplete="tel" />
                  <span class="error-text"></span>
                </div>
                <div class="field span-2">
                  <label for="acc-email">Correo electrónico <span class="req">*</span></label>
                  <input class="input" id="acc-email" name="email" type="email" maxlength="120" value="${escapeHtml(user.email)}" autocomplete="username" />
                  <span class="hint">Es el correo con el que inicias sesión. Si lo cambias, úsalo la próxima vez.</span>
                  <span class="error-text"></span>
                </div>
              </div>
              <div class="row" style="justify-content:flex-end">
                <button class="btn btn-primary" type="submit" data-profile-save>${icon('save', 16)} Guardar cambios</button>
              </div>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('lock', 19)}</div>
            <div><h2>Contraseña y sesión</h2><p>Tu contraseña se almacena con hash PBKDF2-SHA256 en este equipo; nunca en texto plano.</p></div>
          </div>
          <div class="settings-body col" style="gap:18px">
            <div class="info-list">
              <div class="info-row"><span class="k">Sesión iniciada</span><span class="v">${session ? formatDateTime(session.issuedAt) : '—'}</span></div>
              <div class="info-row"><span class="k">Expira</span><span class="v">${session ? formatDateTime(session.expiresAt) : '—'}</span></div>
              <div class="info-row"><span class="k">Duración configurada</span><span class="v">${escapeHtml(SESSION_DURATION_TEXT)}</span></div>
              <div class="info-row"><span class="k">Tipo de cuenta</span><span class="v">Cliente del taller</span></div>
            </div>
            <form id="client-password-form" class="col" style="gap:14px;border-top:1px solid var(--border);padding-top:18px" novalidate>
              <div class="form-grid">
                <div class="field span-2">
                  <label for="acc-current">Contraseña actual <span class="req">*</span></label>
                  <input class="input" id="acc-current" name="current" type="password" autocomplete="current-password" />
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="acc-new">Nueva contraseña <span class="req">*</span></label>
                  <input class="input" id="acc-new" name="next" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" />
                  <div class="pw-meter" data-pw-meter><span></span><span></span><span></span><span></span></div>
                  <span class="error-text"></span>
                </div>
                <div class="field">
                  <label for="acc-confirm">Confirmar nueva contraseña <span class="req">*</span></label>
                  <input class="input" id="acc-confirm" name="confirm" type="password" autocomplete="new-password" />
                  <span class="error-text"></span>
                </div>
              </div>
              <div class="row" style="justify-content:flex-end">
                <button class="btn btn-primary" type="submit" data-pw-save>${icon('key', 16)} Cambiar contraseña</button>
              </div>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('palette', 19)}</div>
            <div><h2>Apariencia</h2><p>Elige el tema visual del portal. La preferencia se guarda únicamente en este navegador.</p></div>
          </div>
          <div class="settings-body">
            <div class="field-label">Tema de la interfaz</div>
            <div class="segmented" role="group" aria-label="Tema">
              <button type="button" data-theme-set="dark" class="${getStoredTheme() === 'dark' ? 'active' : ''}">${icon('moon', 14)} Oscuro</button>
              <button type="button" data-theme-set="light" class="${getStoredTheme() === 'light' ? 'active' : ''}">${icon('sun', 14)} Claro</button>
            </div>
            <p class="hint mt-2">El tema también puede cambiarse desde el botón de la barra superior.</p>
          </div>
        </section>

        <section class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('install', 19)}</div>
            <div><h2>Instalar RR CARS</h2><p>Accede a tu portal como aplicación de escritorio en Windows.</p></div>
          </div>
          <div class="settings-body">
            <div class="install-card">
              <div class="install-ico">${icon('install', 22)}</div>
              <div class="install-text">
                <h4>${isStandalone() ? 'RR CARS está instalada' : canInstall() ? 'Lista para instalar en este equipo' : 'Instala desde Chrome o Edge'}</h4>
                <p>${isStandalone() ? 'La estás usando como aplicación instalada.' : 'Se creará un acceso directo en el escritorio. Requiere localhost o HTTPS.'}</p>
              </div>
              <button class="btn ${isStandalone() ? 'btn-outline' : 'btn-primary'}" type="button" data-install>${icon('install', 16)} ${isStandalone() ? 'Ver estado' : 'Instalar aplicación'}</button>
            </div>
            <div class="info-list mt-2">
              <div class="info-row"><span class="k">Modo de ejecución</span><span class="v">${isStandalone() ? 'Aplicación instalada' : 'Navegador'}</span></div>
              <div class="info-row"><span class="k">Soporte sin conexión</span><span class="v">${pwaState.registration ? 'Service Worker activo' : 'No disponible'}</span></div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="settings-card-head">
            <div class="settings-ico">${icon('shield', 19)}</div>
            <div><h2>Privacidad y seguridad local</h2><p>Información importante sobre dónde viven tus datos.</p></div>
          </div>
          <div class="settings-body">
            <div class="limit-list">
              <div class="limit-item">${icon('shield', 17)}<div><strong>Solo tú puedes ver tu información.</strong> El portal muestra únicamente tus vehículos, órdenes, costos y fotografías. El taller administra el resto.</div></div>
              <div class="limit-item">${icon('database', 17)}<div><strong>Datos locales.</strong> La información se guarda en IndexedDB dentro del navegador de este equipo. No se sincroniza automáticamente con otros dispositivos ni con la nube.</div></div>
              <div class="limit-item">${icon('alertTriangle', 17)}<div><strong>Alcance de la protección.</strong> La contraseña y la sesión protegen la interfaz, pero una persona con acceso físico al equipo y conocimientos técnicos podría alterar el almacenamiento local. No compartas tu contraseña ni dejes tu sesión abierta en equipos ajenos.</div></div>
              <div class="limit-item">${icon('info', 17)}<div><strong>Corrección de datos.</strong> Puedes actualizar tu nombre, teléfono y correo desde esta pantalla. Para eliminar tu cuenta o tus vehículos, contacta al administrador del taller.</div></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  bind();
  void ctx;
  void loadingBlock;

  function bind() {
    root.querySelectorAll('[data-theme-set]').forEach((button) => {
      button.addEventListener('click', () => {
        applyTheme(button.dataset.themeSet);
        root.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.toggle('active', b.dataset.themeSet === button.dataset.themeSet));
      });
    });
    root.querySelectorAll('[data-install]').forEach((button) => {
      button.addEventListener('click', () => handleInstallClick());
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', () => ctx.refresh());

    root.querySelectorAll('.settings-nav a').forEach((link) => {
      link.addEventListener('click', () => {
        root.querySelectorAll('.settings-nav a').forEach((a) => a.classList.toggle('active', a === link));
      });
    });

    const profileForm = root.querySelector('#client-profile-form');
    profileForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors(profileForm);
      const fd = new FormData(profileForm);
      const name = String(fd.get('name') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      let valid = true;

      if (name.length < 3) { setFieldError(profileForm.elements.name, 'Escribe tu nombre completo.'); valid = false; }
      if (!isValidPhone(phone)) { setFieldError(profileForm.elements.phone, 'Escribe un teléfono de al menos 10 dígitos.'); valid = false; }
      if (!isValidEmail(email)) { setFieldError(profileForm.elements.email, 'Escribe un correo válido.'); valid = false; }
      if (!valid) {
        profileForm.querySelector('.field.invalid .input')?.focus();
        return;
      }

      const button = profileForm.querySelector('[data-profile-save]');
      try {
        setButtonLoading(button, true);
        await updateAccount(ctx.user.id, { name, phone, email });
        toast('Tus datos se actualizaron correctamente.', { type: 'success' });
        await ctx.refresh();
      } catch (error) {
        setButtonLoading(button, false);
        if (/correo|email/i.test(error.message)) setFieldError(profileForm.elements.email, error.message);
        toastError(error);
      }
    });

    const passwordForm = root.querySelector('#client-password-form');
    bindPasswordMeter(passwordForm?.elements.next, root.querySelector('[data-pw-meter]'));
    passwordForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors(passwordForm);
      const fd = new FormData(passwordForm);
      const current = String(fd.get('current') || '');
      const next = String(fd.get('next') || '');
      const confirm = String(fd.get('confirm') || '');
      let valid = true;

      if (!current) { setFieldError(passwordForm.elements.current, 'Escribe tu contraseña actual.'); valid = false; }
      const issues = passwordIssues(next);
      if (issues.length) { setFieldError(passwordForm.elements.next, `La contraseña debe tener ${issues.join(', ')}.`); valid = false; }
      if (next !== confirm) { setFieldError(passwordForm.elements.confirm, 'Las contraseñas no coinciden.'); valid = false; }
      if (!valid) return;

      const button = passwordForm.querySelector('[data-pw-save]');
      try {
        setButtonLoading(button, true);
        await changePassword(ctx.user.id, current, next);
        toast('Tu contraseña se actualizó correctamente.', { type: 'success' });
        passwordForm.reset();
        setButtonLoading(button, false);
      } catch (error) {
        setButtonLoading(button, false);
        if (/actual/i.test(error.message)) setFieldError(passwordForm.elements.current, error.message);
        toastError(error);
      }
    });
  }
}
