import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight, ArrowLeft, RefreshCw, Info, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button, Select } from '@/components/ui';
import { cn } from '@/lib/format';
import { fetchAllPaginated } from '@/lib/supabase';

const ERROR_CATEGORIES = [
  { key: 'sku_not_found', label: 'ไม่พบรหัสสินค้า/SKU/บาร์โค้ด', match: (e: string) => e.includes('ไม่พบสินค้า') || e.includes('ไม่พบ SKU') },
  { key: 'branch_not_found', label: 'ไม่พบสาขา', match: (e: string) => e.includes('ไม่พบสาขา') },
  { key: 'invalid_type', label: 'ประเภทรายการไม่ถูกต้อง', match: (e: string) => e.includes('ประเภท') },
  { key: 'invalid_date', label: 'รูปแบบวันที่ผิด', match: (e: string) => e.includes('วันที่') },
  { key: 'invalid_number', label: 'จำนวนไม่ใช่ตัวเลข/ติดลบ/ว่าง', match: (e: string) => e.includes('ตัวเลข') || e.includes('จำนวน') },
  { key: 'missing_required', label: 'ขาดข้อมูลที่บังคับ', match: (e: string) => e.startsWith('ขาด ') },
  { key: 'other', label: 'อื่นๆ', match: (e: string) => true },
] as const;

const TYPE_HINTS: Record<string, string> = {
  text: 'ข้อความ',
  number: 'ตัวเลขเท่านั้น',
  date: 'วันที่ (DD/MM/YYYY หรือ YYYY-MM-DD)',
  boolean: 'true / false',
};

/**
 * Convert any Excel date value (JS Date, serial number, or string) to
 * a display string in DD/MM/YYYY format. Returns '' for empty/null.
 *
 * Excel serial numbers count days from 1899-12-31 (with a leap-year bug
 * for 1900). We subtract 1 day to compensate, matching the standard
 * Excel epoch used by SheetJS.
 */
function normalizeExcelDate(value: any): string {
  if (value == null || value === '') return '';

  // JS Date object (when cellDates:true is used during read)
  // SheetJS creates Date objects in the browser's local timezone, so we must
  // use local getters to extract the correct calendar date.
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const d = value.getDate().toString().padStart(2, '0');
    const m = (value.getMonth() + 1).toString().padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // Numeric Excel serial date — convert via UTC to avoid timezone shift,
  // then extract using UTC getters for a timezone-independent calendar date.
  if (typeof value === 'number' && !isNaN(value)) {
    const ms = Math.round((value - 1) * 86400 * 1000);
    const date = new Date(Date.UTC(1899, 11, 31, 0, 0, 0) + ms);
    if (isNaN(date.getTime())) return '';
    const d = date.getUTCDate().toString().padStart(2, '0');
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  // String — try to parse common formats
  const str = String(value).trim();
  if (!str) return '';

  // Already DD/MM/YYYY or D/M/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmyMatch) {
    const [, dd, mm, yy] = dmyMatch;
    const day = dd.padStart(2, '0');
    const month = mm.padStart(2, '0');
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${day}/${month}/${year}`;
  }

  // Already YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, yy, mm, dd] = ymdMatch;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yy}`;
  }

  // Fallback: let JS Date parse it (uses local timezone)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = parsed.getDate().toString().padStart(2, '0');
    const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // Unparseable — return empty so validation flags it as an error
  // instead of silently using the current date.
  return '';
}

/** Convert a display date string (DD/MM/YYYY) to ISO YYYY-MM-DD for DB storage. */
export function displayDateToISO(display: string): string {
  if (!display) return '';
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return display;
}

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'boolean';
  aliases: string[];
  example?: string;
  hint?: string;
}

export interface PreValidateContext {
  /** Fetch all products (id, sku) for SKU matching */
  products: { id: string; sku: string; barcode?: string | null }[];
  /** Fetch all branches (id, name, short_code) for branch matching */
  branches: { id: string; name: string; short_code?: string | null }[];
  /** Barcode -> product id map for barcode fallback matching */
  barcodeMap: Map<string, string>;
}

