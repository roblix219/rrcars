/* ============================================================
   RR CARS · Vistas de autenticación: configuración inicial,
   inicio de sesión, registro de clientes y estado de cuenta
   ============================================================ */

import {
  escapeHtml, isValidEmail, isValidPhone, passwordIssues, setFieldError,
  clearFieldErrors, formatDate, getStoredTheme, applyTheme,
} from '../core/utils.js';
import { icon } from '../core/icons.js';
import {
  createAdmin, login, registerClient, isSetupComplete, getLockStatus,
} from '../core/auth.js';
import {
  toast, toastError, setButtonLoading, bindPasswordMeter, openModal, confirmDialog,
} from '../core/ui.js';
import { CLIENT_STATUS_META } from '../core/constants.js';
import { navigate } from '../core/router.js';
import { handleInstallClick, canInstall } from '../core/install.js';

/* ---------- Estructura visual compartida ---------- */
function authChrome() {
  return `
    <div class="auth-panel-top">
      <button class="btn-icon btn-ghost theme-toggle" type="button" data-theme-toggle aria-label="Cambiar tema" title="Cambiar tema">
        ${icon('sun', 18, 'sun')}${icon('moon', 18, 'moon')}
      </button>
      <button class="btn btn-outline btn-sm ${canInstall() ? '' : 'hidden'}" type="button" data-install>
        ${icon('install', 16)} Instalar app
      </button>
    </div>
  `;
}

function brandPanel() {
  return `
    <aside class="auth-brand">
      <div class="auth-brand-top">
        <a class="brand" href="#/login">
          <span class="brand-mark">RR</span>
          <span class="brand-text"><strong>RR CARS</strong><small>Hojalatería &amp; Pintura</small></span>
        </a>
        <span class="chip">${icon('shield', 13)} Gestión local</span>
      </div>

      <div class="auth-hero">
        <div class="auth-eyebrow">Taller de precisión automotriz</div>
        <h1>Tu taller,<br /><span class="accent-line">bajo control.</span></h1>
        <p>Gestión profesional de vehículos, órdenes de reparación, costos y evidencia fotográfica.
           Transparencia para tus clientes, control total para tu taller.</p>
        <div class="auth-features">
          <div class="auth-feature">${icon('clipboard', 18)}<div><strong>Órdenes con folio</strong><span>Seguimiento de cada reparación paso a paso.</span></div></div>
          <div class="auth-feature">${icon('camera', 18)}<div><strong>Evidencia visual</strong><span>Fotografías de avance visibles para el cliente.</span></div></div>
          <div class="auth-feature">${icon('chart', 18)}<div><strong>Costos claros</strong><span>Cotizaciones y totales calculados al instante.</span></div></div>
          <div class="auth-feature">${icon('database', 18)}<div><strong>Datos persistentes</strong><span>Guardados localmente e instalables en Windows.</span></div></div>
        </div>
      </div>

      <div class="auth-brand-foot">
        <span class="status-dot">Sistema listo para trabajar sin conexión</span>
        <span>RR CARS · v1.0</span>
      </div>
    </aside>
  `;
}

function authShell({ title, subtitle, body, footer = '', mobileBrand = true }) {
  return `
    <div class="auth">
      ${brandPanel()}
      <section class="auth-panel">
        ${authChrome()}
        <div class="auth-panel-inner">
          ${mobileBrand ? `
            <div class="auth-brand-mobile">
              <span class="brand">
                <span class="brand-mark sm">RR</span>
                <span class="brand-text"><strong>RR CARS</strong><small>Hojalatería &amp; Pintura</small></span>
              </span>
              <button class="btn-icon btn-ghost theme-toggle" type="button" data-theme-toggle aria-label="Cambiar tema">
                ${icon('sun', 18, 'sun')}${icon('moon', 18, 'moon')}
              </button>
            </div>` : ''}
          <h1 class="auth-panel-title">${escapeHtml(title)}</h1>
          <p class="auth-panel-sub">${subtitle}</p>
          ${body}
          ${footer}
        </div>
        <div class="auth-foot">Diseñado para talleres que buscan orden, claridad y resultados.</div>
      </section>
    </div>
  `;
}

