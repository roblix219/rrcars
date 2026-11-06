/* ============================================================
   RR CARS · Panel de administrador: listado de órdenes
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, formatDate, money, todayISO } from '../core/utils.js';
import { loadingBlock, toast, toastError, confirmDialog, orderStatusBadge } from '../core/ui.js';
import { getRoute, navigate } from '../core/router.js';
import { listOrders, deleteOrder, getClientOptions } from '../services.js';
import { openOrderModal } from './order-modal.js';
import {
  pageHead, pagination, emptyTableRow, slicePage, orderStatusOptions, serviceOptions, options,
} from './partials.js';

const PER_PAGE = 12;

export async function renderAdminOrders(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    status: route.query.get('status') || '',
    service: route.query.get('service') || '',
    clientId: route.query.get('clientId') || '',
    from: route.query.get('from') || '',
    to: route.query.get('to') || '',
    page: Number(route.query.get('page')) || 1,
  };
  let orders = [];
  let clients = [];

  root.innerHTML = loadingBlock('Cargando órdenes de servicio…');

  async function load() {
    try {
      [orders, clients] = await Promise.all([
        listOrders({
          search: state.search,
          status: state.status,
          service: state.service,
          clientId: state.clientId,
          from: state.from,
          to: state.to,
        }),
        getClientOptions(),
      ]);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function activeFilterCount() {
    return [state.search, state.status, state.service, state.clientId, state.from, state.to].filter(Boolean).length;
  }

  function render() {
    const pageData = slicePage(orders, state.page, PER_PAGE);
    const totalValue = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Órdenes de servicio',
        title: 'Órdenes del taller',
        subtitle: `${orders.length} orden${orders.length === 1 ? '' : 'es'} · ${money(totalValue)} registrado${activeFilterCount() ? ' con los filtros aplicados' : ''}`,
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <a class="btn btn-outline" href="#/admin/reportes">${icon('chart', 16)} Reportes</a>
          <button class="btn btn-primary" type="button" data-new>${icon('plus', 17)} Nueva orden</button>
        `,
      })}

      <div class="card">
        <div class="table-toolbar">
          <form class="filters" id="orders-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Folio, cliente, placas, vehículo…" value="${escapeHtml(state.search)}" aria-label="Buscar órdenes" />
            </div>
            <select class="select" name="status" style="width:auto" aria-label="Filtrar por estado">
              ${orderStatusOptions(state.status)}
            </select>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <select class="select" name="clientId" style="width:auto;max-width:210px" aria-label="Filtrar por cliente">
              ${options(clients.map((c) => ({ value: c.id, label: c.name })), state.clientId, { placeholder: 'Todos los clientes' })}
            </select>
            <input class="input" type="date" name="from" value="${escapeHtml(state.from)}" aria-label="Desde" style="width:auto" title="Fecha de recepción desde" />
            <input class="input" type="date" name="to" value="${escapeHtml(state.to)}" aria-label="Hasta" style="width:auto" title="Fecha de recepción hasta" />
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Aplicar</button>
            ${activeFilterCount() ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('clipboard', 13)} ${orders.length} resultado${orders.length === 1 ? '' : 's'}</span>
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
                <th style="text-align:right">Total</th>
                <th style="text-align:right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${pageData.items.length ? pageData.items.map((order) => `
                <tr>
                  <td>
                    <a class="cell-main mono" href="#/admin/ordenes/${encodeURIComponent(order.id)}" style="text-decoration:none">${escapeHtml(order.folio)}</a>
                    <span class="cell-sub">${order.estimatedAt ? `Entrega est. ${formatDate(order.estimatedAt)}` : 'Sin fecha estimada'}</span>
                  </td>
                  <td>
                    <span class="cell-main">${escapeHtml(order.clientName)}</span>
                    <span class="cell-sub">${escapeHtml(order.vehicleLabel)} · ${escapeHtml(order.plates)}</span>
                  </td>
                  <td>${escapeHtml(order.service)}</td>
                  <td>${orderStatusBadge(order.status)}</td>
                  <td>${formatDate(order.receivedAt)}</td>
                  <td style="text-align:right"><strong style="font-family:var(--font-display)">${money(order.total)}</strong></td>
                  <td>
                    <div class="row-actions">
                      <a class="btn-icon btn-ghost btn-sm" href="#/admin/ordenes/${encodeURIComponent(order.id)}" title="Ver detalle" aria-label="Ver detalle de la orden">${icon('eye', 15)}</a>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-edit="${escapeHtml(order.id)}" title="Editar" aria-label="Editar orden">${icon('edit', 15)}</button>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-delete="${escapeHtml(order.id)}" title="Eliminar" aria-label="Eliminar orden" style="color:var(--red)">${icon('trash', 15)}</button>
                    </div>
                  </td>
                </tr>
              `).join('') : emptyTableRow(7, activeFilterCount()
                ? 'Ninguna orden coincide con los filtros seleccionados.'
                : 'Aún no hay órdenes de servicio. Crea la primera con el botón “Nueva orden”.')}
            </tbody>
          </table>
        </div>

        ${pagination({ ...pageData, prefix: 'orders' })}
      </div>

      <div class="alert alert-info mt-2">
        ${icon('info', 18)}
        <div>Los folios se generan automáticamente con el formato <strong>RR-AÑO-0001</strong> y son únicos. Los costos y estados solo pueden modificarlos los administradores.</div>
      </div>
    `;
    bind();
  }

  function findOrder(id) {
    return orders.find((o) => o.id === id) || null;
  }

  function bind() {
    const form = root.querySelector('#orders-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.status = String(fd.get('status') || '');
      state.service = String(fd.get('service') || '');
      state.clientId = String(fd.get('clientId') || '');
      state.from = String(fd.get('from') || '');
      state.to = String(fd.get('to') || '');
      state.page = 1;
      load();
    });
    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.search = '';
      state.status = '';
      state.service = '';
      state.clientId = '';
      state.from = '';
      state.to = '';
      state.page = 1;
      load();
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', load);

    root.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page) || 1;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    const openNew = () => {
      if (!clients.length) {
        toast('Registra primero un cliente y su vehículo para crear una orden.', { type: 'warning', duration: 6000 });
        return;
      }
      openOrderModal({
        defaultClientId: state.clientId || '',
        onSaved: (saved) => navigate(`/admin/ordenes/${encodeURIComponent(saved.id)}`),
      });
    };
    root.querySelector('[data-new]')?.addEventListener('click', openNew);

    root.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const order = findOrder(button.dataset.edit);
        if (order) openOrderModal({ order, onSaved: load });
      });
    });
    root.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => removeOrder(findOrder(button.dataset.delete)));
    });
  }

  async function removeOrder(order) {
    if (!order) return;
    const ok = await confirmDialog({
      title: `Eliminar orden ${order.folio}`,
      message: `Se eliminará la orden <strong>${escapeHtml(order.folio)}</strong> de <strong>${escapeHtml(order.clientName)}</strong> (${escapeHtml(order.vehicleLabel)}), junto con sus fotografías e historial.`,
      details: 'El folio no se reutilizará. Esta acción no se puede deshacer desde la aplicación.',
      confirmText: 'Eliminar orden',
      danger: true,
      requireText: 'ELIMINAR',
      requireLabel: `Escribe ELIMINAR para confirmar`,
    });
    if (!ok) return;
    try {
      await deleteOrder(order.id);
      toast(`Orden ${order.folio} eliminada.`, { type: 'success' });
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  await load();
  void ctx;
  void todayISO;

  // Abre automáticamente el formulario cuando se llega con ?nueva=1
  if (route.query.get('nueva') === '1') {
    history.replaceState(null, '', '#/admin/ordenes' + (state.clientId ? `?clientId=${encodeURIComponent(state.clientId)}` : ''));
    setTimeout(() => root.querySelector('[data-new]')?.click(), 120);
  }
}
