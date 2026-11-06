/* ============================================================
   RR CARS · Portal del cliente: mis órdenes de servicio
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, money } from '../core/utils.js';
import { loadingBlock, toastError, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { listOrders } from '../services.js';
import {
  pageHead, pagination, slicePage, orderCard, orderStatusOptions, serviceOptions,
} from './partials.js';

const PER_PAGE = 8;

export async function renderClientOrders(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    status: route.query.get('status') || '',
    service: route.query.get('service') || '',
    page: Number(route.query.get('page')) || 1,
  };
  let orders = [];

  root.innerHTML = loadingBlock('Cargando tus órdenes de servicio…');

  async function load() {
    try {
      orders = await listOrders({
        search: state.search,
        status: state.status,
        service: state.service,
      });
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function activeFilterCount() {
    return [state.search, state.status, state.service].filter(Boolean).length;
  }

  function render() {
    const pageData = slicePage(orders, state.page, PER_PAGE);
    const total = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Mis órdenes',
        title: 'Órdenes de servicio',
        subtitle: `${orders.length} orden${orders.length === 1 ? '' : 'es'} ${activeFilterCount() ? 'con los filtros aplicados' : 'registradas a tu nombre'}${orders.length ? ` · ${money(total)} en total` : ''}.`,
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <a class="btn btn-outline" href="#/cliente/historial">${icon('history', 16)} Historial</a>
        `,
      })}

      <div class="card" style="margin-bottom:16px">
        <div class="table-toolbar">
          <form class="filters" id="client-orders-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Folio, vehículo o placas…" value="${escapeHtml(state.search)}" aria-label="Buscar mis órdenes" />
            </div>
            <select class="select" name="status" style="width:auto" aria-label="Filtrar por estado">
              ${orderStatusOptions(state.status, { placeholder: 'Todas las órdenes' })}
            </select>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Filtrar</button>
            ${activeFilterCount() ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('clipboard', 13)} ${orders.length} resultado${orders.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      ${pageData.items.length ? `
        <div class="order-list">
          ${pageData.items.map((order) => orderCard(order)).join('')}
        </div>
        ${pagination({ ...pageData, prefix: 'client-orders' })}` : emptyState({
          iconName: 'clipboard',
          title: activeFilterCount() ? 'Sin órdenes con esos filtros' : 'Aún no tienes órdenes de servicio',
          text: activeFilterCount()
            ? 'Prueba con otro estado, servicio o término de búsqueda.'
            : 'Cuando el taller reciba tu vehículo y genere la orden, aparecerá aquí con su folio y el avance de la reparación.',
          action: activeFilterCount()
            ? '<button class="btn btn-outline" type="button" data-clear>Limpiar filtros</button>'
            : '<a class="btn btn-outline" href="#/cliente/vehiculos">Ver mis vehículos</a>',
        })}

      <div class="alert alert-info mt-2">
        ${icon('info', 18)}
        <div>Los costos y estados son actualizados únicamente por el personal del taller. Si tienes dudas sobre una orden,
        contacta directamente a RR CARS indicando el folio.</div>
      </div>
    `;
    bind();
  }

  function bind() {
    const form = root.querySelector('#client-orders-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.status = String(fd.get('status') || '');
      state.service = String(fd.get('service') || '');
      state.page = 1;
      load();
    });
    root.querySelectorAll('[data-clear]').forEach((button) => {
      button.addEventListener('click', () => {
        state.search = '';
        state.status = '';
        state.service = '';
        state.page = 1;
        load();
      });
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', load);
    root.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page) || 1;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  await load();
  void ctx;
}
