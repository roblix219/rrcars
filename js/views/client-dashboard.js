/* ============================================================
   RR CARS · Portal del cliente: dashboard
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, money, moneyShort, todayLong, daysBetween, todayISO,
} from '../core/utils.js';
import { orderStatusBadge, renderStepper, loadingBlock, toastError, emptyState } from '../core/ui.js';
import { pageHead, statCard, orderCard } from './partials.js';
import { getClientDashboard } from '../services.js';
import { navigate } from '../core/router.js';
import { openVehicleModal, openVehicleHistoryModal } from './vehicle-modal.js';

export async function renderClientDashboard(root, ctx) {
  root.innerHTML = loadingBlock('Preparando tu portal…');

  let data;
  try {
    data = await getClientDashboard(ctx.user.id);
  } catch (error) {
    toastError(error);
    root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    return;
  }

  let { vehicles, orders, activeOrders, latestActive, stats } = data;
  vehicles = [...vehicles].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  orders = [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const firstName = String(ctx.user.name || 'Cliente').split(' ')[0];
  const active = latestActive && ['recibido', 'diagnostico', 'hojalateria', 'pintura', 'revision'].includes(latestActive.status)
    ? latestActive
    : null;
  const days = active?.estimatedAt ? daysBetween(todayISO(), active.estimatedAt) : null;
  const overdue = active?.estimatedAt ? active.estimatedAt < todayISO() : false;

  root.innerHTML = `
    <section class="client-hero">
      <div class="client-hero-content">
        <div>
          <div class="hero-status">${icon('sparkles', 14)} Portal del cliente</div>
          <h1>Hola, ${escapeHtml(firstName)}</h1>
          <p class="client-hero-sub">
            ${todayLong()}. Aquí puedes seguir el avance de tus reparaciones, revisar costos y consultar
            las fotografías que registra el taller.
          </p>
          <div class="hero-actions" style="margin-top:18px">
            <button class="btn btn-primary" type="button" data-new-vehicle>${icon('plus', 16)} Registrar vehículo</button>
            <a class="btn btn-outline" href="#/cliente/ordenes">${icon('clipboard', 16)} Ver mis órdenes</a>
            <a class="btn btn-ghost" href="#/cliente/cuenta">${icon('user', 16)} Mi cuenta</a>
          </div>
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="chip">${icon('car', 13)} ${stats.vehicles} vehículo${stats.vehicles === 1 ? '' : 's'}</span>
          <span class="chip">${icon('clipboard', 13)} ${stats.active} activa${stats.active === 1 ? '' : 's'}</span>
          <span class="chip">${icon('camera', 13)} ${stats.photos} foto${stats.photos === 1 ? '' : 's'}</span>
        </div>
      </div>
    </section>

    ${active ? `
      <div class="card" style="margin-bottom:16px;border-color:rgba(255,107,26,.25)">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Tu reparación en curso</span>
            <span class="card-sub">${escapeHtml(active.folio)} · ${escapeHtml(active.vehicleLabel)} · <span class="mono">${escapeHtml(active.plates)}</span></span>
          </div>
          <div class="row" style="gap:8px">
            ${orderStatusBadge(active.status)}
            <a class="btn btn-sm btn-primary" href="#/cliente/ordenes/${encodeURIComponent(active.id)}">Ver detalle ${icon('chevronRight', 14)}</a>
          </div>
        </div>
        <div class="card-body">
          <div style="margin-bottom:16px">${renderStepper(active.status)}</div>
          <div class="order-card-body" style="padding:0">
            <div class="order-meta-item"><div class="k">Servicio</div><div class="v">${escapeHtml(active.service)}</div></div>
            <div class="order-meta-item"><div class="k">Recepción</div><div class="v">${formatDate(active.receivedAt)}</div></div>
            <div class="order-meta-item"><div class="k">Entrega estimada</div><div class="v ${overdue ? 'text-red' : ''}">${active.estimatedAt ? formatDate(active.estimatedAt) : 'Por definir'}</div></div>
            <div class="order-meta-item"><div class="k">Costo registrado</div><div class="v">${Number(active.total) ? money(active.total) : 'Por cotizar'}</div></div>
          </div>
          ${active.estimatedAt ? `
            <div class="alert ${overdue ? 'alert-warning' : 'alert-info'} mt-2" style="margin-bottom:0">
              ${icon(overdue ? 'alertTriangle' : 'clock', 17)}
              <div>${overdue
                ? 'La fecha estimada de entrega ya pasó. Contacta al taller para confirmar el estatus de tu reparación.'
                : `Faltan aproximadamente <strong>${Math.max(0, days)} día${days === 1 ? '' : 's'}</strong> para la entrega estimada.`}</div>
            </div>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="dashboard-grid">
      ${statCard({ label: 'Vehículos registrados', value: stats.vehicles, iconName: 'car', tone: 'blue', foot: 'Bajo tu cuenta' })}
      ${statCard({ label: 'Órdenes activas', value: stats.active, iconName: 'wrench', tone: 'amber', foot: stats.active ? 'En proceso en el taller' : 'Sin trabajos en curso' })}
      ${statCard({ label: 'Servicios concluidos', value: stats.finished, iconName: 'checkCircle', tone: 'green', foot: 'Terminados y entregados' })}
      ${statCard({ label: 'Total histórico', value: moneyShort(stats.total), iconName: 'dollar', tone: 'violet', foot: 'Órdenes concluidas' })}
    </div>

    <div class="chart-grid equal" style="margin-top:16px">
      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Órdenes recientes</span>
            <span class="card-sub">Últimos movimientos de tus vehículos</span>
          </div>
          <a class="btn btn-sm btn-ghost" href="#/cliente/ordenes">Ver todas ${icon('arrowUpRight', 14)}</a>
        </div>
        <div class="card-body">
          ${orders.length ? `
            <div class="order-list">
              ${orders.slice(0, 3).map((order) => orderCard(order)).join('')}
            </div>` : emptyState({
              iconName: 'clipboard',
              title: 'Aún no tienes órdenes',
              text: 'Cuando el taller reciba tu vehículo aparecerá aquí el seguimiento de la reparación.',
              action: '<button class="btn btn-outline" type="button" data-new-vehicle>Registrar mi vehículo</button>',
            })}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Mis vehículos</span>
            <span class="card-sub">Vehículos vinculados a tu cuenta</span>
          </div>
          <a class="btn btn-sm btn-ghost" href="#/cliente/vehiculos">Administrar ${icon('arrowUpRight', 14)}</a>
        </div>
        <div class="card-body">
          ${vehicles.length ? `
            <div class="col" style="gap:10px">
              ${vehicles.slice(0, 3).map((vehicle) => `
                <button class="quick-action" type="button" data-vehicle-history="${escapeHtml(vehicle.id)}" style="width:100%;text-align:left">
                  ${icon('car', 19)}
                  <span style="flex:1;min-width:0">
                    <strong style="display:block;color:var(--text);font-size:0.84rem">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} ${escapeHtml(String(vehicle.year))}</strong>
                    <span class="tiny muted">${escapeHtml(vehicle.color)} · <span class="mono">${escapeHtml(vehicle.plates)}</span></span>
                  </span>
                  ${icon('chevronRight', 15)}
                </button>
              `).join('')}
            </div>` : emptyState({
              iconName: 'car',
              title: 'Sin vehículos registrados',
              text: 'Registra tu vehículo para que el taller pueda crear una orden de servicio.',
              action: '<button class="btn btn-outline" type="button" data-new-vehicle>Registrar vehículo</button>',
            })}
        </div>
      </div>
    </div>

    <div class="card mt-2">
      <div class="card-header">
        <div class="card-heading">
          <span class="card-title">Accesos rápidos</span>
          <span class="card-sub">Todo lo que puedes hacer desde tu portal</span>
        </div>
      </div>
      <div class="card-body">
        <div class="quick-grid">
          <button class="quick-action" type="button" data-new-vehicle>${icon('plus', 19)} Registrar vehículo</button>
          <a class="quick-action" href="#/cliente/ordenes">${icon('clipboard', 19)} Consultar órdenes</a>
          <a class="quick-action" href="#/cliente/historial">${icon('history', 19)} Historial de servicios</a>
          <a class="quick-action" href="#/cliente/cuenta">${icon('user', 19)} Datos de mi cuenta</a>
        </div>
      </div>
    </div>
  `;

  const openNew = () => openVehicleModal({
    isAdmin: false,
    onSaved: () => ctx.refresh(),
  });
  root.querySelectorAll('[data-new-vehicle]').forEach((button) => button.addEventListener('click', openNew));
  root.querySelectorAll('[data-vehicle-history]').forEach((button) => {
    button.addEventListener('click', async () => {
      const vehicle = vehicles.find((v) => v.id === button.dataset.vehicleHistory);
      if (vehicle) await openVehicleHistoryModal(vehicle, { role: 'client' });
    });
  });
  root.querySelector('[data-refresh]')?.addEventListener('click', () => ctx.refresh());
  void money;
  void activeOrders;
  void navigate;
  void pageHead;
}
