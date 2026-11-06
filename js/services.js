/* ============================================================
   RR CARS · Servicios de datos y reglas de negocio
   ------------------------------------------------------------
   Todas las operaciones sensibles verifican el rol y la propiedad
   de los datos antes de leer o escribir. Los clientes solo pueden
   operar sobre sus propios vehículos y órdenes.
   ============================================================ */

import {
  dbGet, dbGetAll, dbDelete, dbPut, runTx, getSetting, setSetting,
} from './core/db.js';
import {
  requireAdmin, requireUser, getCurrentUser, updateAccount,
} from './core/auth.js';
import {
  ROLES, CLIENT_STATUS, CLIENT_STATUS_META, ORDER_STATUSES, ORDER_STATUS_MAP,
  ACTIVE_ORDER_STATUSES, FINISHED_ORDER_STATUSES, SERVICES, COST_FIELDS,
  MAX_PHOTO_BYTES,
} from './core/constants.js';
import {
  uid, nowISO, normalize, normalizePlate, normalizeEmail, round2, sum,
  isValidEmail, isValidPhone, isValidYear, isValidDateOnly, monthKey,
  lastMonths, parseDateOnly, daysBetween, sortBy, todayISO,
} from './core/utils.js';

/* ---------- Helpers internos ---------- */
function pReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de IndexedDB'));
  });
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function assert(condition, message, code = 'validation') {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

export function computeTotal(costs = {}) {
  const subtotal = COST_FIELDS.reduce((acc, field) => acc + (Number(costs[field.key]) || 0), 0);
  const discount = Math.min(Math.max(Number(costs.discount) || 0, 0), Math.max(subtotal, 0));
  return round2(Math.max(subtotal - discount, 0));
}

export function normalizeCosts(costs = {}) {
  const result = {};
  for (const field of COST_FIELDS) {
    const value = Number(costs[field.key]);
    result[field.key] = Number.isFinite(value) && value > 0 ? round2(value) : 0;
  }
  const discountValue = Number(costs.discount);
  result.discount = Number.isFinite(discountValue) && discountValue > 0 ? round2(discountValue) : 0;
  return result;
}

export function costsSubtotal(costs = {}) {
  return round2(COST_FIELDS.reduce((acc, field) => acc + (Number(costs[field.key]) || 0), 0));
}

/* ============================================================
   CLIENTES
   ============================================================ */
export async function listClients({ search = '', status = '' } = {}) {
  await requireAdmin();
  const users = await dbGetAll('users');
  const clients = users.filter((u) => u.role === ROLES.CLIENT);
  const q = normalize(search);
  return sortBy(
    clients
      .filter((client) => {
        if (status && client.status !== status) return false;
        if (!q) return true;
        return normalize([client.name, client.email, client.phone, client.requestNote].join(' ')).includes(q);
      })
      .map((client) => ({ ...client, password: undefined })),
    (c) => c.name,
    'asc',
  );
}

export async function getClientOverview(clientId) {
  const actor = await requireUser();
  const client = await dbGet('users', clientId);
  if (!client) assert(false, 'El cliente no existe.', 'not-found');
  if (actor.role !== ROLES.ADMIN && actor.id !== clientId) {
    assert(false, 'No puedes consultar información de otro cliente.', 'forbidden');
  }
  if (client.role !== ROLES.CLIENT && actor.role !== ROLES.ADMIN) {
    assert(false, 'La cuenta no es de tipo cliente.', 'forbidden');
  }
  const [vehicles, orders] = await Promise.all([
    dbGetAllByIndexSafe('vehicles', 'ownerId', clientId),
    dbGetAllByIndexSafe('orders', 'clientId', clientId),
  ]);
  const sortedOrders = sortBy(orders, (o) => o.createdAt, 'desc');
  return {
    client: { ...client, password: undefined },
    vehicles: sortBy(vehicles, (v) => v.createdAt, 'desc'),
    orders: sortedOrders,
    stats: {
      vehicles: vehicles.length,
      orders: orders.length,
      active: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length,
      finished: orders.filter((o) => FINISHED_ORDER_STATUSES.includes(o.status)).length,
      totalBilled: round2(sum(orders, (o) => o.total)),
    },
  };
}

async function dbGetAllByIndexSafe(store, index, query) {
  const all = await dbGetAll(store);
  return all.filter((item) => item[index] === query);
}

export async function setClientStatus(clientId, status, adminNotes = undefined) {
  const admin = await requireAdmin();
  assert(Object.values(CLIENT_STATUS).includes(status), 'Estado de cliente no válido.');
  const client = await dbGet('users', clientId);
  assert(client, 'El cliente no existe.', 'not-found');
  assert(client.role === ROLES.CLIENT, 'Solo se pueden moderar cuentas de cliente.', 'forbidden');
  const next = {
    ...client,
    status,
    statusUpdatedAt: nowISO(),
    statusUpdatedBy: admin.name,
    updatedAt: nowISO(),
  };
  if (adminNotes !== undefined) next.adminNotes = clean(adminNotes, 1000);
  await dbPut('users', next);
  return { ...next, password: undefined };
}

export async function updateClientByAdmin(clientId, patch) {
  const admin = await requireAdmin();
  const client = await dbGet('users', clientId);
  assert(client, 'El cliente no existe.', 'not-found');
  assert(client.role === ROLES.CLIENT, 'Solo se pueden editar cuentas de cliente.', 'forbidden');
  const updated = await updateAccount(clientId, patch, admin);
  return updated;
}

/** Elimina una cuenta de cliente junto con sus vehículos, órdenes, fotos y bitácora. */
export async function deleteClientCascade(clientId) {
  const admin = await requireAdmin();
  const client = await dbGet('users', clientId);
  assert(client, 'El cliente no existe.', 'not-found');
  assert(client.role === ROLES.CLIENT, 'No se puede eliminar la cuenta de administrador.', 'forbidden');
  void admin;

  const counts = await runTx(['users', 'vehicles', 'orders', 'photos', 'events'], 'readwrite', async (stores) => {
    const vehicles = (await pReq(stores.vehicles.index('ownerId').getAll(clientId)));
    const orders = (await pReq(stores.orders.index('clientId').getAll(clientId)));
    let photos = 0;
    for (const order of orders) {
      const orderPhotos = await pReq(stores.photos.index('orderId').getAll(order.id));
      photos += orderPhotos.length;
      for (const photo of orderPhotos) await pReq(stores.photos.delete(photo.id));
      const events = await pReq(stores.events.index('orderId').getAll(order.id));
      for (const event of events) await pReq(stores.events.delete(event.id));
      await pReq(stores.orders.delete(order.id));
    }
    for (const vehicle of vehicles) await pReq(stores.vehicles.delete(vehicle.id));
    await pReq(stores.users.delete(clientId));
    return { vehicles: vehicles.length, orders: orders.length, photos };
  });
  return counts;
}

/* ============================================================
   VEHÍCULOS
   ============================================================ */
function validateVehicleFields(payload, { partial = false } = {}) {
  const out = {};
  const required = ['brand', 'model', 'year', 'color', 'plates', 'damageDescription', 'service'];
  for (const key of required) {
    if (partial && payload[key] === undefined) continue;
    const value = key === 'year' ? payload.year : clean(payload[key], key === 'damageDescription' ? 2000 : 120);
    if (key === 'year') {
      assert(isValidYear(value), 'El año del vehículo debe estar entre 1950 y el próximo año.');
      out.year = Number(value);
    } else {
      assert(String(value).length >= (key === 'color' ? 2 : 1), `El campo ${key} es obligatorio.`);
      out[key] = value;
    }
  }
  if (out.brand) out.brand = clean(out.brand, 60);
  if (out.model) out.model = clean(out.model, 60);
  if (out.color) out.color = clean(out.color, 40);
  if (out.plates) {
    out.plates = out.plates.toUpperCase();
    out.platesKey = normalizePlate(out.plates);
    assert(out.platesKey.length >= 4, 'Las placas deben tener al menos 4 caracteres.');
  }
  if (payload.service !== undefined) {
    assert(SERVICES.includes(clean(payload.service)), 'Selecciona un servicio válido.');
    out.service = clean(payload.service);
  }
  if (payload.notes !== undefined || out.notes === undefined) out.notes = clean(payload.notes, 1000);
  return out;
}

export function isService(value) {
  return SERVICES.includes(value);
}

export async function assertPlatesAvailable(platesKey, excludeId = null) {
  const vehicles = await dbGetAll('vehicles');
  const found = vehicles.find((v) => v.platesKey === platesKey && v.id !== excludeId);
  if (found) {
    const error = new Error(`Las placas ${found.plates} ya están registradas para otro vehículo.`);
    error.code = 'duplicate-plates';
    throw error;
  }
}

export async function createVehicle(payload) {
  const actor = await requireUser();
  const isAdmin = actor.role === ROLES.ADMIN;
  if (!isAdmin) {
    assert(actor.status === CLIENT_STATUS.ACTIVE, 'Tu cuenta debe estar autorizada para registrar vehículos.', 'not-approved');
  }
  const ownerId = isAdmin ? payload.ownerId : actor.id;
  assert(ownerId, 'Selecciona el propietario del vehículo.');
  const owner = await dbGet('users', ownerId);
  assert(owner && owner.role === ROLES.CLIENT, 'El propietario debe ser un cliente registrado.', 'not-found');

  const fields = validateVehicleFields(payload);
  await assertPlatesAvailable(fields.platesKey);

  const now = nowISO();
  const vehicle = {
    id: uid(),
    ownerId,
    ...fields,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
  };
  await dbPut('vehicles', vehicle);
  return vehicle;
}

export async function updateVehicle(vehicleId, payload) {
  const actor = await requireUser();
  const vehicle = await dbGet('vehicles', vehicleId);
  assert(vehicle, 'El vehículo no existe.', 'not-found');
  const isAdmin = actor.role === ROLES.ADMIN;
  if (!isAdmin) {
    assert(vehicle.ownerId === actor.id, 'No puedes modificar un vehículo de otro cliente.', 'forbidden');
    assert(actor.status === CLIENT_STATUS.ACTIVE, 'Tu cuenta debe estar autorizada para modificar vehículos.', 'not-approved');
  }
  const fields = validateVehicleFields(payload, { partial: true });
  if (fields.platesKey) await assertPlatesAvailable(fields.platesKey, vehicleId);

  let ownerId = vehicle.ownerId;
  if (isAdmin && payload.ownerId && payload.ownerId !== vehicle.ownerId) {
    const owner = await dbGet('users', payload.ownerId);
    assert(owner && owner.role === ROLES.CLIENT, 'El propietario debe ser un cliente registrado.');
    ownerId = payload.ownerId;
  }

  const next = { ...vehicle, ...fields, ownerId, updatedAt: nowISO() };
  await dbPut('vehicles', next);
  return next;
}

export async function deleteVehicle(vehicleId) {
  const actor = await requireUser();
  const vehicle = await dbGet('vehicles', vehicleId);
  assert(vehicle, 'El vehículo no existe.', 'not-found');
  if (actor.role !== ROLES.ADMIN) {
    assert(vehicle.ownerId === actor.id, 'No puedes eliminar un vehículo de otro cliente.', 'forbidden');
    assert(actor.status === CLIENT_STATUS.ACTIVE, 'Tu cuenta debe estar autorizada.', 'not-approved');
  }
  const orders = await dbGetAllByIndexSafe('orders', 'vehicleId', vehicleId);
  assert(
    orders.length === 0,
    `No se puede eliminar: el vehículo tiene ${orders.length} orden(es) de servicio asociada(s). Elimina primero las órdenes.`,
    'has-orders',
  );
  await dbDelete('vehicles', vehicleId);
  return true;
}

export async function listVehicles({ search = '', ownerId = '', service = '' } = {}) {
  const actor = await requireUser();
  const [vehicles, users] = await Promise.all([dbGetAll('vehicles'), dbGetAll('users')]);
  const owners = new Map(users.map((u) => [u.id, u]));
  const q = normalize(search);
  let list = vehicles;
  if (actor.role !== ROLES.ADMIN) list = list.filter((v) => v.ownerId === actor.id);
  else if (ownerId) list = list.filter((v) => v.ownerId === ownerId);
  if (service) list = list.filter((v) => v.service === service);
  if (q) {
    list = list.filter((v) => {
      const owner = owners.get(v.ownerId);
      return normalize([v.brand, v.model, v.plates, v.color, v.service, owner?.name, owner?.email].join(' ')).includes(q);
    });
  }
  return sortBy(
    list.map((v) => {
      const owner = owners.get(v.ownerId);
      return {
        ...v,
        ownerName: owner?.name || 'Propietario eliminado',
        ownerEmail: owner?.email || '',
        ownerPhone: owner?.phone || '',
      };
    }),
    (v) => v.createdAt,
    'desc',
  );
}

export async function getVehicle(vehicleId) {
  const actor = await requireUser();
  const vehicle = await dbGet('vehicles', vehicleId);
  assert(vehicle, 'El vehículo no existe.', 'not-found');
  if (actor.role !== ROLES.ADMIN) {
    assert(vehicle.ownerId === actor.id, 'No puedes consultar un vehículo de otro cliente.', 'forbidden');
  }
  const owner = await dbGet('users', vehicle.ownerId);
  return { ...vehicle, owner: owner ? { ...owner, password: undefined } : null };
}

export async function getVehicleHistory(vehicleId) {
  const actor = await requireUser();
  const vehicle = await dbGet('vehicles', vehicleId);
  assert(vehicle, 'El vehículo no existe.', 'not-found');
  if (actor.role !== ROLES.ADMIN) assert(vehicle.ownerId === actor.id, 'Acceso no autorizado.', 'forbidden');
  const orders = await dbGetAllByIndexSafe('orders', 'vehicleId', vehicleId);
  return sortBy(orders, (o) => o.receivedAt || o.createdAt, 'desc');
}

/* ============================================================
   ÓRDENES DE SERVICIO
   ============================================================ */
function buildVehicleLabel(vehicle) {
  return [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ');
}

function snapshotFrom(order) {
  return {
    clientName: order.clientName || '',
    clientEmail: order.clientEmail || '',
    clientPhone: order.clientPhone || '',
    vehicleLabel: order.vehicleLabel || '',
    plates: order.plates || '',
    vehicleColor: order.vehicleColor || '',
    vehicleService: order.vehicleService || '',
    service: order.service || '',
  };
}

function validateOrderFields(payload, { partial = false } = {}) {
  const out = {};
  const put = (key, value, max = 2000) => {
    if (partial && value === undefined) return;
    out[key] = clean(value, max);
  };
  put('damageDescription', payload.damageDescription, 3000);
  put('requestedWork', payload.requestedWork, 3000);
  put('notes', payload.notes, 2000);
  if (!partial || payload.notes !== undefined) {
    out.notes = clean(payload.notes, 2000);
  }

  if (payload.receivedAt !== undefined || !partial) {
    const received = payload.receivedAt || todayISO();
    assert(isValidDateOnly(received), 'La fecha de recepción no es válida.');
    out.receivedAt = received;
  }
  if (payload.estimatedAt !== undefined || !partial) {
    const estimated = payload.estimatedAt || '';
    if (estimated) {
      assert(isValidDateOnly(estimated), 'La fecha estimada de entrega no es válida.');
      const received = out.receivedAt || payload.receivedAt;
      if (received && parseDateOnly(estimated) < parseDateOnly(received)) {
        assert(false, 'La fecha estimada de entrega no puede ser anterior a la recepción.');
      }
    }
    out.estimatedAt = estimated;
  }
  if (payload.deliveredAt !== undefined || !partial) {
    const delivered = payload.deliveredAt || '';
    if (delivered) assert(isValidDateOnly(delivered), 'La fecha real de entrega no es válida.');
    out.deliveredAt = delivered;
  }
  if (payload.status !== undefined || !partial) {
    const status = payload.status || 'recibido';
    assert(ORDER_STATUS_MAP[status], 'El estado de la orden no es válido.');
    out.status = status;
  }
  if (payload.service !== undefined || !partial) {
    const service = payload.service;
    assert(SERVICES.includes(service), 'Selecciona un servicio válido.');
    out.service = service;
  }
  if (payload.costs !== undefined) {
    out.costs = normalizeCosts(payload.costs);
    out.total = computeTotal(out.costs);
  }
  if (payload.adminNotes !== undefined) out.adminNotes = clean(payload.adminNotes, 2000);
  return out;
}

function makeEvent({ orderId, type, message, actor, meta = {} }) {
  return {
    id: uid(),
    orderId,
    type,
    message,
    actorId: actor?.id || null,
    actorName: actor?.name || 'Sistema',
    meta,
    createdAt: nowISO(),
  };
}

async function getNextFolio(stores) {
  const year = new Date().getFullYear();
  const record = await pReq(stores.settings.get('folio'));
  const current = record?.value;
  const seq = current?.year === year ? Number(current.seq || 0) + 1 : 1;
  await pReq(stores.settings.put({
    key: 'folio',
    value: { year, seq },
    updatedAt: nowISO(),
  }));
  return `RR-${year}-${String(seq).padStart(4, '0')}`;
}

export async function createOrder(payload) {
  const admin = await requireAdmin();
  assert(payload.clientId, 'Selecciona el cliente.');
  assert(payload.vehicleId, 'Selecciona el vehículo.');
  const fields = validateOrderFields({ status: 'recibido', ...payload });
  const now = nowISO();

  const order = await runTx(
    ['orders', 'users', 'vehicles', 'events', 'settings'],
    'readwrite',
    async (stores) => {
      const client = await pReq(stores.users.get(payload.clientId));
      assert(client && client.role === ROLES.CLIENT, 'El cliente seleccionado no es válido.', 'not-found');
      const vehicle = await pReq(stores.vehicles.get(payload.vehicleId));
      assert(vehicle, 'El vehículo seleccionado no existe.', 'not-found');
      assert(vehicle.ownerId === client.id, 'El vehículo no pertenece al cliente seleccionado.', 'invalid-owner');

      const folio = await getNextFolio(stores);
      const record = {
        id: uid(),
        folio,
        clientId: client.id,
        vehicleId: vehicle.id,
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone,
        vehicleLabel: buildVehicleLabel(vehicle),
        plates: vehicle.plates,
        vehicleColor: vehicle.color,
        vehicleService: vehicle.service,
        service: fields.service,
        status: fields.status || 'recibido',
        receivedAt: fields.receivedAt,
        estimatedAt: fields.estimatedAt || '',
        deliveredAt: fields.deliveredAt || '',
        damageDescription: fields.damageDescription || vehicle.damageDescription || '',
        requestedWork: fields.requestedWork || '',
        notes: fields.notes || '',
        adminNotes: fields.adminNotes || '',
        costs: fields.costs || normalizeCosts({}),
        total: fields.total ?? 0,
        createdAt: now,
        updatedAt: now,
        createdBy: admin.id,
        createdByName: admin.name,
      };
      await pReq(stores.orders.add(record));
      await pReq(stores.events.add(makeEvent({
        orderId: record.id,
        type: 'created',
        message: `Orden ${record.folio} creada para ${record.clientName}.`,
        actor: admin,
        meta: { status: record.status },
      })));
      return record;
    },
  );
  return order;
}

export async function updateOrder(orderId, payload) {
  const admin = await requireAdmin();
  const order = await dbGet('orders', orderId);
  assert(order, 'La orden no existe.', 'not-found');
  const now = nowISO();
  const fields = validateOrderFields(payload, { partial: true });

  let client = await dbGet('users', order.clientId);
  let vehicle = await dbGet('vehicles', order.vehicleId);
  const snapshotPatch = {};

  if (payload.clientId && payload.clientId !== order.clientId) {
    const newClient = await dbGet('users', payload.clientId);
    assert(newClient && newClient.role === ROLES.CLIENT, 'El cliente seleccionado no es válido.', 'not-found');
    client = newClient;
    const newVehicle = await dbGet('vehicles', payload.vehicleId);
    assert(newVehicle && newVehicle.ownerId === newClient.id, 'Selecciona un vehículo del nuevo cliente.', 'invalid-owner');
    vehicle = newVehicle;
    snapshotPatch.clientId = newClient.id;
    snapshotPatch.clientName = newClient.name;
    snapshotPatch.clientEmail = newClient.email;
    snapshotPatch.clientPhone = newClient.phone;
  }
  if (payload.vehicleId && payload.vehicleId !== order.vehicleId) {
    const newVehicle = await dbGet('vehicles', payload.vehicleId);
    assert(newVehicle, 'El vehículo no existe.', 'not-found');
    assert(newVehicle.ownerId === (payload.clientId || order.clientId), 'El vehículo no pertenece al cliente.', 'invalid-owner');
    vehicle = newVehicle;
  }
  if (vehicle) {
    snapshotPatch.vehicleId = vehicle.id;
    snapshotPatch.vehicleLabel = buildVehicleLabel(vehicle);
    snapshotPatch.plates = vehicle.plates;
    snapshotPatch.vehicleColor = vehicle.color;
    snapshotPatch.vehicleService = vehicle.service;
  }

  const next = {
    ...order,
    ...snapshotPatch,
    ...fields,
    updatedAt: now,
  };

  if (fields.status === 'entregado' && !next.deliveredAt) {
    next.deliveredAt = todayISO();
  }
  if (fields.status && fields.status !== 'entregado' && order.status === 'entregado' && payload.keepDeliveredAt !== true) {
    // Si se corrige el estado, se conserva la fecha real capturada; el admin puede limpiarla manualmente.
    next.deliveredAt = fields.deliveredAt ?? order.deliveredAt ?? '';
  }
  next.total = fields.costs ? computeTotal(fields.costs) : computeTotal(next.costs || {});

  const events = [];
  if (next.status !== order.status) {
    events.push(makeEvent({
      orderId,
      type: 'status',
      message: `Estado actualizado: ${ORDER_STATUS_MAP[order.status]?.label || order.status} → ${ORDER_STATUS_MAP[next.status]?.label || next.status}.`,
      actor: admin,
      meta: { from: order.status, to: next.status },
    }));
  }
  if (JSON.stringify(order.costs || {}) !== JSON.stringify(next.costs || {})) {
    events.push(makeEvent({
      orderId,
      type: 'costs',
      message: 'Se actualizaron los costos de la orden.',
      actor: admin,
      meta: { total: next.total },
    }));
  }
  if ((order.notes || '') !== (next.notes || '') || (order.adminNotes || '') !== (next.adminNotes || '')) {
    events.push(makeEvent({
      orderId,
      type: 'note',
      message: 'El administrador actualizó las observaciones.',
      actor: admin,
    }));
  }
  if (!events.length) {
    events.push(makeEvent({
      orderId,
      type: 'updated',
      message: 'Se actualizó la información de la orden.',
      actor: admin,
    }));
  }

  await runTx(['orders', 'events'], 'readwrite', async (stores) => {
    await pReq(stores.orders.put(next));
    for (const event of events) await pReq(stores.events.add(event));
  });
  return next;
}

export async function changeOrderStatus(orderId, status, note = '') {
  const admin = await requireAdmin();
  assert(ORDER_STATUS_MAP[status], 'Estado no válido.');
  const order = await dbGet('orders', orderId);
  assert(order, 'La orden no existe.', 'not-found');
  if (order.status === status) return order;

  const next = {
    ...order,
    status,
    updatedAt: nowISO(),
    deliveredAt: status === 'entregado' ? (order.deliveredAt || todayISO()) : order.deliveredAt,
  };
  const message = `Estado actualizado: ${ORDER_STATUS_MAP[order.status]?.label || order.status} → ${ORDER_STATUS_MAP[status].label}.${note ? ` ${note}` : ''}`;
  await runTx(['orders', 'events'], 'readwrite', async (stores) => {
    await pReq(stores.orders.put(next));
    await pReq(stores.events.add(makeEvent({
      orderId, type: 'status', message, actor: admin,
      meta: { from: order.status, to: status },
    })));
  });
  return next;
}

export async function deleteOrder(orderId) {
  const admin = await requireAdmin();
  const order = await dbGet('orders', orderId);
  assert(order, 'La orden no existe.', 'not-found');
  void admin;
  await runTx(['orders', 'photos', 'events'], 'readwrite', async (stores) => {
    const photos = await pReq(stores.photos.index('orderId').getAll(orderId));
    for (const photo of photos) await pReq(stores.photos.delete(photo.id));
    const events = await pReq(stores.events.index('orderId').getAll(orderId));
    for (const event of events) await pReq(stores.events.delete(event.id));
    await pReq(stores.orders.delete(orderId));
  });
  return { folio: order.folio };
}

export async function listOrders(filters = {}) {
  const actor = await requireUser();
  const all = await dbGetAll('orders');
  let list = all;
  if (actor.role !== ROLES.ADMIN) list = list.filter((o) => o.clientId === actor.id);
  else if (filters.clientId) list = list.filter((o) => o.clientId === filters.clientId);
  if (filters.vehicleId) list = list.filter((o) => o.vehicleId === filters.vehicleId);
  if (filters.status) {
    if (filters.status === 'activas') list = list.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
    else if (filters.status === 'historicas') list = list.filter((o) => FINISHED_ORDER_STATUSES.includes(o.status));
    else if (filters.status === 'entregadas') list = list.filter((o) => o.status === 'entregado');
    else list = list.filter((o) => o.status === filters.status);
  }
  if (filters.service) list = list.filter((o) => o.service === filters.service);
  if (filters.from) list = list.filter((o) => (o.receivedAt || o.createdAt || '').slice(0, 10) >= filters.from);
  if (filters.to) list = list.filter((o) => (o.receivedAt || o.createdAt || '').slice(0, 10) <= filters.to);
  if (filters.search) {
    const q = normalize(filters.search);
    list = list.filter((o) => normalize([
      o.folio, o.clientName, o.clientEmail, o.clientPhone, o.vehicleLabel,
      o.plates, o.service, o.damageDescription, o.requestedWork,
    ].join(' ')).includes(q));
  }
  return sortBy(list, (o) => o.receivedAt ? `${o.receivedAt}T${o.createdAt}` : o.createdAt, 'desc');
}

export async function getOrder(orderId) {
  const actor = await requireUser();
  const order = await dbGet('orders', orderId);
  assert(order, 'La orden no existe.', 'not-found');
  if (actor.role !== ROLES.ADMIN) {
    assert(order.clientId === actor.id, 'No tienes permiso para consultar esta orden.', 'forbidden');
  }
  return order;
}

export async function getOrderDetail(orderId) {
  const order = await getOrder(orderId);
  const [photos, events, client, vehicle] = await Promise.all([
    dbGetAllByIndexSafe('photos', 'orderId', orderId),
    dbGetAllByIndexSafe('events', 'orderId', orderId),
    dbGet('users', order.clientId),
    dbGet('vehicles', order.vehicleId),
  ]);
  return {
    order,
    photos: sortBy(photos, (p) => p.createdAt, 'asc'),
    events: sortBy(events, (e) => e.createdAt, 'desc'),
    client: client ? { ...client, password: undefined } : null,
    vehicle,
  };
}

export async function addOrderPhotos(orderId, photos) {
  const admin = await requireAdmin();
  const order = await dbGet('orders', orderId);
  assert(order, 'La orden no existe.', 'not-found');
  const cleanPhotos = (photos || []).filter((p) => {
    return p?.dataUrl?.startsWith('data:image/') && Number(p.size || 0) <= MAX_PHOTO_BYTES;
  });
  if (!cleanPhotos.length) {
    assert(false, 'No se recibieron fotografías válidas (máximo 2.5 MB por imagen comprimida).');
  }
  const now = nowISO();
  const records = cleanPhotos.map((photo, index) => ({
    id: uid(),
    orderId,
    dataUrl: photo.dataUrl,
    type: photo.type || 'image/jpeg',
    width: photo.width || 0,
    height: photo.height || 0,
    size: photo.size || 0,
    originalName: clean(photo.originalName, 180) || `foto-${index + 1}.jpg`,
    note: clean(photo.note, 180),
    createdAt: new Date(Date.now() + index).toISOString(),
    createdBy: admin.id,
    createdByName: admin.name,
  }));

  await runTx(['photos', 'events'], 'readwrite', async (stores) => {
    for (const record of records) await pReq(stores.photos.add(record));
    await pReq(stores.events.add(makeEvent({
      orderId,
      type: 'photo',
      message: `Se agregaron ${records.length} fotografía(s) de avance.`,
      actor: admin,
      meta: { count: records.length },
    })));
  });
  void now;
  return records;
}

export async function deleteOrderPhoto(photoId) {
  const admin = await requireAdmin();
  const photo = await dbGet('photos', photoId);
  assert(photo, 'La fotografía no existe.', 'not-found');
  await dbDelete('photos', photoId);
  await runTx('events', 'readwrite', async (stores) => {
    await pReq(stores.events.add(makeEvent({
      orderId: photo.orderId,
      type: 'photo',
      message: 'Se eliminó una fotografía de avance.',
      actor: admin,
    })));
  });
  return true;
}

export async function listOrderEvents(orderId) {
  await getOrder(orderId);
  return sortBy(await dbGetAllByIndexSafe('events', 'orderId', orderId), (e) => e.createdAt, 'desc');
}

/* ============================================================
   DASHBOARD / ESTADÍSTICAS
   ============================================================ */
export async function getAdminDashboard() {
  await requireAdmin();
  const [users, vehicles, orders, events, setup] = await Promise.all([
    dbGetAll('users'),
    dbGetAll('vehicles'),
    dbGetAll('orders'),
    dbGetAll('events'),
    getSetting('setup'),
  ]);
  const clients = users.filter((u) => u.role === ROLES.CLIENT);
  const pendingClients = clients.filter((c) => c.status === CLIENT_STATUS.PENDING);
  const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const finishedOrders = orders.filter((o) => o.status === 'terminado');
  const deliveredOrders = orders.filter((o) => o.status === 'entregado');
  const income = round2(sum(deliveredOrders, (o) => o.total));
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, 0]));
  for (const order of orders) if (statusCounts[order.status] !== undefined) statusCounts[order.status] += 1;
  const serviceMap = new Map();
  for (const order of orders) serviceMap.set(order.service || 'Sin servicio', (serviceMap.get(order.service || 'Sin servicio') || 0) + 1);
  const serviceCounts = [...serviceMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const months = lastMonths(6);
  const monthlyIncome = months.map((key) => ({
    key,
    total: round2(sum(
      deliveredOrders.filter((o) => monthKey(o.deliveredAt || o.updatedAt || o.createdAt) === key),
      (o) => o.total,
    )),
  }));

  const recentOrders = sortBy(orders, (o) => o.createdAt, 'desc').slice(0, 6);
  const upcoming = sortBy(
    activeOrders.filter((o) => o.estimatedAt),
    (o) => o.estimatedAt,
    'asc',
  ).slice(0, 5);
  const recentEvents = sortBy(events, (e) => e.createdAt, 'desc').slice(0, 8);
  const overdue = activeOrders.filter((o) => o.estimatedAt && o.estimatedAt < todayISO());

  return {
    stats: {
      clients: clients.length,
      pendingClients: pendingClients.length,
      vehicles: vehicles.length,
      activeOrders: activeOrders.length,
      finishedOrders: finishedOrders.length,
      deliveredOrders: deliveredOrders.length,
      income,
      pendingJobs: activeOrders.length,
      overdue: overdue.length,
      averageTicket: deliveredOrders.length ? round2(income / deliveredOrders.length) : 0,
    },
    pendingClients: sortBy(pendingClients, (c) => c.createdAt, 'asc'),
    recentOrders,
    upcoming,
    recentEvents,
    statusCounts,
    serviceCounts,
    monthlyIncome,
    setup: setup || null,
  };
}