export interface ImportConfig {
  /** Module name shown in title, e.g. "สินค้า", "ลูกค้า" */
  moduleLabel: string;
  /** Fields definition */
  fields: ImportFieldDef[];
  /** Template sheet name */
  sheetName?: string;
  /** Template filename */
  templateFilename?: string;
  /** Check for duplicates by this field key. If provided, shows skip/update options */
  duplicateCheck?: {
    table: string;
    column: string;
    /** Additional filter, e.g. { is_active: true } */
    filter?: Record<string, any>;
  };
  /** Extra reference sheets to include in the downloaded template (e.g. branch list, type list) */
  templateExtraSheets?: { name: string; rows: Record<string, any>[] }[];
  /** Insert/update function. Returns { success, error? } per row */
  upsertRow: (mapped: Record<string, string>, options: { isUpdate: boolean; existingId?: string; fileName: string }) => Promise<{ success: boolean; error?: string; id?: string }>;
  /** Called after all rows processed */
  onImported?: () => void;
  /** Optional pre-validation using bulk-fetched DB data. Returns error strings per row. */
  preValidate?: (mapped: Record<string, string>, ctx: PreValidateContext) => string[];
}

type Step = 1 | 2 | 3 | 4;

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, any>;
  mapped: Record<string, string>;
  errors: string[];
  status: 'ok' | 'error' | 'duplicate';
  duplicateAction: 'skip' | 'update' | null;
  existingId?: string;
}

interface ImportResult {
  rowIndex: number;
  label: string;
  status: 'success' | 'failed';
  error?: string;
}

