/* ============================================================
   RR CARS · Modal de creación / edición de órdenes (admin)
   ============================================================ */

import { openModal, toast, toastError, setButtonLoading } from '../core/ui.js';
import { icon } from '../core/icons.js';
import {
  escapeHtml, money, setFieldError, clearFieldErrors, todayISO, isValidDateOnly, round2,
} from '../core/utils.js';
import { SERVICES, ORDER_STATUSES, COST_FIELDS } from '../core/constants.js';
import {
  getClientOptions, getVehicleOptions, createOrder, updateOrder,
} from '../services.js';
import { clientOptions, options, vehicleOptions } from './partials.js';

export async function openOrderModal({ order = null, defaultClientId = '', onSaved = null } = {}) {
  let clients = [];
  try {
    clients = await getClientOptions();
  } catch (error) {
    toastError(error);
    return null;
  }

  if (!clients.length) {
    openModal({
      title: 'No hay clientes registrados',
      size: 'sm',
      body: `<div class="alert alert-info">${icon('info', 18)}<div>Para crear una orden de servicio primero debe existir una cuenta de cliente registrada y autorizada.</div></div>`,
      footer: '<button type="button" class="btn btn-primary" data-close>Entendido</button>',
      onMount: (modal, close) => modal.querySelector('[data-close]').addEventListener('click', close),
    });
    return null;
  }

  const editing = Boolean(order);
  const selectedClient = order?.clientId || defaultClientId || clients[0]?.id || '';
  let vehicles = [];
  try {
    vehicles = await getVehicleOptions(selectedClient);
  } catch (error) {
    toastError(error);
  }

  const costs = order?.costs || {};
  const costInputs = COST_FIELDS.map((field) => `
    <div class="field">
      <label for="c-${field.key}">${field.label}</label>
      <input class="input" id="c-${field.key}" name="cost_${field.key}" type="number" min="0" step="0.01" inputmode="decimal"
             value="${Number(costs[field.key] || 0) ? Number(costs[field.key]).toFixed(2) : ''}" placeholder="0.00" data-cost />
    </div>
  `).join('');

  const body = `
    <form id="order-form" class="col" style="gap:18px" novalidate>
      <div class="form-section">
        <div class="form-section-title">${icon('user', 15)} Cliente y vehículo</div>
        <div class="form-grid">
          <div class="field">
            <label for="o-client">Cliente <span class="req">*</span></label>
            <select class="select" id="o-client" name="clientId">${clientOptions(clients, selectedClient)}</select>
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-vehicle">Vehículo <span class="req">*</span></label>
            <select class="select" id="o-vehicle" name="vehicleId">
              ${vehicleOptions(vehicles, order?.vehicleId || '', { placeholder: 'Selecciona el vehículo' })}
            </select>
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-service">Servicio <span class="req">*</span></label>
            <select class="select" id="o-service" name="service">
              ${options(SERVICES, order?.service || '', { placeholder: 'Selecciona el servicio' })}
            </select>
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-status">Estado de reparación <span class="req">*</span></label>
            <select class="select" id="o-status" name="status">
              ${options(ORDER_STATUSES.map((s) => ({ value: s.key, label: s.label })), order?.status || 'recibido')}
            </select>
            <span class="error-text"></span>
          </div>
        </div>
        <div id="vehicle-note" class="mt-2"></div>
      </div>

      <div class="form-section">
        <div class="form-section-title">${icon('calendar', 15)} Fechas</div>
        <div class="form-grid">
          <div class="field">
            <label for="o-received">Fecha de recepción <span class="req">*</span></label>
            <input class="input" id="o-received" name="receivedAt" type="date" value="${escapeHtml(order?.receivedAt || todayISO())}" />
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-estimated">Fecha estimada de entrega</label>
            <input class="input" id="o-estimated" name="estimatedAt" type="date" value="${escapeHtml(order?.estimatedAt || '')}" />
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-delivered">Fecha real de entrega</label>
            <input class="input" id="o-delivered" name="deliveredAt" type="date" value="${escapeHtml(order?.deliveredAt || '')}" />
            <span class="hint">Se completa automáticamente al cambiar el estado a “Entregado”.</span>
            <span class="error-text"></span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">${icon('clipboard', 15)} Trabajo a realizar</div>
        <div class="col" style="gap:14px">
          <div class="field">
            <label for="o-damage">Daños detectados</label>
            <textarea class="textarea" id="o-damage" name="damageDescription" maxlength="3000" placeholder="Descripción de golpes, rayones, piezas y zonas afectadas…">${escapeHtml(order?.damageDescription || '')}</textarea>
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-work">Trabajos requeridos</label>
            <textarea class="textarea" id="o-work" name="requestedWork" maxlength="3000" style="min-height:80px" placeholder="Enderezado, pintura de panel, cambio de pieza, pulido…">${escapeHtml(order?.requestedWork || '')}</textarea>
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="o-notes">Observaciones visibles para el cliente</label>
            <textarea class="textarea" id="o-notes" name="notes" maxlength="2000" style="min-height:72px" placeholder="Avances, recomendaciones, fechas de entrega, etc.">${escapeHtml(order?.notes || '')}</textarea>
            <span class="hint">El cliente puede leer estas observaciones desde su portal.</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">${icon('dollar', 15)} Costos de la reparación</div>
        <div class="cost-grid">${costInputs}
          <div class="field">
            <label for="c-discount">Descuento</label>
            <input class="input" id="c-discount" name="cost_discount" type="number" min="0" step="0.01" inputmode="decimal"
                   value="${Number(costs.discount || 0) ? Number(costs.discount).toFixed(2) : ''}" placeholder="0.00" data-cost />
          </div>
        </div>
        <div class="cost-total mt-2">
          <span class="label">Total de la reparación</span>
          <span class="value" data-total>${money(order?.total || 0)}</span>
        </div>
        <p class="hint mt-1">El total se calcula automáticamente: mano de obra + materiales + pintura + refacciones + otros − descuento.</p>
      </div>
    </form>
  `;

  return openModal({
    title: editing ? `Editar orden ${order.folio}` : 'Nueva orden de servicio',
    subtitle: editing ? 'Actualiza los datos, costos o estado de la reparación.' : 'Asocia un cliente y su vehículo; el folio se genera automáticamente.',
    size: 'xl',
    body,
    footer: `
      <button type="button" class="btn" data-cancel>Cancelar</button>
      <button type="submit" form="order-form" class="btn btn-primary" data-save>
        ${icon('save', 16)} ${editing ? 'Guardar cambios' : 'Crear orden de servicio'}
      </button>
    `,
    onMount: (modal, close) => {
      const form = modal.querySelector('#order-form');
      const saveBtn = modal.querySelector('[data-save]');
      const clientSelect = form.querySelector('#o-client');
      const vehicleSelect = form.querySelector('#o-vehicle');
      const vehicleNote = form.querySelector('#vehicle-note');
      const totalEl = form.querySelector('[data-total]');
      let loadingVehicles = false;

      modal.querySelector('[data-cancel]').addEventListener('click', close);

      const refreshVehicles = async (preselect = '') => {
        const clientId = clientSelect.value;
        vehicleSelect.innerHTML = '<option value="">Cargando vehículos…</option>';
        vehicleSelect.disabled = true;
        loadingVehicles = true;
        vehicleNote.innerHTML = '';
        try {
          const list = await getVehicleOptions(clientId);
          vehicleSelect.disabled = false;
          vehicleSelect.innerHTML = vehicleOptions(list, preselect, { placeholder: list.length ? 'Selecciona el vehículo' : 'Sin vehículos registrados' });
          if (!list.length) {
            vehicleNote.innerHTML = `<div class="alert alert-warning">${icon('alertTriangle', 16)}<div>Este cliente no tiene vehículos registrados. Regístralo desde el módulo <strong>Vehículos</strong> antes de crear la orden.</div></div>`;
          } else if (list.length === 1) {
            vehicleSelect.value = list[0].id;
          }
        } catch (error) {
          vehicleSelect.disabled = false;
          vehicleSelect.innerHTML = '<option value="">Error al cargar vehículos</option>';
          toastError(error);
        } finally {
          loadingVehicles = false;
        }
      };

      clientSelect.addEventListener('change', () => refreshVehicles());
      if (!editing && defaultClientId) {
        refreshVehicles();
      } else if (!vehicleSelect.value && vehicleSelect.options.length === 2) {
        // Si el cliente solo tiene un vehículo, seleccionarlo automáticamente.
        vehicleSelect.selectedIndex = 1;
      }

      const updateTotal = () => {
        let subtotal = 0;
        COST_FIELDS.forEach((field) => {
          subtotal += Number(form.querySelector(`#c-${field.key}`)?.value) || 0;
        });
        const discount = Number(form.querySelector('#c-discount')?.value) || 0;
        totalEl.textContent = money(Math.max(0, round2(subtotal - discount)));
        if (discount > subtotal) {
          totalEl.style.color = 'var(--red)';
        } else {
          totalEl.style.color = '';
        }
      };
      form.querySelectorAll('[data-cost]').forEach((input) => input.addEventListener('input', updateTotal));
      updateTotal();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (loadingVehicles) {
          toast('Espera a que se carguen los vehículos del cliente.', { type: 'warning' });
          return;
        }
        clearFieldErrors(form);
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        let valid = true;

        if (!payload.clientId) {
          setFieldError(clientSelect, 'Selecciona un cliente.');
          valid = false;
        }
        if (!payload.vehicleId) {
          setFieldError(vehicleSelect, 'Selecciona un vehículo.');
          valid = false;
        }
        if (!payload.service) {
          setFieldError(form.elements.service, 'Selecciona el servicio.');
          valid = false;
        }
        if (!isValidDateOnly(payload.receivedAt)) {
          setFieldError(form.elements.receivedAt, 'Indica una fecha de recepción válida.');
          valid = false;
        }
        if (payload.estimatedAt && !isValidDateOnly(payload.estimatedAt)) {
          setFieldError(form.elements.estimatedAt, 'La fecha estimada no es válida.');
          valid = false;
        }
        if (payload.estimatedAt && payload.receivedAt && payload.estimatedAt < payload.receivedAt) {
          setFieldError(form.elements.estimatedAt, 'No puede ser anterior a la recepción.');
          valid = false;
        }
        if (payload.deliveredAt && !isValidDateOnly(payload.deliveredAt)) {
          setFieldError(form.elements.deliveredAt, 'La fecha real de entrega no es válida.');
          valid = false;
        }
        if (!valid) {
          form.querySelector('.field.invalid .input, .field.invalid .select, .field.invalid .textarea')?.focus();
          return;
        }

        payload.costs = normalizeCostForm(fd);
        try {
          setButtonLoading(saveBtn, true);
          const saved = editing ? await updateOrder(order.id, payload) : await createOrder(payload);
          toast(editing ? 'Orden actualizada correctamente.' : `Orden ${saved.folio} creada correctamente.`, { type: 'success' });
          close();
          await onSaved?.(saved);
        } catch (error) {
          setButtonLoading(saveBtn, false);
          toastError(error);
        }
      });
    },
  });
}

function normalizeCostForm(formData) {
  const costs = {};
  for (const field of COST_FIELDS) {
    costs[field.key] = Number(formData.get(`cost_${field.key}`)) || 0;
  }
  costs.discount = Number(formData.get('cost_discount')) || 0;
  return costs;
}
