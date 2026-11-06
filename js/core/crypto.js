/* ============================================================
   RR CARS · Seguridad de contraseñas (Web Crypto API)
   PBKDF2 con SHA-256, sal aleatoria por usuario y 210,000 iteraciones.
   Las contraseñas NUNCA se guardan en texto plano.
   ============================================================ */

const ITERATIONS = 210000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function assertCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'El navegador no permite el cifrado seguro en este contexto. Abre RR CARS mediante http://localhost (no con doble clic al archivo) para proteger las contraseñas.',
    );
  }
}

/**
 * Deriva una contraseña con PBKDF2-SHA256.
 * @param {string} password
 * @param {{salt?: string, iterations?: number}} options
 * @returns {Promise<{hash:string, salt:string, iterations:number, algorithm:string}>}
 */
export async function hashPassword(password, options = {}) {
  assertCrypto();
  const iterations = Number(options.iterations) || ITERATIONS;
  const salt = options.salt ? base64ToBytes(options.salt) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  const hash = new Uint8Array(bits);
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    iterations,
    algorithm: 'PBKDF2-SHA256',
  };
}

/** Comparación en tiempo (casi) constante. */
function timingSafeEqual(a, b) {
  const aBytes = base64ToBytes(a);
  const bBytes = base64ToBytes(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/**
 * Verifica una contraseña contra el registro guardado.
 * @param {string} password
 * @param {{hash:string, salt:string, iterations?:number}} record
 */
export async function verifyPassword(password, record) {
  if (!record?.hash || !record?.salt) return false;
  const candidate = await hashPassword(password, {
    salt: record.salt,
    iterations: record.iterations || ITERATIONS,
  });
  return timingSafeEqual(candidate.hash, record.hash);
}

/** Huella SHA-256 (se usa para validar la integridad de respaldos). */
export async function sha256Hex(value) {
  assertCrypto();
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 24) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}
