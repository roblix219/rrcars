/* ============================================================
   RR CARS · Respaldo y restauración de datos (JSON)
   ------------------------------------------------------------
   El respaldo incluye usuarios, vehículos, órdenes, fotografías,
   historial y configuración. Las contraseñas se exportan como hash
   PBKDF2 (nunca en texto plano).
   ============================================================ */

import {
  dbGetAll, getSetting, setSetting, replaceAllData,
} from './db.js';
import { requireAdmin, getCurrentUser } from './auth.js';
import {
  STORE_NAMES, ROLES, CLIENT_STATUS, ORDER_STATUS_MAP,
} from './constants.js';
import {
  downloadBlob, nowISO, todayISO, normalizeEmail, uid, isValidDateOnly,
} from './utils.js';
import { APP_VERSION } from './utils.js';

const BACKUP_FORMAT = 'rrcars-backup';
const BACKUP_VERSION = 1;

export async function createBackupPayload({ includePhotos = true } = {}) {
  await requireAdmin();
  const data = {};
  for (const store of STORE_NAMES) {
    const rows = await dbGetAll(store);
    data[store] = store === 'photos' && !includePhotos ? [] : rows;
  }
  const counts = {
    users: data.users.length,
    vehicles: data.vehicles.length,
    orders: data.orders.length,
    photos: data.photos.length,
    events: data.events.length,
  };
  const payload = {
    app: 'RR CARS',
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowISO(),
    includePhotos,
    counts,
    data,
  };
  return payload;
}

export async function downloadBackup({ includePhotos = true } = {}) {
  const payload = await createBackupPayload({ includePhotos });
  const filename = `RR-CARS-respaldo-${todayISO()}.json`;
  downloadBlob(filename, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  await markBackupDone();
  return { filename, counts: payload.counts, includePhotos };
}

export async function markBackupDone() {
  await setSetting('lastBackupAt', nowISO());
}

export async function getLastBackupAt() {
  const record = await getSetting('lastBackupAt', null);
  return record;
}

function fail(message) {
  const error = new Error(message);
  error.code = 'backup-invalid';
  throw error;
}

/**
 * Valida estructura, integridad referencial y reglas del sistema.
 * Devuelve un resumen legible antes de reemplazar datos.
 */
export function inspectBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') fail('El archivo no contiene un respaldo válido.');
  if (parsed.format !== BACKUP_FORMAT) fail('El archivo no fue generado por RR CARS o su formato no es reconocido.');
  if (Number(parsed.version) > BACKUP_VERSION) fail('El respaldo fue creado por una versión más reciente de RR CARS.');
  const data = parsed.data;
  if (!data || typeof data !== 'object') fail('El respaldo no contiene datos.');
  for (const store of STORE_NAMES) {
    if (!Array.isArray(data[store])) fail(`Falta la colección "${store}" en el respaldo.`);
  }

  const users = data.users;
  const admins = users.filter((u) => u.role === ROLES.ADMIN);
  if (admins.length !== 1) fail(`El respaldo debe contener exactamente un administrador (encontrados: ${admins.length}).`);
  const emails = new Set();
  for (const user of users) {
    if (!user.id || !user.emailKey || !user.name) fail('Hay una cuenta con datos incompletos en el respaldo.');
    if (![ROLES.ADMIN, ROLES.CLIENT].includes(user.role)) fail(`Rol inválido en la cuenta ${user.email || user.id}.`);
    if (!user.password?.hash || !user.password?.salt) fail(`La cuenta ${user.email || user.id} no contiene una contraseña protegida válida.`);
    const email = normalizeEmail(user.emailKey);
    if (emails.has(email)) fail(`El correo ${email} está duplicado en el respaldo.`);
    emails.add(email);
    if (user.role === ROLES.ADMIN && user.status !== CLIENT_STATUS.ACTIVE) {
      fail('La cuenta de administrador del respaldo debe estar activa.');
    }
  }
  const adminsInBackup = admins[0];
  const clientById = new Map(users.filter((u) => u.role === ROLES.CLIENT).map((u) => [u.id, u]));

  const vehicleIds = new Set();
  const plates = new Set();
  for (const vehicle of data.vehicles) {
    if (!vehicle.id || !vehicle.ownerId || !vehicle.brand || !vehicle.model) fail('Hay un vehículo con datos incompletos en el respaldo.');
    if (!clientById.has(vehicle.ownerId)) fail(`El vehículo ${vehicle.plates || vehicle.id} pertenece a una cuenta inexistente.`);
    if (vehicleIds.has(vehicle.id)) fail(`El vehículo ${vehicle.id} está duplicado.`);
    vehicleIds.add(vehicle.id);
    if (vehicle.platesKey) {
      if (plates.has(vehicle.platesKey)) fail(`Las placas ${vehicle.plates} están duplicadas en el respaldo.`);
      plates.add(vehicle.platesKey);
    }
  }

  const orderIds = new Set();
  const folios = new Set();
  for (const order of data.orders) {
    if (!order.id || !order.folio || !order.clientId || !order.vehicleId) fail('Hay una orden con datos incompletos en el respaldo.');
    if (!clientById.has(order.clientId)) fail(`La orden ${order.folio} pertenece a un cliente inexistente.`);
    if (!vehicleIds.has(order.vehicleId)) fail(`El vehículo de la orden ${order.folio} no existe en el respaldo.`);
    if (!ORDER_STATUS_MAP[order.status]) fail(`La orden ${order.folio} tiene un estado inválido.`);
    if (order.receivedAt && !isValidDateOnly(order.receivedAt)) fail(`La orden ${order.folio} tiene una fecha de recepción inválida.`);
    if (orderIds.has(order.id)) fail(`La orden ${order.folio} está duplicada.`);
    if (folios.has(order.folio)) fail(`El folio ${order.folio} está duplicado.`);
    orderIds.add(order.id);
    folios.add(order.folio);
  }

  for (const photo of data.photos) {
    if (!photo.id || !photo.orderId) fail('Hay una fotografía con datos incompletos.');
    if (!orderIds.has(photo.orderId)) fail('Una fotografía pertenece a una orden inexistente.');
    if (!String(photo.dataUrl || '').startsWith('data:image/')) fail('Una fotografía del respaldo no tiene un formato válido.');
  }
  for (const event of data.events) {
    if (!event.id || !orderIds.has(event.orderId)) fail('El historial contiene registros de órdenes inexistentes.');
  }
  for (const setting of data.settings) {
    if (!setting.key) fail('Hay configuración inválida en el respaldo.');
  }

  return {
    admin: { name: adminsInBackup.name, email: adminsInBackup.email },
    counts: {
      users: users.length,
      clients: users.filter((u) => u.role === ROLES.CLIENT).length,
      vehicles: data.vehicles.length,
      orders: data.orders.length,
      photos: data.photos.length,
      events: data.events.length,
    },
    exportedAt: parsed.exportedAt || null,
    includePhotos: parsed.includePhotos !== false,
    appVersion: parsed.appVersion || '—',
  };
}

