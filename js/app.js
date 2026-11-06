/* ============================================================
   RR CARS · Arranque, rutas, shell y control de acceso de la UI
   ------------------------------------------------------------
   Este módulo concentra el ciclo de vida de la aplicación:
   tema, PWA, sesión, guardias por rol, navegación lateral y
   montaje de cada vista. Las vistas solo se encargan de su
   contenido y de llamar a ctx.refresh()/ctx.logout().
   ============================================================ */

import { icon } from './core/icons.js';
import {
  APP_VERSION, escapeHtml, getStoredTheme, applyTheme, initials, todayLong,
} from './core/utils.js';
import {
  isSetupComplete, getCurrentUser, logout as closeSession,
} from './core/auth.js';
import {
  toast, toastError, confirmDialog, openModal, emptyState,
  loadingBlock, routeProgress,
} from './core/ui.js';
import {
  initPWA, canInstall, applyUpdate, isStandalone, isOnline, pwaState,
} from './core/pwa.js';
import { handleInstallClick } from './core/install.js';
import { getAlerts } from './services.js';
import {
  getRoute, navigate, matchRoute, onRouteChange,
} from './core/router.js';
import { ROLES, CLIENT_STATUS } from './core/constants.js';

/* ---------- Vistas ---------- */
import { renderSetup, renderLogin, renderRegister, renderAccountGate } from './views/auth-views.js';
import { renderAdminDashboard } from './views/admin-dashboard.js';
import { renderAdminClients } from './views/admin-clients.js';
import { renderAdminVehicles } from './views/admin-vehicles.js';
import { renderAdminOrders } from './views/admin-orders.js';
import { renderAdminOrderDetail } from './views/admin-order-detail.js';
import { renderAdminHistory } from './views/admin-history.js';
import { renderAdminReports } from './views/admin-reports.js';
import { renderAdminSettings } from './views/admin-settings.js';
import { renderClientDashboard } from './views/client-dashboard.js';
import { renderClientVehicles } from './views/client-vehicles.js';
import { renderClientOrders } from './views/client-orders.js';
import { renderClientOrderDetail } from './views/client-order-detail.js';
import { renderClientHistory } from './views/client-history.js';
import { renderClientAccount } from './views/client-account.js';

/* ============================================================
   Estado del shell
   ============================================================ */
let currentUser = null;
let shellRole = null;
let renderSeq = 0;
let lastPath = '';
let updatePromptShown = false;

const appRoot = () => document.getElementById('app');

const HOME = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.CLIENT]: '/cliente',
};

/* ============================================================
   Navegación
   ============================================================ */
const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/clientes', label: 'Clientes', icon: 'users', badge: 'pending' },
  { href: '/admin/vehiculos', label: 'Vehículos', icon: 'car' },
  { href: '/admin/ordenes', label: 'Órdenes', icon: 'clipboard', badge: 'active' },
  { href: '/admin/historial', label: 'Historial', icon: 'history' },
  { href: '/admin/reportes', label: 'Reportes', icon: 'chart' },
  { href: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
];

const CLIENT_NAV = [
  { href: '/cliente', label: 'Mi panel', icon: 'dashboard' },
  { href: '/cliente/vehiculos', label: 'Mis vehículos', icon: 'car' },
  { href: '/cliente/ordenes', label: 'Mis órdenes', icon: 'clipboard', badge: 'active' },
  { href: '/cliente/historial', label: 'Historial', icon: 'history' },
  { href: '/cliente/cuenta', label: 'Mi cuenta', icon: 'user' },
];

