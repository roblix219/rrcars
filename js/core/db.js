/* ============================================================
   RR CARS · Capa de base de datos (IndexedDB)
   Base: rrcars_db
   Almacenes relacionados:
     users    -> cuentas (1 administrador + clientes)
     vehicles -> vehículos (ownerId -> users)
     orders   -> órdenes (clientId, vehicleId)
     photos   -> fotografías de progreso (orderId)
     events   -> bitácora / historial (orderId)
     settings -> configuración y contadores
   ============================================================ */

import { DB_NAME, DB_VERSION, STORE_NAMES } from './constants.js';

let dbPromise = null;

function reqPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de IndexedDB'));
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Este navegador no soporta IndexedDB. Usa una versión reciente de Chrome.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;

      if (!db.objectStoreNames.contains('users')) {
        const users = db.createObjectStore('users', { keyPath: 'id' });
        users.createIndex('emailKey', 'emailKey', { unique: true });
        users.createIndex('role', 'role', { unique: false });
        users.createIndex('status', 'status', { unique: false });
        users.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('vehicles')) {
        const vehicles = db.createObjectStore('vehicles', { keyPath: 'id' });
        vehicles.createIndex('ownerId', 'ownerId', { unique: false });
        vehicles.createIndex('platesKey', 'platesKey', { unique: false });
        vehicles.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('orders')) {
        const orders = db.createObjectStore('orders', { keyPath: 'id' });
        orders.createIndex('folio', 'folio', { unique: true });
        orders.createIndex('clientId', 'clientId', { unique: false });
        orders.createIndex('vehicleId', 'vehicleId', { unique: false });
        orders.createIndex('status', 'status', { unique: false });
        orders.createIndex('service', 'service', { unique: false });
        orders.createIndex('receivedAt', 'receivedAt', { unique: false });
        orders.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('orderId', 'orderId', { unique: false });
        photos.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('orderId', 'orderId', { unique: false });
        events.createIndex('createdAt', 'createdAt', { unique: false });
        events.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Migraciones futuras: usar event.oldVersion
      void tx; void event;
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la base de datos.'));
    request.onblocked = () => reject(new Error('La base de datos está bloqueada. Cierra otras pestañas de RR CARS e inténtalo de nuevo.'));
  });
  return dbPromise;
}

/**
 * Ejecuta trabajo dentro de una transacción y resuelve al confirmarse.
 * El trabajo debe usar los object stores recibidos y esperar sus requests.
 */
export async function runTx(storeNames, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeNames, mode);
    } catch (error) {
      reject(error);
      return;
    }
    const stores = Array.isArray(storeNames)
      ? Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]))
      : { [storeNames]: tx.objectStore(storeNames) };

    let result;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    tx.onerror = () => fail(tx.error || new Error('La transacción falló.'));
    tx.onabort = () => fail(tx.error || new Error('La transacción fue cancelada.'));

    Promise.resolve()
      .then(() => work(stores, tx))
      .then((value) => { result = value; })
      .catch((error) => {
        try { tx.abort(); } catch { /* ya abortada */ }
        fail(error);
      });
  });
}

/* ---------- Lecturas ---------- */
export async function dbGet(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  return reqPromise(tx.objectStore(store).get(key));
}

export async function dbGetAll(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  return reqPromise(tx.objectStore(store).getAll());
}

export async function dbGetAllByIndex(store, indexName, query) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const index = tx.objectStore(store).index(indexName);
  return reqPromise(index.getAll(query));
}

export async function dbGetOneByIndex(store, indexName, query) {
  const list = await dbGetAllByIndex(store, indexName, query);
  return list[0] || null;
}

export async function dbCount(store, indexName, query) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const target = indexName ? tx.objectStore(store).index(indexName) : tx.objectStore(store);
  return reqPromise(target.count(query));
}

/* ---------- Escrituras ---------- */
export async function dbPut(store, value) {
  return runTx(store, 'readwrite', async (stores) => {
    await reqPromise(stores[store].put(value));
    return value;
  });
}

export async function dbAdd(store, value) {
  return runTx(store, 'readwrite', async (stores) => {
    await reqPromise(stores[store].add(value));
    return value;
  });
}

export async function dbDelete(store, key) {
  return runTx(store, 'readwrite', async (stores) => {
    await reqPromise(stores[store].delete(key));
    return true;
  });
}

export async function dbBulkPut(store, items) {
  if (!items?.length) return 0;
  return runTx(store, 'readwrite', async (stores) => {
    for (const item of items) {
      await reqPromise(stores[store].put(item));
    }
    return items.length;
  });
}

export async function dbClear(store) {
  return runTx(store, 'readwrite', async (stores) => {
    await reqPromise(stores[store].clear());
    return true;
  });
}

/* ---------- Configuración ---------- */
export async function getSetting(key, fallback = null) {
  const record = await dbGet('settings', key);
  return record ? record.value : fallback;
}

export async function getSettingRecord(key) {
  return dbGet('settings', key);
}

export async function setSetting(key, value) {
  return dbPut('settings', { key, value, updatedAt: new Date().toISOString() });
}

/* ---------- Operaciones compuestas ---------- */
export async function clearAllData() {
  return runTx(STORE_NAMES, 'readwrite', async (stores) => {
    for (const name of STORE_NAMES) {
      await reqPromise(stores[name].clear());
    }
    return true;
  });
}

/**
 * Reemplaza TODA la base con un respaldo validado.
 * Se ejecuta en una sola transacción para evitar estados parciales.
 */
export async function replaceAllData(data) {
  return runTx(STORE_NAMES, 'readwrite', async (stores) => {
    for (const name of STORE_NAMES) {
      await reqPromise(stores[name].clear());
    }
    for (const name of STORE_NAMES) {
      const rows = data[name] || [];
      for (const row of rows) {
        await reqPromise(stores[name].put(row));
      }
    }
    return true;
  });
}

export async function deleteDatabase() {
  const db = await openDB().catch(() => null);
  if (db) db.close();
  dbPromise = null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error('No se pudo eliminar la base de datos.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de RR CARS para restablecer la aplicación.'));
  });
}

/* ---------- Almacenamiento estimado ---------- */
export async function getStorageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage || 0, quota: est.quota || 0 };
    }
  } catch { /* sin soporte */ }
  return { usage: 0, quota: 0 };
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* sin soporte */ }
  return false;
}

/* ---------- Resumen de la base ---------- */
export async function getDatabaseSummary() {
  const [users, vehicles, orders, photos, events] = await Promise.all([
    dbCount('users'),
    dbCount('vehicles'),
    dbCount('orders'),
    dbCount('photos'),
    dbCount('events'),
  ]);
  return { users, vehicles, orders, photos, events };
}
