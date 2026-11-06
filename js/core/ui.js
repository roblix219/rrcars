/* ============================================================
   RR CARS · Interfaz: notificaciones, modales, confirmaciones,
   loaders, badges, stepper y lightbox de fotografías
   ============================================================ */

import { icon } from './icons.js';
import { escapeHtml, initials } from './utils.js';
import { CLIENT_STATUS_META, ORDER_STATUS_MAP, ORDER_STATUSES } from './constants.js';

/* ---------- Toasts ---------- */
const TOAST_ICONS = {
  success: 'checkCircle',
  error: 'alertCircle',
  warning: 'alertTriangle',
  info: 'info',
};

export function toast(message, { type = 'info', title = '', duration = 4200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return () => {};
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="toast-icon">${icon(TOAST_ICONS[type] || 'info', 19)}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title || defaultTitle(type))}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" type="button" aria-label="Cerrar notificación">${icon('x', 15)}</button>
  `;
  root.appendChild(el);

  let timer = null;
  const dismiss = () => {
    if (!el.isConnected) return;
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector('.toast-close').addEventListener('click', dismiss);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

function defaultTitle(type) {
  return {
    success: 'Listo',
    error: 'Ocurrió un error',
    warning: 'Atención',
    info: 'Información',
  }[type] || 'Información';
}

export function toastError(error, fallback = 'No se pudo completar la operación.') {
  const message = error?.message || fallback;
  toast(message, { type: 'error', title: 'No se pudo completar', duration: 6000 });
  if (error) console.error(error);
}

/* ---------- Modales ---------- */
const modalStack = [];

export function openModal({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  size = '',
  onMount = null,
  onClose = null,
  closeOnBackdrop = true,
  closeOnEsc = true,
} = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.dataset.modal = 'true';
  const titleId = `modal-title-${Date.now()}`;
  backdrop.innerHTML = `
    <div class="modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : size === 'sm' ? 'modal-sm' : ''}"
         role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-header">
        <div class="modal-heading">
          <h2 id="${titleId}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal-sub">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="modal-close" type="button" aria-label="Cerrar">${icon('x', 19)}</button>
      </div>
      <div class="modal-body modal-scroll">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;
  root.appendChild(backdrop);
  document.body.classList.add('modal-open');
  const previousFocus = document.activeElement;
  const modal = backdrop.querySelector('.modal');

  const close = () => {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    const idx = modalStack.indexOf(handle);
    if (idx >= 0) modalStack.splice(idx, 1);
    if (modalStack.length === 0) document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeydown);
    try { onClose?.(); } catch (error) { console.error(error); }
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };

  const onKeydown = (event) => {
    if (modalStack[modalStack.length - 1] !== handle) return;
    if (event.key === 'Escape' && closeOnEsc) {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const handle = { close, element: backdrop, modal };
  modalStack.push(handle);
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close();
    });
  }
  document.addEventListener('keydown', onKeydown);

  try { onMount?.(modal, close); } catch (error) { console.error(error); }

  requestAnimationFrame(() => {
    const autoFocus = modal.querySelector('[autofocus]');
    const target = autoFocus || modal.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary, button.btn-danger, button');
    target?.focus({ preventScroll: true });
  });

  return handle;
}

