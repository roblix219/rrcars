/* ============================================================
   RR CARS · Modal compartido de vehículos (admin y cliente)
   ============================================================ */

import { openModal, toast, toastError, setButtonLoading, loadingBlock, orderStatusBadge } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatDate, money, setFieldError, clearFieldErrors, isValidYear } from '../core/utils.js';
import { SERVICES } from '../core/constants.js';
import { createVehicle, updateVehicle, getVehicleHistory } from '../services.js';
import { clientOptions, options } from './partials.js';

export function openVehicleModal({ vehicle = null, clients = [], isAdmin = false, onSaved = null } = {}) {
  const editing = Boolean(vehicle);
  const body = `
    <form id="vehicle-form" class="col" style="gap:18px" novalidate>
      ${isAdmin ? `
        <div class="field span-2">
          <label for="v-owner">Propietario <span class="req">*</span></label>
          <select class="select" id="v-owner" name="ownerId">
            ${clientOptions(clients, vehicle?.ownerId || '', { placeholder: 'Selecciona el cliente propietario' })}
          </select>
          <span class="error-text"></span>
        </div>` : ''}
      <div class="form-grid">
        <div class="field">
          <label for="v-brand">Marca <span class="req">*</span></label>
          <input class="input" id="v-brand" name="brand" maxlength="60" placeholder="Ej. Nissan" value="${escapeHtml(vehicle?.brand || '')}" autocomplete="off" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="v-model">Modelo <span class="req">*</span></label>
          <input class="input" id="v-model" name="model" maxlength="60" placeholder="Ej. Versa" value="${escapeHtml(vehicle?.model || '')}" autocomplete="off" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="v-year">Año <span class="req">*</span></label>
          <input class="input" id="v-year" name="year" type="number" inputmode="numeric" min="1950" max="${new Date().getFullYear() + 1}" placeholder="Ej. 2021" value="${escapeHtml(vehicle?.year || '')}" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="v-color">Color <span class="req">*</span></label>
          <input class="input" id="v-color" name="color" maxlength="40" placeholder="Ej. Rojo" value="${escapeHtml(vehicle?.color || '')}" autocomplete="off" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="v-plates">Placas <span class="req">*</span></label>
          <input class="input mono" id="v-plates" name="plates" maxlength="20" placeholder="Ej. ABC-123-A" value="${escapeHtml(vehicle?.plates || '')}" autocomplete="off" style="text-transform:uppercase" />
          <span class="hint">Se validan para evitar vehículos duplicados.</span>
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="v-service">Servicio que necesita <span class="req">*</span></label>
          <select class="select" id="v-service" name="service">
            ${options(SERVICES, vehicle?.service || '', { placeholder: 'Selecciona un servicio' })}
          </select>
          <span class="error-text"></span>
        </div>
        <div class="field span-2">
          <label for="v-damage">Descripción de los daños <span class="req">*</span></label>
          <textarea class="textarea" id="v-damage" name="damageDescription" maxlength="2000" placeholder="Describe los golpes, rayones, piezas dañadas y zonas afectadas…">${escapeHtml(vehicle?.damageDescription || '')}</textarea>
          <span class="hint">Sin VIN ni fotografías en este formulario. Las fotos de avance se agregan en la orden de servicio.</span>
          <span class="error-text"></span>
        </div>
        <div class="field span-2">
          <label for="v-notes">Observaciones adicionales</label>
          <textarea class="textarea" id="v-notes" name="notes" maxlength="1000" style="min-height:72px" placeholder="Opcional: detalles de uso, horario de contacto, etc.">${escapeHtml(vehicle?.notes || '')}</textarea>
          <span class="error-text"></span>
        </div>
      </div>
    </form>
  `;

  const handle = openModal({
    title: editing ? 'Editar vehículo' : 'Registrar vehículo',
    subtitle: editing ? 'Actualiza la información del automóvil.' : 'Captura los datos del automóvil que ingresará al taller.',
    size: 'lg',
    body,
    footer: `
      <button type="button" class="btn" data-cancel>Cancelar</button>
      <button type="submit" form="vehicle-form" class="btn btn-primary" data-save>
        ${icon('save', 16)} ${editing ? 'Guardar cambios' : 'Registrar vehículo'}
      </button>
    `,
    onMount: (modal, close) => {
      const form = modal.querySelector('#vehicle-form');
      const saveBtn = modal.querySelector('[data-save]');
      modal.querySelector('[data-cancel]').addEventListener('click', close);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFieldErrors(form);
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        payload.brand = String(payload.brand || '').trim();
        payload.model = String(payload.model || '').trim();
        payload.year = String(payload.year || '').trim();
        payload.color = String(payload.color || '').trim();
        payload.plates = String(payload.plates || '').trim().toUpperCase();
        payload.damageDescription = String(payload.damageDescription || '').trim();
        payload.notes = String(payload.notes || '').trim();

        let valid = true;
        const requireField = (name, message, test = (v) => v.length > 0) => {
          const input = form.elements[name];
          if (!test(String(payload[name] || ''))) {
            setFieldError(input, message);
            valid = false;
          }
        };
        if (isAdmin) requireField('ownerId', 'Selecciona al propietario.');
        requireField('brand', 'Indica la marca.');
        requireField('model', 'Indica el modelo.');
        if (!isValidYear(payload.year)) {
          setFieldError(form.elements.year, `Escribe un año entre 1950 y ${new Date().getFullYear() + 1}.`);
          valid = false;
        }
        requireField('color', 'Indica el color.', (v) => v.length >= 2);
        requireField('plates', 'Indica las placas.', (v) => v.length >= 4);
        requireField('service', 'Selecciona el servicio.');
        requireField('damageDescription', 'Describe brevemente los daños.', (v) => v.length >= 5);

        if (!valid) {
          form.querySelector('.field.invalid .input, .field.invalid .select, .field.invalid .textarea')?.focus();
          return;
        }

        try {
          setButtonLoading(saveBtn, true);
          const saved = editing ? await updateVehicle(vehicle.id, payload) : await createVehicle(payload);
          toast(editing ? 'Vehículo actualizado correctamente.' : 'Vehículo registrado correctamente.', { type: 'success' });
          close();
          await onSaved?.(saved);
        } catch (error) {
          setButtonLoading(saveBtn, false);
          if (error?.code === 'duplicate-plates' || /placas/i.test(error?.message || '')) {
            setFieldError(form.elements.plates, error.message);
          }
          toastError(error);
        }
      });
    },
  });
  return handle;
}