/* ---------- Comportamiento común ---------- */
function bindAuthChrome(root) {
  root.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
    });
  });
  root.querySelectorAll('[data-install]').forEach((button) => {
    button.addEventListener('click', () => handleInstallClick());
  });
  root.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.closest('.input-group')?.querySelector('input');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.innerHTML = icon(show ? 'eye' : 'lock', 16);
      button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
  // El botón de instalación se muestra cuando Chrome lo permite.
  if (canInstall()) root.querySelectorAll('[data-install]').forEach((b) => b.classList.remove('hidden'));
  window.addEventListener('rrcars:installable', (event) => {
    if (!document.body.contains(root)) return;
    root.querySelectorAll('[data-install]').forEach((button) => button.classList.toggle('hidden', !event.detail));
  }, { once: false });
}

function passwordToggleButton() {
  return `<button class="btn-icon btn-ghost" type="button" data-toggle-password aria-label="Mostrar contraseña" style="color:var(--muted-2)">${icon('lock', 16)}</button>`;
}

function showTerms() {
  openModal({
    title: 'Aviso de privacidad y uso',
    size: 'lg',
    body: `
      <div class="col" style="gap:14px;font-size:0.86rem;line-height:1.65;color:var(--text-2)">
        <p><strong style="color:var(--text)">RR CARS</strong> es un sistema de gestión local para el taller. Los datos que registres
        (nombre, correo, teléfono, vehículos y órdenes) se almacenan únicamente en la base de datos del navegador de este equipo.</p>
        <p>La información no se envía a servidores externos ni se comparte con terceros desde esta aplicación. El respaldo de los
        datos es responsabilidad del administrador del taller.</p>
        <p>El acceso de los clientes requiere autorización del administrador. El cliente solo puede consultar sus propios vehículos,
        órdenes, costos y fotografías.</p>
        <p>Puedes solicitar al taller la corrección o eliminación de tus datos. Al usar esta aplicación aceptas que la información
        se conserve localmente para la operación del servicio.</p>
        <div class="alert alert-warning">${icon('alertTriangle', 17)}<div>Este sistema no sustituye un contrato de servicio ni una factura fiscal. Los costos registrados son de control interno.</div></div>
      </div>
    `,
    footer: '<button class="btn btn-primary" type="button" data-close>Entendido</button>',
    onMount: (modal, close) => modal.querySelector('[data-close]').addEventListener('click', close),
  });
}

/* ============================================================
   CONFIGURACIÓN INICIAL DEL ADMINISTRADOR
   ============================================================ */