export async function getClientDashboard(clientId) {
  const actor = await requireUser();
  if (actor.role !== ROLES.ADMIN) assert(actor.id === clientId, 'Acceso no autorizado.', 'forbidden');
  const [vehicles, allOrders, photos] = await Promise.all([
    dbGetAllByIndexSafe('vehicles', 'ownerId', clientId),
    dbGetAllByIndexSafe('orders', 'clientId', clientId),
    dbGetAll('photos'),
  ]);
  const orders = sortBy(allOrders, (o) => o.createdAt, 'desc');
  const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const finishedOrders = orders.filter((o) => FINISHED_ORDER_STATUSES.includes(o.status));
  const orderIds = new Set(orders.map((o) => o.id));
  return {
    vehicles,
    orders,
    activeOrders,
    finishedOrders,
    latestActive: activeOrders[0] || orders[0] || null,
    stats: {
      vehicles: vehicles.length,
      active: activeOrders.length,
      finished: finishedOrders.length,
      photos: photos.filter((p) => orderIds.has(p.orderId)).length,
      total: round2(sum(finishedOrders, (o) => o.total)),
    },
  };
}

/* ============================================================
   REPORTES
   ============================================================ */
export async function getReportData(filters = {}) {
  await requireAdmin();
  const orders = await listOrders(filters);
  const delivered = orders.filter((o) => o.status === 'entregado');
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, 0]));
  for (const order of orders) if (statusCounts[order.status] !== undefined) statusCounts[order.status] += 1;
  const serviceMap = new Map();
  for (const order of orders) {
    const key = order.service || 'Sin servicio';
    serviceMap.set(key, (serviceMap.get(key) || 0) + 1);
  }
  const serviceCounts = [...serviceMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const months = filters.months || lastMonths(6);
  const monthly = months.map((key) => ({
    key,
    label: key,
    total: round2(sum(orders.filter((o) => monthKey(o.receivedAt || o.createdAt) === key), (o) => o.total)),
    count: orders.filter((o) => monthKey(o.receivedAt || o.createdAt) === key).length,
  }));
  const total = round2(sum(orders, (o) => o.total));
  return {
    orders,
    summary: {
      count: orders.length,
      total,
      income: round2(sum(delivered, (o) => o.total)),
      delivered: delivered.length,
      average: orders.length ? round2(total / orders.length) : 0,
      outstanding: round2(sum(orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)), (o) => o.total)),
    },
    statusCounts,
    serviceCounts,
    monthly,
  };
}