const META = {
  '/admin/dashboard': { title: 'Dashboard', subtitle: 'Resumen operativo del taller' },
  '/admin/clientes': { title: 'Clientes', subtitle: 'Cuentas, autorizaciones y expedientes' },
  '/admin/vehiculos': { title: 'Vehículos', subtitle: 'Unidades registradas por tus clientes' },
  '/admin/ordenes': { title: 'Órdenes de reparación', subtitle: 'Seguimiento de trabajos y costos' },
  '/admin/historial': { title: 'Historial', subtitle: 'Órdenes terminadas y entregadas' },
  '/admin/reportes': { title: 'Reportes', subtitle: 'Indicadores, filtros y exportación' },
  '/admin/configuracion': { title: 'Configuración', subtitle: 'Cuenta, respaldos y aplicación' },
  '/cliente': { title: 'Mi panel', subtitle: 'Resumen de tu cuenta y reparaciones' },
  '/cliente/vehiculos': { title: 'Mis vehículos', subtitle: 'Vehículos registrados en el taller' },
  '/cliente/ordenes': { title: 'Mis órdenes', subtitle: 'Seguimiento de tus reparaciones' },
  '/cliente/historial': { title: 'Historial', subtitle: 'Servicios concluidos y entregados' },
  '/cliente/cuenta': { title: 'Mi cuenta', subtitle: 'Datos personales y preferencias' },
};

function homeFor(user) {
  return HOME[user?.role] || '/login';
}

function isActivePath(path, href) {
  if (href === '/cliente') return path === '/cliente';
  return path === href || path.startsWith(`${href}/`);
}

function navMarkup(items, path) {
  return items.map((item) => `
    <a class="nav-item ${isActivePath(path, item.href) ? 'active' : ''}" href="#${item.href}" data-nav="${item.href}">
      ${icon(item.icon, 18)}
      <span>${escapeHtml(item.label)}</span>
      ${item.badge ? `<span class="nav-badge" data-badge-${item.badge} hidden>0</span>` : ''}
    </a>
  `).join('');
}

/* ============================================================
   Shell autenticado
   ============================================================ */
function sidebarCard(user) {
  if (user.role === ROLES.ADMIN) {
    return `
      <div class="sidebar-card">
        <div class="row"><span>Clientes pendientes</span><strong data-sidebar-pending>0</strong></div>
        <div class="row"><span>Órdenes activas</span><strong data-sidebar-orders>0</strong></div>
        <div class="row"><span>Entregas vencidas</span><strong data-sidebar-overdue>0</strong></div>
        <p class="tiny" style="margin-top:9px">
          Datos guardados en este equipo.
          <a href="#/admin/configuracion?section=respaldo">Crear respaldo</a>
        </p>
      </div>
    `;
  }
  return `
    <div class="sidebar-card">
      <div class="row"><span>Órdenes activas</span><strong data-sidebar-orders>0</strong></div>
      <div class="row"><span>Cuenta</span><strong>Autorizada</strong></div>
      <p class="tiny" style="margin-top:9px">
        Consulta tus avances y fotografías cuando quieras. La información se guarda en este equipo.
      </p>
    </div>
  `;
}

