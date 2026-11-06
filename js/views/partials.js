/* ============================================================
   RR CARS · Fragmentos reutilizables de las vistas
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, formatDate, money } from '../core/utils.js';
import { ORDER_STATUSES, SERVICES, CLIENT_STATUS_META } from '../core/constants.js';
import { orderStatusBadge, clientStatusBadge } from '../core/ui.js';

export function pageHead({ eyebrow = '', title, subtitle = '', actions = '' } = {}) {
  return `
    <div class="page-head">
      <div class="page-title-group">
        ${eyebrow ? `<div class="page-eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-sub">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>
  `;
}

export function statCard({ label, value, foot = '', iconName = 'chart', tone = '', action = '' }) {
  return `
    <div class="stat-card ${tone}">
      <div class="stat-top">
        <span class="stat-label">${escapeHtml(label)}</span>
        <span class="stat-icon">${icon(iconName, 18)}</span>
      </div>
      <div class="stat-value">${value}</div>
      ${foot ? `<div class="stat-foot">${foot}</div>` : ''}
      ${action || ''}
    </div>
  `;
}

export function options(items, selected = '', { placeholder = '' } = {}) {
  const list = items.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    return item;
  });
  return [
    placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '',
    ...list.map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(selected) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`),
  ].join('');
}

export function serviceOptions(selected = '', { placeholder = 'Todos los servicios' } = {}) {
  return options(SERVICES, selected, { placeholder });
}

export function orderStatusOptions(selected = '', { placeholder = 'Todos los estados', includeGroups = true } = {}) {
  const groups = includeGroups
    ? [
      { value: 'activas', label: 'Solo órdenes activas' },
      { value: 'historicas', label: 'Históricas (terminadas + entregadas)' },
    ]
    : [];
  return options(
    [...groups, ...ORDER_STATUSES.map((s) => ({ value: s.key, label: s.label }))],
    selected,
    { placeholder },
  );
}

export function clientStatusOptions(selected = '', { placeholder = 'Todos los estados' } = {}) {
  return options(
    Object.entries(CLIENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
    selected,
    { placeholder },
  );
}

export function clientOptions(clients, selected = '', { placeholder = 'Selecciona un cliente' } = {}) {
  return options(
    clients.map((c) => ({
      value: c.id,
      label: `${c.name} · ${c.email}${c.status !== 'active' ? ` (${CLIENT_STATUS_META[c.status]?.short || c.status})` : ''}`,
    })),
    selected,
    { placeholder },
  );
}

export function vehicleOptions(vehicles, selected = '', { placeholder = 'Selecciona un vehículo' } = {}) {
  return options(
    vehicles.map((v) => ({
      value: v.id,
      label: v.label || `${v.brand} ${v.model} ${v.year} · ${v.plates}`,
    })),
    selected,
    { placeholder },
  );
}

export function slicePage(items, page = 1, perPage = 10) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: safePage, totalPages, total: items.length, start, perPage };
}

export function pagination({ page, totalPages, total, perPage, prefix = 'pager' } = {}) {
  if (!total) return '';
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const buttons = [];
  const push = (p, label, opts = {}) => buttons.push(
    `<button type="button" data-page="${p}" class="${opts.active ? 'active' : ''}" ${opts.disabled ? 'disabled' : ''} aria-label="${opts.aria || `Página ${p}`}">${label}</button>`,
  );
  push(page - 1, icon('chevronLeft', 14), { disabled: page <= 1, aria: 'Página anterior' });
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) buttons.push('<span class="muted tiny" style="padding:0 4px">…</span>');
    push(p, String(p), { active: p === page });
    previous = p;
  }
  push(page + 1, icon('chevronRight', 14), { disabled: page >= totalPages, aria: 'Página siguiente' });
  return `
    <div class="table-footer" data-pagination="${prefix}">
      <span>Mostrando <strong>${from}–${to}</strong> de <strong>${total}</strong> registros</span>
      <div class="pagination">${buttons.join('')}</div>
    </div>
  `;
}

export function emptyTableRow(colspan, message = 'No se encontraron registros.') {
  return `<tr><td colspan="${colspan}"><div class="table-empty">${escapeHtml(message)}</div></td></tr>`;
}

export function statusTimelineColor(status) {
  return ORDER_STATUSES.find((s) => s.key === status)?.color || '#93a4b8';
}

export function clientStatusChip(status) {
  return clientStatusBadge(status);
}

/** Tarjeta de orden usada en el portal del cliente y en historial. */
export function orderCard(order) {
  const price = Number(order.total) ? money(order.total) : 'Por cotizar';
  return `
    <a class="order-card" href="#/cliente/ordenes/${encodeURIComponent(order.id)}">
      <div class="order-card-head">
        <span class="order-folio">${escapeHtml(order.folio)}</span>
        ${orderStatusBadge(order.status)}
        <span class="spacer"></span>
        <span class="order-vehicle">${escapeHtml(order.vehicleLabel)} · <span class="mono">${escapeHtml(order.plates)}</span></span>
      </div>
      <div class="order-card-body">
        <div class="order-meta-item">
          <div class="k">Servicio</div>
          <div class="v">${escapeHtml(order.service || '—')}</div>
        </div>
        <div class="order-meta-item">
          <div class="k">Recepción</div>
          <div class="v">${formatDate(order.receivedAt)}</div>
        </div>
        <div class="order-meta-item">
          <div class="k">Entrega estimada</div>
          <div class="v">${order.estimatedAt ? formatDate(order.estimatedAt) : 'Por definir'}</div>
        </div>
        <div class="order-meta-item">
          <div class="k">${order.status === 'entregado' ? 'Entregado' : 'Costo registrado'}</div>
          <div class="v">${order.status === 'entregado' ? formatDate(order.deliveredAt) : price}</div>
        </div>
      </div>
      <div class="order-card-foot">
        <span>${escapeHtml(order.damageDescription ? order.damageDescription.slice(0, 90) : 'Sin descripción de daños')}</span>
        <span class="row" style="gap:6px;font-weight:600;color:var(--accent-2)">Ver detalle ${icon('chevronRight', 14)}</span>
      </div>
    </a>
  `;
}

