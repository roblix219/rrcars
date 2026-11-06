/* ============================================================
   RR CARS · Portal del cliente: historial de servicios
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, formatDate, money, normalize } from '../core/utils.js';
import { loadingBlock, toastError, orderStatusBadge, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { getClientHistory } from '../services.js';
import {
  pageHead, pagination, emptyTableRow, slicePage, serviceOptions, orderCard,
} from './partials.js';

const PER_PAGE = 10;

export async function renderClientHistory(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    service: route.query.get('service') || '',
    from: route.query.get('from') || '',
    to: route.query.get('to') || '',
    page: Number(route.query.get('page')) || 1,
    view: route.query.get('view') === 'cards' ? 'cards' : 'table',
  };
  let allOrders = [];

  root.innerHTML = loadingBlock('Cargando tu historial de servicios…');

  async function load() {
    try {
      allOrders = await getClientHistory(ctx.user.id);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function filteredOrders() {
    const q = normalize(state.search);
    return allOrders.filter((order) => {
      if (state.service && order.service !== state.service) return false;
      const received = String(order.receivedAt || order.createdAt || '').slice(0, 10);
      if (state.from && received < state.from) return false;
      if (state.to && received > state.to) return false;
      if (!q) return true;
      return normalize([
        order.folio, order.vehicleLabel, order.plates, order.service,
        order.damageDescription, order.requestedWork,
      ].join(' ')).includes(q);
    });
  }

  function activeFilters() {
    return [state.search, state.service, state.from, state.to].filter(Boolean).length;
  }

  function render() {
    const orders = filteredOrders();
    const pageData = slicePage(orders, state.page, PER_PAGE);
    const total = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
    const delivered = orders.filter((order) => order.status === 'entregado').length;
    const finished = orders.filter((order) => order.status === 'terminado').length;

    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Historial',
        title: 'Mis servicios concluidos',
        subtitle: 'Reparaciones terminadas y entregadas. Consulta fechas, costos y el detalle de cada orden.',
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <div class="segmented" role="group" aria-label="Vista del historial">
            <button type="button" data-view="table" class="${state.view === 'table' ? 'active' : ''}">${icon('list', 14)} Tabla</button>
            <button type="button" data-view="cards" class="${state.view === 'cards' ? 'active' : ''}">${icon('grid', 14)} Tarjetas</button>
          </div>
        `,
      })}

      <div class="report-summary">
        <div class="report-kpi"><div class="k">Servicios históricos</div><div class="v">${orders.length}</div><div class="s">Terminados + entregados</div></div>
        <div class="report-kpi"><div class="k">Entregados</div><div class="v">${delivered}</div><div class="s">Vehículos devueltos</div></div>
        <div class="report-kpi"><div class="k">Terminados</div><div class="v">${finished}</div><div class="s">Listos para entrega</div></div>
        <div class="report-kpi"><div class="k">Total histórico</div><div class="v" style="font-size:1.2rem">${money(total)}</div><div class="s">Suma de las órdenes filtradas</div></div>
      </div>

      <div class="card">
        <div class="table-toolbar">
          <form class="filters" id="client-history-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Folio, vehículo o placas…" value="${escapeHtml(state.search)}" aria-label="Buscar en mi historial" />
            </div>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <input class="input" type="date" name="from" value="${escapeHtml(state.from)}" style="width:auto" aria-label="Desde" title="Recepción desde" />
            <input class="input" type="date" name="to" value="${escapeHtml(state.to)}" style="width:auto" aria-label="Hasta" title="Recepción hasta" />
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Filtrar</button>
            ${activeFilters() ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('history', 13)} ${orders.length} resultado${orders.length === 1 ? '' : 's'}</span>
        </div>

        ${state.view === 'cards' ? `
          <div class="card-body">
            ${pageData.items.length ? `
              <div class="order-list">
                ${pageData.items.map((order) => orderCard(order)).join('')}
              </div>` : `<div class="note-box empty">No hay servicios concluidos con los filtros seleccionados.</div>`}
          </div>
          ${pagination({ ...pageData, prefix: 'client-history' })}` : `
          <div class="table-wrap">
            <table class="data-table" style="min-width:820px">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Vehículo</th>
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
                    <td><a class="cell-main mono" href="#/cliente/ordenes/${encodeURIComponent(order.id)}" style="text-decoration:none">${escapeHtml(order.folio)}</a></td>
                    <td>
                      <span class="cell-main">${escapeHtml(order.vehicleLabel)}</span>
                      <span class="cell-sub mono">${escapeHtml(order.plates)}</span>
                    </td>
                    <td>${escapeHtml(order.service)}</td>
                    <td>${orderStatusBadge(order.status)}</td>
                    <td>${formatDate(order.receivedAt)}</td>
                    <td>${order.deliveredAt ? formatDate(order.deliveredAt) : '—'}</td>
                    <td style="text-align:right"><strong style="font-family:var(--font-display)">${money(order.total)}</strong></td>
                    <td>
                      <div class="row-actions">
                        <a class="btn-icon btn-ghost btn-sm" href="#/cliente/ordenes/${encodeURIComponent(order.id)}" title="Ver detalle" aria-label="Ver detalle de la orden">${icon('eye', 15)}</a>
                      </div>
                    </td>
                  </tr>
                `).join('') : emptyTableRow(8, 'No hay servicios concluidos con los filtros seleccionados.')}
              </tbody>
            </table>
          </div>
          ${pagination({ ...pageData, prefix: 'client-history' })}
        `}
      </div>

      ${!allOrders.length ? emptyState({
        iconName: 'history',
        title: 'Aún no hay servicios concluidos',
        text: 'Cuando una de tus órdenes pase a “Terminado” o “Entregado” aparecerá en este historial.',
        action: '<a class="btn btn-outline" href="#/cliente/ordenes">Ver mis órdenes</a>',
      }) : ''}
    `;
    bind();
  }

  function bind() {
    const form = root.querySelector('#client-history-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.service = String(fd.get('service') || '');
      state.from = String(fd.get('from') || '');
      state.to = String(fd.get('to') || '');
      state.page = 1;
      load();
    });
    root.querySelectorAll('[data-clear]').forEach((button) => {
      button.addEventListener('click', () => {
        state.search = '';
        state.service = '';
        state.from = '';
        state.to = '';
        state.page = 1;
        load();
      });
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', load);
    root.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = button.dataset.view;
        state.page = 1;
        render();
      });
    });
    root.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page) || 1;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  await load();
}