function shellMarkup(user, path) {
  const isAdmin = user.role === ROLES.ADMIN;
  const nav = isAdmin ? ADMIN_NAV : CLIENT_NAV;
  const home = homeFor(user);

  return `
    <div class="app-shell" data-shell="${user.role}">
      <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
        <a class="brand" href="#${home}">
          <span class="brand-mark">RR</span>
          <span class="brand-text"><strong>RR CARS</strong><small>Hojalatería &amp; Pintura</small></span>
        </a>

        <div class="sidebar-section-label">${isAdmin ? 'Administración' : 'Mi portal'}</div>
        <nav class="nav">${navMarkup(nav, path)}</nav>

        <div class="sidebar-spacer"></div>
        ${sidebarCard(user)}
        <div class="sidebar-foot">
          <span class="conn-dot ${isOnline() ? '' : 'offline'}" data-conn>${isOnline() ? 'En línea' : 'Sin conexión'}</span>
          <span>v${escapeHtml(APP_VERSION)}</span>
        </div>
      </aside>

      <div class="sidebar-overlay" data-sidebar-overlay></div>

      <div class="app-main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="btn-icon btn-ghost menu-btn" type="button" data-menu aria-label="Abrir menú" aria-controls="sidebar">
              ${icon('menu', 20)}
            </button>
            <div class="topbar-title">
              <h1 data-topbar-title>${escapeHtml(META[path]?.title || 'RR CARS')}</h1>
              <p data-topbar-subtitle>${escapeHtml(META[path]?.subtitle || todayLong())}</p>
            </div>
          </div>

          <div class="topbar-actions">
            <button class="btn-icon btn-ghost hide-xs" type="button" data-top-refresh title="Actualizar vista" aria-label="Actualizar vista">
              ${icon('refresh', 18)}
            </button>
            ${isAdmin ? `<a class="btn btn-primary btn-sm hide-xs" href="#/admin/ordenes?nueva=1">${icon('plus', 16)} Nueva orden</a>` : ''}
            <button class="btn-icon btn-ghost theme-toggle" type="button" data-theme-toggle aria-label="Cambiar tema" title="Cambiar tema">
              ${icon('sun', 18, 'sun')}${icon('moon', 18, 'moon')}
            </button>
            <button class="btn btn-outline btn-sm hide-xs ${canInstall() ? '' : 'hidden'}" type="button" data-install-top>
              ${icon('install', 16)} Instalar
            </button>
            <div class="topbar-divider hide-xs"></div>

            <div class="dropdown" data-user-menu>
              <button class="user-chip" type="button" data-user-toggle aria-haspopup="menu" aria-expanded="false">
                <span class="avatar accent">${escapeHtml(initials(user.name))}</span>
                <span class="user-meta">
                  <span class="user-name" data-user-name>${escapeHtml(user.name)}</span>
                  <span class="user-role">${isAdmin ? 'Administrador' : 'Cliente'}</span>
                </span>
                ${icon('chevronDown', 15)}
              </button>
              <div class="dropdown-menu" data-user-dropdown role="menu" hidden>
                <div class="dropdown-head">
                  <strong style="display:block;font-size:0.84rem" data-user-name>${escapeHtml(user.name)}</strong>
                  <span class="tiny muted" style="word-break:break-all">${escapeHtml(user.email)}</span>
                </div>
                <a class="dropdown-item" role="menuitem" href="#${isAdmin ? '/admin/configuracion' : '/cliente/cuenta'}">
                  ${icon(isAdmin ? 'settings' : 'user', 16)} ${isAdmin ? 'Configuración' : 'Mi cuenta'}
                </a>
                <button class="dropdown-item" type="button" role="menuitem" data-theme-toggle>
                  ${icon('moon', 16)} Cambiar tema
                </button>
                <button class="dropdown-item" type="button" role="menuitem" data-install>
                  ${icon('install', 16)} Instalar aplicación
                </button>
                <div class="dropdown-sep"></div>
                <button class="dropdown-item danger" type="button" role="menuitem" data-logout>
                  ${icon('logout', 16)} Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        <main class="view" id="main" tabindex="-1" aria-live="polite"></main>
      </div>
    </div>
  `;
}

function ensureShell(user, path) {
  const root = appRoot();
  const existing = root.querySelector('.app-shell');
  if (!existing || shellRole !== user.role) {
    root.innerHTML = shellMarkup(user, path);
    shellRole = user.role;
    bindShellEvents();
  } else {
    updateShellUser(user);
  }
}

function updateShellUser(user) {
  const root = appRoot();
  root.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = user.name; });
}

function updateNavActive(path) {
  document.querySelectorAll('.nav-item[data-nav]').forEach((link) => {
    link.classList.toggle('active', isActivePath(path, link.dataset.nav));
  });
}

function setTopbar(title, subtitle) {
  const t = document.querySelector('[data-topbar-title]');
  const s = document.querySelector('[data-topbar-subtitle]');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle || todayLong();
  document.title = `${title} · RR CARS`;
}

