/* ============================================================
   RR CARS · Panel de administrador: gestión de clientes
   ============================================================ */

import { icon } from '../core/icons.js';
import {
  escapeHtml, formatDate, formatDateTime, money, isValidEmail, isValidPhone,
  setFieldError, clearFieldErrors, normalize,
} from '../core/utils.js';
import { CLIENT_STATUS_META, ROLES } from '../core/constants.js';
import {
  loadingBlock, toast, toastError, setButtonLoading, openModal, confirmDialog,
  clientStatusBadge, orderStatusBadge, emptyState,
} from '../core/ui.js';
import { getRoute, navigate } from '../core/router.js';
import {
  listClients, setClientStatus, updateClientByAdmin, deleteClientCascade, getClientOverview,
} from '../services.js';
import {
  pageHead, clientStatusOptions, pagination, emptyTableRow, slicePage, clientOptions,
} from './partials.js';

const PER_PAGE = 10;

export async function renderAdminClients(root, ctx) {
  const route = getRoute();
  const state = {
    search: route.query.get('q') || '',
    status: route.query.get('status') || '',
    page: Number(route.query.get('page')) || 1,
  };
  let all = [];

  root.innerHTML = loadingBlock('Cargando clientes…');

  async function load() {
    try {
      all = await listClients({ search: state.search, status: state.status });
      render();
    } catch (error) {
      toastError(error);
      root.innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 18)}<div>${escapeHtml(error.message)}</div></div>`;
    }
  }

  function render() {
    const pageData = slicePage(all, state.page, PER_PAGE);
    const pending = all.filter((c) => c.status === 'pending').length;
    root.innerHTML = `
      ${pageHead({
        eyebrow: 'Clientes',
        title: 'Gestión de clientes',
        subtitle: `${all.length} cuenta${all.length === 1 ? '' : 's'} ${state.status || state.search ? 'con los filtros aplicados' : 'registradas'} · ${pending} pendiente${pending === 1 ? '' : 's'} de autorización`,
        actions: `
          <button class="btn" type="button" data-refresh>${icon('refresh', 16)} <span class="hide-xs">Actualizar</span></button>
          <a class="btn btn-primary" href="#/admin/ordenes?nueva=1">${icon('plus', 16)} Nueva orden</a>
        `,
      })}

      ${pending && state.status !== 'pending' ? `
        <div class="alert alert-warning" style="margin-bottom:14px">
          ${icon('clock', 18)}
          <div style="flex:1"><strong>${pending} solicitud${pending === 1 ? '' : 'es'} esperando revisión.</strong> Autoriza o rechaza las cuentas para que puedan operar.</div>
          <button class="btn btn-sm btn-outline" type="button" data-filter-pending>Ver pendientes ${icon('chevronRight', 14)}</button>
        </div>` : ''}

      <div class="card">
        <div class="table-toolbar">
          <form class="filters" id="clients-filters" role="search">
            <div class="search-box">
              ${icon('search', 16)}
              <input class="input" type="search" name="q" id="clients-search" placeholder="Buscar por nombre, correo o teléfono…" value="${escapeHtml(state.search)}" aria-label="Buscar clientes" />
            </div>
            <select class="select" name="status" id="clients-status" style="width:auto" aria-label="Filtrar por estado">
              ${clientStatusOptions(state.status)}
            </select>
            <button class="btn btn-sm btn-outline" type="submit">${icon('filter', 14)} Filtrar</button>
            ${state.search || state.status ? `<button class="btn btn-sm btn-ghost" type="button" data-clear>${icon('x', 14)} Limpiar</button>` : ''}
          </form>
          <span class="chip">${icon('users', 13)} ${all.length} resultado${all.length === 1 ? '' : 's'}</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Registro</th>
                <th style="text-align:right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${pageData.items.length ? pageData.items.map((client) => `
                <tr data-client-row="${escapeHtml(client.id)}">
                  <td>
                    <button class="link-row" type="button" data-overview="${escapeHtml(client.id)}" style="background:none;border:0;padding:0;text-align:left;color:inherit;cursor:pointer">
                      <span class="cell-main">${escapeHtml(client.name)}</span>
                      <span class="cell-sub">${escapeHtml(client.email)}</span>
                    </button>
                  </td>
                  <td>
                    <span class="cell-main" style="font-weight:500">${escapeHtml(client.phone || '—')}</span>
                    <span class="cell-sub">${client.requestNote ? escapeHtml(client.requestNote.slice(0, 46)) + (client.requestNote.length > 46 ? '…' : '') : 'Sin mensaje de solicitud'}</span>
                  </td>
                  <td>${clientStatusBadge(client.status)}</td>
                  <td>
                    <span class="cell-main" style="font-weight:500">${formatDate(client.createdAt)}</span>
                    <span class="cell-sub">${client.lastLoginAt ? `Último acceso ${formatDate(client.lastLoginAt)}` : 'Sin accesos'}</span>
                  </td>
                  <td>
                    <div class="row-actions">
                      ${client.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" type="button" data-approve="${escapeHtml(client.id)}" title="Autorizar cuenta">${icon('check', 14)} Autorizar</button>
                        <button class="btn-icon btn-ghost btn-sm" type="button" data-reject="${escapeHtml(client.id)}" title="Rechazar" aria-label="Rechazar cuenta">${icon('xCircle', 15)}</button>
                      ` : client.status === 'active' ? `
                        <button class="btn-icon btn-ghost btn-sm" type="button" data-suspend="${escapeHtml(client.id)}" title="Suspender" aria-label="Suspender cuenta">${icon('pause', 15)}</button>
                      ` : `
                        <button class="btn btn-sm btn-outline" type="button" data-approve="${escapeHtml(client.id)}" title="Reactivar cuenta">${icon('play', 13)} Activar</button>
                      `}
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-overview="${escapeHtml(client.id)}" title="Ver ficha" aria-label="Ver ficha del cliente">${icon('eye', 15)}</button>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-edit="${escapeHtml(client.id)}" title="Editar" aria-label="Editar cliente">${icon('edit', 15)}</button>
                      <button class="btn-icon btn-ghost btn-sm" type="button" data-delete="${escapeHtml(client.id)}" title="Eliminar" aria-label="Eliminar cliente" style="color:var(--red)">${icon('trash', 15)}</button>
                    </div>
                  </td>
                </tr>
              `).join('') : emptyTableRow(5, state.search || state.status ? 'Ningún cliente coincide con los filtros.' : 'Aún no hay clientes registrados. Comparte el enlace de registro con tus clientes.')}
            </tbody>
          </table>
        </div>

        ${pagination({ ...pageData, prefix: 'clients' })}
      </div>

      <div class="alert alert-info mt-2">
        ${icon('shield', 18)}
        <div>Los clientes solo pueden consultar sus propios vehículos, órdenes y fotografías. Autorizar una cuenta le permite registrarse y operar en el portal; eliminarla borra también todos sus datos.</div>
      </div>
    `;
    bind();
  }

  function findClient(id) {
    return all.find((c) => c.id === id) || null;
  }

  function bind() {
    const form = root.querySelector('#clients-filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      state.search = String(new FormData(form).get('q') || '').trim();
      state.status = String(new FormData(form).get('status') || '');
      state.page = 1;
      load();
    });
    root.querySelector('#clients-status')?.addEventListener('change', () => form?.requestSubmit());
    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.search = '';
      state.status = '';
      state.page = 1;
      load();
    });
    root.querySelector('[data-filter-pending]')?.addEventListener('click', () => {
      state.status = 'pending';
      state.search = '';
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

    root.querySelectorAll('[data-overview]').forEach((button) => {
      button.addEventListener('click', () => openClientOverview(findClient(button.dataset.overview), load));
    });
    root.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => openClientEditModal(findClient(button.dataset.edit), load));
    });
    root.querySelectorAll('[data-approve]').forEach((button) => {
      button.addEventListener('click', () => changeStatus(findClient(button.dataset.approve), 'active', button));
    });
    root.querySelectorAll('[data-reject]').forEach((button) => {
      button.addEventListener('click', () => changeStatus(findClient(button.dataset.reject), 'rejected', button));
    });
    root.querySelectorAll('[data-suspend]').forEach((button) => {
      button.addEventListener('click', () => changeStatus(findClient(button.dataset.suspend), 'suspended', button));
    });
    root.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => removeClient(findClient(button.dataset.delete)));
    });
    root.querySelectorAll('[data-client-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openClientOverview(findClient(row.dataset.clientRow), load));
    });
  }

  async function changeStatus(client, status, button = null) {
    if (!client) return;
    const meta = CLIENT_STATUS_META[status];
    const dangerous = status === 'rejected' || status === 'suspended';
    if (dangerous) {
      const ok = await confirmDialog({
        title: status === 'rejected' ? 'Rechazar solicitud' : 'Suspender cuenta',
        message: status === 'rejected'
          ? `¿Rechazar la solicitud de <strong>${escapeHtml(client.name)}</strong>? No podrá iniciar sesión, pero sus datos se conservarán por si deseas reactivarla más adelante.`
          : `¿Suspender temporalmente la cuenta de <strong>${escapeHtml(client.name)}</strong>? El cliente perderá acceso al portal hasta que la reactives.`,
        confirmText: status === 'rejected' ? 'Rechazar solicitud' : 'Suspender cuenta',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      if (button) setButtonLoading(button, true);
      await setClientStatus(client.id, status);
      toast(status === 'active' ? 'Cuenta autorizada. El cliente ya puede acceder.' : `Cuenta marcada como ${meta.short.toLowerCase()}.`, { type: 'success' });
      await load();
    } catch (error) {
      if (button) setButtonLoading(button, false);
      toastError(error);
    }
  }

  async function removeClient(client) {
    if (!client) return;
    const ok = await confirmDialog({
      title: 'Eliminar cliente permanentemente',
      message: `Se eliminará la cuenta de <strong>${escapeHtml(client.name)}</strong> junto con <strong>todos sus vehículos, órdenes, fotografías e historial</strong>.`,
      details: 'Esta acción no se puede deshacer desde la aplicación. Genera un respaldo JSON antes de continuar si necesitas conservar la información.',
      confirmText: 'Eliminar definitivamente',
      danger: true,
      requireText: 'ELIMINAR',
      requireLabel: 'Escribe ELIMINAR para confirmar',
    });
    if (!ok) return;
    try {
      const counts = await deleteClientCascade(client.id);
      toast(`Cliente eliminado. Se borraron ${counts.vehicles} vehículo(s), ${counts.orders} orden(es) y ${counts.photos} fotografía(s).`, { type: 'success', duration: 6000 });
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  async function openClientOverview(client, onChanged) {
    if (!client) return;
    const handle = openModal({
      title: 'Ficha del cliente',
      subtitle: client.name,
      size: 'xl',
      body: loadingBlock('Cargando información del cliente…'),
      footer: `<button class="btn" type="button" data-close>${icon('x', 15)} Cerrar</button>`,
      onMount: (modal, close) => modal.querySelector('[data-close]').addEventListener('click', close),
    });
    let overview;
    try {
      overview = await getClientOverview(client.id);
    } catch (error) {
      handle.element.querySelector('.modal-body').innerHTML = `<div class="alert alert-danger">${icon('alertCircle', 17)}<span>${escapeHtml(error.message)}</span></div>`;
      return;
    }
    const { stats, vehicles, orders } = overview;
    const c = overview.client;
    const body = handle.element.querySelector('.modal-body');
    body.innerHTML = `
      <div class="row-between" style="align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px">
        <div class="row" style="gap:12px">
          <span class="avatar lg accent">${escapeHtml(c.name.slice(0, 2).toUpperCase())}</span>
          <div>
            <div style="font-weight:650;font-size:1rem">${escapeHtml(c.name)}</div>
            <div class="tiny muted">${escapeHtml(c.email)} · ${escapeHtml(c.phone || 'Sin teléfono')}</div>
            <div class="row mt-1" style="gap:6px">${clientStatusBadge(c.status)}<span class="chip">${icon('calendar', 12)} Alta ${formatDate(c.createdAt)}</span></div>
          </div>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${c.status === 'active' ? `<button class="btn btn-sm btn-outline" type="button" data-ov-suspend>${icon('pause', 14)} Suspender</button>` : `<button class="btn btn-sm btn-success" type="button" data-ov-approve>${icon('check', 14)} Activar</button>`}
          ${c.status === 'pending' ? `<button class="btn btn-sm btn-outline" type="button" data-ov-reject>${icon('xCircle', 14)} Rechazar</button>` : ''}
          <button class="btn btn-sm btn-outline" type="button" data-ov-edit>${icon('edit', 14)} Editar</button>
          <button class="btn btn-sm btn-danger" type="button" data-ov-delete>${icon('trash', 14)} Eliminar</button>
        </div>
      </div>

      <div class="report-summary" style="margin-bottom:16px">
        <div class="report-kpi"><div class="k">Vehículos</div><div class="v">${stats.vehicles}</div><div class="s">Registrados por el cliente</div></div>
        <div class="report-kpi"><div class="k">Órdenes</div><div class="v">${stats.orders}</div><div class="s">${stats.active} activas · ${stats.finished} finalizadas</div></div>
        <div class="report-kpi"><div class="k">Facturado</div><div class="v" style="font-size:1.15rem">${money(stats.totalBilled)}</div><div class="s">Total registrado en órdenes</div></div>
        <div class="report-kpi"><div class="k">Último acceso</div><div class="v" style="font-size:0.95rem">${c.lastLoginAt ? formatDate(c.lastLoginAt) : 'Nunca'}</div><div class="s">${c.lastLoginAt ? formatDateTime(c.lastLoginAt) : 'Sin sesiones registradas'}</div></div>
      </div>

      ${c.requestNote ? `<div class="note-box accent" style="margin-bottom:12px"><strong>Solicitud del cliente:</strong><br>${escapeHtml(c.requestNote)}</div>` : ''}
      ${c.adminNotes ? `<div class="note-box" style="margin-bottom:12px"><strong>Notas internas:</strong><br>${escapeHtml(c.adminNotes)}</div>` : ''}

      <div class="settings-layout" style="grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="card-title" style="margin-bottom:8px">Vehículos (${vehicles.length})</div>
          ${vehicles.length ? `
            <div class="col" style="gap:8px">
              ${vehicles.map((v) => `
                <div class="note-box" style="padding:10px 12px">
                  <div class="row-between"><strong style="color:var(--text)">${escapeHtml(v.brand)} ${escapeHtml(v.model)} ${escapeHtml(String(v.year))}</strong><span class="plate">${escapeHtml(v.plates)}</span></div>
                  <div class="tiny muted" style="margin-top:3px">${escapeHtml(v.color)} · ${escapeHtml(v.service)}</div>
                </div>
              `).join('')}
            </div>` : `<div class="note-box empty">Sin vehículos registrados.</div>`}
        </div>
        <div>
          <div class="card-title" style="margin-bottom:8px">Órdenes recientes (${orders.length})</div>
          ${orders.length ? `
            <div class="col" style="gap:8px">
              ${orders.slice(0, 6).map((o) => `
                <a class="note-box" href="#/admin/ordenes/${encodeURIComponent(o.id)}" data-ov-order style="padding:10px 12px;display:block;text-decoration:none;color:inherit">
                  <div class="row-between"><strong class="mono" style="color:var(--text)">${escapeHtml(o.folio)}</strong>${orderStatusBadge(o.status)}</div>
                  <div class="tiny muted" style="margin-top:3px">${escapeHtml(o.vehicleLabel)} · ${escapeHtml(o.service)} · ${money(o.total)}</div>
                </a>
              `).join('')}
              ${orders.length > 6 ? `<a class="btn btn-sm btn-ghost" href="#/admin/ordenes?clientId=${encodeURIComponent(c.id)}">Ver todas las órdenes ${icon('chevronRight', 14)}</a>` : ''}
            </div>` : `<div class="note-box empty">Sin órdenes de servicio.</div>`}
        </div>
      </div>
    `;

    body.querySelector('[data-ov-order]')?.addEventListener('click', () => handle.close());
    body.querySelector('[data-ov-edit]')?.addEventListener('click', () => {
      handle.close();
      openClientEditModal(client, onChanged);
    });
    body.querySelector('[data-ov-delete]')?.addEventListener('click', async () => {
      handle.close();
      await removeClient(client);
    });
    body.querySelector('[data-ov-approve]')?.addEventListener('click', async () => {
      handle.close();
      await changeStatus(client, 'active');
    });
    body.querySelector('[data-ov-reject]')?.addEventListener('click', async () => {
      handle.close();
      await changeStatus(client, 'rejected');
    });
    body.querySelector('[data-ov-suspend]')?.addEventListener('click', async () => {
      handle.close();
      await changeStatus(client, 'suspended');
    });
    void ROLES;
  }

  function openClientEditModal(client, onSaved) {
    if (!client) return;
    openModal({
      title: 'Editar cliente',
      subtitle: client.name,
      size: 'lg',
      body: `
        <form id="client-edit-form" class="col" style="gap:16px" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="ce-name">Nombre completo <span class="req">*</span></label>
              <input class="input" id="ce-name" name="name" maxlength="90" value="${escapeHtml(client.name)}" />
              <span class="error-text"></span>
            </div>
            <div class="field">
              <label for="ce-phone">Teléfono <span class="req">*</span></label>
              <input class="input" id="ce-phone" name="phone" maxlength="30" value="${escapeHtml(client.phone || '')}" />
              <span class="error-text"></span>
            </div>
            <div class="field span-2">
              <label for="ce-email">Correo electrónico <span class="req">*</span></label>
              <input class="input" id="ce-email" name="email" type="email" maxlength="120" value="${escapeHtml(client.email)}" />
              <span class="hint">Cambiar el correo modifica las credenciales de acceso del cliente.</span>
              <span class="error-text"></span>
            </div>
            <div class="field span-2">
              <label for="ce-notes">Notas internas del administrador</label>
              <textarea class="textarea" id="ce-notes" name="adminNotes" maxlength="1000" style="min-height:80px" placeholder="Información visible solo para el taller…">${escapeHtml(client.adminNotes || '')}</textarea>
              <span class="hint">Estas notas no son visibles para el cliente.</span>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn" type="button" data-cancel>Cancelar</button>
        <button class="btn btn-primary" type="submit" form="client-edit-form" data-save>${icon('save', 16)} Guardar cambios</button>
      `,
      onMount: (modal, close) => {
        const form = modal.querySelector('#client-edit-form');
        const save = modal.querySelector('[data-save]');
        modal.querySelector('[data-cancel]').addEventListener('click', close);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          clearFieldErrors(form);
          const fd = new FormData(form);
          const name = String(fd.get('name') || '').trim();
          const email = String(fd.get('email') || '').trim();
          const phone = String(fd.get('phone') || '').trim();
          const adminNotes = String(fd.get('adminNotes') || '').trim();
          let valid = true;
          if (name.length < 3) { setFieldError(form.elements.name, 'Escribe el nombre completo.'); valid = false; }
          if (!isValidEmail(email)) { setFieldError(form.elements.email, 'Escribe un correo válido.'); valid = false; }
          if (phone && !isValidPhone(phone)) { setFieldError(form.elements.phone, 'El teléfono debe tener al menos 10 dígitos.'); valid = false; }
          if (!valid) return;
          try {
            setButtonLoading(save, true);
            await updateClientByAdmin(client.id, { name, email, phone });
            await setClientStatus(client.id, client.status, adminNotes);
            toast('Datos del cliente actualizados.', { type: 'success' });
            close();
            await onSaved?.();
          } catch (error) {
            setButtonLoading(save, false);
            toastError(error);
          }
        });
      },
    });
  }

  await load();
  void navigate;
  void normalize;
  void clientOptions;
  void emptyState;
}
