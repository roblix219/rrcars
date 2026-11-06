/* ============================================================
   RR CARS · Enrutador basado en hash (compatible con PWA offline)
   ============================================================ */

export function getRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const questionIndex = raw.indexOf('?');
  const pathPart = questionIndex >= 0 ? raw.slice(0, questionIndex) : raw;
  const queryPart = questionIndex >= 0 ? raw.slice(questionIndex + 1) : '';
  let path = pathPart || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return {
    path,
    query: new URLSearchParams(queryPart),
    hash: raw,
  };
}

export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) {
    const url = `${location.pathname}${location.search}${target}`;
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = target;
  }
}

/** Devuelve los parámetros si la ruta coincide, o null. Patrón: /admin/ordenes/:id */
export function matchRoute(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

export function onRouteChange(handler) {
  window.addEventListener('hashchange', handler);
  if (!location.hash) history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}

export function goBack(fallback = '/') {
  if (window.history.length > 1 && document.referrer) window.history.back();
  else navigate(fallback);
}