export function GenericImportModal({ open, onClose, config }: {
  open: boolean;
  onClose: () => void;
  config: ImportConfig;
}) {
  const { moduleLabel, fields, duplicateCheck, upsertRow, onImported, templateExtraSheets, preValidate } = config;
  const REQUIRED_FIELDS = fields.filter((f) => f.required);
  const OPTIONAL_FIELDS = fields.filter((f) => !f.required);
  const sheetName = config.sheetName ?? moduleLabel;
  const templateFilename = config.templateFilename ?? `template-import-${moduleLabel}.xlsx`;

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<string, string>>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1);
    setFileName('');
    setFileHeaders([]);
    setRawRows([]);
    setMapping({});
    setParsedRows([]);
    setImporting(false);
    setReviewing(false);
    setResults([]);
    setParseError(null);
    setDragOver(false);
    setShowErrorsOnly(false);
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate() {
    const headers = fields.map((f) => f.label);
    const exampleRow: Record<string, string> = {};
    fields.forEach((f) => {
      exampleRow[f.label] = f.example ?? (f.type === 'number' ? '0' : '');
    });
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    if (templateExtraSheets) {
      for (const extra of templateExtraSheets) {
        const extraWs = XLSX.utils.json_to_sheet(extra.rows.length > 0 ? extra.rows : [{}]);
        XLSX.utils.book_append_sheet(wb, extraWs, extra.name);
      }
    }
    XLSX.writeFile(wb, templateFilename);
  }

  function normalizeHeader(h: string): string {
    return h.toLowerCase().trim().replace(/^["'\uFEFF]+|["'\uFEFF]+$/g, '').replace(/\s+/g, ' ');
  }

  function autoDetectMapping(headers: string[]): Partial<Record<string, string>> {
    const result: Partial<Record<string, string>> = {};
    const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
    for (const field of fields) {
      const aliases = field.aliases.map(normalizeHeader);
      const match = normalized.find((h) =>
        aliases.includes(h.norm) || h.norm === normalizeHeader(field.label)
      );
      if (match) result[field.key] = match.original;
    }
    return result;
  }

  function handleFile(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let ws: XLSX.WorkSheet;
        if (file.name.endsWith('.csv')) {
          let text = String(data);
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          const wb = XLSX.read(text, { type: 'string', cellDates: true });
          ws = wb.Sheets[wb.SheetNames[0]];
        } else {
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          ws = wb.Sheets[wb.SheetNames[0]];
        }
        if (!ws) {
          setParseError('ไม่พบชีตในไฟล์ กรุณาตรวจสอบรูปแบบไฟล์');
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
        if (json.length === 0) {
          setParseError('ไฟล์ไม่มีข้อมูล กรุณาตรวจสอบว่ามีข้อมูลในชีตแรก (อาจมีแต่หัวคอลัมน์ ไม่มีแถวข้อมูล)');
          return;
        }
        const headers = Object.keys(json[0]);
        if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
          setParseError('ไม่พบหัวคอลัมน์ในไฟล์ กรุณาตรวจสอบว่าแถวแรกเป็นหัวคอลัมน์');
          return;
        }
        setFileHeaders(headers);
        setRawRows(json);
        setFileName(file.name);
        setMapping(autoDetectMapping(headers));
        setStep(2);
      } catch (err: any) {
        setParseError(`อ่านไฟล์ไม่สำเร็จ: ${err.message ?? 'ไฟล์ไม่ถูกต้อง'}`);
      }
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function goToReview() {
    setReviewing(true);
    try {
      const rows: ParsedRow[] = rawRows.map((raw, idx) => {
        const mapped: Record<string, string> = {};
        for (const field of fields) {
          const colName = mapping[field.key];
          if (colName && raw[colName] != null) {
            if (field.type === 'date') {
              mapped[field.key] = normalizeExcelDate(raw[colName]);
            } else if (field.type === 'number') {
              mapped[field.key] = String(raw[colName]).trim().replace(/,/g, '');
            } else {
              mapped[field.key] = String(raw[colName]).trim();
            }
          }
        }
        const errors: string[] = [];
        for (const field of REQUIRED_FIELDS) {
          if (!mapped[field.key]) {
            errors.push(`ขาด "${field.label}"`);
          }
        }
        for (const field of fields) {
          if (!mapped[field.key]) continue;
          if (field.type === 'number') {
            const num = Number(mapped[field.key]);
            if (isNaN(num) || num < 0) {
              errors.push(`${field.label} ต้องเป็นตัวเลขที่ไม่ติดลบ`);
            }
          }
          if (field.type === 'date' && mapped[field.key]) {
            const iso = displayDateToISO(mapped[field.key]);
            if (!iso || isNaN(new Date(iso).getTime())) {
              errors.push(`${field.label} รูปแบบวันที่ไม่ถูกต้อง`);
            } else {
              mapped[field.key] = iso;
            }
          }
        }
        return {
          rowIndex: idx + 2,
          raw,
          mapped,
          errors,
          status: errors.length > 0 ? 'error' as const : 'ok' as const,
          duplicateAction: null,
        };
      });

      let updated = rows;

      // Bulk DB pre-validation (paginated to exceed Supabase's 1000-row default limit)
      if (preValidate) {
        const { supabase } = await import('@/lib/supabase');
        const [prodRows, branchRows, barRows] = await Promise.all([
          fetchAllPaginated<{ id: string; sku: string | null }>(() => supabase.from('products').select('id, sku').eq('is_active', true)),
          fetchAllPaginated<{ id: string; name: string; short_code: string | null }>(() => supabase.from('branches').select('id, name, short_code')),
          fetchAllPaginated<{ product_id: string; barcode: string | null }>(() => supabase.from('product_barcodes').select('product_id, barcode')),
        ]);
        const products = prodRows.map((p) => ({ id: p.id, sku: p.sku ?? '', barcode: null }));
        const branches = branchRows.map((b) => ({ id: b.id, name: b.name, short_code: b.short_code }));
        const barcodeMap = new Map<string, string>();
        barRows.forEach((b) => {
          if (b.barcode) {
            const norm = b.barcode.trim().toLowerCase();
            barcodeMap.set(norm, b.product_id);
            const stripped = norm.replace(/^0+/, '') || '0';
            if (stripped !== norm) barcodeMap.set(stripped, b.product_id);
          }
        });
        const ctx: PreValidateContext = { products, branches, barcodeMap };
        updated = rows.map((r) => {
          if (r.status === 'error') return r;
          const dbErrors = preValidate(r.mapped, ctx);
          if (dbErrors.length > 0) {
            return { ...r, errors: [...r.errors, ...dbErrors], status: 'error' as const };
          }
          return r;
        });
      }

      if (duplicateCheck) {
        const dupField = fields.find((f) => f.key === duplicateCheck.column);
        const dupKey = dupField?.key ?? duplicateCheck.column;
        const values = updated.filter((r) => r.status === 'ok' && r.mapped[dupKey]).map((r) => r.mapped[dupKey]);
        if (values.length > 0) {
          const { supabase } = await import('@/lib/supabase');
          const { data: existing } = await supabase.from(duplicateCheck.table)
            .select(`id, ${duplicateCheck.column}`)
            .in(duplicateCheck.column, values);
          const existingMap = new Map<string, string>();
          (existing ?? []).forEach((p: any) => {
            existingMap.set(String(p[duplicateCheck.column]), p.id);
          });
          updated = updated.map((r) => {
            if (r.status === 'error') return r;
            const val = r.mapped[dupKey];
            if (val && existingMap.has(val)) {
              return { ...r, status: 'duplicate' as const, duplicateAction: 'skip' as const, existingId: existingMap.get(val) };
            }
            return r;
          });
        }
      }

      setParsedRows(updated);
      setStep(3);
    } finally {
      setReviewing(false);
    }
  }

  function setDuplicateAction(rowIndex: number, action: 'skip' | 'update') {
    setParsedRows((prev) => prev.map((r) =>
      r.rowIndex === rowIndex ? { ...r, duplicateAction: action } : r
    ));
  }

  const validRows = parsedRows.filter((r) => r.status === 'ok' || (r.status === 'duplicate' && r.duplicateAction === 'update'));
  const errorRows = parsedRows.filter((r) => r.status === 'error');
  const skipRows = parsedRows.filter((r) => r.status === 'duplicate' && r.duplicateAction === 'skip');

  async function doImport() {
    setImporting(true);
    const importResults: ImportResult[] = [];
    const dateField = fields.find((f) => f.type === 'date');
    const sortedRows = dateField
      ? [...validRows].sort((a, b) => (a.mapped[dateField.key] ?? '').localeCompare(b.mapped[dateField.key] ?? ''))
      : validRows;
    for (const row of sortedRows) {
      const labelField = fields.find((f) => !f.required) ?? fields[0];
      const label = row.mapped[labelField.key] ?? row.mapped[fields[0].key] ?? `แถว ${row.rowIndex}`;
      try {
        const isUpdate = row.status === 'duplicate' && row.duplicateAction === 'update';
        const result = await upsertRow(row.mapped, { isUpdate, existingId: row.existingId, fileName });
        importResults.push({
          rowIndex: row.rowIndex,
          label,
          status: result.success ? 'success' : 'failed',
          error: result.error,
        });
      } catch (err: any) {
        importResults.push({ rowIndex: row.rowIndex, label, status: 'failed', error: err.message ?? 'ไม่ทราบสาเหตุ' });
      }
    }
    setResults(importResults);
    setImporting(false);
    setStep(4);
    onImported?.();
  }

  function downloadProblemRows() {
    const problems = parsedRows.filter((r) => r.status === 'error');
    if (problems.length === 0) return;
    const headerLabels = fields.map((f) => f.label);
    const rowsData = problems.map((r) => {
      const row: Record<string, any> = { 'แถวที่': r.rowIndex };
      for (const f of fields) {
        row[f.label] = r.mapped[f.key] ?? '';
      }
      row['เหตุผล'] = r.errors.join('; ');
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rowsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แถวที่มีปัญหา');
    XLSX.writeFile(wb, `import-problems-${moduleLabel}.xlsx`);
  }

  function downloadErrorReport() {
    const failed = results.filter((r) => r.status === 'failed');
    if (failed.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(failed.map((r) => ({
      'แถวที่': r.rowIndex,
      'รายการ': r.label,
      'สาเหตุความล้มเหลว': r.error ?? '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, `import-errors-${moduleLabel}.xlsx`);
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const stepLabels = ['อัปโหลด', 'แผนผังคอลัมน์', 'ตรวจสอบ', 'เสร็จสิ้น'];

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`นำเข้า${moduleLabel}จาก Excel/CSV`} size="xl">
      <div className="space-y-5">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => {
            const stepNum = (i + 1) as Step;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} className="flex items-center flex-1">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all flex-1',
                  isActive ? 'bg-primary-600 text-white shadow-sm' : isDone ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-400'
                )}>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isActive ? 'bg-white/20' : isDone ? 'bg-success-500 text-white' : 'bg-surface-200'
                  )}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                  </div>
                  <span className="truncate">{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={cn('h-0.5 w-6 mx-1 rounded transition-colors', isDone ? 'bg-success-400' : 'bg-surface-200')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
                dragOver ? 'border-primary-500 bg-primary-50' : 'border-surface-300 hover:border-primary-400 hover:bg-surface-50'
              )}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">คลิกหรือลากไฟล์มาวางที่นี่</p>
                  <p className="text-sm text-surface-400 mt-1">รองรับไฟล์ .xlsx, .xls, .csv</p>
                </div>
                {fileName && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-100 text-success-700 text-sm">
                    <FileSpreadsheet className="w-4 h-4" /> {fileName}
                  </div>
                )}
              </div>
            </div>

            {parseError && (
              <div className="p-3 rounded-xl bg-error-50 text-error-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
              </div>
            )}

            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์แม่แบบ (Template)
              </Button>
            </div>

            {/* Column reference table */}
            <div className="rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-50 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary-500" />
                <p className="text-sm font-semibold text-surface-700">รายละเอียดคอลัมน์ทั้งหมด ({fields.length} คอลัมน์)</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">ชื่อคอลัมน์</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">บังคับ</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">รูปแบบข้อมูล</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">ตัวอย่าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {fields.map((f) => (
                    <tr key={f.key} className="hover:bg-surface-50">
                      <td className="px-3 py-2 font-medium text-surface-700">{f.label}</td>
                      <td className="px-3 py-2">
                        {f.required
                          ? <span className="text-error-600 font-bold">*</span>
                          : <span className="text-surface-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-surface-500">{TYPE_HINTS[f.type] ?? 'ข้อความ'}</td>
                      <td className="px-3 py-2 text-surface-400">{f.example ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick badges */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-error-500 font-bold text-sm">*</span>
                <span className="text-xs text-surface-500">= บังคับกรอก</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-surface-400 text-sm">—</span>
                <span className="text-xs text-surface-500">= ไม่บังคับ</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { if (fileName) setStep(2); }} disabled={!fileName}>
                ถัดไป <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-primary-50 text-sm text-primary-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              ไฟล์: <span className="font-medium">{fileName}</span> · พบ {rawRows.length} แถว · {fileHeaders.length} คอลัมน์
            </div>

            <p className="text-sm text-surface-600">
              จับคู่หัวคอลัมน์ในไฟล์ของคุณกับฟิลด์ในระบบ (ระบบจับคู่อัตโนมัติให้แล้ว ตรวจสอบและปรับแก้ได้)
            </p>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-50">
                  <div className="w-48 shrink-0">
                    <span className="text-sm font-medium text-surface-700">{field.label}</span>
                    {field.required && <span className="text-error-500 ml-1">*</span>}
                    <span className="ml-1.5 text-[10px] text-surface-400">({TYPE_HINTS[field.type] ?? 'ข้อความ'})</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-surface-400 shrink-0" />
                  <Select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))}
                    className="flex-1"
                  >
                    <option value="">— ไม่ใช้คอลัมน์นี้ —</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                  {mapping[field.key] && (
                    <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
              </Button>
              <Button onClick={goToReview} loading={reviewing}>
                ตรวจสอบ <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-success-50 border border-success-200">
                <p className="text-2xl font-bold text-success-600">{validRows.length}</p>
                <p className="text-xs text-surface-500">พร้อมนำเข้า</p>
              </div>
              <div className="p-3 rounded-xl bg-error-50 border border-error-200">
                <p className="text-2xl font-bold text-error-600">{errorRows.length}</p>
                <p className="text-xs text-surface-500">มีปัญหา</p>
              </div>
              <div className="p-3 rounded-xl bg-warning-50 border border-warning-200">
                <p className="text-2xl font-bold text-warning-600">{skipRows.length}</p>
                <p className="text-xs text-surface-500">จะข้าม (ซ้ำ)</p>
              </div>
            </div>

            {errorRows.length > 0 && (
              <div className="rounded-xl border border-error-200 bg-error-50/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-error-700">สรุปสาเหตุของแถวที่มีปัญหา ({errorRows.length} แถว)</p>
                <div className="flex flex-wrap gap-2">
                  {ERROR_CATEGORIES.map((cat) => {
                    const count = errorRows.filter((r) => r.errors.some((e) => cat.match(e))).length;
                    if (count === 0) return null;
                    return (
                      <span key={cat.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-error-200 text-xs text-error-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-error-500" />
                        {cat.label}: {count} แถว
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={downloadProblemRows} className="!text-error-700 hover:!bg-error-100">
                    <Download className="w-3.5 h-3.5" /> ดาวน์โหลดเฉพาะแถวที่มีปัญหา
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowErrorsOnly((v) => !v)} className="!text-surface-600">
                    <Filter className="w-3.5 h-3.5" /> {showErrorsOnly ? 'แสดงทั้งหมด' : 'แสดงเฉพาะที่มีปัญหา'}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-h-[400px] overflow-auto rounded-xl border border-surface-200">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">แถว</th>
                    {fields.slice(0, 5).map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 font-medium text-surface-500">{f.label}</th>
                    ))}
                    <th className="text-left px-3 py-2 font-medium text-surface-500">สถานะ / เหตุผล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {(showErrorsOnly ? parsedRows.filter((r) => r.status === 'error') : parsedRows).slice(0, 500).map((r) => (
                    <tr key={r.rowIndex} className={cn(
                      r.status === 'error' ? 'bg-error-50/50' : '',
                      r.status === 'duplicate' ? 'bg-warning-50/50' : '',
                    )}>
                      <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                      {fields.slice(0, 5).map((f) => (
                        <td key={f.key} className="px-3 py-2 text-surface-600 max-w-[150px] truncate">
                          {r.mapped[f.key] || <span className="text-surface-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {r.status === 'ok' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success-100 text-success-700 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> พร้อม
                          </span>
                        )}
                        {r.status === 'error' && (
                          <div className="space-y-0.5">
                            {r.errors.map((err, i) => (
                              <div key={i} className="text-xs text-error-600 flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.status === 'duplicate' && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-warning-100 text-warning-700 text-xs font-medium whitespace-nowrap">
                              ซ้ำ
                            </span>
                            <select
                              value={r.duplicateAction ?? 'skip'}
                              onChange={(e) => setDuplicateAction(r.rowIndex, e.target.value as 'skip' | 'update')}
                              className="text-xs px-1.5 py-0.5 rounded-lg border border-surface-200 bg-white outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="skip">ข้าม</option>
                              <option value="update">อัปเดต</option>
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 500 && (
              <p className="text-xs text-surface-400 text-center">แสดง 500 จาก {parsedRows.length} แถว</p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
              </Button>
              <Button onClick={doImport} loading={importing} disabled={validRows.length === 0}>
                <Upload className="w-4 h-4" /> นำเข้า {validRows.length} รายการ
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center py-6">
              {failedCount === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-success-600" />
                  </div>
                  <p className="text-xl font-bold text-surface-900">นำเข้าสำเร็จ!</p>
                  <p className="text-sm text-surface-500">นำเข้า{moduleLabel} {successCount} รายการเรียบร้อยแล้ว</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-warning-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-warning-600" />
                  </div>
                  <p className="text-xl font-bold text-surface-900">นำเข้าเสร็จสิ้น</p>
                  <p className="text-sm text-surface-500">
                    สำเร็จ {successCount} รายการ · ล้มเหลว {failedCount} รายการ
                  </p>
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className="max-h-[300px] overflow-auto rounded-xl border border-surface-200">
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">แถว</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">รายการ</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">ผล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {results.map((r, i) => (
                      <tr key={i} className={r.status === 'failed' ? 'bg-error-50/50' : ''}>
                        <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                        <td className="px-3 py-2 text-surface-600 max-w-[200px] truncate">{r.label}</td>
                        <td className="px-3 py-2">
                          {r.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-success-600">
                              <CheckCircle2 className="w-3 h-3" /> สำเร็จ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-error-600" title={r.error}>
                              <AlertCircle className="w-3 h-3 shrink-0" /> {r.error ?? 'ล้มเหลว'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between">
              {failedCount > 0 ? (
                <Button variant="ghost" onClick={downloadErrorReport}>
                  <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์สรุปปัญหา
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { reset(); }}>
                  <RefreshCw className="w-4 h-4" /> นำเข้าไฟล์ใหม่
                </Button>
                <Button onClick={handleClose}>
                  <CheckCircle2 className="w-4 h-4" /> เสร็จสิ้น
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
