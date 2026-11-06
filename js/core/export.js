/* ============================================================
   RR CARS · Exportación de reportes a CSV y PDF
   ============================================================ */

import {
  downloadBlob, formatDate, money, slugify, todayISO, round2, sum,
} from './utils.js';
import { orderStatusMeta } from './constants.js';
import { downloadReportPdf } from './pdf.js';

const CSV_SEPARATOR = ';'; // Compatible con Excel en configuración regional de México.

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function fixed(value) {
  return (Number(value) || 0).toFixed(2);
}

export function buildOrdersCsv(orders) {
  const headers = [
    'Folio', 'Cliente', 'Correo', 'Teléfono', 'Vehículo', 'Placas', 'Color',
    'Servicio', 'Estado', 'Fecha de recepción', 'Entrega estimada', 'Fecha real de entrega',
    'Mano de obra', 'Materiales', 'Pintura', 'Refacciones', 'Otros conceptos',
    'Descuento', 'Total', 'Daños reportados', 'Trabajos requeridos', 'Observaciones',
  ];
  const lines = [headers.map(csvCell).join(CSV_SEPARATOR)];
  for (const order of orders) {
    const costs = order.costs || {};
    lines.push([
      order.folio,
      order.clientName,
      order.clientEmail,
      order.clientPhone,
      order.vehicleLabel,
      order.plates,
      order.vehicleColor,
      order.service,
      orderStatusMeta(order.status).label,
      order.receivedAt || '',
      order.estimatedAt || '',
      order.deliveredAt || '',
      fixed(costs.labor),
      fixed(costs.materials),
      fixed(costs.paint),
      fixed(costs.parts),
      fixed(costs.other),
      fixed(costs.discount),
      fixed(order.total),
      order.damageDescription || '',
      order.requestedWork || '',
      order.notes || '',
    ].map(csvCell).join(CSV_SEPARATOR));
  }
  const totals = orders.reduce((acc, order) => {
    const costs = order.costs || {};
    acc.labor += Number(costs.labor) || 0;
    acc.materials += Number(costs.materials) || 0;
    acc.paint += Number(costs.paint) || 0;
    acc.parts += Number(costs.parts) || 0;
    acc.other += Number(costs.other) || 0;
    acc.discount += Number(costs.discount) || 0;
    acc.total += Number(order.total) || 0;
    return acc;
  }, { labor: 0, materials: 0, paint: 0, parts: 0, other: 0, discount: 0, total: 0 });
  lines.push('');
  lines.push([
    'TOTALES', '', '', '', '', '', '', '', '', '', '', '',
    fixed(totals.labor), fixed(totals.materials), fixed(totals.paint),
    fixed(totals.parts), fixed(totals.other), fixed(totals.discount),
    fixed(totals.total), '', '', '',
  ].map(csvCell).join(CSV_SEPARATOR));
  return `\uFEFFsep=;\r\n${lines.join('\r\n')}`;
}

export function exportOrdersCsv(orders, filename = `RR-CARS-ordenes-${todayISO()}`) {
  const csv = buildOrdersCsv(orders);
  downloadBlob(`${slugify(filename)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

export function exportOrdersPdf({
  orders,
  filters = {},
  title = 'Reporte de órdenes de servicio',
  filename = `RR-CARS-reporte-${todayISO()}`,
  generatedBy = '',
}) {
  const delivered = orders.filter((o) => o.status === 'entregado');
  const total = round2(sum(orders, (o) => o.total));
  const income = round2(sum(delivered, (o) => o.total));
  const costs = orders.reduce((acc, order) => {
    const c = order.costs || {};
    acc.labor += Number(c.labor) || 0;
    acc.materials += Number(c.materials) || 0;
    acc.paint += Number(c.paint) || 0;
    acc.parts += Number(c.parts) || 0;
    acc.other += Number(c.other) || 0;
    acc.discount += Number(c.discount) || 0;
    return acc;
  }, { labor: 0, materials: 0, paint: 0, parts: 0, other: 0, discount: 0 });

  const columns = [
    { label: 'Folio', weight: 0.9 },
    { label: 'Cliente', weight: 1.45 },
    { label: 'Vehículo', weight: 1.35 },
    { label: 'Placas', weight: 0.8 },
    { label: 'Servicio', weight: 1.15 },
    { label: 'Estado', weight: 0.85 },
    { label: 'Recepción', weight: 0.8 },
    { label: 'Entrega', weight: 0.8 },
    { label: 'Total', weight: 0.9, align: 'right' },
  ];
  const rows = orders.map((order) => [
    order.folio,
    order.clientName,
    order.vehicleLabel,
    order.plates,
    order.service,
    orderStatusMeta(order.status).label,
    formatDate(order.receivedAt),
    order.deliveredAt ? formatDate(order.deliveredAt) : (order.estimatedAt ? `Est. ${formatDate(order.estimatedAt)}` : '—'),
    money(order.total),
  ]);

  const meta = [
    `Generado: ${new Date().toLocaleString('es-MX')}${generatedBy ? ` · Por: ${generatedBy}` : ''}`,
    `Filtros: ${describeFilters(filters)}`,
    `Órdenes: ${orders.length} · Entregadas: ${delivered.length} · Ingresos por entregas: ${money(income)} · Total registrado: ${money(total)}`,
    `Mano de obra: ${money(costs.labor)} · Materiales: ${money(costs.materials)} · Pintura: ${money(costs.paint)} · Refacciones: ${money(costs.parts)} · Otros: ${money(costs.other)} · Descuentos: ${money(costs.discount)}`,
  ];

  return downloadReportPdf({
    filename,
    title,
    subtitle: 'Documento confidencial de uso interno',
    meta,
    columns,
    rows,
    totals: ['TOTALES', '', '', '', '', '', '', '', money(total)],
    notes: [
      'El total registrado incluye órdenes activas, terminadas y entregadas. Los ingresos por entregas solo consideran órdenes con estado Entregado.',
      'Este reporte se genera localmente desde la base de datos de RR CARS. Verifica los respaldos periódicamente.',
    ],
  });
}

export function describeFilters({ from, to, status, service, clientName, vehicleLabel, search } = {}) {
  const parts = [];
  if (from || to) parts.push(`Periodo ${from ? formatDate(from) : 'inicio'} – ${to ? formatDate(to) : 'hoy'}`);
  else parts.push('Periodo completo');
  if (status) parts.push(`Estado: ${status === 'activas' ? 'Activas' : status === 'historicas' ? 'Históricas' : orderStatusMeta(status).label}`);
  if (service) parts.push(`Servicio: ${service}`);
  if (clientName) parts.push(`Cliente: ${clientName}`);
  if (vehicleLabel) parts.push(`Vehículo: ${vehicleLabel}`);
  if (search) parts.push(`Búsqueda: "${search}"`);
  return parts.join(' · ');
}