export async function renderSetup(root, ctx) {
  if (await isSetupComplete()) {
    navigate(ctx.user ? (ctx.user.role === 'admin' ? '/admin/dashboard' : '/cliente') : '/login', { replace: true });
    return;
  }
  document.title = 'Configuración inicial · RR CARS';

  root.innerHTML = authShell({
    title: 'Configura tu cuenta de administrador',
    subtitle: 'Esta es la única cuenta con control total del sistema. Se crea una sola vez, sin formulario público de registro.',
    body: `
      <div class="setup-steps" aria-hidden="true"><span class="active"></span><span></span><span></span></div>
      <div class="alert alert-warning" style="margin-bottom:18px">
        ${icon('shield', 18)}
        <div><strong>Cuenta única e irremplazable.</strong> No existirá un registro de administradores. Guarda tu correo y contraseña y
        realiza respaldos frecuentes; no hay recuperación automática de contraseña sin acceso a la cuenta.</div>
      </div>
      <form class="auth-form" id="setup-form" novalidate>
        <div class="field">
          <label for="setup-name">Nombre completo <span class="req">*</span></label>
          <input class="input" id="setup-name" name="name" autocomplete="name" maxlength="90" placeholder="Nombre del propietario" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="setup-email">Correo electrónico <span class="req">*</span></label>
          <div class="input-group">
            ${icon('mail', 17)}
            <input class="input" id="setup-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="admin@rrcars.mx" />
          </div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="setup-phone">Teléfono del taller</label>
          <div class="input-group">
            ${icon('phone', 17)}
            <input class="input" id="setup-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="Opcional" />
          </div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="setup-password">Contraseña <span class="req">*</span></label>
          <div class="input-group">
            ${icon('lock', 17)}
            <input class="input" id="setup-password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" />
            ${passwordToggleButton()}
          </div>
          <div class="pw-meter" data-pw-meter><span></span><span></span><span></span><span></span></div>
          <span class="hint">Se almacena con hash PBKDF2-SHA256. Nunca se guarda en texto plano.</span>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="setup-confirm">Confirmar contraseña <span class="req">*</span></label>
          <input class="input" id="setup-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repite la contraseña" />
          <span class="error-text"></span>
        </div>
        <label class="checkbox">
          <input type="checkbox" name="ack" />
          <span>Entiendo que esta cuenta se crea una sola vez y que soy responsable de resguardar la contraseña y los respaldos de la información.</span>
        </label>
        <span class="hint" data-ack-error style="color:var(--red);display:none">Debes confirmar que entiendes esta responsabilidad.</span>
        <button class="btn btn-primary btn-lg btn-block" type="submit">
          ${icon('shield', 18)} Crear cuenta de administrador
        </button>
      </form>
    `,
    footer: `
      <div class="auth-switch">
        ¿Ya configuraste el sistema? <button class="link" type="button" data-go-login>Iniciar sesión</button>
      </div>
    `,
  });

  bindAuthChrome(root);
  const form = root.querySelector('#setup-form');
  const meter = root.querySelector('[data-pw-meter]');
  bindPasswordMeter(form.elements.password, meter);
  root.querySelector('[data-go-login]').addEventListener('click', () => navigate('/login'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm') || '');
    let valid = true;

    if (name.length < 3) { setFieldError(form.elements.name, 'Escribe el nombre completo.'); valid = false; }
    if (!isValidEmail(email)) { setFieldError(form.elements.email, 'Escribe un correo válido.'); valid = false; }
    if (phone && !isValidPhone(phone)) { setFieldError(form.elements.phone, 'El teléfono debe tener al menos 10 dígitos.'); valid = false; }
    const issues = passwordIssues(password);
    if (issues.length) { setFieldError(form.elements.password, `La contraseña debe tener ${issues.join(', ')}.`); valid = false; }
    if (password !== confirm) { setFieldError(form.elements.confirm, 'Las contraseñas no coinciden.'); valid = false; }
    if (!fd.get('ack')) {
      root.querySelector('[data-ack-error]').style.display = 'block';
      valid = false;
    }
    if (!valid) {
      form.querySelector('.field.invalid .input')?.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    try {
      setButtonLoading(button, true);
      await createAdmin({ name, email, phone, password });
      toast('Cuenta de administrador creada. Bienvenido a RR CARS.', { type: 'success' });
      navigate('/admin/dashboard');
    } catch (error) {
      setButtonLoading(button, false);
      if (/correo|email/i.test(error.message)) setFieldError(form.elements.email, error.message);
      toastError(error);
    }
  });
}

/* ============================================================
   INICIAR SESIÓN
   ============================================================ */
export async function renderLogin(root, ctx) {
  if (ctx.user) {
    navigate(ctx.user.role === 'admin' ? '/admin/dashboard' : '/cliente', { replace: true });
    return;
  }
  document.title = 'Iniciar sesión · RR CARS';

  root.innerHTML = authShell({
    title: 'Bienvenido de nuevo',
    subtitle: 'Accede a tu panel para dar seguimiento a tus vehículos y reparaciones.',
    body: `
      <div class="auth-tabs" role="tablist">
        <button type="button" class="active" role="tab" aria-selected="true">Iniciar sesión</button>
        <button type="button" role="tab" aria-selected="false" data-go-register>Crear cuenta</button>
      </div>
      <form class="auth-form" id="login-form" novalidate>
        <div class="field">
          <label for="login-email">Correo electrónico <span class="req">*</span></label>
          <div class="input-group">
            ${icon('mail', 17)}
            <input class="input" id="login-email" name="email" type="email" autocomplete="username" placeholder="tu@correo.com" maxlength="120" />
          </div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="login-password">Contraseña <span class="req">*</span></label>
          <div class="input-group">
            ${icon('lock', 17)}
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" />
            ${passwordToggleButton()}
          </div>
          <span class="error-text"></span>
        </div>
        <div class="row-between">
          <label class="checkbox" style="font-size:0.8rem">
            <input type="checkbox" name="remember" checked />
            <span>Mantener sesión iniciada</span>
          </label>
          <span class="tiny muted">Sesión segura en este equipo</span>
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('logout', 17)} Entrar a RR CARS</button>
      </form>
    `,
    footer: `
      <div class="auth-switch">
        ¿Aún no tienes cuenta? <button class="link" type="button" data-go-register>Regístrate como cliente</button>
      </div>
      <p class="tiny muted" style="margin-top:14px;line-height:1.5">
        Las cuentas nuevas de clientes quedan pendientes de autorización del administrador del taller.
      </p>
    `,
  });

  bindAuthChrome(root);
  root.querySelectorAll('[data-go-register]').forEach((b) => b.addEventListener('click', () => navigate('/register')));
  const form = root.querySelector('#login-form');

  const emailInput = form.elements.email;
  try {
    const saved = sessionStorage.getItem('rrcars.lastEmail');
    if (saved) emailInput.value = saved;
  } catch { /* sin sessionStorage */ }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const remember = Boolean(fd.get('remember'));
    let valid = true;

    if (!isValidEmail(email)) { setFieldError(emailInput, 'Escribe un correo válido.'); valid = false; }
    if (!password) { setFieldError(form.elements.password, 'Escribe tu contraseña.'); valid = false; }
    if (!valid) return;

    const lock = getLockStatus(email);
    if (lock.locked) {
      toast(`Demasiados intentos. Espera ${lock.seconds} segundos.`, { type: 'warning' });
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    try {
      setButtonLoading(button, true);
      const user = await login(email, password, { remember });
      try { sessionStorage.setItem('rrcars.lastEmail', email); } catch { /* ignore */ }
      toast(`Bienvenido${user.role === 'admin' ? ', administrador' : ''}.`, { type: 'success', title: 'Sesión iniciada' });
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/cliente');
    } catch (error) {
      setButtonLoading(button, false);
      if (/contraseña|correo/i.test(error.message)) setFieldError(form.elements.password, error.message);
      toastError(error);
    }
  });
}

