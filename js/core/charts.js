/* ============================================================
   RR CARS · Gráficas ligeras en Canvas (sin librerías externas)
   Se redibujan al cambiar el tamaño o el tema.
   ============================================================ */

const PALETTE = ['#ff6b1a', '#4aa8ff', '#2dd36f', '#a78bfa', '#f5b83d', '#2dd4bf', '#ff5d5d', '#93a4b8'];

const registry = new Set();
let themeBound = false;

function cssVar(name, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function bindThemeRedraw() {
  if (themeBound) return;
  themeBound = true;
  window.addEventListener('rrcars:theme', () => {
    for (const entry of registry) entry.draw();
  });
}

function register(canvas, draw) {
  if (!canvas) return () => {};
  const entry = { canvas, draw };
  registry.add(entry);
  bindThemeRedraw();
  if (canvas.__rrcarsObserver) canvas.__rrcarsObserver.disconnect();
  const observer = new ResizeObserver(() => {
    if (canvas.isConnected) draw();
    else {
      observer.disconnect();
      registry.delete(entry);
    }
  });
  observer.observe(canvas);
  canvas.__rrcarsObserver = observer;
  requestAnimationFrame(draw);
  return () => {
    observer.disconnect();
    registry.delete(entry);
  };
}

function preparar(canvas) {
  if (!canvas || !canvas.isConnected) return null;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 10 || height < 10) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  return { ctx, width, height };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const normalized = value / base;
  let step = 10;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  return step * base;
}

function emptyMessage(ctx, width, height, text = 'Sin datos para mostrar') {
  ctx.fillStyle = cssVar('--muted-2', '#6d7887');
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
}

/* ---------- Barras verticales ---------- */
export function barChart(canvas, {
  labels = [], values = [], colors = PALETTE, valueFormat = (v) => String(v), showValues = true,
}) {
  return register(canvas, () => {
    const prep = preparar(canvas);
    if (!prep) return;
    const { ctx, width, height } = prep;
    const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!values.length || total <= 0) {
      emptyMessage(ctx, width, height);
      return;
    }
    const padding = { top: 22, right: 12, bottom: 40, left: 40 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const max = niceMax(Math.max(...values));
    const gridColor = cssVar('--border', '#252c36');
    const textColor = cssVar('--muted-2', '#6d7887');

    ctx.strokeStyle = gridColor;
    ctx.fillStyle = textColor;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const value = max - (max / 4) * i;
      ctx.fillStyle = textColor;
      ctx.fillText(value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value)), padding.left - 8, y);
    }

    const slot = plotW / values.length;
    const barW = Math.max(10, Math.min(46, slot * 0.58));
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
      const value = Number(values[index]) || 0;
      const barH = max > 0 ? (value / max) * plotH : 0;
      const x = padding.left + slot * index + (slot - barW) / 2;
      const y = padding.top + plotH - barH;
      ctx.fillStyle = Array.isArray(colors) ? colors[index % colors.length] : colors;
      roundRect(ctx, x, y, barW, Math.max(barH, value > 0 ? 3 : 0), 5);
      ctx.fill();

      if (showValues && value > 0) {
        ctx.fillStyle = cssVar('--text-2', '#c8d0da');
        ctx.font = '600 10.5px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(valueFormat(value), x + barW / 2, y - 5);
      }

      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      let text = String(label);
      const maxWidth = slot - 4;
      if (ctx.measureText(text).width > maxWidth) {
        while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
        text = `${text}…`;
      }
      ctx.fillText(text, padding.left + slot * index + slot / 2, padding.top + plotH + 10);
      ctx.restore();
    });
  });
}

