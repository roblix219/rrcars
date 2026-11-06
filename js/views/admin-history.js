/* ============================================================
   RR CARS · Panel de administrador: historial de servicios
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, formatDate, money } from '../core/utils.js';
import { loadingBlock, toast, toastError, orderStatusBadge, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { getHistory, getClientOptions } from '../services.js';
import { exportOrdersCsv } from '../core/export.js';
import {
  pageHead, pagination, emptyTableRow, slicePage, serviceOptions, options,
} from './partials.js';

const PER_PAGE = 12;

export async function renderAdminHistory(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    from: route.query.get('from') || '',
    to: route.query.get('to') || '',
    service: route.query.get('service') || '',
    clientId: route.query.get('clientId') || '',
    page: Number(route.query.get('page')) || 1,
  };
  let orders = [];
  let clients = [];

  root.innerHTML = loadingBlock('Cargando historial de servicios…');

  async function load() {
    try {
      [orders, clients] = await Promise.all([
        getHistory(state),
        getClientOptions(),
      ]);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function render() {
    const pageData = slicePage(orders, state.page, PER_PAGE);
    const total = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const delivered = orders.filter((o) => o.status === 'entregado').length;
    const finished = orders.filter((o) => o.status === 'terminado').length;
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Historial',
        title: 'Servicios concluidos',
        subtitle: 'Órdenes terminadas y entregadas. Consulta, filtra y exporta el historial del taller.',
        actions: `
          <button class="btn" type="button" data-export ${orders.length ? '' : 'disabled'}>${icon('download', 16)} Exportar CSV</button>
          <a class="btn btn-primary" href="#/admin/reportes">${icon('chart', 16)} Reportes completos</a>
        `,
      })}

      <div class="report-summary">
        <div class="report-kpi"><div class="k">Servicios históricos</div><div class="v">${orders.length}</div><div class="s">Terminados + entregados</div></div>
        <div class="report-kpi"><div class="k">Entregados</div><div class="v">${delivered}</div><div class="s">Vehículos devueltos al cliente</div></div>
        <div class="report-kpi"><div class="k">Terminados</div><div class="v">${finished}</div><div class="s">Listos para entrega</div></div>
        <div class="report-kpi"><div class="k">Valor histórico</div><div class="v" style="font-size:1.2rem">${money(total)}</div><div class="s">Total registrado</div></div>
      </div>

      <div class="card">
        <div class="table-toolbar">
          <form class="filters" id="history-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Folio, cliente, placas…" value="${escapeHtml(state.search)}" aria-label="Buscar en el historial" />
            </div>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <select class="select" name="clientId" style="width:auto;max-width:200px" aria-label="Filtrar por cliente">
              ${options(clients.map((c) => ({ value: c.id, label: c.name })), state.clientId, { placeholder: 'Todos los clientes' })}
            </select>
            <input class="input" type="date" name="from" value="${escapeHtml(state.from)}" style="width:auto" aria-label="Desde" title="Desde" />
            <input class="input" type="date" name="to" value="${escapeHtml(state.to)}" style="width:auto" aria-label="Hasta" title="Hasta" />
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Aplicar</button>
            ${state.search || state.from || state.to || state.service || state.clientId ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
        </div>

        <div class="table-wrap">
          <table class="data-table" style="min-width:900px">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente / Vehículo</th>
                <th>Servicio</th>
                <th>Estado</th>
                <th>Recepción</th>
                <th>Entrega real</th>
                <th style="text-align:right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${pageData.items.length ? pageData.items.map((order) => `
                <tr>
                  <td><a class="cell-main mono" href="#/admin/ordenes/${encodeURIComponent(order.id)}" style="text-decoration:none">${escapeHtml(order.folio)}</a></td>
                  <td>
                    <span class="cell-main">${escapeHtml(order.clientName)}</span>
                    <span class="cell-sub">${escapeHtml(order.vehicleLabel)} · ${escapeHtml(order.plates)}</span>
                  </td>
                  <td>${escapeHtml(order.service)}</td>
                  <td>${orderStatusBadge(order.status)}</td>
                  <td>${formatDate(order.receivedAt)}</td>
                  <td>${order.deliveredAt ? formatDate(order.deliveredAt) : '—'}</td>
                  <td style="text-align:right"><strong style="font-family:var(--font-display)">${money(order.total)}</strong></td>
                  <td>
                    <div class="row-actions">
                      <a class="btn-icon btn-ghost btn-sm" href="#/admin/ordenes/${encodeURIComponent(order.id)}" title="Ver detalle" aria-label="Ver detalle de la orden">${icon('eye', 15)}</a>
                    </div>
                  </td>
                </tr>
              `).join('') : emptyTableRow(8, 'No hay servicios concluidos con los filtros seleccionados.')}
            </tbody>
          </table>
        </div>

        ${pagination({ ...pageData, prefix: 'history' })}
      </div>

      ${!orders.length && !state.search && !state.from && !state.to ? emptyState({
        iconName: 'history',
        title: 'Aún no hay servicios concluidos',
        text: 'Cuando una orden cambie a “Terminado” o “Entregado” aparecerá en este historial.',
        action: '<a class="btn btn-outline" href="#/admin/ordenes">Ver órdenes activas</a>',
      }) : ''}
    `;
    bind();
  }

  function bind() {
    const form = root.querySelector('#history-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.service = String(fd.get('service') || '');
      state.clientId = String(fd.get('clientId') || '');
      state.from = String(fd.get('from') || '');
      state.to = String(fd.get('to') || '');
      state.page = 1;
      load();
    });
    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.search = '';
      state.service = '';
      state.clientId = '';
      state.from = '';
      state.to = '';
      state.page = 1;
      load();
    });
    root.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page) || 1;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    root.querySelector('[data-export]')?.addEventListener('click', () => {
      if (!orders.length) {
        toast('No hay registros para exportar.', { type: 'warning' });
        return;
      }
      exportOrdersCsv(orders, 'RR-CARS-historial');
      toast('Archivo CSV generado. Ábrelo con Excel.', { type: 'success' });
    });
  }

  await load();
  void ctx;
}