export async function getHistory({ search = '', from = '', to = '', service = '', clientId = '' } = {}) {
  return listOrders({ search, from, to, service, clientId, status: 'historicas' });
}

export async function getClientHistory(clientId) {
  const actor = await requireUser();
  if (actor.role !== ROLES.ADMIN) assert(actor.id === clientId, 'Acceso no autorizado.', 'forbidden');
  const orders = await dbGetAllByIndexSafe('orders', 'clientId', clientId);
  return sortBy(orders.filter((o) => FINISHED_ORDER_STATUSES.includes(o.status)), (o) => o.receivedAt, 'desc');
}

/* ============================================================
   CATÁLOGOS / AUXILIARES
   ============================================================ */
export async function getClientOptions() {
  await requireAdmin();
  const users = await dbGetAll('users');
  return sortBy(users.filter((u) => u.role === ROLES.CLIENT), (u) => u.name, 'asc')
    .map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status, phone: u.phone }));
}

export async function getVehicleOptions(clientId) {
  await requireUser();
  const vehicles = await dbGetAllByIndexSafe('vehicles', 'ownerId', clientId);
  return sortBy(vehicles, (v) => v.createdAt, 'desc')
    .map((v) => ({ id: v.id, label: `${v.brand} ${v.model} ${v.year} · ${v.plates}`, plates: v.plates }));
}