let shellEventsBound = false;
function bindShellEvents() {
  if (shellEventsBound) return;
  shellEventsBound = true;

  document.addEventListener('click', (event) => {
    const target = event.target;

    // Las vistas de autenticación manejan sus propios controles de tema.
    if (!target.closest('.app-shell')) {
      closeUserMenu();
      return;
    }

    if (target.closest('[data-menu]')) {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.querySelector('[data-sidebar-overlay]')?.classList.toggle('open');
      return;
    }
    if (target.closest('[data-sidebar-overlay]')) {
      closeSidebar();
      return;
    }
    if (target.closest('.nav-item')) {
      closeSidebar();
    }

    const themeButton = target.closest('[data-theme-toggle]');
    if (themeButton) {
      event.preventDefault();
      applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
      return;
    }

    if (target.closest('[data-install], [data-install-top]')) {
      event.preventDefault();
      closeUserMenu();
      handleInstallClick();
      return;
    }

    if (target.closest('[data-top-refresh]')) {
      event.preventDefault();
      refreshRoute();
      return;
    }

    if (target.closest('[data-logout]')) {
      event.preventDefault();
      closeUserMenu();
      confirmLogout();
      return;
    }

    const userToggle = target.closest('[data-user-toggle]');
    if (userToggle) {
      event.preventDefault();
      const menu = document.querySelector('[data-user-dropdown]');
      const open = menu?.hasAttribute('hidden');
      if (open) openUserMenu();
      else closeUserMenu();
      return;
    }

    const menuLink = target.closest('[data-user-menu] a');
    if (menuLink) closeUserMenu();

    if (!target.closest('[data-user-menu]')) closeUserMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeUserMenu();
  });

  window.addEventListener('rrcars:installable', refreshInstallButtons);
  window.addEventListener('rrcars:installed', () => {
    toast('RR CARS se instaló correctamente en este equipo.', { type: 'success', title: 'Aplicación instalada' });
    refreshInstallButtons();
  });
  window.addEventListener('rrcars:connection', (event) => {
    const dot = document.querySelector('[data-conn]');
    if (dot) {
      dot.classList.toggle('offline', !event.detail);
      dot.textContent = event.detail ? 'En línea' : 'Sin conexión';
    }
    toast(event.detail ? 'Conexión restablecida.' : 'Sin conexión. RR CARS sigue funcionando localmente.', {
      type: event.detail ? 'success' : 'warning',
    });
  });
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('[data-sidebar-overlay]')?.classList.remove('open');
}

function openUserMenu() {
  const menu = document.querySelector('[data-user-dropdown]');
  const toggle = document.querySelector('[data-user-toggle]');
  menu?.removeAttribute('hidden');
  toggle?.setAttribute('aria-expanded', 'true');
}

function closeUserMenu() {
  const menu = document.querySelector('[data-user-dropdown]');
  const toggle = document.querySelector('[data-user-toggle]');
  if (menu && !menu.hasAttribute('hidden')) menu.setAttribute('hidden', '');
  toggle?.setAttribute('aria-expanded', 'false');
}

function refreshInstallButtons() {
  const show = canInstall();
  document.querySelectorAll('[data-install-top]').forEach((button) => button.classList.toggle('hidden', !show));
}

/* ============================================================
   Alertas / badges
   ============================================================ */
function setBadge(el, value) {
  if (!el) return;
  el.textContent = value > 99 ? '99+' : String(value || 0);
  el.hidden = !value;
}

async function updateAlerts() {
  try {
    const alerts = await getAlerts();
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    setBadge(shell.querySelector('[data-badge-pending]'), alerts.pendingClients);
    setBadge(shell.querySelector('[data-badge-active]'), alerts.activeOrders);

    const pending = shell.querySelector('[data-sidebar-pending]');
    const orders = shell.querySelector('[data-sidebar-orders]');
    const overdue = shell.querySelector('[data-sidebar-overdue]');
    if (pending) pending.textContent = String(alerts.pendingClients);
    if (orders) orders.textContent = String(alerts.activeOrders);
    if (overdue) overdue.textContent = String(alerts.overdue);
  } catch (error) {
    console.warn('No se pudieron actualizar las alertas:', error);
  }
}

/* ============================================================
   Contexto para las vistas
   ============================================================ */
function buildContext(user) {
  return {
    user,
    refresh: refreshRoute,
    logout: performLogout,
  };
}

async function refreshRoute() {
  currentUser = await getCurrentUser();
  await renderRoute();
}

async function performLogout() {
  try {
    await closeSession();
  } finally {
    currentUser = null;
    shellRole = null;
    toast('Tu sesión se cerró correctamente.', { type: 'info', title: 'Hasta pronto' });
    navigate('/login', { replace: true });
  }
}

async function confirmLogout() {
  const ok = await confirmDialog({
    title: 'Cerrar sesión',
    message: '¿Deseas cerrar la sesión actual? Tus datos permanecerán guardados en este equipo.',
    confirmText: 'Cerrar sesión',
    danger: false,
  });
  if (ok) await performLogout();
}

/* ============================================================
   Rutas
   ============================================================ */
