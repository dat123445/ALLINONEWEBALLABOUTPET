import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  /** Number format: 'currency', 'number', 'percent', 'date', or custom */
  format?: 'currency' | 'number' | 'percent' | 'date' | 'text';
  width?: number;
  /** Highlight cell if value meets condition */
  highlight?: (value: any, row: any) => 'warning' | 'error' | 'success' | null;
}

export interface ExportSummary {
  label: string;
  /** Column key to put the value in, or 'value' for a single value column */
  columnKey?: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percent' | 'text';
}

export interface ExportConfig {
  /** Report name, e.g. "รายงานสต๊อกสินค้า" */
  reportName: string;
  /** Column definitions */
  columns: ExportColumn[];
  /** Data rows */
  data: Record<string, any>[];
  /** Summary rows shown at the bottom */
  summary?: ExportSummary[];
  /** Additional info rows shown at the top (e.g. date range, branch) */
  meta?: { label: string; value: string }[];
  /** Date range for filename, defaults to today */
  dateRange?: { start: string; end: string };
  /** Highlight row condition */
  rowHighlight?: (row: any) => 'warning' | 'error' | 'success' | null;
}

const COLORS = {
  headerFill: { fgColor: { rgb: '1E40AF' } }, // primary-700
  headerFont: { color: { rgb: 'FFFFFF' }, bold: true, sz: 12 },
  metaFont: { color: { rgb: '64748B' }, sz: 10 }, // surface-500
  summaryFill: { fgColor: { rgb: 'F1F5F9' } }, // surface-100
  summaryFont: { bold: true, sz: 11 },
  warningFill: { fgColor: { rgb: 'FEF3C7' } }, // warning-100
  errorFill: { fgColor: { rgb: 'FEE2E2' } }, // error-100
  successFill: { fgColor: { rgb: 'D1FAE5' } }, // success-100
  border: { style: 'thin', color: { rgb: 'E2E8F0' } },
};

function getNumberFormat(format?: string): string {
  switch (format) {
    case 'currency': return '#,##0.00 "฿"';
    case 'number': return '#,##0.00';
    case 'percent': return '0.0%';
    case 'date': return 'DD/MM/YYYY';
    default: return '@';
  }
}

function thaiDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear() + 543;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function applyCellStyle(cell: XLSX.CellObject, opts: {
  fill?: any;
  font?: any;
  format?: string;
  bold?: boolean;
  align?: 'left' | 'right' | 'center';
}): void {
  if (opts.fill) (cell as any).s = (cell as any).s || {};
  if (opts.fill) {
    (cell as any).s.fill = { patternType: 'solid', ...opts.fill };
  }
  if (opts.font || opts.bold) {
    (cell as any).s = (cell as any).s || {};
    (cell as any).s.font = { ...(opts.font || {}), bold: opts.bold ?? (opts.font as any)?.bold };
  }
  if (opts.format) {
    cell.z = getNumberFormat(opts.format);
  }
  if (opts.align) {
    (cell as any).s = (cell as any).s || {};
    (cell as any).s.alignment = { horizontal: opts.align, vertical: 'center' };
  }
}