/* ---------- Confirmaciones ---------- */
export function confirmDialog({
  title = '¿Confirmar acción?',
  message = '',
  details = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  requireText = '',
  requireLabel = '',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value, closeFn) => {
      if (settled) return;
      settled = true;
      closeFn();
      resolve(value);
    };
    const handle = openModal({
      title,
      size: 'sm',
      body: `
        <div class="col" style="gap:14px">
          <div class="row top gap-12">
            <div style="width:38px;height:38px;flex:0 0 auto;border-radius:10px;display:grid;place-items:center;background:${danger ? 'var(--red-soft)' : 'var(--accent-soft)'};color:${danger ? 'var(--red)' : 'var(--accent-2)'}">
              ${icon(danger ? 'alertTriangle' : 'alertCircle', 20)}
            </div>
            <div style="font-size:0.88rem;line-height:1.6;color:var(--text-2)">${message}</div>
          </div>
          ${details ? `<div class="note-box">${details}</div>` : ''}
          ${requireText ? `
            <div class="field">
              <label for="confirm-text-input">${escapeHtml(requireLabel || `Escribe “${requireText}” para confirmar`)}</label>
              <input class="input" id="confirm-text-input" autocomplete="off" placeholder="${escapeHtml(requireText)}" />
              <span class="hint">Esta acción es irreversible sin un respaldo.</span>
            </div>` : ''}
        </div>
      `,
      footer: `
        <button type="button" class="btn" data-cancel>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm ${requireText ? 'disabled' : ''}>
          ${escapeHtml(confirmText)}
        </button>
      `,
      onMount: (modal, close) => {
        const confirmBtn = modal.querySelector('[data-confirm]');
        const cancelBtn = modal.querySelector('[data-cancel]');
        const textInput = modal.querySelector('#confirm-text-input');
        cancelBtn.addEventListener('click', () => finish(false, close));
        confirmBtn.addEventListener('click', () => finish(true, close));
        if (textInput) {
          textInput.addEventListener('input', () => {
            confirmBtn.disabled = textInput.value.trim() !== requireText;
          });
          textInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && textInput.value.trim() === requireText) {
              event.preventDefault();
              finish(true, close);
            }
          });
        }
      },
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
        void handle;
      },
    });
  });
}

