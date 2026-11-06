/* ============================================================
   RR CARS · Generador de PDF nativo (sin librerías externas)
   Escribe un documento PDF 1.4 con tabla, encabezados y paginación.
   Las cadenas se codifican en WinAnsi (soporta acentos y ñ).
   ============================================================ */

import { downloadBlob, slugify } from './utils.js';

const PAGE = {
  landscape: { width: 841.89, height: 595.28 },
  portrait: { width: 595.28, height: 841.89 },
};

const COLORS = {
  ink: '#14181e',
  text: '#333b47',
  muted: '#6b7585',
  accent: '#ff6b1a',
  line: '#dfe3e9',
  zebra: '#f6f8fa',
  white: '#ffffff',
};

const FONT_REGULAR = 'F1';
const FONT_BOLD = 'F2';

function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const int = parseInt(full, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

/** Convierte texto a una cadena de bytes compatibles con WinAnsi. */
function encodePdfText(text) {
  const replacements = {
    '—': '-', '–': '-', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'",
    '•': '-', '→': '->', '·': '-', '≥': '>=', '≤': '<=', '€': 'EUR',
    '\n': ' ', '\r': ' ', '\t': ' ',
  };
  return String(text ?? '')
    .replace(/[—–…“”‘’•→·≥≤€\n\r\t]/g, (ch) => replacements[ch] ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function toOctalText(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code < 128) out += ch;
    else out += `\\${code.toString(8).padStart(3, '0')}`;
  }
  return out;
}

/** Aproximación del ancho de texto Helvetica (suficiente para tablas). */
function textWidth(text, size, bold = false) {
  const factor = bold ? 0.56 : 0.51;
  return String(text ?? '').length * size * factor;
}

function fitText(text, maxWidth, size, bold = false) {
  let value = String(text ?? '');
  const ellipsis = '...';
  if (textWidth(value, size, bold) <= maxWidth) return value;
  while (value.length > 1 && textWidth(`${value}${ellipsis}`, size, bold) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}${ellipsis}`;
}

function wrapText(text, maxWidth, size) {
  const words = String(text ?? '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (textWidth(attempt, size) <= maxWidth) {
      current = attempt;
    } else {
      if (current) lines.push(current);
      current = word;
      while (textWidth(current, size) > maxWidth && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && textWidth(current.slice(0, cut), size) > maxWidth) cut -= 1;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

class PdfBuilder {
  constructor({ orientation = 'landscape', title = 'Reporte', subtitle = '', brand = 'RR CARS' } = {}) {
    const size = PAGE[orientation] || PAGE.landscape;
    this.width = size.width;
    this.height = size.height;
    this.margin = 30;
    this.title = title;
    this.subtitle = subtitle;
    this.brand = brand;
    this.pages = [];
    this.current = null;
    this.newPage();
  }

  newPage() {
    this.current = { ops: [] };
    this.pages.push(this.current);
    this.y = this.margin + 58;
    this.drawHeader();
  }

  get contentWidth() {
    return this.width - this.margin * 2;
  }

  drawHeader() {
    const { width, height, margin } = this;
    this.rect(0, 0, width, 4, COLORS.accent);
    this.rect(0, 4, width, 52, COLORS.ink);
    this.rect(0, 56, width, 1, COLORS.accent);

    this.text(this.brand, margin, height - 30, { size: 17, bold: true, color: COLORS.white });
    this.text('HOJALATERÍA Y PINTURA', margin, height - 42, { size: 6.5, color: '#ffb37a', charSpacing: 1.3 });

    this.text(this.title, width - margin, height - 30, {
      size: 13, bold: true, color: COLORS.white, align: 'right',
    });
    if (this.subtitle) {
      this.text(this.subtitle, width - margin, height - 43, {
        size: 7.5, color: '#aab4c2', align: 'right',
      });
    }
    this.y = height - 74;
  }

  rect(xTop, yTop, w, h, fill) {
    const [r, g, b] = hexToRgb(fill);
    this.current.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${xTop.toFixed(2)} ${(this.height - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1, y1Top, x2, y2Top, color = COLORS.line, width = 0.7) {
    const [r, g, b] = hexToRgb(color);
    this.current.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width} w ${x1.toFixed(2)} ${(this.height - y1Top).toFixed(2)} m ${x2.toFixed(2)} ${(this.height - y2Top).toFixed(2)} l S`);
  }

  text(value, x, yTop, { size = 8.5, bold = false, color = COLORS.text, align = 'left', charSpacing = 0 } = {}) {
    if (!value && value !== 0) return;
    let drawX = x;
    const safe = encodePdfText(value);
    if (align === 'right') drawX = x - textWidth(safe, size, bold);
    else if (align === 'center') drawX = x - textWidth(safe, size, bold) / 2;
    const [r, g, b] = hexToRgb(color);
    this.current.ops.push(
      `BT /${bold ? FONT_BOLD : FONT_REGULAR} ${size.toFixed(2)} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${charSpacing ? `${charSpacing} Tc ` : '0 Tc '}${drawX.toFixed(2)} ${(this.height - yTop).toFixed(2)} Td (${toOctalText(safe)}) Tj ET`,
    );
  }

  ensureSpace(needed) {
    if (this.y + needed > this.height - 42) {
      this.newPage();
      return true;
    }
    return false;
  }

  addMeta(lines = []) {
    const size = 7.8;
    for (const line of lines) {
      this.ensureSpace(size + 6);
      this.text(line, this.margin, this.y, { size, color: COLORS.muted });
      this.y += 11;
    }
    this.y += 4;
  }

  addTable(columns, rows, { totals = null, emptyText = 'Sin registros para los filtros seleccionados.' } = {}) {
    const totalWeight = columns.reduce((acc, col) => acc + (col.weight || 1), 0);
    const widths = columns.map((col) => ((col.weight || 1) / totalWeight) * this.contentWidth);
    const fontSize = columns.length > 10 ? 6.8 : columns.length > 7 ? 7.4 : 8.2;
    const headerHeight = 20;
    const rowHeight = columns.length > 10 ? 15 : 17;

    const drawHead = () => {
      this.ensureSpace(headerHeight + rowHeight * 2);
      this.rect(this.margin, this.y, this.contentWidth, headerHeight, '#222932');
      let x = this.margin;
      columns.forEach((col, index) => {
        this.text(col.label, col.align === 'right' ? x + widths[index] - 6 : x + 6, this.y + 13, {
          size: fontSize - 0.6, bold: true, color: COLORS.white,
          align: col.align === 'right' ? 'right' : 'left',
        });
        x += widths[index];
      });
      this.y += headerHeight;
    };

    drawHead();

    if (!rows.length) {
      this.ensureSpace(28);
      this.text(emptyText, this.width / 2, this.y + 16, { size: 9, color: COLORS.muted, align: 'center' });
      this.y += 32;
      return;
    }

    rows.forEach((row, rowIndex) => {
      if (this.ensureSpace(rowHeight + 4)) drawHead();
      if (rowIndex % 2 === 1) this.rect(this.margin, this.y, this.contentWidth, rowHeight, COLORS.zebra);
      let x = this.margin;
      columns.forEach((col, index) => {
        const value = row[index] ?? '';
        const clipped = fitText(value, widths[index] - 12, fontSize, false);
        this.text(clipped, col.align === 'right' ? x + widths[index] - 6 : x + 6, this.y + rowHeight - 5.5, {
          size: fontSize, color: COLORS.text, align: col.align === 'right' ? 'right' : 'left',
        });
        x += widths[index];
      });
      this.line(this.margin, this.y + rowHeight, this.margin + this.contentWidth, this.y + rowHeight, COLORS.line, 0.4);
      this.y += rowHeight;
    });

    if (totals) {
      if (this.ensureSpace(rowHeight + 10)) drawHead();
      this.line(this.margin, this.y, this.margin + this.contentWidth, this.y, COLORS.ink, 1.2);
      let x = this.margin;
      columns.forEach((col, index) => {
        const value = totals[index] ?? '';
        if (value !== '') {
          this.text(fitText(value, widths[index] - 12, fontSize + 0.4, true),
            col.align === 'right' ? x + widths[index] - 6 : x + 6,
            this.y + rowHeight - 4,
            { size: fontSize + 0.4, bold: true, color: COLORS.ink, align: col.align === 'right' ? 'right' : 'left' });
        }
        x += widths[index];
      });
      this.y += rowHeight;
    }
  }

  addSection(title, lines = []) {
    this.ensureSpace(30);
    this.y += 8;
    this.text(title, this.margin, this.y, { size: 8.5, bold: true, color: COLORS.ink });
    this.y += 12;
    for (const line of lines) {
      this.ensureSpace(12);
      this.text(line, this.margin, this.y, { size: 7.8, color: COLORS.muted });
      this.y += 10.5;
    }
  }

  finish() {
    const pageCount = this.pages.length;
    const objects = [];
    const fontRegular = 3;
    const fontBold = 4;
    const firstPageObj = 5;
    const kids = [];

    this.pages.forEach((page, index) => {
      const pageNumber = index + 1;
      const pageObjNum = firstPageObj + index * 2;
      const contentObjNum = pageObjNum + 1;
      const footerY = this.height - 24;
      const footer = [
        `0.42 0.46 0.52 rg BT /${FONT_REGULAR} 6.5 Tf ${this.margin} ${(this.height - footerY).toFixed(2)} Td (${toOctalText(`RR CARS · ${this.brand === 'RR CARS' ? 'Sistema de gestión de taller' : this.brand} · Documento generado el ${new Date().toLocaleString('es-MX')}`)}) Tj ET`,
        `0.42 0.46 0.52 rg BT /${FONT_REGULAR} 6.5 Tf ${(this.width - this.margin - 60).toFixed(2)} ${(this.height - footerY).toFixed(2)} Td (Pagina ${pageNumber} de ${pageCount}) Tj ET`,
      ].join('\n');
      const content = `${page.ops.join('\n')}\n${footer}`;
      const contentBytes = content.length;
      objects[pageObjNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
      objects[contentObjNum] = `<< /Length ${contentBytes} >>\nstream\n${content}\nendstream`;
      kids.push(`${pageObjNum} 0 R`);
    });

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`;
    objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    const maxObj = objects.length - 1;
    let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = new Array(maxObj + 1).fill(0);
    for (let i = 1; i <= maxObj; i += 1) {
      if (!objects[i]) continue;
      offsets[i] = output.length;
      output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefOffset = output.length;
    output += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxObj; i += 1) {
      output += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const bytes = new Uint8Array(output.length);
    for (let i = 0; i < output.length; i += 1) bytes[i] = output.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}

/**
 * Genera y descarga un reporte PDF.
 */
export function downloadReportPdf({
  filename = 'reporte-rr-cars.pdf',
  title = 'Reporte de órdenes',
  subtitle = '',
  meta = [],
  columns = [],
  rows = [],
  totals = null,
  notes = [],
  orientation = 'landscape',
} = {}) {
  const doc = new PdfBuilder({ title, subtitle, orientation });
  doc.addMeta(meta);
  doc.addTable(columns, rows, { totals });
  if (notes.length) doc.addSection('Notas del reporte', notes);
  const blob = doc.finish();
  downloadBlob(slugify(filename).endsWith('.pdf') ? filename : `${slugify(filename)}.pdf`, blob);
  return blob;
}

export { PdfBuilder };