export function exportToExcel(config: ExportConfig): void {
  const { reportName, columns, data, summary, meta, dateRange, rowHighlight } = config;

  // Build worksheet data manually for full control
  const ws: XLSX.WorkSheet = {};
  let row = 0;

  // Title row
  const titleCell = { t: 's', v: reportName } as XLSX.CellObject;
  applyCellStyle(titleCell, { font: { bold: true, sz: 14, color: { rgb: '1E40AF' } } });
  XLSX.utils.sheet_add_aoa(ws, [[reportName]], { origin: `A${row + 1}` });
  (ws as any)[`A${row + 1}`] = titleCell;
  // Merge title across columns
  ws['!merges'] = [{ s: { r: row, c: 0 }, e: { r: row, c: columns.length - 1 } }];
  row++;

  // Meta rows
  if (meta && meta.length > 0) {
    for (const m of meta) {
      XLSX.utils.sheet_add_aoa(ws, [[`${m.label}: ${m.value}`]], { origin: `A${row + 1}` });
      const cell = (ws as any)[`A${row + 1}`];
      if (cell) applyCellStyle(cell, { font: COLORS.metaFont });
      ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: columns.length - 1 } });
      row++;
    }
  }

  // Date range
  if (dateRange) {
    const rangeText = `ช่วงข้อมูล: ${dateRange.start} ถึง ${dateRange.end}`;
    XLSX.utils.sheet_add_aoa(ws, [[rangeText]], { origin: `A${row + 1}` });
    const cell = (ws as any)[`A${row + 1}`];
    if (cell) applyCellStyle(cell, { font: COLORS.metaFont });
    ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: columns.length - 1 } });
    row++;
  }

  // Export date
  const exportDateText = `ส่งออกเมื่อ: ${thaiDate()}`;
  XLSX.utils.sheet_add_aoa(ws, [[exportDateText]], { origin: `A${row + 1}` });
  const exportCell = (ws as any)[`A${row + 1}`];
  if (exportCell) applyCellStyle(exportCell, { font: COLORS.metaFont });
  ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: columns.length - 1 } });
  row++;

  // Empty row
  row++;

  // Header row
  const headerRow = row;
  XLSX.utils.sheet_add_aoa(ws, [columns.map((c) => c.label)], { origin: `A${row + 1}` });
  for (let c = 0; c < columns.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c });
    const cell = (ws as any)[cellRef];
    if (cell) {
      applyCellStyle(cell, {
        fill: COLORS.headerFill,
        font: COLORS.headerFont,
        align: 'center',
      });
    }
  }
  row++;

  // Data rows
  for (const dataRow of data) {
    const rowHighlightColor = rowHighlight?.(dataRow);
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const rawValue = dataRow[col.key];
      const cellRef = XLSX.utils.encode_cell({ r: row, c });
      let cell: XLSX.CellObject;

      if (col.format === 'date' && rawValue) {
        const d = new Date(rawValue);
        if (!isNaN(d.getTime())) {
          cell = { t: 'n', v: Math.floor((d.getTime() - new Date(Date.UTC(1899, 11, 30)).getTime()) / 86400000) + 1 } as any;
        } else {
          cell = { t: 's', v: String(rawValue) } as any;
        }
      } else if (col.format === 'currency' || col.format === 'number' || col.format === 'percent') {
        const num = Number(rawValue);
        cell = { t: 'n', v: isNaN(num) ? 0 : num } as any;
      } else {
        cell = { t: 's', v: rawValue == null ? '' : String(rawValue) } as any;
      }

      (ws as any)[cellRef] = cell;

      const cellOpts: any = { format: col.format };
      if (col.format === 'currency' || col.format === 'number' || col.format === 'percent') {
        cellOpts.align = 'right';
      }

      // Cell-level highlight
      const cellHighlight = col.highlight?.(rawValue, dataRow);
      if (cellHighlight === 'warning') cellOpts.fill = COLORS.warningFill;
      else if (cellHighlight === 'error') cellOpts.fill = COLORS.errorFill;
      else if (cellHighlight === 'success') cellOpts.fill = COLORS.successFill;
      else if (rowHighlightColor === 'warning') cellOpts.fill = COLORS.warningFill;
      else if (rowHighlightColor === 'error') cellOpts.fill = COLORS.errorFill;
      else if (rowHighlightColor === 'success') cellOpts.fill = COLORS.successFill;

      applyCellStyle(cell, cellOpts);
    }
    row++;
  }

  // Summary rows
  if (summary && summary.length > 0) {
    row++; // empty row before summary
    for (const s of summary) {
      const labelCellRef = `A${row + 1}`;
      XLSX.utils.sheet_add_aoa(ws, [[s.label, '']], { origin: `A${row + 1}` });
      const labelCell = (ws as any)[labelCellRef];
      if (labelCell) applyCellStyle(labelCell, { fill: COLORS.summaryFill, font: COLORS.summaryFont, bold: true });

      // Find the column to put the value
      const colIdx = s.columnKey ? columns.findIndex((c) => c.key === s.columnKey) : 1;
      if (colIdx >= 0) {
        const valCellRef = XLSX.utils.encode_cell({ r: row, c: colIdx });
        const num = Number(s.value);
        const valCell: XLSX.CellObject = (typeof s.value === 'number' || !isNaN(num)) 
          ? { t: 'n', v: num } as any 
          : { t: 's', v: String(s.value) } as any;
        (ws as any)[valCellRef] = valCell;
        applyCellStyle(valCell, { fill: COLORS.summaryFill, font: COLORS.summaryFont, bold: true, format: s.format, align: 'right' });
      }
      row++;
    }
  }

  // Column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(c.label.length * 1.8, 12) }));

  // Row heights for header
  ws['!rows'] = [];
  (ws as any)['!rows'][headerRow] = { hpt: 24 };

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportName.substring(0, 28));

  // Generate filename
  const dateStr = dateRange 
    ? `${dateRange.start}_${dateRange.end}` 
    : (() => { const n = new Date(); return `${n.getFullYear()}-${(n.getMonth() + 1).toString().padStart(2, '0')}-${n.getDate().toString().padStart(2, '0')}`; })();
  const filename = `${reportName}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