export async function getRecentEvents(limit = 10) {
  await requireAdmin();
  const events = await dbGetAll('events');
  return sortBy(events, (e) => e.createdAt, 'desc').slice(0, limit);
}

export async function getAlerts() {
  const user = await getCurrentUser();
  if (!user) return { pendingClients: 0, activeOrders: 0, overdue: 0 };
  if (user.role === ROLES.ADMIN) {
    const [users, orders] = await Promise.all([dbGetAll('users'), dbGetAll('orders')]);
    return {
      pendingClients: users.filter((u) => u.role === ROLES.CLIENT && u.status === CLIENT_STATUS.PENDING).length,
      activeOrders: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length,
      overdue: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status) && o.estimatedAt && o.estimatedAt < todayISO()).length,
    };
  }
  const orders = await dbGetAllByIndexSafe('orders', 'clientId', user.id);
  return {
    pendingClients: 0,
    activeOrders: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length,
    overdue: 0,
  };
}

export async function getLastBackupAt() {
  return getSetting('lastBackupAt', null);
}

export async function markBackupDone() {
  await setSetting('lastBackupAt', nowISO());
}

export {
  CLIENT_STATUS, CLIENT_STATUS_META, ORDER_STATUSES, ACTIVE_ORDER_STATUSES,
  FINISHED_ORDER_STATUSES, SERVICES, COST_FIELDS, normalize,
  daysBetween, normalizeEmail,
};