export function vehicleCard(vehicle, { canManage = true } = {}) {
  return `
    <article class="vehicle-card" data-vehicle="${escapeHtml(vehicle.id)}">
      <div class="vehicle-card-top">
        <div class="vehicle-icon">${icon('car', 23)}</div>
        <div class="vehicle-card-title">
          <h3>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h3>
          <div class="vehicle-sub">${escapeHtml(String(vehicle.year))} · ${escapeHtml(vehicle.color)}</div>
        </div>
        <span class="plate">${escapeHtml(vehicle.plates)}</span>
      </div>
      <div class="vehicle-card-body">
        <div class="vehicle-data">
          <div><span class="k">Servicio</span><span class="v">${escapeHtml(vehicle.service)}</span></div>
          <div><span class="k">Registrado</span><span class="v">${formatDate(vehicle.createdAt)}</span></div>
        </div>
        <div class="vehicle-damage">${escapeHtml(vehicle.damageDescription || 'Sin daños descritos.')}</div>
      </div>
      <div class="vehicle-card-foot">
        <span class="tiny muted">${vehicle.notes ? escapeHtml(vehicle.notes.slice(0, 50)) : 'Sin observaciones'}</span>
        ${canManage ? `<div class="row">
          <button class="btn-icon btn-ghost btn-sm" type="button" data-vehicle-history="${escapeHtml(vehicle.id)}" title="Historial" aria-label="Historial del vehículo">${icon('history', 15)}</button>
          <button class="btn-icon btn-ghost btn-sm" type="button" data-vehicle-edit="${escapeHtml(vehicle.id)}" title="Editar" aria-label="Editar vehículo">${icon('edit', 15)}</button>
          <button class="btn-icon btn-ghost btn-sm" type="button" data-vehicle-delete="${escapeHtml(vehicle.id)}" title="Eliminar" aria-label="Eliminar vehículo" style="color:var(--red)">${icon('trash', 15)}</button>
        </div>` : ''}
      </div>
    </article>
  `;
}