export async function restoreBackup(parsed) {
  const admin = await requireAdmin();
  const summary = inspectBackup(parsed);

  // Garantizar consistencia de la configuración de administrador.
  const settings = [...parsed.data.settings];
  const setupIndex = settings.findIndex((s) => s.key === 'setup');
  const setupValue = {
    adminCreated: true,
    adminId: parsed.data.users.find((u) => u.role === ROLES.ADMIN).id,
    restoredAt: nowISO(),
    app: 'RR CARS',
  };
  if (setupIndex >= 0) settings[setupIndex] = { ...settings[setupIndex], value: { ...settings[setupIndex].value, ...setupValue } };
  else settings.push({ key: 'setup', value: setupValue, updatedAt: nowISO() });

  // Garantizar contador de folios coherente tras restaurar.
  const folioIndex = settings.findIndex((s) => s.key === 'folio');
  if (folioIndex < 0) {
    const year = new Date().getFullYear();
    const maxSeq = Math.max(0, ...parsed.data.orders
      .filter((o) => String(o.folio).startsWith(`RR-${year}-`))
      .map((o) => Number(String(o.folio).split('-')[2]) || 0));
    settings.push({ key: 'folio', value: { year, seq: maxSeq }, updatedAt: nowISO() });
  }

  const data = { ...parsed.data, settings };
  await replaceAllData(data);
  await setSetting('lastRestoreAt', nowISO());
  await setSetting('lastRestoreBy', admin.email || admin.name);

  const current = await getCurrentUser();
  return { summary, restoredBy: current?.id === admin.id ? admin.id : admin.id, adminEmail: summary.admin.email };
}

export async function readBackupFile(file) {
  if (!file) throw new Error('Selecciona un archivo de respaldo.');
  if (file.size > 250 * 1024 * 1024) throw new Error('El archivo es demasiado grande (máximo 250 MB).');
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido. Selecciona un respaldo generado por RR CARS.');
  }
  return parsed;
}

/** Utilidad para pruebas / generación de un respaldo vacío válido. */
export function emptyBackupShell(adminPasswordRecord) {
  return {
    app: 'RR CARS',
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    includePhotos: true,
    data: {
      users: [{
        id: uid(),
        role: ROLES.ADMIN,
        name: 'Administrador',
        email: 'admin@rrcars.local',
        emailKey: 'admin@rrcars.local',
        phone: '',
        password: adminPasswordRecord,
        status: CLIENT_STATUS.ACTIVE,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }],
      vehicles: [],
      orders: [],
      photos: [],
      events: [],
      settings: [{ key: 'setup', value: { adminCreated: true }, updatedAt: nowISO() }],
    },
  };
}