export async function openVehicleHistoryModal(vehicle, { role = 'client' } = {}) {
  if (!vehicle) return;
  const handle = openModal({
    title: 'Historial del vehículo',
    subtitle: `${vehicle.brand} ${vehicle.model} ${vehicle.year} · ${vehicle.plates}`,
    size: 'lg',
    body: loadingBlock('Cargando historial…'),
    footer: `<button type="button" class="btn" data-close>${icon('x', 15)} Cerrar</button>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-close]').addEventListener('click', close);
    },
  });

  try {
    const orders = await getVehicleHistory(vehicle.id);
    const body = handle.element.querySelector('.modal-body');
    body.innerHTML = orders.length ? `
      <div class="note-box" style="margin-bottom:14px">
        <strong>${orders.length}</strong> orden${orders.length === 1 ? '' : 'es'} de servicio registrada${orders.length === 1 ? '' : 's'} para este vehículo.
      </div>
      <div class="table-wrap">
        <table class="data-table" style="min-width:560px">
          <thead><tr><th>Folio</th><th>Servicio</th><th>Estado</th><th>Recepción</th><th>Entrega</th><th>Total</th></tr></thead>
          <tbody>
            ${orders.map((order) => `
              <tr>
                <td>
                  <a href="#/${role === 'admin' ? 'admin' : 'cliente'}/ordenes/${encodeURIComponent(order.id)}"
                     data-order-link="${escapeHtml(order.id)}" class="mono strong">${escapeHtml(order.folio)}</a>
                </td>
                <td>${escapeHtml(order.service)}</td>
                <td>${orderStatusBadge(order.status)}</td>
                <td>${formatDate(order.receivedAt)}</td>
                <td>${order.deliveredAt ? formatDate(order.deliveredAt) : order.estimatedAt ? `Est. ${formatDate(order.estimatedAt)}` : '—'}</td>
                <td>${money(order.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `<div class="note-box empty">Este vehículo aún no tiene órdenes de servicio registradas.</div>`;
    body.querySelectorAll('[data-order-link]').forEach((link) => {
      link.addEventListener('click', () => handle.close());
    });
  } catch (error) {
    handle.element.querySelector('.modal-body').innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 17)}<span>${escapeHtml(error.message)}</span></div>`;
  }
}