/* ============================================================
   REGISTRO DE CLIENTES
   ============================================================ */
export async function renderRegister(root, ctx) {
  if (ctx.user) {
    navigate(ctx.user.role === 'admin' ? '/admin/dashboard' : '/cliente', { replace: true });
    return;
  }
  document.title = 'Crear cuenta · RR CARS';

  root.innerHTML = authShell({
    title: 'Solicita tu acceso',
    subtitle: 'Registra tus datos. El administrador del taller revisará y autorizará tu cuenta para que puedas dar seguimiento a tus reparaciones.',
    body: `
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="false" data-go-login>Iniciar sesión</button>
        <button type="button" class="active" role="tab" aria-selected="true">Crear cuenta</button>
      </div>
      <form class="auth-form" id="register-form" novalidate>
        <div class="field">
          <label for="reg-name">Nombre completo <span class="req">*</span></label>
          <input class="input" id="reg-name" name="name" autocomplete="name" maxlength="90" placeholder="Nombre y apellidos" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="reg-email">Correo electrónico <span class="req">*</span></label>
          <div class="input-group">
            ${icon('mail', 17)}
            <input class="input" id="reg-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="tu@correo.com" />
          </div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="reg-phone">Teléfono <span class="req">*</span></label>
          <div class="input-group">
            ${icon('phone', 17)}
            <input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="10 dígitos" />
          </div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="reg-password">Contraseña <span class="req">*</span></label>
          <div class="input-group">
            ${icon('lock', 17)}
            <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" />
            ${passwordToggleButton()}
          </div>
          <div class="pw-meter" data-pw-meter><span></span><span></span><span></span><span></span></div>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="reg-confirm">Confirmar contraseña <span class="req">*</span></label>
          <input class="input" id="reg-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repite la contraseña" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="reg-note">¿Qué servicio necesitas? <span class="muted tiny">(opcional)</span></label>
          <textarea class="textarea" id="reg-note" name="requestNote" maxlength="500" style="min-height:70px" placeholder="Cuéntanos brevemente sobre tu vehículo o el servicio que buscas."></textarea>
          <span class="hint">El administrador verá este mensaje al revisar tu solicitud.</span>
        </div>
        <label class="checkbox">
          <input type="checkbox" name="terms" />
          <span>Acepto el <button type="button" class="link" style="background:none;border:0;color:var(--accent-2);font-weight:600;padding:0;font-size:inherit" data-terms>aviso de privacidad y uso</button> de RR CARS.</span>
        </label>
        <span class="hint" data-terms-error style="color:var(--red);display:none">Debes aceptar el aviso para continuar.</span>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('send', 17)} Enviar solicitud de acceso</button>
      </form>
    `,
    footer: `
      <div class="auth-switch">
        ¿Ya tienes una cuenta autorizada? <button class="link" type="button" data-go-login>Inicia sesión</button>
      </div>
    `,
  });

  bindAuthChrome(root);
  root.querySelectorAll('[data-go-login]').forEach((b) => b.addEventListener('click', () => navigate('/login')));
  root.querySelector('[data-terms]').addEventListener('click', showTerms);
  const form = root.querySelector('#register-form');
  bindPasswordMeter(form.elements.password, root.querySelector('[data-pw-meter]'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm') || '');
    const requestNote = String(fd.get('requestNote') || '').trim();
    let valid = true;

    if (name.length < 3) { setFieldError(form.elements.name, 'Escribe tu nombre completo.'); valid = false; }
    if (!isValidEmail(email)) { setFieldError(form.elements.email, 'Escribe un correo válido.'); valid = false; }
    if (!isValidPhone(phone)) { setFieldError(form.elements.phone, 'Escribe un teléfono de al menos 10 dígitos.'); valid = false; }
    const issues = passwordIssues(password);
    if (issues.length) { setFieldError(form.elements.password, `La contraseña debe tener ${issues.join(', ')}.`); valid = false; }
    if (password !== confirm) { setFieldError(form.elements.confirm, 'Las contraseñas no coinciden.'); valid = false; }
    if (!fd.get('terms')) {
      root.querySelector('[data-terms-error]').style.display = 'block';
      valid = false;
    }
    if (!valid) {
      form.querySelector('.field.invalid .input')?.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    try {
      setButtonLoading(button, true);
      await registerClient({ name, email, phone, password, requestNote });
      await login(email, password, { remember: false });
      toast('Solicitud enviada. Tu cuenta está pendiente de autorización.', { type: 'success', title: 'Registro completado', duration: 6000 });
      navigate('/cliente');
    } catch (error) {
      setButtonLoading(button, false);
      if (/correo|email/i.test(error.message)) setFieldError(form.elements.email, error.message);
      toastError(error);
    }
  });
}

/* ============================================================
   PANTALLA DE ESTADO PARA CLIENTES NO AUTORIZADOS
   ============================================================ */
export function renderAccountGate(root, user, ctx) {
  const meta = CLIENT_STATUS_META[user.status] || CLIENT_STATUS_META.pending;
  const isPending = user.status === 'pending';
  document.title = `${meta.short} · RR CARS`;
  const iconName = isPending ? 'clock' : user.status === 'rejected' ? 'xCircle' : 'pause';
  const title = isPending ? 'Tu cuenta está en revisión' : meta.label;
  const message = isPending
    ? 'Recibimos tu solicitud de acceso correctamente. El administrador del taller debe autorizar tu cuenta antes de que puedas registrar vehículos y consultar órdenes. Te recomendamos conservar esta sesión abierta o volver a iniciar sesión más tarde.'
    : meta.description;

  root.innerHTML = `
    <div class="gate">
      <div class="gate-card">
        <div class="gate-icon ${user.status}">${icon(iconName, 30)}</div>
        <span class="badge ${meta.badge}" style="margin-bottom:12px">${escapeHtml(meta.label)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <div class="gate-meta">
          <div><span>Cuenta</span><strong>${escapeHtml(user.name)}</strong></div>
          <div><span>Correo</span><strong style="word-break:break-all">${escapeHtml(user.email)}</strong></div>
          <div><span>Solicitud</span><strong>${formatDate(user.createdAt)}</strong></div>
          <div><span>Teléfono</span><strong>${escapeHtml(user.phone || '—')}</strong></div>
        </div>
        ${isPending ? `<div class="alert alert-info" style="text-align:left;margin-bottom:16px">${icon('info', 17)}<div>Si el administrador ya autorizó tu cuenta, presiona <strong>Verificar de nuevo</strong> para recargar tu acceso.</div></div>` : ''}
        <div class="gate-actions">
          <button class="btn btn-primary" type="button" data-verify>${icon('refresh', 16)} Verificar de nuevo</button>
          <button class="btn btn-outline" type="button" data-logout>${icon('logout', 16)} Cerrar sesión</button>
        </div>
        <p class="tiny muted" style="margin-top:20px">RR CARS · Hojalatería y Pintura</p>
      </div>
    </div>
  `;

  const brand = document.createElement('div');
  brand.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(700px 360px at 50% 0%, rgba(255,107,26,.08), transparent 65%);z-index:-1';
  root.prepend(brand);

  root.querySelector('[data-verify]').addEventListener('click', async () => {
    const button = root.querySelector('[data-verify]');
    setButtonLoading(button, true);
    await ctx.refresh();
    if (button.isConnected) setButtonLoading(button, false);
  });
  root.querySelector('[data-logout]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Deseas cerrar la sesión de tu cuenta?',
      confirmText: 'Cerrar sesión',
      danger: false,
    });
    if (ok) await ctx.logout();
  });
}

void toast;