/* ---------- Botones / cargas ---------- */
export function setButtonLoading(button, loading = true, loadingText = '') {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.classList.add('is-loading');
    button.disabled = true;
    if (loadingText) button.setAttribute('aria-label', loadingText);
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function loadingBlock(message = 'Cargando…') {
  return `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(message)}</span></div>`;
}

export function errorBlock(message, retry = true) {
  return `
    <div class="empty-state">
      <div class="empty-icon" style="color:var(--red);background:var(--red-soft);border-color:rgba(255,93,93,.25)">${icon('alertTriangle', 26)}</div>
      <h3>No se pudo cargar la información</h3>
      <p>${escapeHtml(message)}</p>
      ${retry ? '<button class="btn btn-outline" type="button" onclick="location.reload()">Reintentar</button>' : ''}
    </div>
  `;
}

/* ---------- Badges ---------- */
export function clientStatusBadge(status) {
  const meta = CLIENT_STATUS_META[status] || { short: status || '—', badge: 'badge-suspended' };
  return `<span class="badge ${meta.badge}">${escapeHtml(meta.short || meta.label)}</span>`;
}

export function orderStatusBadge(status) {
  const meta = ORDER_STATUS_MAP[status] || { label: status || '—', badge: 'badge-suspended' };
  return `<span class="badge ${meta.badge}">${escapeHtml(meta.label)}</span>`;
}

export function avatar(name, { size = '', accent = false } = {}) {
  return `<span class="avatar ${size} ${accent ? 'accent' : ''}">${escapeHtml(initials(name))}</span>`;
}

/* ---------- Stepper de reparación ---------- */
export function renderStepper(currentStatus) {
  const currentIndex = ORDER_STATUSES.findIndex((s) => s.key === currentStatus);
  return `
    <div class="stepper" role="list" aria-label="Progreso de la reparación">
      ${ORDER_STATUSES.map((status, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
        const mark = index < currentIndex ? icon('check', 14) : String(index + 1);
        return `
          <div class="step ${state}" role="listitem" aria-current="${state === 'current' ? 'step' : 'false'}">
            <span class="step-dot">${mark}</span>
            <span class="step-label">${escapeHtml(status.label)}</span>
          </div>`;
      }).join('')}
    </div>
  `;
}

/* ---------- Timeline ---------- */
const EVENT_ICON = {
  created: 'plus',
  status: 'refresh',
  costs: 'dollar',
  note: 'fileText',
  photo: 'camera',
  updated: 'edit',
};

export function renderTimeline(events, { empty = 'Sin movimientos registrados.' } = {}) {
  if (!events?.length) {
    return `<div class="note-box empty">${escapeHtml(empty)}</div>`;
  }
  return `
    <div class="timeline">
      ${events.map((event) => `
        <div class="tl-item ${event.type === 'status' ? 'accent' : event.type === 'photo' ? 'green' : ''}">
          <div class="tl-dot">${icon(EVENT_ICON[event.type] || 'circleDot', 14)}</div>
          <div class="tl-body">
            <div class="tl-title">${escapeHtml(event.message)}</div>
            <div class="tl-meta">${escapeHtml(event.actorName || 'Sistema')} · ${new Date(event.createdAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ---------- Lightbox ---------- */
export function openLightbox(photos, startIndex = 0, captionFn = null) {
  if (!photos?.length) return;
  let index = Math.max(0, Math.min(startIndex, photos.length - 1));
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <button class="btn-icon btn-ghost lb-close" type="button" aria-label="Cerrar">${icon('x', 22)}</button>
    ${photos.length > 1 ? `<button class="btn-icon btn-ghost lb-prev" type="button" aria-label="Anterior">${icon('chevronLeft', 24)}</button>` : ''}
    <img alt="Fotografía de avance de la reparación" />
    ${photos.length > 1 ? `<button class="btn-icon btn-ghost lb-next" type="button" aria-label="Siguiente">${icon('chevronRight', 24)}</button>` : ''}
    <div class="lb-caption"></div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const img = overlay.querySelector('img');
  const caption = overlay.querySelector('.lb-caption');
  const render = () => {
    const photo = photos[index];
    img.src = photo.dataUrl;
    img.alt = photo.originalName || 'Fotografía de avance';
    caption.textContent = captionFn ? captionFn(photo, index) : `${index + 1} de ${photos.length}`;
  };
  const close = () => {
    overlay.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
  };
  const next = () => { index = (index + 1) % photos.length; render(); };
  const prev = () => { index = (index - 1 + photos.length) % photos.length; render(); };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') next();
    if (event.key === 'ArrowLeft') prev();
  };
  overlay.querySelector('.lb-close').addEventListener('click', close);
  overlay.querySelector('.lb-prev')?.addEventListener('click', prev);
  overlay.querySelector('.lb-next')?.addEventListener('click', next);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  render();
}

/* ---------- Bloques vacíos ---------- */
export function emptyState({ iconName = 'inbox', title = 'Sin información', text = '', action = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconName, 26)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${action}
    </div>
  `;
}

/* ---------- Progreso de ruta ---------- */
export function routeProgress(active = true, done = false) {
  const bar = document.getElementById('route-progress');
  if (!bar) return;
  if (done) {
    bar.classList.add('done');
    bar.classList.remove('active');
    setTimeout(() => {
      bar.classList.remove('done');
      bar.style.width = '0';
    }, 450);
    return;
  }
  if (active) {
    bar.style.width = '0';
    bar.classList.remove('done');
    requestAnimationFrame(() => bar.classList.add('active'));
  }
}

/* ---------- Contraseña ---------- */
export function bindPasswordMeter(input, meter) {
  if (!input || !meter) return;
  const update = () => {
    const value = input.value;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
    meter.dataset.score = String(Math.min(score, 4));
    meter.setAttribute('aria-label', ['Contraseña demasiado débil', 'Contraseña débil', 'Contraseña aceptable', 'Contraseña buena', 'Contraseña fuerte'][Math.min(score, 4)]);
  };
  input.addEventListener('input', update);
  update();
}

/* ---------- Galería ---------- */
export function renderGallery(photos, { canDelete = false } = {}) {
  if (!photos?.length) {
    return `<div class="note-box empty">Aún no hay fotografías de avance para esta orden.</div>`;
  }
  return `
    <div class="gallery">
      ${photos.map((photo, index) => `
        <div class="photo-card" data-photo-index="${index}" role="button" tabindex="0" aria-label="Ampliar fotografía ${index + 1}">
          <img src="${photo.dataUrl}" alt="${escapeHtml(photo.note || photo.originalName || `Fotografía ${index + 1}`)}" loading="lazy" />
          <div class="photo-meta">
            <span>${escapeHtml(photo.note || new Date(photo.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }))}</span>
            ${canDelete ? `<button type="button" class="photo-del" data-delete-photo="${photo.id}" title="Eliminar fotografía" aria-label="Eliminar fotografía">${icon('trash', 14)}</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
