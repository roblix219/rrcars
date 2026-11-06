/* ============================================================
   RR CARS · Autenticación, sesiones y control de acceso
   ------------------------------------------------------------
   Importante: al ser una aplicación 100% local (sin backend),
   los controles de rol protegen la interfaz y evitan operaciones
   accidentales, pero NO son una barrera inviolable: cualquier
   persona con acceso físico al navegador y conocimientos técnicos
   puede modificar IndexedDB o el código. Ver limitaciones.
   ============================================================ */

import {
  dbGet, dbGetAllByIndex, dbGetOneByIndex, dbPut, runTx, getSetting,
  setSetting,
} from './db.js';
import { hashPassword, verifyPassword, randomToken } from './crypto.js';
import { normalizeEmail, normalize, nowISO, uid } from './utils.js';
import { ROLES, CLIENT_STATUS, SESSION_KEYS } from './constants.js';

const SESSION_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;   // 7 días
const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;

export class AuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/* ---------- Sesión ---------- */
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    localStorage.setItem(SESSION_KEYS.session, JSON.stringify(session));
  } catch {
    throw new AuthError('No se pudo iniciar la sesión: el almacenamiento del navegador está bloqueado.', 'storage');
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEYS.session); } catch { /* ignore */ }
}

export function getSessionInfo() {
  const session = readSession();
  if (!session) return null;
  return {
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    remember: !!session.remember,
    role: session.role,
  };
}

export function publicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  void password;
  return safe;
}

/**
 * Devuelve el usuario de la sesión actual, validando expiración y existencia.
 * No bloquea cuentas pendientes/suspendidas: la vista muestra el estado.
 */
export async function getCurrentUser() {
  const session = readSession();
  if (!session?.userId) return null;
  const expires = new Date(session.expiresAt).getTime();
  if (!expires || Number.isNaN(expires) || expires < Date.now()) {
    clearSession();
    return null;
  }
  const user = await dbGet('users', session.userId);
  if (!user) {
    clearSession();
    return null;
  }
  if (session.role && session.role !== user.role) {
    clearSession();
    return null;
  }
  return publicUser(user);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Debes iniciar sesión para continuar.', 'unauthenticated');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== ROLES.ADMIN) throw new AuthError('Esta operación requiere permisos de administrador.', 'forbidden');
  return user;
}

export async function requireActiveClient() {
  const user = await requireUser();
  if (user.role !== ROLES.CLIENT) throw new AuthError('Esta operación requiere una cuenta de cliente.', 'forbidden');
  if (user.status !== CLIENT_STATUS.ACTIVE) {
    throw new AuthError('Tu cuenta aún no está autorizada para realizar esta operación.', 'not-approved');
  }
  return user;
}

/* ---------- Intentos de acceso ---------- */
function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEYS.attempts)) || {};
  } catch {
    return {};
  }
}

function writeAttempts(data) {
  try { localStorage.setItem(SESSION_KEYS.attempts, JSON.stringify(data)); } catch { /* ignore */ }
}