/* ---------- Barras horizontales ---------- */
export function horizontalBarChart(canvas, {
  labels = [], values = [], colors = PALETTE, valueFormat = (v) => String(v),
}) {
  return register(canvas, () => {
    const prep = preparar(canvas);
    if (!prep) return;
    const { ctx, width, height } = prep;
    if (!values.length || Math.max(...values) <= 0) {
      emptyMessage(ctx, width, height);
      return;
    }
    const padding = { top: 8, right: 44, bottom: 8, left: 118 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const max = Math.max(...values);
    const slot = plotH / values.length;
    const barH = Math.max(9, Math.min(20, slot * 0.55));
    const textColor = cssVar('--muted-2', '#6d7887');

    labels.forEach((label, index) => {
      const value = Number(values[index]) || 0;
      const y = padding.top + slot * index + (slot - barH) / 2;
      ctx.fillStyle = cssVar('--panel-3', '#212832');
      roundRect(ctx, padding.left, y, plotW, barH, 4);
      ctx.fill();
      const w = max > 0 ? (value / max) * plotW : 0;
      ctx.fillStyle = Array.isArray(colors) ? colors[index % colors.length] : colors;
      roundRect(ctx, padding.left, y, Math.max(w, value > 0 ? 3 : 0), barH, 4);
      ctx.fill();

      ctx.fillStyle = cssVar('--text-2', '#c8d0da');
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      let text = String(label);
      const maxLabel = padding.left - 18;
      if (ctx.measureText(text).width > maxLabel) {
        while (text.length > 1 && ctx.measureText(`${text}…`).width > maxLabel) text = text.slice(0, -1);
        text = `${text}…`;
      }
      ctx.fillText(text, padding.left - 10, y + barH / 2);

      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      const valueText = valueFormat(value);
      ctx.fillText(valueText, padding.left + plotW + 8, y + barH / 2);
    });
  });
}

/* ---------- Dona ---------- */
export function donutChart(canvas, {
  labels = [], values = [], colors = PALETTE, centerLabel = 'Total', centerValue = '',
}) {
  return register(canvas, () => {
    const prep = preparar(canvas);
    if (!prep) return;
    const { ctx, width, height } = prep;
    const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!values.length || total <= 0) {
      emptyMessage(ctx, width, height);
      return;
    }
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const thickness = Math.max(16, radius * 0.28);
    let angle = -Math.PI / 2;

    values.forEach((value, index) => {
      const portion = (Number(value) || 0) / total;
      const end = angle + portion * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle + 0.02, Math.max(angle + 0.021, end - 0.02));
      ctx.strokeStyle = Array.isArray(colors) ? colors[index % colors.length] : colors;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';
      ctx.stroke();
      angle = end;
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cssVar('--text', '#eef1f5');
    ctx.font = '700 26px "Bahnschrift", "Segoe UI", system-ui, sans-serif';
    ctx.fillText(centerValue || String(total), cx, cy - 7);
    ctx.fillStyle = cssVar('--muted', '#96a1b1');
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(centerLabel, cx, cy + 16);
    void labels;
  });
}

/* ---------- Línea / área ---------- */
export function lineChart(canvas, {
  labels = [], values = [], color = PALETTE[0], valueFormat = (v) => String(v), fill = true,
}) {
  return register(canvas, () => {
    const prep = preparar(canvas);
    if (!prep) return;
    const { ctx, width, height } = prep;
    if (!values.length) {
      emptyMessage(ctx, width, height);
      return;
    }
    const padding = { top: 26, right: 18, bottom: 34, left: 48 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const max = niceMax(Math.max(...values, 1));
    const gridColor = cssVar('--border', '#252c36');
    const textColor = cssVar('--muted-2', '#6d7887');

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const amount = max - (max / 4) * i;
      ctx.fillStyle = textColor;
      ctx.font = '10.5px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(Math.round(amount)), padding.left - 8, y);
    }

    const stepX = values.length > 1 ? plotW / (values.length - 1) : 0;
    const points = values.map((value, index) => ({
      x: padding.left + (values.length > 1 ? stepX * index : plotW / 2),
      y: padding.top + plotH - ((Number(value) || 0) / max) * plotH,
      value: Number(value) || 0,
    }));

    if (fill && points.length > 1) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
      gradient.addColorStop(0, hexToRgba(color, 0.28));
      gradient.addColorStop(1, hexToRgba(color, 0));
      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + plotH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + plotH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.beginPath();
    points.forEach((p, index) => {
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = cssVar('--panel', '#14181e');
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Etiquetas del eje X
    ctx.fillStyle = textColor;
    ctx.font = '10.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const every = Math.ceil(labels.length / 8);
    labels.forEach((label, index) => {
      if (index % every !== 0 && index !== labels.length - 1) return;
      const x = points[index]?.x ?? padding.left;
      ctx.fillText(String(label), x, padding.top + plotH + 10);
    });

    // Etiqueta del último valor
    if (points.length) {
      const last = points[points.length - 1];
      ctx.fillStyle = cssVar('--text-2', '#c8d0da');
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(valueFormat(last.value), Math.min(last.x, width - padding.right), last.y - 7);
    }
  });
}

function hexToRgba(hex, alpha) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(255,107,26,${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export { PALETTE };
