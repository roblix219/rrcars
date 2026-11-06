/* ============================================================
   RR CARS · Portal del cliente: mis vehículos
   ============================================================ */

import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { loadingBlock, toast, toastError, confirmDialog, emptyState } from '../core/ui.js';
import { getRoute } from '../core/router.js';
import { listVehicles, deleteVehicle } from '../services.js';
import { openVehicleModal, openVehicleHistoryModal } from './vehicle-modal.js';
import { pageHead, serviceOptions, vehicleCard } from './partials.js';

export async function renderClientVehicles(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    service: route.query.get('service') || '',
  };
  let vehicles = [];

  root.innerHTML = loadingBlock('Cargando tus vehículos…');

  async function load() {
    try {
      vehicles = await listVehicles({ search: state.search, service: state.service });
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function filtered() {
    return Boolean(state.search || state.service);
  }

  function findVehicle(id) {
    return vehicles.find((v) => v.id === id) || null;
  }

  function render() {
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Mis vehículos',
        title: 'Vehículos registrados',
        subtitle: `${vehicles.length} vehículo${vehicles.length === 1 ? '' : 's'} ${filtered() ? 'con los filtros aplicados' : 'bajo tu cuenta'}. Solo tú y el taller pueden consultarlos.`,
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <button class="btn btn-primary" type="button" data-new>${icon('plus', 17)} Registrar vehículo</button>
        `,
      })}

      <div class="card" style="margin-bottom:16px">
        <div class="table-toolbar">
          <form class="filters" id="client-vehicles-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" placeholder="Marca, modelo, placas o color…" value="${escapeHtml(state.search)}" aria-label="Buscar mis vehículos" />
            </div>
            <select class="select" name="service" style="width:auto" aria-label="Filtrar por servicio">
              ${serviceOptions(state.service)}
            </select>
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Filtrar</button>
            ${filtered() ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('car', 13)} ${vehicles.length} resultado${vehicles.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      ${vehicles.length ? `
        <div class="vehicle-grid">
          ${vehicles.map((vehicle) => vehicleCard(vehicle, { canManage: true })).join('')}
        </div>` : emptyState({
          iconName: 'car',
          title: filtered() ? 'Sin resultados' : 'Aún no has registrado vehículos',
          text: filtered()
            ? 'Ningún vehículo coincide con los filtros seleccionados. Prueba con otro término.'
            : 'Registra los datos de tu automóvil para que el taller pueda crear la orden de servicio y dar seguimiento a la reparación.',
          action: filtered()
            ? '<button class="btn btn-outline" type="button" data-clear>Limpiar filtros</button>'
            : '<button class="btn btn-primary" type="button" data-new>Registrar mi primer vehículo</button>',
        })}

      <div class="alert alert-info mt-2">
        ${icon('info', 18)}
        <div>El registro solicita marca, modelo, año, color, placas, daños y servicio. No se pide VIN ni fotografías del vehículo:
        las fotografías de avance las agrega el taller desde la orden de servicio.</div>
      </div>
    `;
    bind();
  }

  function bind() {
    const form = root.querySelector('#client-vehicles-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.search = String(fd.get('q') || '').trim();
      state.service = String(fd.get('service') || '');
      load();
    });
    root.querySelectorAll('[data-clear]').forEach((button) => {
      button.addEventListener('click', () => {
        state.search = '';
        state.service = '';
        load();
      });
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', load);

    const openNew = () => openVehicleModal({ isAdmin: false, onSaved: load });
    root.querySelectorAll('[data-new]').forEach((button) => button.addEventListener('click', openNew));

    root.querySelectorAll('[data-vehicle-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const vehicle = findVehicle(button.dataset.vehicleEdit);
        if (vehicle) openVehicleModal({ vehicle, isAdmin: false, onSaved: load });
      });
    });
    root.querySelectorAll('[data-vehicle-history]').forEach((button) => {
      button.addEventListener('click', async () => {
        const vehicle = findVehicle(button.dataset.vehicleHistory);
        if (vehicle) await openVehicleHistoryModal(vehicle, { role: 'client' });
      });
    });
    root.querySelectorAll('[data-vehicle-delete]').forEach((button) => {
      button.addEventListener('click', () => removeVehicle(findVehicle(button.dataset.vehicleDelete)));
    });
  }

  async function removeVehicle(vehicle) {
    if (!vehicle) return;
    const ok = await confirmDialog({
      title: 'Eliminar vehículo',
      message: `¿Eliminar <strong>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} ${escapeHtml(String(vehicle.year))}</strong> con placas <strong>${escapeHtml(vehicle.plates)}</strong>?`,
      details: 'Solo puedes eliminar vehículos que no tengan órdenes de servicio. Si ya tiene órdenes, contacta al taller.',
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
  void ctx;
}
