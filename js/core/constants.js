/* ============================================================
   RR CARS · Dominio: roles, estados y servicios
   ============================================================ */

export const ROLES = { ADMIN: 'admin', CLIENT: 'client' };

export const CLIENT_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
};

export const CLIENT_STATUS_META = {
  pending: {
    label: 'Pendiente de aprobación',
    short: 'Pendiente',
    badge: 'badge-pending',
    description: 'La cuenta está registrada y espera la autorización del administrador.',
  },
  active: {
    label: 'Cuenta autorizada',
    short: 'Autorizada',
    badge: 'badge-active',
    description: 'La cuenta está activa y puede utilizar todas las funciones del portal.',
  },
  rejected: {
    label: 'Cuenta rechazada',
    short: 'Rechazada',
    badge: 'badge-rejected',
    description: 'La solicitud de acceso fue rechazada por el administrador del taller.',
  },
  suspended: {
    label: 'Cuenta suspendida',
    short: 'Suspendida',
    badge: 'badge-suspended',
    description: 'El acceso fue suspendido temporalmente por el administrador del taller.',
  },
};

export const ORDER_STATUSES = [
  {
    key: 'recibido',
    label: 'Recibido',
    badge: 'badge-recibido',
    color: '#93a4b8',
    description: 'El vehículo fue recibido y está en espera de diagnóstico.',
  },
  {
    key: 'diagnostico',
    label: 'En diagnóstico',
    badge: 'badge-diagnostico',
    color: '#4aa8ff',
    description: 'Se está evaluando el daño y definiendo el alcance del trabajo.',
  },
  {
    key: 'hojalateria',
    label: 'Hojalatería',
    badge: 'badge-hojalateria',
    color: '#ff6b1a',
    description: 'Trabajos de enderezado, reparación de paneles y estructura.',
  },
  {
    key: 'pintura',
    label: 'Pintura',
    badge: 'badge-pintura',
    color: '#a78bfa',
    description: 'Preparación de superficie, aplicación de pintura y secado.',
  },
  {
    key: 'revision',
    label: 'En revisión',
    badge: 'badge-revision',
    color: '#f5b83d',
    description: 'Control de calidad, armado final y verificación de detalles.',
  },
  {
    key: 'terminado',
    label: 'Terminado',
    badge: 'badge-terminado',
    color: '#2dd36f',
    description: 'La reparación concluyó y el vehículo está listo para entrega.',
  },
  {
    key: 'entregado',
    label: 'Entregado',
    badge: 'badge-entregado',
    color: '#2dd4bf',
    description: 'El vehículo fue entregado al cliente.',
  },
];

export const ORDER_STATUS_MAP = Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, s]));
export const ACTIVE_ORDER_STATUSES = ['recibido', 'diagnostico', 'hojalateria', 'pintura', 'revision'];
export const FINISHED_ORDER_STATUSES = ['terminado', 'entregado'];

export function orderStatusMeta(key) {
  return ORDER_STATUS_MAP[key] || {
    key, label: key || 'Sin estado', badge: 'badge-suspended', color: '#93a4b8', description: '',
  };
}

export function orderStatusIndex(key) {
  return ORDER_STATUSES.findIndex((s) => s.key === key);
}

export const SERVICES = [
  'Hojalatería',
  'Pintura',
  'Hojalatería y pintura',
  'Reparación de carrocería',
  'Enderezado y alineación',
  'Pulido y estética',
  'Otro',
];

export const COST_FIELDS = [
  { key: 'labor', label: 'Mano de obra' },
  { key: 'materials', label: 'Materiales' },
  { key: 'paint', label: 'Pintura' },
  { key: 'parts', label: 'Refacciones' },
  { key: 'other', label: 'Otros conceptos' },
];

export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
export const SESSION_KEYS = {
  session: 'rrcars.session.v1',
  attempts: 'rrcars.loginAttempts.v1',
  lastBackup: 'rrcars.lastBackup.v1',
};

export const DB_NAME = 'rrcars_db';
export const DB_VERSION = 1;

export const STORE_NAMES = ['users', 'vehicles', 'orders', 'photos', 'events', 'settings'];
