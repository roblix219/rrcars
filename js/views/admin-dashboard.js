/* ============================================================
   RR CARS · Panel de administrador: Dashboard
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatRelative, money, moneyShort, todayLong, daysBetween, todayISO,
} from '../core/utils.js';
import { ORDER_STATUSES, ACTIVE_ORDER_STATUSES } from '../core/constants.js';
import { orderStatusBadge, renderTimeline, loadingBlock, toastError, emptyState } from '../core/ui.js';
import { horizontalBarChart, donutChart, lineChart, PALETTE } from '../core/charts.js';
import { pageHead, statCard } from './partials.js';
import { getAdminDashboard, getLastBackupAt } from '../services.js';
import { navigate } from '../core/router.js';

export async function renderAdminDashboard(root, ctx) {
  root.innerHTML = loadingBlock('Preparando tu panel de control…');
  let data;
  let lastBackup = null;
  try {
    [data, lastBackup] = await Promise.all([getAdminDashboard(), getLastBackupAt()]);
  } catch (error) {
    toastError(error);
    root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    return;
  }
  const { stats, pendingClients, recentOrders, upcoming, recentEvents, statusCounts, serviceCounts, monthlyIncome } = data;
  const firstName = String(ctx.user.name || 'Administrador').split(' ')[0];
  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const backupDays = lastBackup ? Math.abs(daysBetween(lastBackup.slice(0, 10), todayISO())) : null;
  const backupDue = !lastBackup || backupDays > 30;

  root.innerHTML = `
    ${pageHead({
      eyebrow: 'Panel administrativo',
      title: `Hola, ${firstName}`,
      subtitle: `${todayLong()} · Resumen operativo del taller`,
      actions: `
        <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
        <button class="btn btn-primary" type="button" data-new-order>${icon('plus', 17)} Nueva orden</button>
      `,
    })}

    ${pendingClients.length ? `
      <div class="alert alert-warning" style="margin-bottom:16px">
        ${icon('users', 19)}
        <div style="flex:1">
          <strong>${pendingClients.length} cliente${pendingClients.length === 1 ? '' : 's'} esperando autorización.</strong>
          ${escapeHtml(pendingClients.slice(0, 3).map((c) => c.name).join(', '))}${pendingClients.length > 3 ? ' y más' : ''}.
        </div>
        <a class="btn btn-sm btn-outline" href="#/admin/clientes?status=pending">Revisar solicitudes ${icon('chevronRight', 14)}</a>
      </div>` : ''}

    ${backupDue ? `
      <div class="alert alert-info" style="margin-bottom:16px">
        ${icon('database', 19)}
        <div style="flex:1">
          <strong>${lastBackup ? 'Tu último respaldo tiene más de 30 días.' : 'Aún no has generado un respaldo.'}</strong>
          Los datos viven en este equipo. Exporta un JSON para proteger la información del taller.
        </div>
        <a class="btn btn-sm btn-outline" href="#/admin/configuracion?section=respaldo">Crear respaldo ${icon('download', 14)}</a>
      </div>` : ''}

    <div class="dashboard-grid">
      ${statCard({ label: 'Total de clientes', value: stats.clients, iconName: 'users', tone: 'blue', foot: `${icon('chart', 12)} ${stats.pendingClients} pendiente(s) de aprobación` })}
      ${statCard({ label: 'Clientes pendientes', value: stats.pendingClients, iconName: 'clock', tone: stats.pendingClients ? 'amber' : 'teal', foot: stats.pendingClients ? 'Requieren revisión' : 'Todo al día' })}
      ${statCard({ label: 'Vehículos registrados', value: stats.vehicles, iconName: 'car', tone: 'violet', foot: 'En la base de datos local' })}
      ${statCard({ label: 'Órdenes activas', value: stats.activeOrders, iconName: 'wrench', tone: 'amber', foot: `${stats.overdue} con entrega vencida` })}
      ${statCard({ label: 'Órdenes terminadas', value: stats.finishedOrders, iconName: 'checkCircle', tone: 'green', foot: 'Listas para entrega' })}
      ${statCard({ label: 'Órdenes entregadas', value: stats.deliveredOrders, iconName: 'check', tone: 'teal', foot: 'Historial de entregas' })}
      ${statCard({ label: 'Ingresos registrados', value: moneyShort(stats.income), iconName: 'dollar', tone: 'green', foot: `Ticket promedio ${money(stats.averageTicket)}` })}
      ${statCard({ label: 'Trabajos pendientes', value: stats.pendingJobs, iconName: 'clipboard', tone: 'red', foot: 'Reparaciones en curso' })}
    </div>

    <div class="chart-grid">
      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Servicios más solicitados</span>
            <span class="card-sub">Distribución de todas las órdenes registradas</span>
          </div>
          <span class="chip">${icon('briefcase', 13)} ${serviceCounts.length} tipo(s)</span>
        </div>
        <div class="card-body">
          <div class="chart-box">
            <canvas id="services-chart" aria-label="Gráfica de servicios solicitados" role="img"></canvas>
            ${!serviceCounts.length ? '<div class="chart-empty">Aún no hay órdenes registradas</div>' : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Estado de las reparaciones</span>
            <span class="card-sub">${statusTotal} orden${statusTotal === 1 ? '' : 'es'} en total</span>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-box sm">
            <canvas id="status-chart" aria-label="Gráfica de estados de reparación" role="img"></canvas>
          </div>
          <div class="chart-legend">
            ${ORDER_STATUSES.map((status) => `
              <span class="legend-item">
                <span class="legend-swatch" style="background:${status.color}"></span>
                ${escapeHtml(status.label)} <strong style="color:var(--text-2)">${statusCounts[status.key] || 0}</strong>
              </span>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="chart-grid equal">
      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Ingresos por entregas</span>
            <span class="card-sub">Últimos 6 meses · solo órdenes entregadas</span>
          </div>
          <span class="chip">${moneyShort(stats.income)} acumulado</span>
        </div>
        <div class="card-body">
          <div class="chart-box">
            <canvas id="income-chart" aria-label="Gráfica de ingresos mensuales" role="img"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Actividad reciente</span>
            <span class="card-sub">Últimos movimientos del taller</span>
          </div>
        </div>
        <div class="card-body" style="max-height:300px;overflow-y:auto">
          ${recentEvents.length ? renderTimeline(recentEvents.slice(0, 6)) : emptyState({ iconName: 'history', title: 'Sin actividad', text: 'Los cambios de estado, costos y fotografías aparecerán aquí.' })}
        </div>
      </div>
    </div>

    <div class="dashboard-grid mt-2">
      <div class="card span-2">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Órdenes recientes</span>
            <span class="card-sub">Últimos vehículos recibidos</span>
          </div>
          <a class="btn btn-sm btn-ghost" href="#/admin/ordenes">Ver todas ${icon('arrowUpRight', 14)}</a>
        </div>
        ${recentOrders.length ? `
          <div class="recent-list">
            ${recentOrders.slice(0, 5).map((order) => `
              <a class="recent-item" href="#/admin/ordenes/${encodeURIComponent(order.id)}">
                <span class="avatar">${escapeHtml((order.vehicleLabel || 'RR').slice(0, 2).toUpperCase())}</span>
                <div class="recent-main">
                  <div class="recent-title">${escapeHtml(order.vehicleLabel)} <span class="mono tiny muted">${escapeHtml(order.folio)}</span></div>
                  <div class="recent-sub">${escapeHtml(order.clientName)} · ${escapeHtml(order.service)}</div>
                </div>
                <div class="recent-right">
                  ${orderStatusBadge(order.status)}
                  <div class="recent-amount" style="margin-top:4px">${money(order.total)}</div>
                </div>
              </a>
            `).join('')}
          </div>` : emptyState({ iconName: 'clipboard', title: 'Aún no hay órdenes', text: 'Crea la primera orden de servicio para comenzar a operar.', action: '<button class="btn btn-primary" type="button" data-new-order>Crear orden</button>' })}
      </div>

      <div class="card span-2">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Próximas entregas</span>
            <span class="card-sub">Órdenes activas con fecha estimada</span>
          </div>
        </div>
        ${upcoming.length ? `
          <div class="recent-list">
            ${upcoming.map((order) => {
              const overdue = order.estimatedAt < todayISO();
              return `
                <a class="recent-item" href="#/admin/ordenes/${encodeURIComponent(order.id)}">
                  <div class="recent-main">
                    <div class="recent-title">${escapeHtml(order.vehicleLabel)} <span class="mono tiny muted">${escapeHtml(order.plates)}</span></div>
                    <div class="recent-sub">${escapeHtml(order.clientName)} · ${escapeHtml(order.service)}</div>
                  </div>
                  <div class="recent-right">
                    <div class="tiny ${overdue ? 'text-red' : 'muted'}">${overdue ? 'Entrega vencida' : 'Entrega estimada'}</div>
                    <div class="strong tiny" style="color:${overdue ? 'var(--red)' : 'var(--text-2)'}">${formatDate(order.estimatedAt)}</div>
                  </div>
                </a>`;
            }).join('')}
          </div>` : emptyState({ iconName: 'calendar', title: 'Sin entregas programadas', text: 'Agrega fechas estimadas a las órdenes activas.' })}
      </div>
    </div>

    <div class="card mt-2">
      <div class="card-header">
        <div class="card-heading">
          <span class="card-title">Accesos rápidos</span>
          <span class="card-sub">Operaciones frecuentes del taller</span>
        </div>
      </div>
      <div class="card-body">
        <div class="quick-grid">
          <a class="quick-action" href="#/admin/ordenes?nueva=1">${icon('plus', 19)} Nueva orden</a>
          <a class="quick-action" href="#/admin/clientes?status=pending">${icon('users', 19)} Autorizar clientes</a>
          <a class="quick-action" href="#/admin/vehiculos">${icon('car', 19)} Registrar vehículo</a>
          <a class="quick-action" href="#/admin/reportes">${icon('chart', 19)} Generar reporte</a>
          <a class="quick-action" href="#/admin/configuracion?section=respaldo">${icon('database', 19)} Respaldar información</a>
        </div>
      </div>
    </div>
  `;

  // Gráficas
  const servicesCanvas = root.querySelector('#services-chart');
  if (servicesCanvas && serviceCounts.length) {
    horizontalBarChart(servicesCanvas, {
      labels: serviceCounts.map((s) => s.label),
      values: serviceCounts.map((s) => s.count),
      colors: PALETTE,
    });
  }
  const statusCanvas = root.querySelector('#status-chart');
  if (statusCanvas) {
    const visible = ORDER_STATUSES.filter((s) => (statusCounts[s.key] || 0) > 0);
    donutChart(statusCanvas, {
      labels: visible.map((s) => s.label),
      values: visible.map((s) => statusCounts[s.key]),
      colors: visible.map((s) => s.color),
      centerLabel: 'Órdenes',
      centerValue: String(statusTotal),
    });
  }
  const incomeCanvas = root.querySelector('#income-chart');
  if (incomeCanvas) {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    lineChart(incomeCanvas, {
      labels: monthlyIncome.map((m) => {
        const [, mm] = m.key.split('-');
        return months[Number(mm) - 1] || m.key;
      }),
      values: monthlyIncome.map((m) => m.total),
      color: PALETTE[0],
      valueFormat: (v) => moneyShort(v),
    });
  }

  root.querySelector('[data-refresh]')?.addEventListener('click', () => ctx.refresh());
  root.querySelectorAll('[data-new-order]').forEach((btn) => btn.addEventListener('click', () => navigate('/admin/ordenes?nueva=1')));
  void ACTIVE_ORDER_STATUSES;
  void formatRelative;
}
