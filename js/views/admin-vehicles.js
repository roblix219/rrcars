/* ============================================================
   RR CARS · Panel de administrador: gestión de vehículos
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { loadingBlock, toast, toastError, confirmDialog, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { listVehicles, deleteVehicle, getClientOptions } from '../services.js';
import { openVehicleModal, openVehicleHistoryModal } from './vehicle-modal.js';
import {
  pageHead, pagination, emptyTableRow, slicePage, serviceOptions, options,
} from './partials.js';

const PER_PAGE = 10;

export async function renderAdminVehicles(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    ownerId: route.query.get('owner') || '',
    service: route.query.get('service') || '',
    page: Number(route.query.get('page')) || 1,
  };
  let vehicles = [];
  let clients = [];

  root.innerHTML = loadingBlock('Cargando vehículos…');

  async function load() {
    try {
      [vehicles, clients] = await Promise.all([
        listVehicles({ search: state.search, ownerId: state.ownerId, service: state.service }),
        getClientOptions(),
      ]);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function render() {
    const pageData = slicePage(vehicles, state.page, PER_PAGE);
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Vehículos',
        title: 'Vehículos del taller',
        subtitle: `${vehicles.length} vehículo${vehicles.length === 1 ? '' : 's'} ${state.search || state.ownerId || state.service ? 'con los filtros aplicados' : 'registrados en el sistema'}`,
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <button class="btn btn-primary" type="button" data-new>${icon('plus', 17)} Registrar vehículo</button>
        `,
      })}

      <div class="card">
        <div class="table-toolbar">
          <form class="filters" id="vehicles-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Marca, modelo, placas o propietario…" value="${escapeHtml(state.search)}" aria-label="Buscar vehículos" />
            </div>
            <select class="select" name="owner" style="width:auto;max-width:220px" aria-label="Filtrar por propietario">
              ${options(clients.map((c) => ({ value: c.id, label: c.name })), state.ownerId, { placeholder: 'Todos los propietarios' })}
            </select>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Filtrar</button>
            ${state.search || state.ownerId || state.service ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('car', 13)} ${vehicles.length} resultado${vehicles.length === 1 ? '' : 's'}</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Placas</th>
                <th>Propietario</th>
                <th>Servicio</th>
                <th>Registro</th>
                <th style="text-align:right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${pageData.items.length ? pageData.items.map((vehicle) => `
                <tr data-vehicle-row="${escapeHtml(vehicle.id)}">
                  <td>
                    <span class="cell-main">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} ${escapeHtml(String(vehicle.year))}</span>
                    <span class="cell-sub">${escapeHtml(vehicle.color)} · ${escapeHtml((vehicle.damageDescription || 'Sin daños descritos').slice(0, 52))}${(vehicle.damageDescription || '').length > 52 ? '…' : ''}</span>
                  </td>
                  <td><span class="plate">${escapeHtml(vehicle.plates)}</span></td>
                  <td>
                    <span class="cell-main" style="font-weight:500">${escapeHtml(vehicle.ownerName)}</span>
                    <span class="cell-sub">${escapeHtml(vehicle.ownerPhone || vehicle.ownerEmail || '')}</span>
                  </td>
                  <td><span class="chip">${escapeHtml(vehicle.service)}</span></td>
                  <td>${formatDate(vehicle.createdAt)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-history="${escapeHtml(vehicle.id)}" title="Historial" aria-label="Historial del vehículo">${icon('history', 15)}</button>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-edit="${escapeHtml(vehicle.id)}" title="Editar" aria-label="Editar vehículo">${icon('edit', 15)}</button>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-delete="${escapeHtml(vehicle.id)}" title="Eliminar" aria-label="Eliminar vehículo" style="color:var(--red)">${icon('trash', 15)}</button>
                    </div>
                  </td>
                </tr>
              `).join('') : emptyTableRow(6, state.search || state.ownerId || state.service
                ? 'Ningún vehículo coincide con los filtros seleccionados.'
                : 'Aún no hay vehículos registrados. Captura el primero con el botón “Registrar vehículo”.')}
            </tbody>
          </table>
        </div>

        ${pagination({ ...pageData, prefix: 'vehicles' })}
      </div>

      <div class="alert alert-info mt-2">
        ${icon('info', 18)}
        <div>El registro de vehículos no solicita VIN ni fotografías. Las fotografías de avance se cargan desde la orden de servicio, quedan guardadas localmente y son visibles para el propietario.</div>
      </div>
    `;
    bind();
  }

  function findVehicle(id) {
    return vehicles.find((v) => v.id === id) || null;
  }

  function bind() {
    const form = root.querySelector('#vehicles-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.ownerId = String(fd.get('owner') || '');
      state.service = String(fd.get('service') || '');
      state.page = 1;
      load();
    });
    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.search = '';
      state.ownerId = '';
      state.service = '';
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
        toast('Primero debe existir un cliente registrado para asignarle un vehículo.', { type: 'warning', duration: 6000 });
        return;
      }
      openVehicleModal({ clients, isAdmin: true, onSaved: load });
    };
    root.querySelector('[data-new]')?.addEventListener('click', openNew);

    root.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const vehicle = findVehicle(button.dataset.edit);
        if (!vehicle) return;
        openVehicleModal({ vehicle, clients, isAdmin: true, onSaved: load });
      });
    });
    root.querySelectorAll('[data-history]').forEach((button) => {
      button.addEventListener('click', async () => {
        const vehicle = findVehicle(button.dataset.history);
        if (vehicle) await openVehicleHistoryModal(vehicle, { role: 'admin' });
      });
    });
    root.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => removeVehicle(findVehicle(button.dataset.delete)));
    });
    root.querySelectorAll('[data-vehicle-row]').forEach((row) => {
      row.addEventListener('dblclick', () => {
        const vehicle = findVehicle(row.dataset.vehicleRow);
        if (!vehicle) return;
        openVehicleModal({ vehicle, clients, isAdmin: true, onSaved: load });
      });
    });
  }

  async function removeVehicle(vehicle) {
    if (!vehicle) return;
    const ok = await confirmDialog({
      title: 'Eliminar vehículo',
      message: `¿Eliminar <strong>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} ${escapeHtml(String(vehicle.year))}</strong> con placas <strong>${escapeHtml(vehicle.plates)}</strong>?`,
      details: 'Solo es posible eliminar vehículos sin órdenes de servicio asociadas. Si tiene órdenes, elimínalas primero desde el módulo de órdenes.',
      confirmText: 'Eliminar vehículo',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteVehicle(vehicle.id);
      toast('Vehículo eliminado correctamente.', { type: 'success' });
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  await load();
  void emptyState;
  void ctx;
}
