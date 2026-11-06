/* ============================================================
   RR CARS · Panel de administrador: detalle de una orden
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatDateTime, money, compressImage, todayISO, formatBytes,
} from '../core/utils.js';
import { ORDER_STATUS_MAP, COST_FIELDS, MAX_PHOTO_BYTES } from '../core/constants.js';
import {
  loadingBlock, toast, toastError, confirmDialog, orderStatusBadge, renderStepper,
  renderTimeline, renderGallery, openLightbox, setButtonLoading,
} from '../core/ui.js';
import { getRoute, navigate } from '../core/router.js';
import {
  getOrderDetail, changeOrderStatus, deleteOrder, addOrderPhotos, deleteOrderPhoto,
} from '../services.js';
import { pageHead, options } from './partials.js';
import { openOrderModal } from './order-modal.js';

export async function renderAdminOrderDetail(root, ctx, params = {}) {
  const orderId = params.id;
  let detail = null;
  let activeTab = 'resumen';

  root.innerHTML = loadingBlock('Cargando orden de servicio…');

  async function load() {
    try {
      detail = await getOrderDetail(orderId);
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `
        <div class="notfound">
          <div class="code">404</div>
          <h1>Orden no encontrada</h1>
          <p>${escapeHtml(error.message)}</p>
          <a class="btn btn-primary" href="#/admin/ordenes">${icon('arrowLeft', 16)} Volver a órdenes</a>
        </div>`;
    }
  }

  function render() {
    const { order, photos, events, client, vehicle } = detail;
    const statusMeta = ORDER_STATUS_MAP[order.status] || {};
    const costs = order.costs || {};
    const subtotal = COST_FIELDS.reduce((acc, field) => acc + (Number(costs[field.key]) || 0), 0);
    const discount = Number(costs.discount) || 0;
    const overdue = ['recibido', 'diagnostico', 'hojalateria', 'pintura', 'revision'].includes(order.status)
      && order.estimatedAt && order.estimatedAt < todayISO();

    root.innerHTML = `
      <div class="breadcrumb">
        <a href="#/admin/ordenes">Órdenes</a> ${icon('chevronRight', 12)}
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
              ${escapeHtml(order.clientName)} · ${escapeHtml(order.service)}
            </div>
            <div class="detail-header-meta">
              <span class="chip">${icon('calendar', 13)} Recepción ${formatDate(order.receivedAt)}</span>
              <span class="chip">${icon('clock', 13)} ${order.estimatedAt ? `Entrega estimada ${formatDate(order.estimatedAt)}` : 'Sin fecha estimada'}</span>
              ${order.deliveredAt ? `<span class="chip">${icon('checkCircle', 13)} Entregado ${formatDate(order.deliveredAt)}</span>` : ''}
              <span class="chip">${icon('car', 13)} ${escapeHtml(order.vehicleColor || '')}</span>
            </div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-outline btn-sm" type="button" data-edit>${icon('edit', 15)} Editar orden</button>
            <button class="btn btn-danger btn-sm" type="button" data-delete>${icon('trash', 15)} Eliminar</button>
          </div>
        </div>
        <div style="margin-top:20px">
          ${renderStepper(order.status)}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-body" style="padding:14px 18px">
          <form class="status-select-row" id="status-form" style="flex-wrap:wrap">
            <span class="tiny muted" style="flex:0 0 auto">Cambiar estado de la reparación:</span>
            <select class="select" name="status" style="max-width:240px" aria-label="Nuevo estado">
              ${options(Object.values(ORDER_STATUS_MAP).map((s) => ({ value: s.key, label: s.label })), order.status)}
            </select>
            <input class="input" name="note" placeholder="Nota opcional para el historial…" maxlength="200" style="flex:1;min-width:200px" />
            <button class="btn btn-primary btn-sm" type="submit" data-status-save>${icon('refresh', 15)} Actualizar estado</button>
          </form>
          <div class="tiny muted" style="margin-top:8px">${escapeHtml(statusMeta.description || '')}</div>
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
                  <span class="card-title">Trabajo a realizar</span>
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
                  <div class="field-label">Observaciones visibles para el cliente</div>
                  <div class="note-box ${order.notes ? '' : 'empty'}">${escapeHtml(order.notes || 'Sin observaciones registradas.')}</div>
                </div>
                ${order.adminNotes ? `
                  <div>
                    <div class="field-label">Notas internas del administrador</div>
                    <div class="note-box accent">${escapeHtml(order.adminNotes)}</div>
                  </div>` : ''}
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-heading">
                  <span class="card-title">Costos de la reparación</span>
                  <span class="card-sub">Calculados automáticamente a partir de los conceptos</span>
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
                  <span class="card-title">Últimas fotografías de avance</span>
                  <span class="card-sub">${photos.length} imagen${photos.length === 1 ? '' : 'es'} almacenada${photos.length === 1 ? '' : 's'} localmente</span>
                </div>
                <button class="btn btn-sm btn-outline" type="button" data-go-photos>${icon('camera', 14)} Administrar fotos</button>
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
                  </div>` : `<div class="note-box empty">Aún no hay fotografías. Súbelas desde la pestaña “Fotografías”.</div>`}
              </div>
            </div>
          </div>

          <div class="detail-side">
            <div class="card">
              <div class="card-header"><div class="card-heading"><span class="card-title">Cliente</span></div></div>
              <div class="card-body">
                <div class="row" style="gap:10px;margin-bottom:12px">
                  <span class="avatar accent">${escapeHtml((order.clientName || 'RR').slice(0, 2).toUpperCase())}</span>
                  <div style="min-width:0">
                    <div class="strong" style="font-size:0.88rem">${escapeHtml(order.clientName)}</div>
                    <div class="tiny muted" style="word-break:break-all">${escapeHtml(order.clientEmail)}</div>
                  </div>
                </div>
                <div class="info-list">
                  <div class="info-row"><span class="k">Teléfono</span><span class="v">${escapeHtml(order.clientPhone || '—')}</span></div>
                  <div class="info-row"><span class="k">Estado de cuenta</span><span class="v">${client ? escapeHtml(client.status === 'active' ? 'Autorizada' : client.status) : '—'}</span></div>
                  <div class="info-row"><span class="k">Ficha</span><span class="v"><a href="#/admin/clientes?q=${encodeURIComponent(order.clientEmail)}" style="color:var(--accent-2)">Ver en clientes ${icon('arrowUpRight', 12)}</a></span></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-heading"><span class="card-title">Vehículo</span></div></div>
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
              <div class="card-header"><div class="card-heading"><span class="card-title">Fechas y registro</span></div></div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-row"><span class="k">Recepción</span><span class="v">${formatDate(order.receivedAt)}</span></div>
                  <div class="info-row"><span class="k">Entrega estimada</span><span class="v ${overdue ? 'text-red' : ''}">${order.estimatedAt ? formatDate(order.estimatedAt) : 'Por definir'}</span></div>
                  <div class="info-row"><span class="k">Entrega real</span><span class="v">${order.deliveredAt ? formatDate(order.deliveredAt) : 'Pendiente'}</span></div>
                  <div class="info-row"><span class="k">Creada</span><span class="v">${formatDateTime(order.createdAt)}</span></div>
                  <div class="info-row"><span class="k">Actualizada</span><span class="v">${formatDateTime(order.updatedAt)}</span></div>
                  <div class="info-row"><span class="k">Responsable</span><span class="v">${escapeHtml(order.createdByName || '—')}</span></div>
                </div>
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
              <span class="card-sub">Máximo 2.5 MB por imagen comprimida · se guardan en este equipo</span>
            </div>
            <button class="btn btn-sm btn-primary" type="button" data-upload-photos>${icon('upload', 14)} Subir fotografías</button>
          </div>
          <div class="card-body">
            <input type="file" id="photo-input" accept="image/*" multiple class="hidden" style="display:none" />
            <div class="dropzone" id="photo-dropzone" role="button" tabindex="0" aria-label="Subir fotografías">
              ${icon('camera', 26)}
              <strong>Arrastra imágenes aquí o haz clic para seleccionarlas</strong>
              <span>Formatos JPG, PNG o WebP · se comprimen automáticamente a 1400 px</span>
            </div>
            <div id="photo-progress" class="mt-2"></div>
            <div class="mt-2">
              ${renderGallery(photos, { canDelete: true })}
            </div>
          </div>
        </div>
      </div>

      <div data-panel="historial" style="${activeTab === 'historial' ? '' : 'display:none'}">
        <div class="card">
          <div class="card-header">
            <div class="card-heading">
              <span class="card-title">Historial de la orden</span>
              <span class="card-sub">Bitácora de estados, costos, notas y fotografías</span>
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

    root.querySelector('[data-edit]')?.addEventListener('click', () => {
      openOrderModal({ order: detail.order, onSaved: load });
    });

    root.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const order = detail.order;
      const ok = await confirmDialog({
        title: `Eliminar orden ${order.folio}`,
        message: `Se eliminará la orden de <strong>${escapeHtml(order.clientName)}</strong> (${escapeHtml(order.vehicleLabel)}) junto con sus fotografías e historial.`,
        details: 'Esta acción no se puede deshacer desde la aplicación.',
        confirmText: 'Eliminar orden',
        danger: true,
        requireText: 'ELIMINAR',
        requireLabel: 'Escribe ELIMINAR para confirmar',
      });
      if (!ok) return;
      try {
        await deleteOrder(order.id);
        toast(`Orden ${order.folio} eliminada.`, { type: 'success' });
        navigate('/admin/ordenes');
      } catch (error) {
        toastError(error);
      }
    });

    root.querySelector('#status-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[data-status-save]');
      const fd = new FormData(form);
      const status = String(fd.get('status') || '');
      const note = String(fd.get('note') || '').trim();
      if (status === detail.order.status) {
        toast('La orden ya tiene ese estado.', { type: 'info' });
        return;
      }
      try {
        setButtonLoading(button, true, 'Actualizando estado…');
        await changeOrderStatus(detail.order.id, status, note);
        toast(`Estado actualizado a “${ORDER_STATUS_MAP[status]?.label || status}”.`, { type: 'success' });
        await load();
      } catch (error) {
        setButtonLoading(button, false);
        toastError(error);
      }
    });

    // Fotografías
    const input = root.querySelector('#photo-input');
    const dropzone = root.querySelector('#photo-dropzone');
    const progress = root.querySelector('#photo-progress');
    const pick = () => input?.click();
    root.querySelector('[data-upload-photos]')?.addEventListener('click', pick);
    dropzone?.addEventListener('click', pick);
    dropzone?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); }
    });
    dropzone?.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('drag');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
    dropzone?.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('drag');
      handleFiles([...event.dataTransfer.files]);
    });
    input?.addEventListener('change', () => {
      handleFiles([...input.files]);
      input.value = '';
    });

    root.querySelectorAll('[data-preview-photo]').forEach((card) => {
      card.addEventListener('click', () => openLightbox(detail.photos, Number(card.dataset.previewPhoto)));
    });
    root.querySelectorAll('.photo-card[data-photo-index]').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-delete-photo]')) return;
        openLightbox(detail.photos, Number(card.dataset.photoIndex));
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') openLightbox(detail.photos, Number(card.dataset.photoIndex));
      });
    });
    root.querySelectorAll('[data-delete-photo]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const ok = await confirmDialog({
          title: 'Eliminar fotografía',
          message: '¿Deseas eliminar esta fotografía de avance? El cliente dejará de verla de inmediato.',
          confirmText: 'Eliminar fotografía',
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteOrderPhoto(button.dataset.deletePhoto);
          toast('Fotografía eliminada.', { type: 'success' });
          await load();
        } catch (error) {
          toastError(error);
        }
      });
    });

    async function handleFiles(files) {
      const images = files.filter((file) => file.type?.startsWith('image/'));
      if (!images.length) {
        toast('Selecciona al menos una imagen válida.', { type: 'warning' });
        return;
      }
      if (progress) progress.innerHTML = `<div class="alert alert-info">${icon('upload', 17)}<div>Procesando ${images.length} imagen(es)…</div></div>`;
      const processed = [];
      let failed = 0;
      for (const file of images) {
        try {
          const result = await compressImage(file);
          if (result.size > MAX_PHOTO_BYTES) {
            failed += 1;
            continue;
          }
          processed.push(result);
        } catch (error) {
          failed += 1;
          console.warn(error);
        }
      }
      if (!processed.length) {
        if (progress) progress.innerHTML = `<div class="alert alert-danger">${icon('alertTriangle', 17)}<div>No se pudo procesar ninguna imagen. Usa archivos JPG o PNG menores a 20 MB.</div></div>`;
        return;
      }
      try {
        await addOrderPhotos(detail.order.id, processed);
        toast(`${processed.length} fotografía(s) agregada(s) correctamente.${failed ? ` ${failed} no se pudieron procesar.` : ''}`, { type: 'success' });
        activeTab = 'fotos';
        await load();
      } catch (error) {
        toastError(error);
        if (progress) progress.innerHTML = '';
      }
    }
  }

  await load();
  void ctx;
  void pageHead;
  void formatBytes;
}
