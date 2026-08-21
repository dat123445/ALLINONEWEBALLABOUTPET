import { useCallback, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, Modal, Select } from '@/components/ui';
import { cn } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type RowType = 'parent' | 'variant';
type FieldKey = 'row_type' | 'parent_ref' | 'product_name' | 'variant_name' | 'sku' | 'category' | 'brand' | 'unit' | 'quantity_old' | 'quantity_new' | 'cost_old' | 'cost_new' | 'retail_old' | 'retail_new' | 'status';
type FieldType = 'text' | 'number';

type Field = { key: FieldKey; label: string; type: FieldType; aliases: string[] };
type ParsedRow = { rowIndex: number; mapped: Partial<Record<FieldKey, string>>; errors: string[]; status: 'ok' | 'error' | 'duplicate' };

type ImportResult = { rowIndex: number; label: string; status: 'success' | 'failed'; error?: string };

const FIELDS: Field[] = [
  { key: 'row_type', label: 'row_type', type: 'text', aliases: ['row_type', 'ประเภทแถว', 'ชนิดแถว'] },
  { key: 'parent_ref', label: 'parent_ref', type: 'text', aliases: ['parent_ref', 'รหัสอ้างอิงกลุ่ม', 'รหัสกลุ่ม'] },
  { key: 'product_name', label: 'product_name', type: 'text', aliases: ['product_name', 'ชื่อกลุ่มสินค้า', 'ชื่อสินค้า', 'product name'] },
  { key: 'variant_name', label: 'variant_name', type: 'text', aliases: ['variant_name', 'ชื่อรุ่นย่อย', 'ชื่อรูปแบบ', 'variant name'] },
  { key: 'sku', label: 'sku', type: 'text', aliases: ['sku', 'SKU', 'รหัสสินค้า', 'รหัส'] },
  { key: 'category', label: 'category', type: 'text', aliases: ['category', 'หมวดหมู่', 'ประเภท'] },
  { key: 'brand', label: 'brand', type: 'text', aliases: ['brand', 'แบรนด์', 'ยี่ห้อ'] },
  { key: 'unit', label: 'unit', type: 'text', aliases: ['unit', 'หน่วย', 'หน่วยนับ'] },
  { key: 'quantity_old', label: 'quantity_old', type: 'number', aliases: ['quantity_old', 'จำนวนเก่า', 'สต็อกเก่า', 'สต๊อกเก่า'] },
  { key: 'quantity_new', label: 'quantity_new', type: 'number', aliases: ['quantity_new', 'จำนวนใหม่', 'สต็อกใหม่', 'สต๊อกใหม่', 'จำนวน', 'สต็อก', 'สต๊อก', 'จำนวนคงเหลือ'] },
  { key: 'cost_old', label: 'cost_old', type: 'number', aliases: ['cost_old', 'ทุนเก่า', 'ต้นทุนเก่า'] },
  { key: 'cost_new', label: 'cost_new', type: 'number', aliases: ['cost_new', 'ทุนใหม่', 'ต้นทุนใหม่'] },
  { key: 'retail_old', label: 'retail_old', type: 'number', aliases: ['retail_old', 'หน้าร้านเก่า', 'ราคาหน้าร้านเก่า'] },
  { key: 'retail_new', label: 'retail_new', type: 'number', aliases: ['retail_new', 'หน้าร้านใหม่', 'ราคาหน้าร้านใหม่', 'ราคา'] },
  { key: 'status', label: 'status', type: 'text', aliases: ['status', 'สถานะ', 'เปิดขาย', 'เปิด/ปิดขาย'] },
];

const TEMPLATE_ROWS: Record<string, string>[] = [
  { row_type: 'parent', parent_ref: 'CAT-FOOD', product_name: 'อาหารแมว Toro', variant_name: '', sku: '', category: 'อาหารสัตว์เลี้ยง', brand: 'Toro', unit: 'ชิ้น', quantity_old: '', quantity_new: '', cost_old: '', cost_new: '', retail_old: '', retail_new: '', status: '' },
  { row_type: 'variant', parent_ref: 'CAT-FOOD', product_name: '', variant_name: 'รสทูน่า 1 กก.', sku: 'TORO-TUNA-1KG', category: '', brand: '', unit: 'ชิ้น', quantity_old: '10', quantity_new: '20', cost_old: '80', cost_new: '85', retail_old: '125', retail_new: '130', status: 'active' },
  { row_type: 'variant', parent_ref: '', product_name: 'ทรายแมว 5 ลิตร', variant_name: '', sku: 'LITTER-5L', category: 'ทรายแมว', brand: '', unit: 'ถุง', quantity_old: '0', quantity_new: '12', cost_old: '', cost_new: '110', retail_old: '', retail_new: '180', status: 'active' },
];

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/^['"\uFEFF]+|['"]+$/g, '').replace(/\s+/g, ' ');
}

