/* ============================================================
   RR CARS · Utilidades generales
   ============================================================ */

export const APP_NAME = 'RR CARS';
export const APP_VERSION = '1.0.0';
export const CURRENCY = 'MXN';
export const LOCALE = 'es-MX';

/* ---------- DOM ---------- */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Texto ---------- */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export function titleCase(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b([a-záéíóúñü])/g, (m) => m.toUpperCase());
}

export function truncateText(value, max = 80) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/* ---------- IDs / fechas ---------- */
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Convierte 'YYYY-MM-DD' a Date local a mediodía (evita saltos de zona horaria). */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && parseDateOnly(value) !== null;
}

export function formatDate(value, { long = false } = {}) {
  if (!value) return '—';
  const d = parseDateOnly(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, long
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const units = [
    ['año', 365 * 24 * 3600e3], ['mes', 30 * 24 * 3600e3], ['día', 24 * 3600e3],
    ['hora', 3600e3], ['minuto', 60e3],
  ];
  for (const [label, ms] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      const plural = label === 'mes' ? 'meses' : `${label}${n === 1 ? '' : 's'}`;
      return diff >= 0 ? `Hace ${n} ${plural}` : `En ${n} ${plural}`;
    }
  }
  return 'Hace un momento';
}

export function daysBetween(from, to = todayISO()) {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return null;
  return Math.round((b - a) / (24 * 3600e3));
}

export function monthKey(value) {
  const d = parseDateOnly(value) || new Date(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key, { withYear = false } = {}) {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(LOCALE, { month: 'short', year: withYear ? '2-digit' : undefined })
    .replace('.', '');
}

export function lastMonths(count = 6) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function dateRangeForPeriod(period) {
  const now = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (period === 'month') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
  if (period === 'quarter') {
    return { from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: iso(now) };
  }
  if (period === 'year') {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  }
  return { from: '', to: '' };
}

/* ---------- Números / moneda ---------- */
export function money(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyShort(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
}

export function number(value) {
  return (Number(value) || 0).toLocaleString(LOCALE);
}

export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function sum(items, selector = (x) => x) {
  return items.reduce((acc, item) => acc + (Number(selector(item)) || 0), 0);
}

export function groupBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function uniqueBy(items, selector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------- Validaciones ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value) {
  const email = String(value ?? '').trim();
  return email.length <= 120 && EMAIL_RE.test(email);
}

export function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidPhone(value) {
  const digits = phoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function passwordScore(password) {
  const pw = String(password ?? '');
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) return 0;
  return clamp(score, 1, 4);
}

export function passwordIssues(password) {
  const issues = [];
  const pw = String(password ?? '');
  if (pw.length < 8) issues.push('al menos 8 caracteres');
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw)) issues.push('al menos una letra');
  if (!/\d/.test(pw)) issues.push('al menos un número');
  return issues;
}

export function isValidYear(value) {
  const y = Number(value);
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(y) && y >= 1950 && y <= max;
}

/* ---------- Formularios ---------- */
export function setFieldError(input, message = '') {
  if (!input) return;
  const field = input.closest('.field') || input.parentElement;
  if (!field) return;
  const error = field.querySelector('.error-text');
  if (message) {
    field.classList.add('invalid');
    input.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = message;
  } else {
    field.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
    if (error) error.textContent = '';
  }
}

export function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 120) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback manual */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ---------- Archivos ---------- */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function dataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Redimensiona y comprime una imagen para almacenarla en IndexedDB.
 * Las fotografías se guardan como data URL JPEG para poder exportarlas a JSON.
 */
export function compressImage(file, { maxSize = 1400, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen.'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error('La imagen supera el límite de 20 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida o está dañada.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          dataUrl,
          width,
          height,
          size: dataUrlBytes(dataUrl),
          type: 'image/jpeg',
          originalName: file.name,
          originalSize: file.size,
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Preferencias ---------- */
export const PREFS_KEY = 'rrcars.prefs.v1';

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch { /* almacenamiento lleno o bloqueado */ }
  return next;
}

export function getStoredTheme() {
  const prefs = loadPrefs();
  if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', value);
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', value === 'light' ? '#f4f6f9' : '#0b0d10');
  });
  savePrefs({ theme: value });
  window.dispatchEvent(new CustomEvent('rrcars:theme', { detail: value }));
  return value;
}

/* ---------- Varios ---------- */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'RR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function sortBy(items, selector, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = selector(a);
    const bv = selector(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), LOCALE, { numeric: true }) * dir;
  });
}

export function todayLong() {
  return new Date().toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