function routeMeta(path) {
  if (matchRoute('/admin/ordenes/:id', path)) {
    return { title: 'Detalle de orden', subtitle: 'Seguimiento completo de la reparación' };
  }
  if (matchRoute('/cliente/ordenes/:id', path)) {
    return { title: 'Detalle de orden', subtitle: 'Avance, costos y fotografías de tu reparación' };
  }
  return META[path] || { title: 'RR CARS', subtitle: todayLong() };
}

function notFoundMarkup(user) {
  return emptyState({
    iconName: 'search',
    title: 'Página no encontrada',
    text: 'La ruta que buscas no existe o cambió de ubicación.',
    action: `<a class="btn btn-primary" href="#${homeFor(user)}">${icon('arrowLeft', 16)} Volver al inicio</a>`,
  });
}

async function renderAuth(view, ctx) {
  shellRole = null;
  await view(appRoot(), ctx);
}

async function renderRoute() {
  const seq = ++renderSeq;
  const { path, query } = getRoute();

  routeProgress(true);

  try {
    const setupDone = await isSetupComplete();
    if (seq !== renderSeq) return;
    currentUser = await getCurrentUser();
    if (seq !== renderSeq) return;
    const ctx = buildContext(currentUser);

    /* --- Configuración inicial --- */
    if (!setupDone) {
      if (path !== '/setup') {
        navigate('/setup', { replace: true });
        return;
      }
      await renderAuth(renderSetup, ctx);
      return;
    }

    if (path === '/setup') {
      navigate(currentUser ? homeFor(currentUser) : '/login', { replace: true });
      return;
    }

    /* --- Rutas públicas --- */
    if (path === '/login' || path === '/register') {
      if (currentUser) {
        navigate(homeFor(currentUser), { replace: true });
        return;
      }
      await renderAuth(path === '/login' ? renderLogin : renderRegister, ctx);
      return;
    }

    /* --- Sesión obligatoria --- */
    if (!currentUser) {
      navigate('/login', { replace: true });
      return;
    }

    /* --- Redirección de la raíz --- */
    if (path === '/') {
      navigate(homeFor(currentUser), { replace: true });
      return;
    }

    /* --- Guardias por rol --- */
    if (path.startsWith('/admin') && currentUser.role !== ROLES.ADMIN) {
      navigate(homeFor(currentUser), { replace: true });
      return;
    }
    if (path.startsWith('/cliente') && currentUser.role !== ROLES.CLIENT) {
      navigate(homeFor(currentUser), { replace: true });
      return;
    }

    /* --- Clientes pendientes / rechazados / suspendidos --- */
    if (currentUser.role === ROLES.CLIENT && currentUser.status !== CLIENT_STATUS.ACTIVE) {
      renderAccountGate(appRoot(), currentUser, ctx);
      return;
    }

    /* --- Shell autenticado --- */
    ensureShell(currentUser, path);
    updateNavActive(path);
    setTopbar(routeMeta(path).title, routeMeta(path).subtitle);
    routeProgress(false, true);
    updateAlerts();
    refreshInstallButtons();

    if (path !== lastPath) {
      closeSidebar();
      closeUserMenu();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    lastPath = path;

    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = loadingBlock('Cargando información…');

    await dispatchView(path, query, main, ctx);
  } catch (error) {
    console.error(error);
    toastError(error, 'No se pudo cargar la aplicación.');
    const main = document.getElementById('main');
    const root = appRoot();
    if (main) {
      main.innerHTML = `
        <div class="alert alert-danger">
          ${icon('alertCircle', 19)}
          <div>
            <strong>No se pudo cargar esta sección.</strong>
            <div style="margin-top:4px">${escapeHtml(error?.message || 'Error inesperado.')}</div>
          </div>
        </div>
        <div style="margin-top:14px">
          <button class="btn btn-outline" type="button" data-retry>${icon('refresh', 16)} Reintentar</button>
        </div>`;
      main.querySelector('[data-retry]')?.addEventListener('click', () => refreshRoute());
    } else {
      root.innerHTML = `
        <div class="gate">
          <div class="gate-card">
            <div class="gate-icon rejected">${icon('alertTriangle', 30)}</div>
            <h1>No se pudo iniciar RR CARS</h1>
            <p>${escapeHtml(error?.message || 'Ocurrió un error inesperado al abrir la base de datos local.')}</p>
            <div class="gate-actions">
              <button class="btn btn-primary" type="button" onclick="location.reload()">${icon('refresh', 16)} Reintentar</button>
            </div>
          </div>
        </div>`;
    }
  } finally {
    if (seq === renderSeq) routeProgress(false, true);
  }
}

async function dispatchView(path, query, main, ctx) {
  let params = null;

  if (path === '/admin/dashboard') return renderAdminDashboard(main, ctx);
  if (path === '/admin/clientes') return renderAdminClients(main, ctx);
  if (path === '/admin/vehiculos') return renderAdminVehicles(main, ctx);
  if (path === '/admin/ordenes') return renderAdminOrders(main, ctx);
  if ((params = matchRoute('/admin/ordenes/:id', path))) return renderAdminOrderDetail(main, ctx, params);
  if (path === '/admin/historial') return renderAdminHistory(main, ctx);
  if (path === '/admin/reportes') return renderAdminReports(main, ctx);
  if (path === '/admin/configuracion') return renderAdminSettings(main, ctx);

  if (path === '/cliente') return renderClientDashboard(main, ctx);
  if (path === '/cliente/vehiculos') return renderClientVehicles(main, ctx);
  if (path === '/cliente/ordenes') return renderClientOrders(main, ctx);
  if ((params = matchRoute('/cliente/ordenes/:id', path))) return renderClientOrderDetail(main, ctx, params);
  if (path === '/cliente/historial') return renderClientHistory(main, ctx);
  if (path === '/cliente/cuenta') return renderClientAccount(main, ctx);

  main.innerHTML = notFoundMarkup(currentUser);
  void query;

  const title = document.querySelector('[data-topbar-title]');
  if (title) title.textContent = 'Página no encontrada';
  document.title = 'Página no encontrada · RR CARS';
}

/* ============================================================
   PWA · Actualización disponible
   ============================================================ */
function showUpdatePrompt() {
  if (updatePromptShown) return;
  updatePromptShown = true;
  openModal({
    title: 'Nueva versión disponible',
    size: 'sm',
    body: `
      <div class="col" style="gap:14px;font-size:0.88rem;line-height:1.6;color:var(--text-2)">
        <div class="row gap-12">
          <div style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-2);flex:0 0 auto">
            ${icon('download', 20)}
          </div>
          <p>Hay una actualización de RR CARS lista para instalarse. Tus datos locales no se perderán.</p>
        </div>
        <div class="note-box">Puedes actualizar ahora o continuar trabajando; la nueva versión se aplicará la próxima vez que abras la app.</div>
      </div>
    `,
    footer: `
      <button class="btn" type="button" data-later>Más tarde</button>
      <button class="btn btn-primary" type="button" data-update>${icon('refresh', 16)} Actualizar ahora</button>
    `,
    onMount: (modal, close) => {
      modal.querySelector('[data-later]').addEventListener('click', close);
      modal.querySelector('[data-update]').addEventListener('click', () => {
        close();
        applyUpdate();
      });
    },
  });
}

/* ============================================================
   Arranque
   ============================================================ */
function boot() {
  applyTheme(getStoredTheme());

  initPWA({
    onUpdateAvailable: () => {
      showUpdatePrompt();
    },
  });

  window.addEventListener('rrcars:theme', () => {
    refreshInstallButtons();
  });

  if (isStandalone() && !sessionStorage.getItem('rrcars.standaloneNotified')) {
    try { sessionStorage.setItem('rrcars.standaloneNotified', '1'); } catch { /* ignore */ }
    setTimeout(() => {
      toast('RR CARS se está ejecutando como aplicación instalada. Funciona sin conexión.', {
        type: 'success', title: 'Modo aplicación', duration: 5500,
      });
    }, 900);
  }

  onRouteChange(() => { renderRoute(); });

  window.addEventListener('online', refreshInstallButtons);
  window.addEventListener('offline', refreshInstallButtons);

  if (!pwaState.installed) {
    console.info('RR CARS · Consejo: instala la app desde Chrome para abrirla como aplicación de Windows.');
  }
}

boot();
