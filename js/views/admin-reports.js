/* ============================================================
   RR CARS · Panel de administrador: reportes y exportaciones
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, money, moneyShort, todayISO, dateRangeForPeriod, monthLabel, sum,
} from '../core/utils.js';
import { ORDER_STATUSES, ORDER_STATUS_MAP } from '../core/constants.js';
import { loadingBlock, toast, toastError, orderStatusBadge, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { getReportData, getClientOptions } from '../services.js';
import { exportOrdersCsv, exportOrdersPdf, describeFilters } from '../core/export.js';
import { barChart, donutChart, horizontalBarChart, PALETTE } from '../core/charts.js';
import {
  pageHead, serviceOptions, orderStatusOptions, options, emptyTableRow,
} from './partials.js';

export async function renderAdminReports(root, ctx) {
  const route = getRoute();
  const state = {
    from: route.query.get('from') || '',
    to: route.query.get('to') || '',
    status: route.query.get('status') || '',
    service: route.query.get('service') || '',
    clientId: route.query.get('clientId') || '',
    search: route.query.get('q') || '',
  };
  let data = null;
  let clients = [];

  root.innerHTML = loadingBlock('Generando reporte…');

  async function load() {
    try {
      [data, clients] = await Promise.all([
        getReportData({ ...state }),
        getClientOptions(),
      ]);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function currentClientName() {
    return clients.find((c) => c.id === state.clientId)?.name || '';
  }

  function filterChips() {
    const chips = [];
    if (state.from || state.to) chips.push(`${icon('calendar', 12)} ${state.from ? formatDate(state.from) : 'Inicio'} – ${state.to ? formatDate(state.to) : 'Hoy'}`);
    if (state.status) chips.push(`${icon('clipboard', 12)} Estado: ${state.status === 'activas' ? 'Activas' : state.status === 'historicas' ? 'Históricas' : ORDER_STATUS_MAP[state.status]?.label || state.status}`);
    if (state.service) chips.push(`${icon('wrench', 12)} ${state.service}`);
    if (state.clientId) chips.push(`${icon('user', 12)} ${currentClientName() || 'Cliente'}`);
    if (state.search) chips.push(`${icon('search', 12)} “${state.search}”`);
    if (!chips.length) chips.push(`${icon('database', 12)} Todas las órdenes registradas`);
    return chips.map((chip) => `<span class="chip">${chip}</span>`).join('');
  }

  function render() {
    const { orders, summary, statusCounts, serviceCounts, monthly } = data;
    const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const deliveredOrders = orders.filter((o) => o.status === 'entregado');
    const activeCount = orders.length - deliveredOrders.length;

    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Reportes',
        title: 'Reportes del taller',
        subtitle: 'Analiza la operación, filtra por periodo y exporta la información en CSV o PDF.',
        actions: `
          <button class="btn" type="button" data-export-csv ${orders.length ? '' : 'disabled'}>${icon('download', 16)} CSV</button>
          <button class="btn btn-primary" type="button" data-export-pdf ${orders.length ? '' : 'disabled'}>${icon('printer', 16)} PDF</button>
        `,
      })}

      <form class="filter-bar" id="report-filters" style="margin-bottom:16px" role="search">
        <div class="field"><label for="rep-from">Desde</label><input class="input" id="rep-from" type="date" name="from" value="${escapeHtml(state.from)}" /></div>
        <div class="field"><label for="rep-to">Hasta</label><input class="input" id="rep-to" type="date" name="to" value="${escapeHtml(state.to)}" /></div>
        <div class="field"><label for="rep-status">Estado</label><select class="select" id="rep-status" name="status">${orderStatusOptions(state.status)}</select></div>
        <div class="field"><label for="rep-service">Servicio</label><select class="select" id="rep-service" name="service">${serviceOptions(state.service)}</select></div>
        <div class="field"><label for="rep-client">Cliente</label><select class="select" id="rep-client" name="clientId">${options(clients.map((c) => ({ value: c.id, label: c.name })), state.clientId, { placeholder: 'Todos los clientes' })}</select></div>
        <div class="field grow"><label for="rep-search">Búsqueda</label><input class="input" id="rep-search" type="search" name="q" value="${escapeHtml(state.search)}" placeholder="Folio, placas, cliente…" /></div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="submit">${icon('filter', 15)} Aplicar filtros</button>
          <button class="btn btn-outline" type="button" data-clear>${icon('x', 14)} Limpiar</button>
        </div>
        <div class="filter-actions" style="width:100%;border-top:1px solid var(--border);padding-top:12px;margin-top:2px">
          <span class="tiny muted" style="margin-right:4px">Periodos rápidos:</span>
          <button class="btn btn-sm btn-ghost" type="button" data-period="month">Este mes</button>
          <button class="btn btn-sm btn-ghost" type="button" data-period="quarter">Este trimestre</button>
          <button class="btn btn-sm btn-ghost" type="button" data-period="year">Este año</button>
          <button class="btn btn-sm btn-ghost" type="button" data-period="all">Histórico completo</button>
        </div>
      </form>

      <div class="filters-summary">${filterChips()}</div>

      <div class="report-summary">
        <div class="report-kpi"><div class="k">Órdenes en el periodo</div><div class="v">${summary.count}</div><div class="s">${deliveredOrders.length} entregadas · ${activeCount} en proceso o terminadas</div></div>
        <div class="report-kpi"><div class="k">Ingresos por entregas</div><div class="v" style="font-size:1.2rem;color:var(--green)">${money(summary.income)}</div><div class="s">Solo órdenes con estado Entregado</div></div>
        <div class="report-kpi"><div class="k">Total registrado</div><div class="v" style="font-size:1.2rem">${money(summary.total)}</div><div class="s">Ticket promedio ${money(summary.average)}</div></div>
        <div class="report-kpi"><div class="k">Por cobrar / en proceso</div><div class="v" style="font-size:1.2rem;color:var(--accent-2)">${money(summary.outstanding)}</div><div class="s">Órdenes activas o terminadas sin entregar</div></div>
      </div>

      <div class="chart-grid equal">
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Valor mensual de las órdenes</span>
              <span class="card-sub">Últimos 6 meses según fecha de recepción</span>
            </div>
            <span class="chip">${moneyShort(sum(monthly, (m) => m.total))}</span>
          </div>
          <div class="card-body"><div class="chart-box"><canvas id="report-monthly" role="img" aria-label="Gráfica de valor mensual"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Distribución por estado</span>
              <span class="card-sub">${statusTotal} orden${statusTotal === 1 ? '' : 'es'} en el reporte</span>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-box sm"><canvas id="report-status" role="img" aria-label="Gráfica de estados"></canvas></div>
            <div class="chart-legend">
              ${ORDER_STATUSES.map((s) => `<span class="legend-item"><span class="legend-swatch" style="background:${s.color}"></span>${escapeHtml(s.label)} <strong style="color:var(--text-2)">${statusCounts[s.key] || 0}</strong></span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Servicios solicitados</span>
              <span class="card-sub">Frecuencia por tipo de servicio</span>
            </div>
          </div>
          <div class="card-body"><div class="chart-box sm"><canvas id="report-services" role="img" aria-label="Gráfica de servicios"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Resumen financiero</span>
              <span class="card-sub">Consolidado de las órdenes filtradas</span>
            </div>
          </div>
          <div class="card-body">
            <div class="info-list">
              <div class="info-row"><span class="k">Órdenes entregadas</span><span class="v">${deliveredOrders.length}</span></div>
              <div class="info-row"><span class="k">Ingresos reconocidos</span><span class="v big">${money(summary.income)}</span></div>
              <div class="info-row"><span class="k">Total registrado</span><span class="v">${money(summary.total)}</span></div>
              <div class="info-row"><span class="k">Ticket promedio</span><span class="v">${money(summary.average)}</span></div>
              <div class="info-row"><span class="k">Cartera en proceso</span><span class="v">${money(summary.outstanding)}</span></div>
              <div class="info-row"><span class="k">Generado</span><span class="v">${formatDate(todayISO())}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <div class="card-heading">
            <span class="card-title">Detalle de órdenes</span>
            <span class="card-sub">${orders.length} registro${orders.length === 1 ? '' : 's'} · desplázate para ver todos</span>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn btn-sm btn-outline" type="button" data-export-csv ${orders.length ? '' : 'disabled'}>${icon('download', 13)} CSV</button>
            <button class="btn btn-sm btn-primary" type="button" data-export-pdf ${orders.length ? '' : 'disabled'}>${icon('printer', 13)} PDF</button>
          </div>
        </div>
        ${orders.length ? `
          <div class="report-table-wrap">
            <table class="data-table" style="min-width:940px">
              <thead>
                <tr>
                  <th>Folio</th><th>Cliente</th><th>Vehículo</th><th>Servicio</th><th>Estado</th>
                  <th>Recepción</th><th>Entrega</th><th style="text-align:right">Mano de obra</th><th style="text-align:right">Total</th><th></th>
                </tr>
              </thead>
              <tbody>
                ${orders.map((order) => `
                  <tr>
                    <td><a class="mono strong" href="#/admin/ordenes/${encodeURIComponent(order.id)}" style="text-decoration:none">${escapeHtml(order.folio)}</a></td>
                    <td><span class="cell-main">${escapeHtml(order.clientName)}</span><span class="cell-sub">${escapeHtml(order.clientPhone || '')}</span></td>
                    <td><span class="cell-main" style="font-weight:500">${escapeHtml(order.vehicleLabel)}</span><span class="cell-sub mono">${escapeHtml(order.plates)}</span></td>
                    <td>${escapeHtml(order.service)}</td>
                    <td>${orderStatusBadge(order.status)}</td>
                    <td>${formatDate(order.receivedAt)}</td>
                    <td>${order.deliveredAt ? formatDate(order.deliveredAt) : order.estimatedAt ? `Est. ${formatDate(order.estimatedAt)}` : '—'}</td>
                    <td style="text-align:right">${money(order.costs?.labor)}</td>
                    <td style="text-align:right"><strong style="font-family:var(--font-display)">${money(order.total)}</strong></td>
                    <td><div class="row-actions"><a class="btn-icon btn-ghost btn-sm" href="#/admin/ordenes/${encodeURIComponent(order.id)}" title="Abrir orden" aria-label="Abrir orden">${icon('eye', 15)}</a></div></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : emptyTableRow(10, 'No hay órdenes para los filtros seleccionados.')}
      </div>
    `;
    drawCharts();
    bind();
  }

  function drawCharts() {
    const { monthly, statusCounts, serviceCounts } = data;
    const monthlyCanvas = root.querySelector('#report-monthly');
    if (monthlyCanvas) {
      barChart(monthlyCanvas, {
        labels: monthly.map((m) => monthLabel(m.key)),
        values: monthly.map((m) => m.total),
        colors: PALETTE[0],
        valueFormat: (v) => moneyShort(v),
      });
    }
    const statusCanvas = root.querySelector('#report-status');
    if (statusCanvas) {
      const visible = ORDER_STATUSES.filter((s) => (statusCounts[s.key] || 0) > 0);
      donutChart(statusCanvas, {
        labels: visible.map((s) => s.label),
        values: visible.map((s) => statusCounts[s.key]),
        colors: visible.map((s) => s.color),
        centerLabel: 'Órdenes',
        centerValue: String(visible.reduce((acc, s) => acc + statusCounts[s.key], 0)),
      });
    }
    const servicesCanvas = root.querySelector('#report-services');
    if (servicesCanvas && serviceCounts.length) {
      horizontalBarChart(servicesCanvas, {
        labels: serviceCounts.map((s) => s.label),
        values: serviceCounts.map((s) => s.count),
        colors: PALETTE,
      });
    }
  }

  function bind() {
    const form = root.querySelector('#report-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.from = String(fd.get('from') || '');
      state.to = String(fd.get('to') || '');
      state.status = String(fd.get('status') || '');
      state.service = String(fd.get('service') || '');
      state.clientId = String(fd.get('clientId') || '');
      state.search = String(fd.get('q') || '').trim();
      load();
    });
    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.from = '';
      state.to = '';
      state.status = '';
      state.service = '';
      state.clientId = '';
      state.search = '';
      load();
    });
    root.querySelectorAll('[data-period]').forEach((button) => {
      button.addEventListener('click', () => {
        const range = dateRangeForPeriod(button.dataset.period);
        state.from = range.from;
        state.to = range.to;
        load();
      });
    });

    const doCsv = () => {
      if (!data.orders.length) {
        toast('No hay órdenes para exportar con los filtros actuales.', { type: 'warning' });
        return;
      }
      exportOrdersCsv(data.orders, 'RR-CARS-reporte');
      toast('Reporte CSV generado con separador “;” para Excel.', { type: 'success' });
    };
    const doPdf = () => {
      if (!data.orders.length) {
        toast('No hay órdenes para exportar con los filtros actuales.', { type: 'warning' });
        return;
      }
      try {
        exportOrdersPdf({
          orders: data.orders,
          filters: { ...state, clientName: currentClientName() },
          title: 'Reporte de órdenes de servicio',
          filename: `RR-CARS-reporte-${todayISO()}`,
          generatedBy: ctx.user?.name || 'Administrador',
        });
        toast('Reporte PDF generado.', { type: 'success' });
      } catch (error) {
        toastError(error);
      }
    };
    root.querySelectorAll('[data-export-csv]').forEach((b) => b.addEventListener('click', doCsv));
    root.querySelectorAll('[data-export-pdf]').forEach((b) => b.addEventListener('click', doPdf));
    void describeFilters;
  }

  await load();
}