export function getLockStatus(email) {
  const emailKey = normalizeEmail(email);
  const record = readAttempts()[emailKey];
  if (record?.lockedUntil && record.lockedUntil > Date.now()) {
    return { locked: true, seconds: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, seconds: 0 };
}

function registerFailedAttempt(emailKey) {
  const all = readAttempts();
  const prev = all[emailKey] || { count: 0, lockedUntil: 0 };
  const count = prev.lockedUntil && prev.lockedUntil < Date.now() ? 1 : prev.count + 1;
  all[emailKey] = {
    count,
    lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
    updatedAt: nowISO(),
  };
  writeAttempts(all);
  return all[emailKey];
}

function clearAttempts(emailKey) {
  const all = readAttempts();
  if (all[emailKey]) {
    delete all[emailKey];
    writeAttempts(all);
  }
}

/* ---------- Configuración inicial del administrador ---------- */
export async function isSetupComplete() {
  const setup = await getSetting('setup');
  return Boolean(setup?.adminCreated);
}

export async function getAdminUser() {
  const admins = await dbGetAllByIndex('users', 'role', ROLES.ADMIN);
  return admins[0] || null;
}

/**
 * Crea la ÚNICA cuenta de administrador.
 * La comprobación y la creación ocurren en una sola transacción para evitar
 * que se cree una segunda cuenta incluso con doble clic o pestañas simultáneas.
 */
export async function createAdmin({ name, email, password, phone = '' }) {
  const cleanName = String(name ?? '').trim();
  const emailKey = normalizeEmail(email);
  if (cleanName.length < 3) throw new AuthError('Escribe el nombre completo del administrador.', 'validation');
  if (!emailKey) throw new AuthError('El correo electrónico es obligatorio.', 'validation');

  const passwordRecord = await hashPassword(password);
  const now = nowISO();
  const admin = {
    id: uid(),
    role: ROLES.ADMIN,
    name: cleanName,
    email: emailKey,
    emailKey,
    phone: String(phone ?? '').trim(),
    password: passwordRecord,
    status: CLIENT_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    requestNote: '',
  };

  await runTx(['users', 'settings'], 'readwrite', async (stores) => {
    const adminCount = await new Promise((resolve, reject) => {
      const r = stores.users.index('role').count(ROLES.ADMIN);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const setup = await new Promise((resolve, reject) => {
      const r = stores.settings.get('setup');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (adminCount > 0 || setup?.value?.adminCreated) {
      throw new AuthError('La cuenta de administrador ya fue configurada. Solo puede existir una.', 'already-configured');
    }
    const existing = await new Promise((resolve, reject) => {
      const r = stores.users.index('emailKey').get(emailKey);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (existing) throw new AuthError('Ese correo electrónico ya está registrado.', 'duplicate');
    await new Promise((resolve, reject) => {
      const r = stores.users.add(admin);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const r = stores.settings.put({
        key: 'setup',
        value: { adminCreated: true, adminId: admin.id, createdAt: now, app: 'RR CARS' },
        updatedAt: now,
      });
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });

  startSession(admin, true);
  return publicUser(admin);
}

/* ---------- Registro de clientes ---------- */
export async function registerClient({ name, email, phone, password, requestNote = '' }) {
  const configured = await isSetupComplete();
  if (!configured) throw new AuthError('La aplicación aún no tiene administrador configurado.', 'not-configured');

  const cleanName = String(name ?? '').trim();
  const emailKey = normalizeEmail(email);
  const cleanPhone = String(phone ?? '').trim();
  if (cleanName.length < 3) throw new AuthError('Escribe tu nombre completo.', 'validation');
  if (cleanName.length > 90) throw new AuthError('El nombre es demasiado largo.', 'validation');
  if (!emailKey) throw new AuthError('El correo electrónico es obligatorio.', 'validation');
  if (!cleanPhone) throw new AuthError('El teléfono es obligatorio.', 'validation');

  const existing = await dbGetOneByIndex('users', 'emailKey', emailKey);
  if (existing) throw new AuthError('Ya existe una cuenta registrada con ese correo electrónico.', 'duplicate');

  const passwordRecord = await hashPassword(password);
  const now = nowISO();
  const user = {
    id: uid(),
    role: ROLES.CLIENT,
    name: cleanName,
    email: emailKey,
    emailKey,
    phone: cleanPhone,
    password: passwordRecord,
    status: CLIENT_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    requestNote: String(requestNote ?? '').trim().slice(0, 500),
    adminNotes: '',
  };

  try {
    await dbPut('users', user);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique') || error?.name === 'ConstraintError') {
      throw new AuthError('Ya existe una cuenta registrada con ese correo electrónico.', 'duplicate');
    }
    throw error;
  }
  return publicUser(user);
}

/* ---------- Iniciar / cerrar sesión ---------- */
function startSession(user, remember = false) {
  const now = Date.now();
  const ttl = remember ? SESSION_REMEMBER_MS : SESSION_DEFAULT_MS;
  const session = {
    userId: user.id,
    role: user.role,
    token: randomToken(),
    remember: !!remember,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  writeSession(session);
  return session;
}

export async function login(email, password, { remember = false } = {}) {
  const emailKey = normalizeEmail(email);
  const lock = getLockStatus(emailKey);
  if (lock.locked) {
    throw new AuthError(`Demasiados intentos fallidos. Espera ${lock.seconds} segundos e inténtalo de nuevo.`, 'locked');
  }
  if (!emailKey || !password) {
    throw new AuthError('Escribe tu correo y contraseña.', 'validation');
  }

  const user = await dbGetOneByIndex('users', 'emailKey', emailKey);
  const valid = user ? await verifyPassword(password, user.password) : false;

  if (!user || !valid) {
    const state = registerFailedAttempt(emailKey);
    const remaining = MAX_ATTEMPTS - state.count;
    const suffix = remaining > 0 ? ` Te quedan ${remaining} intento${remaining === 1 ? '' : 's'}.` : '';
    throw new AuthError(`Correo o contraseña incorrectos.${suffix}`, 'invalid-credentials');
  }

  clearAttempts(emailKey);

  if (user.status === CLIENT_STATUS.REJECTED) {
    throw new AuthError('Tu solicitud de acceso fue rechazada. Contacta al taller para más información.', 'rejected');
  }

  try {
    await dbPut('users', { ...user, lastLoginAt: nowISO() });
  } catch { /* no es crítico */ }

  startSession(user, remember);
  return publicUser(user);
}

export async function logout() {
  clearSession();
}

/* ---------- Edición de cuenta y contraseña ---------- */
export async function updateAccount(userId, patch, actor = null) {
  const user = await dbGet('users', userId);
  if (!user) throw new AuthError('La cuenta no existe.', 'not-found');
  const current = actor || await requireUser();
  if (current.role !== ROLES.ADMIN && current.id !== userId) {
    throw new AuthError('No puedes modificar otra cuenta.', 'forbidden');
  }

  const next = { ...user };
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (name.length < 3) throw new AuthError('El nombre debe tener al menos 3 caracteres.', 'validation');
    next.name = name.slice(0, 90);
  }
  if (patch.phone !== undefined) next.phone = String(patch.phone).trim().slice(0, 30);
  if (patch.email !== undefined) {
    const emailKey = normalizeEmail(patch.email);
    if (!emailKey) throw new AuthError('El correo electrónico es obligatorio.', 'validation');
    if (emailKey !== user.emailKey) {
      const existing = await dbGetOneByIndex('users', 'emailKey', emailKey);
      if (existing && existing.id !== userId) {
        throw new AuthError('Ese correo electrónico ya pertenece a otra cuenta.', 'duplicate');
      }
    }
    next.email = emailKey;
    next.emailKey = emailKey;
  }
  next.updatedAt = nowISO();
  await dbPut('users', next);
  return publicUser(next);
}

export async function changePassword(userId, currentPassword, newPassword, actor = null) {
  const user = await dbGet('users', userId);
  if (!user) throw new AuthError('La cuenta no existe.', 'not-found');
  const current = actor || await requireUser();
  if (current.role !== ROLES.ADMIN && current.id !== userId) {
    throw new AuthError('No puedes modificar otra cuenta.', 'forbidden');
  }
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new AuthError('La contraseña actual no es correcta.', 'invalid-password');

  const record = await hashPassword(newPassword);
  await dbPut('users', { ...user, password: record, passwordUpdatedAt: nowISO(), updatedAt: nowISO() });
  return true;
}

/* ---------- Utilidades ---------- */
export async function getUsersByStatus(status) {
  return dbGetAllByIndex('users', 'status', status);
}

export async function findUserByEmail(email) {
  return dbGetOneByIndex('users', 'emailKey', normalizeEmail(email));
}

export function roleLabel(role) {
  return role === ROLES.ADMIN ? 'Administrador' : 'Cliente';
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function searchUserText(user) {
  return normalize([user.name, user.email, user.phone].filter(Boolean).join(' '));
}

export { CLIENT_STATUS };
export const SESSION_DURATION_TEXT = '7 días (30 días con "Recordarme")';