function isActive(value: string | undefined): boolean {
  const normalized = normalize(value ?? 'active');
  return !['inactive', 'disabled', 'closed', 'false', '0', 'ปิด', 'ปิดขาย', 'ไม่ใช้งาน'].includes(normalized);
}

export function ParentVariantImportModal({ open, onClose, branchId, onImported }: { open: boolean; onClose: () => void; branchId?: string; onImported: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1); setFileName(''); setHeaders([]); setRawRows([]); setMapping({}); setRows([]); setResults([]); setError(null); setLoading(false);
  }, []);

  function close() { reset(); onClose(); }

  function downloadTemplate() {
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: FIELDS.map((field) => field.label) });
    worksheet['!cols'] = FIELDS.map((field) => ({ wch: Math.max(field.label.length + 4, 14) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'template-parent-variant-products.xlsx');
  }

  function detectMapping(fileHeaders: string[]): Partial<Record<FieldKey, string>> {
    const detected: Partial<Record<FieldKey, string>> = {};
    FIELDS.forEach((field) => {
      const match = fileHeaders.find((header) => field.aliases.map(normalize).includes(normalize(header)));
      if (match) detected[field.key] = match;
    });
    return detected;
  }

  function readFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError('อ่านไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง');
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = file.name.toLowerCase().endsWith('.csv')
          ? XLSX.read(String(data), { type: 'string', cellDates: true, codepage: 65001, raw: false })
          : XLSX.read(data, { type: 'array', cellDates: true, codepage: 65001, raw: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });
        if (!json.length) throw new Error('ไฟล์ไม่มีข้อมูล');
        const fileHeaders = Object.keys(json[0]);
        setHeaders(fileHeaders); setRawRows(json); setMapping(detectMapping(fileHeaders)); setFileName(file.name); setStep(2);
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : 'อ่านไฟล์ไม่สำเร็จ');
      }
    };
    file.name.toLowerCase().endsWith('.csv') ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  }

  function validateRows() {
    const mappedRows = rawRows.map((raw, index): ParsedRow => {
      const mapped: Partial<Record<FieldKey, string>> = {};
      FIELDS.forEach((field) => {
        const source = mapping[field.key];
        if (source && raw[source] !== undefined && raw[source] !== null) mapped[field.key] = String(raw[source]).trim();
      });
      const errors: string[] = [];
      const rowType = normalize(mapped.row_type ?? '') as RowType;
      if (rowType !== 'parent' && rowType !== 'variant') errors.push('row_type ต้องเป็น parent หรือ variant');
      if (rowType === 'parent') {
        if (!mapped.parent_ref) errors.push('แถว parent ต้องมี parent_ref');
        if (!mapped.product_name) errors.push('แถว parent ต้องมี product_name');
        if (mapped.sku || mapped.variant_name || mapped.quantity_old || mapped.quantity_new || mapped.cost_old || mapped.cost_new || mapped.retail_old || mapped.retail_new || mapped.status) errors.push('แถว parent ห้ามมี SKU, รุ่นย่อย, จำนวน, ราคา หรือสถานะ');
      }
      if (rowType === 'variant') {
        if (!mapped.sku) errors.push('แถวย่อยต้องมี SKU');
        if (!mapped.parent_ref && !mapped.product_name) errors.push('สินค้าเดี่ยวต้องมี product_name');
        if ((mapped.quantity_old === undefined || mapped.quantity_old === '') && (mapped.quantity_new === undefined || mapped.quantity_new === '')) errors.push('แถวย่อยต้องมี quantity_old หรือ quantity_new');
        if (!mapped.cost_old && !mapped.cost_new) errors.push('ต้องมี cost_old หรือ cost_new');
        if (!mapped.retail_old && !mapped.retail_new) errors.push('ต้องมี retail_old หรือ retail_new');
        if (!mapped.status) errors.push('แถวย่อยต้องมี status');
      }
      ['quantity_old', 'quantity_new', 'cost_old', 'cost_new', 'retail_old', 'retail_new'].forEach((key) => {
        const value = mapped[key as FieldKey];
        if (value && !Number.isFinite(Number(value))) errors.push(`${key} ต้องเป็นตัวเลข`);
      });
      return { rowIndex: index + 2, mapped, errors, status: errors.length ? 'error' : 'ok' };
    });
    mappedRows.forEach((row) => {
      if (row.errors.length) row.status = 'error';
    });
    const skus = mappedRows.filter((row) => row.status === 'ok' && row.mapped.sku).map((row) => row.mapped.sku!);
    const duplicateSkus = new Set(skus.filter((sku, index) => skus.indexOf(sku) !== index));
    mappedRows.forEach((row) => {
      if (row.status === 'ok' && row.mapped.sku && duplicateSkus.has(row.mapped.sku)) {
        row.errors.push(`SKU ซ้ำในไฟล์: ${row.mapped.sku}`); row.status = 'error';
      }
    });
    setRows(mappedRows); setStep(3);
  }

  async function importRows() {
    setLoading(true); setError(null);
    const importResults: ImportResult[] = [];
    const validRows = rows.filter((row) => row.status === 'ok');
    const parentIds = new Map<string, string>();
    const parentRows = validRows.filter((row) => row.mapped.row_type === 'parent');
    const variants = validRows.filter((row) => row.mapped.row_type === 'variant');
    setImportProgress({ done: 0, total: parentRows.length + variants.length, errors: 0 });

    for (const row of parentRows) {
      const parent = row.mapped;
      try {
        const { data: existing, error: existErr } = await supabase.from('products').select('id').eq('parent_ref', parent.parent_ref!).maybeSingle();
        if (existErr) throw new Error(existErr.message);
        if (existing?.id) {
          parentIds.set(parent.parent_ref!, existing.id);
          importResults.push({ rowIndex: row.rowIndex, label: `${parent.product_name} (${parent.parent_ref})`, status: 'success' });
        } else {
          const { data, error } = await supabase.from('products').insert({ sku: null, name: parent.product_name!, category: parent.category || null, brand: parent.brand || null, unit: parent.unit || null, product_role: 'parent', parent_ref: parent.parent_ref!, is_active: true }).select('id').maybeSingle();
          if (error || !data) throw new Error(error?.message ?? 'สร้างแถวหลักไม่สำเร็จ');
          parentIds.set(parent.parent_ref!, data.id);
          importResults.push({ rowIndex: row.rowIndex, label: `${parent.product_name} (${parent.parent_ref})`, status: 'success' });
        }
      } catch (parentError) {
        console.error('[Import] Parent insert failed:', parent.parent_ref, parentError);
        importResults.push({ rowIndex: row.rowIndex, label: parent.product_name ?? parent.parent_ref ?? `แถว ${row.rowIndex}`, status: 'failed', error: parentError instanceof Error ? parentError.message : 'สร้างแถวหลักไม่สำเร็จ' });
      }
      setImportProgress((prev) => ({ ...prev, done: importResults.length, errors: importResults.filter((r) => r.status === 'failed').length }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const BATCH_SIZE = 150;
    for (let batchStart = 0; batchStart < variants.length; batchStart += BATCH_SIZE) {
      const batch = variants.slice(batchStart, batchStart + BATCH_SIZE);
      for (const row of batch) {
        const variant = row.mapped;
        try {
          let productId = variant.parent_ref ? parentIds.get(variant.parent_ref) : undefined;
          if (!productId && variant.parent_ref) {
            const { data: parent, error: parentErr } = await supabase.from('products').select('id').eq('parent_ref', variant.parent_ref).maybeSingle();
            if (parentErr) throw new Error(parentErr.message);
            productId = parent?.id;
            if (productId) parentIds.set(variant.parent_ref, productId);
          }
          if (!productId && !variant.parent_ref) {
            const standalone = await supabase.from('products').insert({ sku: null, name: variant.product_name!, category: variant.category || null, brand: variant.brand || null, unit: variant.unit || null, cost_price: Number(variant.cost_new || variant.cost_old || 0), retail_price: Number(variant.retail_new || variant.retail_old || 0), is_active: isActive(variant.status), product_role: 'parent' }).select('id').maybeSingle();
            if (standalone.error || !standalone.data) throw new Error(standalone.error?.message ?? 'สร้างสินค้าเดี่ยวไม่สำเร็จ');
            productId = standalone.data.id;
          }
          if (!productId) throw new Error(`ไม่พบ parent_ref "${variant.parent_ref}" ในระบบ`);
          const { data: existing, error: existBcErr } = await supabase.from('product_barcodes').select('id, stock_qty, cost_price, price').eq('barcode', variant.sku!).maybeSingle();
          if (existBcErr) throw new Error(existBcErr.message);
          const lotResult = existing ? await supabase.from('variant_lot_prices').select('lot_label, quantity, cost_price, retail_price').eq('product_barcode_id', existing.id) : { data: [] as { lot_label: string; quantity: number; cost_price: number; retail_price: number }[], error: null as Error | null };
          if (lotResult.error) throw new Error(lotResult.error.message);
          const existingLots = lotResult.data;
          const oldLot = existingLots?.find((lot) => lot.lot_label === 'old');
          const newLot = existingLots?.find((lot) => lot.lot_label === 'new');
          const incomingOldQuantity = Number(variant.quantity_old || 0);
          const incomingNewQuantity = Number(variant.quantity_new || 0);
          const oldQuantity = Number(oldLot?.quantity ?? 0) + incomingOldQuantity;
          const newQuantity = Number(newLot?.quantity || 0) + incomingNewQuantity;
          const oldCost = Number(variant.cost_old || oldLot?.cost_price || existing?.cost_price || 0);
          const oldRetail = Number(variant.retail_old || oldLot?.retail_price || existing?.price || 0);
          const newCost = Number(variant.cost_new || newLot?.cost_price || oldCost);
          const newRetail = Number(variant.retail_new || newLot?.retail_price || oldRetail);
          const payload = { product_id: productId, barcode: variant.sku!, variant_name: variant.variant_name || null, label: variant.variant_name || variant.product_name!, parent_ref: variant.parent_ref || null, price: newRetail, cost_price: newCost, stock_qty: oldQuantity + newQuantity, is_available: isActive(variant.status), unit: ['piece', 'dozen', 'carton'].includes(variant.unit || '') ? variant.unit : 'piece', unit_multiplier: 1 };
          const response = existing
            ? await supabase.from('product_barcodes').update(payload).eq('id', existing.id).select('id').maybeSingle()
            : await supabase.from('product_barcodes').insert(payload).select('id').maybeSingle();
          if (response.error || !response.data) throw new Error(response.error?.message ?? 'บันทึกแถวย่อยไม่สำเร็จ');
          const lotRows = [
            { product_barcode_id: response.data.id, lot_label: 'old', quantity: oldQuantity, cost_price: oldCost, retail_price: oldRetail },
            { product_barcode_id: response.data.id, lot_label: 'new', quantity: newQuantity, cost_price: newCost, retail_price: newRetail },
          ];
          const { error: lotError } = await supabase.from('variant_lot_prices').upsert(lotRows, { onConflict: 'product_barcode_id,lot_label' });
          if (lotError) throw new Error(lotError.message);
          if (branchId) {
            const { error: stockError } = await supabase.from('variant_branch_stock').upsert({ variant_id: response.data.id, branch_id: branchId, quantity: oldQuantity + newQuantity }, { onConflict: 'variant_id,branch_id' });
            if (stockError) throw new Error(stockError.message);
          }
          importResults.push({ rowIndex: row.rowIndex, label: `${variant.variant_name || variant.product_name} (${variant.sku})`, status: 'success' });
        } catch (variantError) {
          console.error('[Import] Variant insert failed:', variant.sku, variant.parent_ref, variantError);
          importResults.push({ rowIndex: row.rowIndex, label: variant.variant_name ?? variant.sku ?? `แถว ${row.rowIndex}`, status: 'failed', error: variantError instanceof Error ? variantError.message : 'บันทึกแถวย่อยไม่สำเร็จ' });
        }
      }
      setImportProgress((prev) => ({ ...prev, done: parentRows.length + batchStart + batch.length, errors: importResults.filter((r) => r.status === 'failed').length }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setResults(importResults); setLoading(false); setStep(4); onImported();
  }

  const validCount = rows.filter((row) => row.status === 'ok').length;
  const errorCount = rows.filter((row) => row.status === 'error').length;
  const successCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;

  return (
    <Modal open={open} onClose={close} title="นำเข้าสินค้าแบบ Parent–Variant" size="xl">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-500">{['อัปโหลด', 'จับคู่คอลัมน์', 'ตรวจสอบ', 'เสร็จสิ้น'].map((label, index) => <div key={label} className={cn('flex-1 rounded-xl px-3 py-2 text-center', step === index + 1 ? 'bg-primary-600 text-white' : step > index + 1 ? 'bg-success-100 text-success-700' : 'bg-surface-100')}>{index + 1}. {label}</div>)}</div>
        {step === 1 && <div className="space-y-4">
          <div onClick={() => inputRef.current?.click()} className="cursor-pointer rounded-2xl border-2 border-dashed border-surface-300 p-10 text-center hover:border-primary-400 hover:bg-primary-50/30"><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} className="hidden" /><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-primary-600" /><p className="font-semibold text-surface-900">คลิกเพื่อเลือกไฟล์ Excel/CSV</p><p className="mt-1 text-sm text-surface-500">ต้องมี row_type และ parent_ref ทุกแถว</p></div>
          {error && <div className="flex items-center gap-2 rounded-xl bg-error-50 p-3 text-sm text-error-700"><AlertCircle className="h-4 w-4" />{error}</div>}
          <Button variant="ghost" onClick={downloadTemplate} className="mx-auto"><Download className="h-4 w-4" /> ดาวน์โหลด Template Parent–Variant</Button>
          <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4 text-sm text-surface-600"><p className="font-semibold text-primary-700">กติกาไฟล์มาตรฐาน</p><p>แถว parent ใส่เฉพาะชื่อกลุ่มและ parent_ref ส่วนแถว variant ต้องมี parent_ref, variant_name, sku, quantity_old, quantity_new, cost_old, cost_new, retail_old, retail_new และ status ครบ</p><p className="mt-1">ระบบนับจำนวนสินค้าเฉพาะแถว variant และจะไม่สร้าง SKU หรือสต็อกให้แถว parent</p></div>
        </div>}
        {step === 2 && <div className="space-y-4"><div className="rounded-xl bg-primary-50 p-3 text-sm text-primary-700">ไฟล์ {fileName} · พบ {rawRows.length} แถว</div><div className="max-h-[440px] space-y-2 overflow-y-auto">{FIELDS.map((field) => <div key={field.key} className="flex items-center gap-3 rounded-lg bg-surface-50 p-2.5"><span className="w-36 shrink-0 text-sm font-medium text-surface-700">{field.label}</span><ArrowRight className="h-4 w-4 text-surface-400" /><Select value={mapping[field.key] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))} className="flex-1"><option value="">— ไม่ใช้คอลัมน์นี้ —</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</Select></div>)}</div><div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> ย้อนกลับ</Button><Button onClick={validateRows}>ตรวจสอบ <ArrowRight className="h-4 w-4" /></Button></div></div>}
        {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-success-200 bg-success-50 p-3"><p className="text-2xl font-bold text-success-600">{validCount}</p><p className="text-xs text-surface-500">แถวพร้อมนำเข้า</p></div><div className="rounded-xl border border-error-200 bg-error-50 p-3"><p className="text-2xl font-bold text-error-600">{errorCount}</p><p className="text-xs text-surface-500">มีปัญหา</p></div></div>{loading && importProgress.total > 0 && <div className="space-y-1.5"><div className="flex justify-between text-xs font-medium text-surface-600"><span>กำลังนำเข้า... {importProgress.done}/{importProgress.total}</span>{importProgress.errors > 0 && <span className="text-error-600">ผิดพลาด {importProgress.errors}</span>}</div><div className="h-2 rounded-full bg-surface-100 overflow-hidden"><div className="h-full rounded-full bg-primary-500 transition-all duration-300" style={{ width: String(importProgress.total > 0 ? Math.round((importProgress.done / importProgress.total) * 100) : 0) + '%' }} /></div></div>}<div className="max-h-[440px] overflow-auto rounded-xl border border-surface-200"><table className="w-full text-xs"><thead className="sticky top-0 bg-surface-50"><tr><th className="px-3 py-2 text-left">แถว</th><th className="px-3 py-2 text-left">ประเภท</th><th className="px-3 py-2 text-left">กลุ่ม / รุ่นย่อย</th><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-right">ราคาเก่า</th><th className="px-3 py-2 text-right">ราคาใหม่</th><th className="px-3 py-2 text-right">สต็อกเก่า</th><th className="px-3 py-2 text-right">สต็อกใหม่</th><th className="px-3 py-2 text-left">ผลตรวจ</th></tr></thead><tbody className="divide-y divide-surface-100">{rows.map((row) => { const isParentRow = row.mapped.row_type === 'parent'; const isStandalone = row.mapped.row_type === 'variant' && !row.mapped.parent_ref; const typeLabel = isParentRow ? 'แถวหลัก (มีตัวเลือกย่อย)' : isStandalone ? 'สินค้าเดี่ยว' : 'แถวย่อย'; return <tr key={row.rowIndex} className={cn(isParentRow && 'bg-primary-50/60', row.status === 'error' && 'bg-error-50/60')}><td className="px-3 py-2 text-surface-400">{row.rowIndex}</td><td className="px-3 py-2 font-semibold">{typeLabel}</td><td className={cn('px-3 py-2', !isParentRow && !isStandalone && 'pl-8')}>{isParentRow ? row.mapped.product_name : isStandalone ? (row.mapped.product_name || row.mapped.variant_name) : `↳ ${row.mapped.variant_name || row.mapped.product_name}`}<div className="text-[10px] text-surface-400">{row.mapped.parent_ref}</div></td><td className="px-3 py-2 font-mono">{row.mapped.sku || '—'}</td><td className="px-3 py-2 text-right">{isParentRow ? '—' : (row.mapped.retail_old || '—')}</td><td className="px-3 py-2 text-right">{isParentRow ? '—' : (row.mapped.retail_new || '—')}</td><td className="px-3 py-2 text-right">{isParentRow ? '—' : (row.mapped.quantity_old || '0')}</td><td className="px-3 py-2 text-right">{isParentRow ? '—' : (row.mapped.quantity_new || '0')}</td><td className="px-3 py-2">{row.status === 'ok' ? <span className="inline-flex items-center gap-1 text-success-700"><CheckCircle2 className="h-3 w-3" />พร้อม</span> : <div className="space-y-1 text-error-700">{row.errors.map((message) => <div key={message} className="flex items-start gap-1"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{message}</div>)}</div>}</td></tr>; })}</tbody></table></div><div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> ย้อนกลับ</Button><Button onClick={importRows} loading={loading} disabled={validCount === 0 || errorCount > 0}><Upload className="h-4 w-4" /> นำเข้าเฉพาะแถวที่ถูกต้อง</Button></div></div>}
        {step === 4 && <div className="space-y-4"><div className="py-6 text-center"><CheckCircle2 className={cn('mx-auto h-12 w-12', failedCount ? 'text-warning-500' : 'text-success-500')} /><p className="mt-3 text-xl font-bold text-surface-900">นำเข้าเสร็จสิ้น</p><p className="text-sm text-surface-500">สำเร็จ {successCount} แถว · ล้มเหลว {failedCount} แถว</p></div>{results.length > 0 && <div className="max-h-[300px] overflow-auto rounded-xl border border-surface-200"><table className="w-full text-xs"><tbody className="divide-y divide-surface-100">{results.map((result) => <tr key={result.rowIndex}><td className="px-3 py-2">แถว {result.rowIndex}</td><td className="px-3 py-2">{result.label}</td><td className={cn('px-3 py-2', result.status === 'success' ? 'text-success-700' : 'text-error-700')}>{result.status === 'success' ? 'สำเร็จ' : result.error}</td></tr>)}</tbody></table></div>}<div className="flex justify-end"><Button onClick={close}>เสร็จสิ้น</Button></div></div>}
      </div>
    </Modal>
  );
}
