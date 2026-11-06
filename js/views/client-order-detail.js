/* ============================================================
   RR CARS · Portal del cliente: detalle de una orden (solo lectura)
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatDateTime, money, todayISO,
} from '../core/utils.js';
import { ORDER_STATUS_MAP, COST_FIELDS } from '../core/constants.js';
import {
  loadingBlock, toast, toastError, orderStatusBadge, renderStepper, renderTimeline,
  renderGallery, openLightbox,
} from '../core/ui.js';
import { getOrderDetail } from '../services.js';

export async function renderClientOrderDetail(root, ctx, params = {}) {
  const orderId = params.id;
  let detail = null;
  let activeTab = 'resumen';

  root.innerHTML = loadingBlock('Cargando el detalle de tu orden…');

  async function load() {
    try {
      detail = await getOrderDetail(orderId);
      render();
    } catch (error) {
      if (error?.code === 'forbidden' || error?.code === 'not-found') {
        toast(error.message, { type: 'warning' });
      } else {
        toastError(error);
      }
      root.innerHTML = `
        <div class="notfound">
          <div class="code">404</div>
          <h1>Orden no disponible</h1>
          <p>${escapeHtml(error.message)}</p>
          <a class="btn btn-primary" href="#/cliente/ordenes">${icon('arrowLeft', 16)} Volver a mis órdenes</a>
        </div>`;
    }
  }

  function render() {
    const { order, photos, events, vehicle } = detail;
    const statusMeta = ORDER_STATUS_MAP[order.status] || {};
    const costs = order.costs || {};
    const subtotal = COST_FIELDS.reduce((acc, field) => acc + (Number(costs[field.key]) || 0), 0);
    const discount = Number(costs.discount) || 0;
    const activeStatus = ['recibido', 'diagnostico', 'hojalateria', 'pintura', 'revision'];
    const overdue = activeStatus.includes(order.status) && order.estimatedAt && order.estimatedAt < todayISO();

    root.innerHTML = `
      <div class="breadcrumb">
        <a href="#/cliente/ordenes">Mis órdenes</a> ${icon('chevronRight', 12)}
        <span>${escapeHtml(order.folio)}</span>
      </div>

      <div class="detail-header-card" style="margin-bottom:16px">
        <div class="detail-header-top">
          <div>
            <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
              <h1 class="mono" style="letter-spacing:0.02em">${escapeHtml(order.folio)}</h1>
              ${orderStatusBadge(order.status)}
              ${overdue ? `<span class="badge badge-rejected">Entrega vencida</span>` : ''}
            </div>
            <div class="detail-sub">
              ${escapeHtml(order.vehicleLabel)} · <span class="mono">${escapeHtml(order.plates)}</span> ·
              ${escapeHtml(order.service)}
            </div>
            <div class="detail-header-meta">
              <span class="chip">${icon('calendar', 13)} Recepción ${formatDate(order.receivedAt)}</span>
              <span class="chip">${icon('clock', 13)} ${order.estimatedAt ? `Entrega estimada ${formatDate(order.estimatedAt)}` : 'Sin fecha estimada'}</span>
              ${order.deliveredAt ? `<span class="chip">${icon('checkCircle', 13)} Entregado ${formatDate(order.deliveredAt)}</span>` : ''}
              <span class="chip">${icon('car', 13)} ${escapeHtml(order.vehicleColor || '')}</span>
            </div>
          </div>
          <div class="detail-actions">
            <a class="btn btn-outline btn-sm" href="#/cliente/ordenes">${icon('arrowLeft', 15)} Volver</a>
          </div>
        </div>
        <div style="margin-top:20px">
          ${renderStepper(order.status)}
        </div>
        <div class="note-box mt-2" style="margin-top:16px">
          ${escapeHtml(statusMeta.description || '')}
        </div>
      </div>

      <div class="tabs" role="tablist" style="margin-bottom:16px">
        <button class="tab ${activeTab === 'resumen' ? 'active' : ''}" type="button" role="tab" data-tab="resumen">${icon('clipboard', 14)} Resumen</button>
        <button class="tab ${activeTab === 'fotos' ? 'active' : ''}" type="button" role="tab" data-tab="fotos">${icon('camera', 14)} Fotografías <span class="count">${photos.length}</span></button>
        <button class="tab ${activeTab === 'historial' ? 'active' : ''}" type="button" role="tab" data-tab="historial">${icon('history', 14)} Historial <span class="count">${events.length}</span></button>
      </div>

      <div data-panel="resumen" style="${activeTab === 'resumen' ? '' : 'display:none'}">
        <div class="detail-layout">
          <div class="detail-main">
            <div class="card">
              <div class="card-header">
                <div class="card-heading">
                  <span class="card-title">Trabajo realizado en tu vehículo</span>
                  <span class="card-sub">Descripción de daños y alcance de la reparación</span>
                </div>
              </div>
              <div class="card-body col" style="gap:14px">
                <div>
                  <div class="field-label">Daños detectados</div>
                  <div class="note-box">${escapeHtml(order.damageDescription || 'Sin descripción de daños.')}</div>
                </div>
                <div>
                  <div class="field-label">Trabajos requeridos</div>
                  <div class="note-box">${escapeHtml(order.requestedWork || 'Sin trabajos detallados.')}</div>
                </div>
                <div>
                  <div class="field-label">Observaciones del taller</div>
                  <div class="note-box ${order.notes ? '' : 'empty'}">${escapeHtml(order.notes || 'Sin observaciones registradas.')}</div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-heading">
                  <span class="card-title">Costos de la reparación</span>
                  <span class="card-sub">Los importes son definidos por el taller</span>
                </div>
                <span class="chip">${money(order.total)}</span>
              </div>
              <div class="card-body">
                <table class="cost-table">
                  <tbody>
                    ${COST_FIELDS.map((field) => `
                      <tr><td>${escapeHtml(field.label)}</td><td>${money(costs[field.key])}</td></tr>
                    `).join('')}
                    <tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
                    ${discount ? `<tr class="discount"><td>Descuento</td><td>−${money(discount)}</td></tr>` : ''}
                    <tr class="total"><td>Total de la reparación</td><td>${money(order.total)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-heading">
                  <span class="card-title">Fotografías de avance</span>
                  <span class="card-sub">${photos.length} imagen${photos.length === 1 ? '' : 'es'} compartida${photos.length === 1 ? '' : 's'} por el taller</span>
                </div>
                <button class="btn btn-sm btn-outline" type="button" data-go-photos>${icon('camera', 14)} Ver todas</button>
              </div>
              <div class="card-body">
                ${photos.length ? `
                  <div class="gallery">
                    ${photos.slice(0, 4).map((photo, index) => `
                      <div class="photo-card" data-preview-photo="${index}" role="button" tabindex="0" aria-label="Ampliar fotografía">
                        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.note || photo.originalName || 'Fotografía de avance')}" loading="lazy" />
                        <div class="photo-meta"><span>${formatDate(photo.createdAt)}</span></div>
                      </div>
                    `).join('')}
                  </div>` : `<div class="note-box empty">El taller aún no ha publicado fotografías de esta reparación.</div>`}
              </div>
            </div>
          </div>

          <div class="detail-side">
            <div class="card">
              <div class="card-header"><div class="card-heading"><span class="card-title">Mi vehículo</span></div></div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-row"><span class="k">Vehículo</span><span class="v">${escapeHtml(order.vehicleLabel)}</span></div>
                  <div class="info-row"><span class="k">Placas</span><span class="v mono">${escapeHtml(order.plates)}</span></div>
                  <div class="info-row"><span class="k">Color</span><span class="v">${escapeHtml(order.vehicleColor || '—')}</span></div>
                  <div class="info-row"><span class="k">Servicio</span><span class="v">${escapeHtml(order.service)}</span></div>
                  <div class="info-row"><span class="k">Registrado</span><span class="v">${vehicle ? formatDate(vehicle.createdAt) : '—'}</span></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-heading"><span class="card-title">Fechas del servicio</span></div></div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-row"><span class="k">Recepción</span><span class="v">${formatDate(order.receivedAt)}</span></div>
                  <div class="info-row"><span class="k">Entrega estimada</span><span class="v ${overdue ? 'text-red' : ''}">${order.estimatedAt ? formatDate(order.estimatedAt) : 'Por definir'}</span></div>
                  <div class="info-row"><span class="k">Entrega real</span><span class="v">${order.deliveredAt ? formatDate(order.deliveredAt) : 'Pendiente'}</span></div>
                  <div class="info-row"><span class="k">Orden creada</span><span class="v">${formatDateTime(order.createdAt)}</span></div>
                  <div class="info-row"><span class="k">Última actualización</span><span class="v">${formatDateTime(order.updatedAt)}</span></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-heading"><span class="card-title">Mi cuenta</span></div></div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-row"><span class="k">Nombre</span><span class="v">${escapeHtml(ctx.user.name)}</span></div>
                  <div class="info-row"><span class="k">Correo</span><span class="v" style="word-break:break-all">${escapeHtml(ctx.user.email)}</span></div>
                  <div class="info-row"><span class="k">Teléfono</span><span class="v">${escapeHtml(ctx.user.phone || '—')}</span></div>
                </div>
                <a class="btn btn-sm btn-outline mt-2" href="#/cliente/cuenta" style="width:100%">${icon('settings', 14)} Actualizar mis datos</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-panel="fotos" style="${activeTab === 'fotos' ? '' : 'display:none'}">
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Fotografías de avance</span>
              <span class="card-sub">Evidencia visual compartida por RR CARS para esta orden</span>
            </div>
            <span class="chip">${icon('camera', 13)} ${photos.length} foto${photos.length === 1 ? '' : 's'}</span>
          </div>
          <div class="card-body">
            ${renderGallery(photos, { canDelete: false })}
          </div>
        </div>
      </div>

      <div data-panel="historial" style="${activeTab === 'historial' ? '' : 'display:none'}">
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Historial de la orden</span>
              <span class="card-sub">Cambios de estado, costos, notas y fotografías</span>
            </div>
            <span class="chip">${events.length} movimiento${events.length === 1 ? '' : 's'}</span>
          </div>
          <div class="card-body">
            ${renderTimeline(events, { empty: 'Aún no hay movimientos registrados para esta orden.' })}
          </div>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        activeTab = button.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
        root.querySelectorAll('[data-panel]').forEach((panel) => {
          panel.style.display = panel.dataset.panel === activeTab ? '' : 'none';
        });
      });
    });
    root.querySelector('[data-go-photos]')?.addEventListener('click', () => {
      root.querySelector('[data-tab="fotos"]')?.click();
    });
    root.querySelectorAll('[data-preview-photo]').forEach((card) => {
      card.addEventListener('click', () => openLightbox(detail.photos, Number(card.dataset.previewPhoto)));
    });
    root.querySelectorAll('.photo-card[data-photo-index]').forEach((card) => {
      card.addEventListener('click', () => openLightbox(detail.photos, Number(card.dataset.photoIndex)));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') openLightbox(detail.photos, Number(card.dataset.photoIndex));
      });
    });
  }

  await load();
}
