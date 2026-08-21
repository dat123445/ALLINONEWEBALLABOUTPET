import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button, Select } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/format';
import { normalizeExcelDate, displayDateToISO } from '@/components/GenericImportModal';

function numOrZero(val: string | undefined): number {
  if (val == null || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}
function numOrUndef(val: string | undefined): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}
function parseActive(val: string | undefined): boolean {
  if (val == null || val === '') return true;
  const v = val.toLowerCase().trim();
  return !(v === 'ปิด' || v === 'false' || v === '0' || v === 'no' || v === 'inactive' || v === 'ปิดขาย');
}

type FieldKey =
  | 'sku' | 'name' | 'category' | 'brand' | 'pack_size'
  | 'old_cost_price' | 'new_cost_price' | 'old_retail_price' | 'new_retail_price'
  | 'unit' | 'quantity' | 'lot_number' | 'expiry_date'
  | 'new_sku' | 'other_sku' | 'pieces_per_pack' | 'packs_per_carton'
  | 'price_per_pack' | 'price_per_carton'
  | 'piece_old_cost' | 'piece_old_retail' | 'piece_new_cost' | 'piece_new_retail'
  | 'pack_old_cost' | 'pack_old_retail' | 'pack_new_cost' | 'pack_new_retail'
  | 'carton_old_cost' | 'carton_old_retail' | 'carton_new_cost' | 'carton_new_retail'
  | 'variant_active';

interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'date';
  aliases: string[];
}

const FIELDS: FieldDef[] = [
  { key: 'sku', label: 'SKU (ชิ้น)', required: false, type: 'text', aliases: ['sku', 'รหัสสินค้า', 'รหัส', 'code', 'item code'] },
  { key: 'name', label: 'ชื่อสินค้า', required: true, type: 'text', aliases: ['name', 'ชื่อ', 'ชื่อสินค้า', 'product name', 'description'] },
  { key: 'category', label: 'หมวดหมู่', required: false, type: 'text', aliases: ['category', 'หมวดหมู่', 'หมวด', 'ประเภท'] },
  { key: 'brand', label: 'แบรนด์', required: false, type: 'text', aliases: ['brand', 'แบรนด์', 'ยี่ห้อ'] },
  { key: 'pack_size', label: 'ขนาดบรรจุ', required: false, type: 'text', aliases: ['pack size', 'ขนาดบรรจุ', 'ขนาด', 'size'] },
  { key: 'old_cost_price', label: 'ราคาทุนเก่า', required: false, type: 'number', aliases: ['old cost', 'ทุนเก่า', 'ราคาทุนเก่า', 'cost old'] },
  { key: 'new_cost_price', label: 'ราคาทุนใหม่', required: false, type: 'number', aliases: ['new cost', 'ทุนใหม่', 'ราคาทุนใหม่', 'cost new', 'cost'] },
  { key: 'old_retail_price', label: 'ราคาหน้าร้านเก่า', required: false, type: 'number', aliases: ['old retail', 'หน้าร้านเก่า', 'ราคาหน้าร้านเก่า', 'retail old'] },
  { key: 'new_retail_price', label: 'ราคาหน้าร้านใหม่', required: false, type: 'number', aliases: ['new retail', 'หน้าร้านใหม่', 'ราคาหน้าร้านใหม่', 'retail new', 'retail', 'ราคาขาย'] },
  { key: 'unit', label: 'หน่วย', required: false, type: 'text', aliases: ['unit', 'หน่วย', 'หน่วยนับ'] },
  { key: 'quantity', label: 'จำนวนคงเหลือ', required: false, type: 'number', aliases: ['quantity', 'จำนวน', 'จำนวนคงเหลือ', 'stock', 'qty', 'สต๊อก'] },
  { key: 'lot_number', label: 'เลขล็อต', required: false, type: 'text', aliases: ['lot', 'lot number', 'เลขล็อต', 'ล็อต', 'batch'] },
  { key: 'expiry_date', label: 'วันหมดอายุ', required: false, type: 'date', aliases: ['expiry', 'expiry date', 'วันหมดอายุ', 'หมดอายุ', 'expire', 'exp'] },
  { key: 'new_sku', label: 'SKU ใหม่', required: false, type: 'text', aliases: ['new sku', 'sku ใหม่', 'รหัสใหม่'] },
  { key: 'other_sku', label: 'SKU อื่น', required: false, type: 'text', aliases: ['other sku', 'sku อื่น', 'รหัสอื่น', 'alt sku'] },
  { key: 'pieces_per_pack', label: 'จำนวนชิ้น/แพ็ก', required: false, type: 'number', aliases: ['pieces per pack', 'ชิ้นต่อแพ็ก', 'จำนวนชิ้น/แพ็ก', 'pcs/pack'] },
  { key: 'packs_per_carton', label: 'จำนวนแพ็ก/ลัง', required: false, type: 'number', aliases: ['packs per carton', 'แพ็กต่อลัง', 'จำนวนแพ็ก/ลัง', 'pack/carton'] },
  { key: 'price_per_pack', label: 'ราคาขายต่อแพ็ก', required: false, type: 'number', aliases: ['price per pack', 'ราคาแพ็ก', 'ราคาขายต่อแพ็ก'] },
  { key: 'price_per_carton', label: 'ราคาขายต่อลัง', required: false, type: 'number', aliases: ['price per carton', 'ราคาลัง', 'ราคาขายต่อลัง'] },
  { key: 'piece_old_cost', label: 'ทุนล็อตเก่า (ชิ้น)', required: false, type: 'number', aliases: ['piece old cost', 'ทุนเก่าชิ้น', 'ราคาทุนล็อตเก่า ชิ้น', 'old lot cost piece'] },
  { key: 'piece_old_retail', label: 'ขายล็อตเก่า (ชิ้น)', required: false, type: 'number', aliases: ['piece old retail', 'ขายเก่าชิ้น', 'ราคาขายล็อตเก่า ชิ้น', 'old lot retail piece'] },
  { key: 'piece_new_cost', label: 'ทุนล็อตใหม่ (ชิ้น)', required: false, type: 'number', aliases: ['piece new cost', 'ทุนใหม่ชิ้น', 'ราคาทุนล็อตใหม่ ชิ้น', 'new lot cost piece'] },
  { key: 'piece_new_retail', label: 'ขายล็อตใหม่ (ชิ้น)', required: false, type: 'number', aliases: ['piece new retail', 'ขายใหม่ชิ้น', 'ราคาขายล็อตใหม่ ชิ้น', 'new lot retail piece'] },
  { key: 'pack_old_cost', label: 'ทุนล็อตเก่า (แพ็ก)', required: false, type: 'number', aliases: ['pack old cost', 'ทุนเก่าแพ็ก', 'ราคาทุนล็อตเก่า แพ็ก'] },
  { key: 'pack_old_retail', label: 'ขายล็อตเก่า (แพ็ก)', required: false, type: 'number', aliases: ['pack old retail', 'ขายเก่าแพ็ก', 'ราคาขายล็อตเก่า แพ็ก'] },
  { key: 'pack_new_cost', label: 'ทุนล็อตใหม่ (แพ็ก)', required: false, type: 'number', aliases: ['pack new cost', 'ทุนใหม่แพ็ก', 'ราคาทุนล็อตใหม่ แพ็ก'] },
  { key: 'pack_new_retail', label: 'ขายล็อตใหม่ (แพ็ก)', required: false, type: 'number', aliases: ['pack new retail', 'ขายใหม่แพ็ก', 'ราคาขายล็อตใหม่ แพ็ก'] },
  { key: 'carton_old_cost', label: 'ทุนล็อตเก่า (ลัง)', required: false, type: 'number', aliases: ['carton old cost', 'ทุนเก่าลัง', 'ราคาทุนล็อตเก่า ลัง'] },
  { key: 'carton_old_retail', label: 'ขายล็อตเก่า (ลัง)', required: false, type: 'number', aliases: ['carton old retail', 'ขายเก่าลัง', 'ราคาขายล็อตเก่า ลัง'] },
  { key: 'carton_new_cost', label: 'ทุนล็อตใหม่ (ลัง)', required: false, type: 'number', aliases: ['carton new cost', 'ทุนใหม่ลัง', 'ราคาทุนล็อตใหม่ ลัง'] },
  { key: 'carton_new_retail', label: 'ขายล็อตใหม่ (ลัง)', required: false, type: 'number', aliases: ['carton new retail', 'ขายใหม่ลัง', 'ราคาขายล็อตใหม่ ลัง'] },
  { key: 'variant_active', label: 'สถานะเปิด/ปิด', required: false, type: 'text', aliases: ['active', 'สถานะ', 'is available', 'เปิดขาย', 'variant active'] },
];

const REQUIRED_FIELDS = FIELDS.filter((f) => f.required);
const OPTIONAL_FIELDS = FIELDS.filter((f) => !f.required);
const FLAT_FIELD_KEYS: FieldKey[] = ['sku', 'name', 'category', 'brand', 'pack_size', 'old_cost_price', 'new_cost_price', 'old_retail_price', 'new_retail_price', 'unit', 'quantity', 'lot_number', 'expiry_date'];
const FLAT_FIELDS = FIELDS.filter((field) => FLAT_FIELD_KEYS.includes(field.key));

type Step = 1 | 2 | 3 | 4;

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, any>;
  mapped: Partial<Record<FieldKey, string>>;
  errors: string[];
  status: 'ok' | 'error' | 'duplicate';
  duplicateAction: 'skip' | 'update' | null;
  existingProductId?: string;
  isGroupHeader?: boolean;
}

interface ImportResult {
  rowIndex: number;
  sku: string;
  name: string;
  status: 'success' | 'failed';
  error?: string;
}

export function ImportProductsModal({ open, onClose, branches, profileId, profileName, branchId, onImported }: {
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string }[];
  profileId?: string;
  profileName?: string;
  branchId?: string;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [existingProductIds, setExistingProductIds] = useState<Map<string, string>>(new Map());
  const [importing, setImporting] = useState(false);
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
    setExistingSkus(new Set());
    setExistingProductIds(new Map());
    setImporting(false);
    setResults([]);
    setParseError(null);
    setDragOver(false);
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate(mode: 'hierarchical' | 'flat') {
    const templateFields = mode === 'flat' ? FLAT_FIELDS : FIELDS;
    const headers = templateFields.map((f) => f.label);
    const makeRow = (values: Partial<Record<FieldKey, string>>): Record<string, string> => {
      const row: Record<string, string> = {};
      templateFields.forEach((field) => {
        row[field.label] = values[field.key] ?? '';
      });
      return row;
    };

    const rows = mode === 'flat'
      ? [makeRow({
          sku: 'FD-001', name: 'อาหารแมว ขนาด 1kg', category: 'อาหารสัตว์เลี้ยง', brand: 'Whiskas',
          pack_size: '1kg', old_cost_price: '80', new_cost_price: '85', old_retail_price: '120',
          new_retail_price: '130', unit: 'ชิ้น', quantity: '50', lot_number: 'LOT-2024-001', expiry_date: '2025-12-31',
        })]
      : [
          makeRow({ name: 'Toro', category: 'อาหารแมว', brand: 'Toro' }),
          makeRow({ sku: 'TORO-001', name: 'โตโร่ รสทูน่า', pack_size: '1kg', old_cost_price: '80', new_cost_price: '85', old_retail_price: '120', new_retail_price: '130', unit: 'ชิ้น', quantity: '30' }),
          makeRow({ sku: 'TORO-002', name: 'โตโร่ รสแซลมอน', pack_size: '1kg', old_cost_price: '82', new_cost_price: '87', old_retail_price: '125', new_retail_price: '135', unit: 'ชิ้น', quantity: '25' }),
          makeRow({ sku: 'FD-001', name: 'อาหารแมว ขนาด 1kg', category: 'อาหารสัตว์เลี้ยง', brand: 'Whiskas', pack_size: '1kg', old_cost_price: '80', new_cost_price: '85', old_retail_price: '120', new_retail_price: '130', unit: 'ชิ้น', quantity: '50', lot_number: 'LOT-2024-001', expiry_date: '2025-12-31' }),
        ];

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, mode === 'flat' ? 'template-import-products-flat.xlsx' : 'template-import-products-hierarchical.xlsx');
  }

  function normalizeHeader(h: string): string {
    return h.toLowerCase().trim().replace(/^["'\uFEFF]+|["'\uFEFF]+$/g, '').replace(/\s+/g, ' ');
  }

  function autoDetectMapping(headers: string[]): Partial<Record<FieldKey, string>> {
    const result: Partial<Record<FieldKey, string>> = {};
    const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
    for (const field of FIELDS) {
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
          const text = String(data);
          ws = XLSX.read(text, { type: 'string', cellDates: true }).Sheets[Object.keys(XLSX.read(text, { type: 'string', cellDates: true }).Sheets)[0]];
        } else {
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          ws = wb.Sheets[wb.SheetNames[0]];
        }
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (json.length === 0) {
          setParseError('ไฟล์ไม่มีข้อมูล กรุณาตรวจสอบว่ามีข้อมูลในชีตแรก');
          return;
        }
        const headers = Object.keys(json[0]);
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
      reader.readAsText(file);
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
    let currentGroup: { category?: string; brand?: string } | null = null;
    const rows: ParsedRow[] = rawRows.map((raw, idx) => {
      const mapped: Partial<Record<FieldKey, string>> = {};
      for (const field of FIELDS) {
        const colName = mapping[field.key];
        if (colName && raw[colName] != null) {
          if (field.type === 'date') {
            mapped[field.key] = normalizeExcelDate(raw[colName]);
          } else {
            mapped[field.key] = String(raw[colName]).trim();
          }
        }
      }

      const isGroupHeader = !mapped.sku && !!mapped.name;
      if (isGroupHeader) {
        currentGroup = { category: mapped.category || undefined, brand: mapped.brand || mapped.name || undefined };
        return { rowIndex: idx + 2, raw, mapped, errors: [], status: 'ok' as const, duplicateAction: null, isGroupHeader: true };
      }

      if (currentGroup) {
        if (!mapped.category && currentGroup.category) mapped.category = currentGroup.category;
        if (!mapped.brand && currentGroup.brand) mapped.brand = currentGroup.brand;
      }

      const errors: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        if (!mapped[field.key]) errors.push(`ขาด "${field.label}"`);
      }
      if (mapped.old_cost_price && isNaN(Number(mapped.old_cost_price))) errors.push('ราคาทุนเก่า ต้องเป็นตัวเลข');
      if (mapped.new_cost_price && isNaN(Number(mapped.new_cost_price))) errors.push('ราคาทุนใหม่ ต้องเป็นตัวเลข');
      if (mapped.old_retail_price && isNaN(Number(mapped.old_retail_price))) errors.push('ราคาหน้าร้านเก่า ต้องเป็นตัวเลข');
      if (mapped.new_retail_price && isNaN(Number(mapped.new_retail_price))) errors.push('ราคาหน้าร้านใหม่ ต้องเป็นตัวเลข');
      if (mapped.quantity && isNaN(Number(mapped.quantity))) errors.push('จำนวนคงเหลือ ต้องเป็นตัวเลข');
      if (mapped.pieces_per_pack && isNaN(Number(mapped.pieces_per_pack))) errors.push('จำนวนชิ้น/แพ็ก ต้องเป็นตัวเลข');
      if (mapped.packs_per_carton && isNaN(Number(mapped.packs_per_carton))) errors.push('จำนวนแพ็ก/ลัง ต้องเป็นตัวเลข');
      if (mapped.price_per_pack && isNaN(Number(mapped.price_per_pack))) errors.push('ราคาขายต่อแพ็ก ต้องเป็นตัวเลข');
      if (mapped.price_per_carton && isNaN(Number(mapped.price_per_carton))) errors.push('ราคาขายต่อลัง ต้องเป็นตัวเลข');
      const numericVariantFields = ['piece_old_cost', 'piece_old_retail', 'piece_new_cost', 'piece_new_retail', 'pack_old_cost', 'pack_old_retail', 'pack_new_cost', 'pack_new_retail', 'carton_old_cost', 'carton_old_retail', 'carton_new_cost', 'carton_new_retail'];
      for (const nk of numericVariantFields) {
        const val = (mapped as Record<string, string | undefined>)[nk];
        if (val && isNaN(Number(val))) {
          const field = FIELDS.find((f) => f.key === nk);
          errors.push(`${field?.label ?? nk} ต้องเป็นตัวเลข`);
        }
      }
      return { rowIndex: idx + 2, raw, mapped, errors, status: errors.length > 0 ? 'error' : 'ok', duplicateAction: null };
    });

    const skus = new Set(rows.filter((r) => !r.isGroupHeader && r.mapped.sku).map((r) => r.mapped.sku!));
    const { data: existing } = await supabase.from('products').select('id, sku').in('sku', [...skus]);
    const skuSet = new Set<string>();
    const idMap = new Map<string, string>();
    (existing ?? []).forEach((p: any) => {
      skuSet.add(p.sku);
      idMap.set(p.sku, p.id);
    });
    setExistingSkus(skuSet);
    setExistingProductIds(idMap);

    const updated = rows.map((r) => {
      if (r.status === 'error') return r;
      if (r.mapped.sku && skuSet.has(r.mapped.sku)) {
        return { ...r, status: 'duplicate' as const, duplicateAction: 'skip' as const, existingProductId: idMap.get(r.mapped.sku) };
      }
      return r;
    });
    setParsedRows(updated);
    setStep(3);
  }

  function setDuplicateAction(rowIndex: number, action: 'skip' | 'update') {
    setParsedRows((prev) => prev.map((r) =>
      r.rowIndex === rowIndex ? { ...r, duplicateAction: action } : r
    ));
  }

  const validRows = parsedRows.filter((r) => !r.isGroupHeader && (r.status === 'ok' || (r.status === 'duplicate' && r.duplicateAction === 'update')));
  const errorRows = parsedRows.filter((r) => r.status === 'error');
  const skipRows = parsedRows.filter((r) => r.status === 'duplicate' && r.duplicateAction === 'skip');
  const groupHeaderRows = parsedRows.filter((r) => r.isGroupHeader);

  async function doImport() {
    setImporting(true);
    const importResults: ImportResult[] = [];
    const resolvedBranchId = branchId ?? branches[0]?.id;

    for (const row of validRows) {
      const sku = row.mapped.sku!;
      const name = row.mapped.name!;
      try {
        const costPrice = Number(row.mapped.new_cost_price || row.mapped.old_cost_price || 0);
        const retailPrice = Number(row.mapped.new_retail_price || row.mapped.old_retail_price || 0);
        const isDuplicate = row.status === 'duplicate' && row.duplicateAction === 'update';
        const productId = row.existingProductId;

        if (isDuplicate && productId) {
          const { error: updErr } = await supabase.from('products').update({
            name,
            category: row.mapped.category || null,
            brand: row.mapped.brand || null,
            unit: row.mapped.unit || null,
            cost_price: costPrice,
            retail_price: retailPrice,
          }).eq('id', productId);
          if (updErr) {
            importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'failed', error: updErr.message });
            continue;
          }

          if (row.mapped.quantity && resolvedBranchId) {
            const qty = Number(row.mapped.quantity);
            const lotLabel = row.mapped.new_cost_price ? 'new' : 'old';
            const lotCost = Number(row.mapped.new_cost_price || row.mapped.old_cost_price || 0);
            const { data: existingLot } = await supabase.from('stock_lots')
              .select('id, quantity, cost_price')
              .eq('product_id', productId)
              .eq('branch_id', resolvedBranchId)
              .eq('lot_label', lotLabel)
              .maybeSingle();
            if (existingLot) {
              await supabase.from('stock_lots').update({
                quantity: Number(existingLot.quantity) + qty,
                cost_price: lotCost || Number(existingLot.cost_price),
                retail_price: Number(row.mapped.new_retail_price || row.mapped.old_retail_price || 0) || undefined,
                expiry_date: displayDateToISO(row.mapped.expiry_date) || null,
              }).eq('id', existingLot.id);
            } else {
              await supabase.from('stock_lots').insert({
                product_id: productId,
                branch_id: resolvedBranchId,
                lot_label: lotLabel,
                quantity: qty,
                cost_price: lotCost,
                retail_price: Number(row.mapped.new_retail_price || row.mapped.old_retail_price || 0),
                lot_number: row.mapped.lot_number || null,
                expiry_date: displayDateToISO(row.mapped.expiry_date) || null,
              });
            }
            await supabase.from('stock_movements').insert({
              product_id: productId,
              branch_id: resolvedBranchId,
              movement_type: 'receive',
              type_config: 'นำเข้าจาก Excel',
              quantity: qty,
              unit_price: lotCost,
              discount_amount: 0,
              discount_percent: 0,
              reference_note: `นำเข้าจาก Excel: ${fileName}`,
              profile_id: profileId ?? null,
            });
          }

          await supabase.from('product_audit_logs').insert({
            product_id: productId,
            action: 'import_update',
            actor_profile_id: profileId ?? null,
            actor_name: profileName ?? null,
            new_value: row.mapped,
            note: `นำเข้าจาก Excel (อัปเดตสินค้าเดิม): ${fileName}`,
          });

          importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'success' });
        } else {
          const { data: newProduct, error: insErr } = await supabase.from('products').insert({
            sku,
            name,
            category: row.mapped.category || null,
            brand: row.mapped.brand || null,
            unit: row.mapped.unit || null,
            cost_price: costPrice,
            retail_price: retailPrice,
            min_stock: 5,
            is_active: true,
          }).select('id').single();
          if (insErr) {
            importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'failed', error: insErr.message });
            continue;
          }
          const newProductId = newProduct.id;

          if (row.mapped.quantity && resolvedBranchId) {
            const qty = Number(row.mapped.quantity);
            const lotLabel = row.mapped.new_cost_price ? 'new' : 'old';
            const lotCost = Number(row.mapped.new_cost_price || row.mapped.old_cost_price || 0);
            await supabase.from('stock_lots').insert({
              product_id: newProductId,
              branch_id: resolvedBranchId,
              lot_label: lotLabel,
              quantity: qty,
              cost_price: lotCost,
              retail_price: Number(row.mapped.new_retail_price || row.mapped.old_retail_price || 0),
              lot_number: row.mapped.lot_number || null,
              expiry_date: displayDateToISO(row.mapped.expiry_date) || null,
            });
            await supabase.from('stock_movements').insert({
              product_id: newProductId,
              branch_id: resolvedBranchId,
              movement_type: 'receive',
              type_config: 'นำเข้าจาก Excel',
              quantity: qty,
              unit_price: lotCost,
              discount_amount: 0,
              discount_percent: 0,
              reference_note: `นำเข้าจาก Excel: ${fileName}`,
              profile_id: profileId ?? null,
            });
          }

          const lotPriceMap: Record<string, { oldCost?: number; oldRetail?: number; newCost?: number; newRetail?: number }> = {
            piece: {
              oldCost: numOrUndef(row.mapped.piece_old_cost),
              oldRetail: numOrUndef(row.mapped.piece_old_retail),
              newCost: numOrUndef(row.mapped.piece_new_cost),
              newRetail: numOrUndef(row.mapped.piece_new_retail),
            },
            pack: {
              oldCost: numOrUndef(row.mapped.pack_old_cost),
              oldRetail: numOrUndef(row.mapped.pack_old_retail),
              newCost: numOrUndef(row.mapped.pack_new_cost),
              newRetail: numOrUndef(row.mapped.pack_new_retail),
            },
            carton: {
              oldCost: numOrUndef(row.mapped.carton_old_cost),
              oldRetail: numOrUndef(row.mapped.carton_old_retail),
              newCost: numOrUndef(row.mapped.carton_new_cost),
              newRetail: numOrUndef(row.mapped.carton_new_retail),
            },
          };
          const variantActive = parseActive(row.mapped.variant_active);

          const barcodes: { barcode: string; unit: string; unit_multiplier: number; lotKey: string; costPrice: number; price: number }[] = [];
          if (row.mapped.sku) barcodes.push({ barcode: row.mapped.sku, unit: 'piece', unit_multiplier: 1, lotKey: 'piece', costPrice: numOrZero(row.mapped.old_cost_price), price: numOrZero(row.mapped.old_retail_price) });
          if (row.mapped.new_sku) barcodes.push({ barcode: row.mapped.new_sku, unit: 'piece', unit_multiplier: 1, lotKey: 'piece', costPrice: numOrZero(row.mapped.new_cost_price), price: numOrZero(row.mapped.new_retail_price) });
          if (row.mapped.other_sku) barcodes.push({ barcode: row.mapped.other_sku, unit: 'piece', unit_multiplier: 1, lotKey: 'piece', costPrice: 0, price: 0 });
          if (row.mapped.pieces_per_pack && Number(row.mapped.pieces_per_pack) > 1) {
            const packBarcode = `${row.mapped.sku}-PACK`;
            barcodes.push({ barcode: packBarcode, unit: 'dozen', unit_multiplier: Number(row.mapped.pieces_per_pack), lotKey: 'pack', costPrice: numOrZero(row.mapped.price_per_pack), price: numOrZero(row.mapped.price_per_pack) });
          }
          if (row.mapped.packs_per_carton && Number(row.mapped.packs_per_carton) > 1) {
            const cartonBarcode = `${row.mapped.sku}-CTN`;
            const cartonMult = Number(row.mapped.pieces_per_pack || 1) * Number(row.mapped.packs_per_carton);
            barcodes.push({ barcode: cartonBarcode, unit: 'carton', unit_multiplier: cartonMult, lotKey: 'carton', costPrice: numOrZero(row.mapped.price_per_carton), price: numOrZero(row.mapped.price_per_carton) });
          }
          for (const bc of barcodes) {
            const { data: insertedBc, error: bcErr } = await supabase.from('product_barcodes').insert({
              product_id: newProductId,
              barcode: bc.barcode,
              unit: bc.unit,
              unit_multiplier: bc.unit_multiplier,
              cost_price: bc.costPrice,
              price: bc.price,
              is_available: variantActive,
            }).select('id').single();
            if (bcErr) {
              importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'failed', error: `barcode insert: ${bcErr.message}` });
              continue;
            }
            const lp = lotPriceMap[bc.lotKey];
            if (lp) {
              const lotEntries: { lot_label: string; cost_price: number; retail_price: number }[] = [];
              if (lp.oldCost != null || lp.oldRetail != null) {
                lotEntries.push({ lot_label: 'old', cost_price: lp.oldCost ?? 0, retail_price: lp.oldRetail ?? 0 });
              }
              if (lp.newCost != null || lp.newRetail != null) {
                lotEntries.push({ lot_label: 'new', cost_price: lp.newCost ?? 0, retail_price: lp.newRetail ?? 0 });
              }
              for (const le of lotEntries) {
                await supabase.from('variant_lot_prices').insert({
                  product_barcode_id: insertedBc.id,
                  lot_label: le.lot_label,
                  cost_price: le.cost_price,
                  retail_price: le.retail_price,
                });
              }
            }
          }

          await supabase.from('product_audit_logs').insert({
            product_id: newProductId,
            action: 'import_create',
            actor_profile_id: profileId ?? null,
            actor_name: profileName ?? null,
            new_value: row.mapped,
            note: `นำเข้าจาก Excel (สร้างใหม่): ${fileName}`,
          });

          importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'success' });
        }
      } catch (err: any) {
        importResults.push({ rowIndex: row.rowIndex, sku, name, status: 'failed', error: err.message ?? 'ไม่ทราบสาเหตุ' });
      }
    }

    setResults(importResults);
    setImporting(false);
    setStep(4);
    onImported();
  }

  function downloadErrorReport() {
    const failed = results.filter((r) => r.status === 'failed');
    if (failed.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(failed.map((r) => ({
      'แถวที่': r.rowIndex,
      'SKU': r.sku,
      'ชื่อสินค้า': r.name,
      'สาเหตุความล้มเหลว': r.error ?? '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'import-errors.xlsx');
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  const stepLabels = ['อัปโหลด', 'แผนผังคอลัมน์', 'ตรวจสอบ', 'เสร็จสิ้น'];

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="นำเข้าสินค้าจาก Excel/CSV" size="xl">
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => downloadTemplate('hierarchical')}>
                  <Download className="w-4 h-4" /> แม่แบบ Hierarchical
                </Button>
                <Button variant="ghost" size="sm" onClick={() => downloadTemplate('flat')}>
                  <Download className="w-4 h-4" /> แม่แบบ Flat
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100 text-sm text-surface-600 space-y-1">
              <p className="font-medium text-primary-700">รูปแบบ Hierarchical — รองรับ 2 กรณี:</p>
              <p>• <span className="font-medium">แถวหลักที่มีย่อย</span>: กรอกเฉพาะชื่อกลุ่ม เช่น "Toro" ไม่ต้องใส่ SKU และราคา ไม่นับเป็นสินค้า</p>
              <p>• <span className="font-medium">แถวย่อยใต้แถวหลัก</span>: กรอก SKU และราคาของตัวเอง นับเป็นสินค้า</p>
              <p>• <span className="font-medium">แถวหลักที่ไม่มีย่อย</span>: กรอก SKU และราคาของตัวเอง นับเป็นสินค้า</p>
            </div>

            {/* Required columns */}
            <div className="p-4 rounded-xl border border-error-200 bg-error-50/50">
              <p className="text-sm font-semibold text-error-700 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> จำเป็นต้องมี (บังคับกรอก)
              </p>
              <div className="flex flex-wrap gap-2">
                {REQUIRED_FIELDS.map((f) => (
                  <span key={f.key} className="px-2.5 py-1 rounded-lg bg-white border border-error-200 text-xs font-medium text-surface-700">
                    {f.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-error-600 mt-2">ระบบจะปฏิเสธแถวที่ขาดคอลัมน์บังคับนี้ (SKU จำเป็นสำหรับสินค้า ยกเว้นแถวหมวดใน Hierarchical)</p>
            </div>

            {/* Optional columns */}
            <div className="p-4 rounded-xl border border-surface-200 bg-surface-50/50">
              <p className="text-sm font-semibold text-surface-600 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> มีก็ได้ (ไม่บังคับ)
              </p>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_FIELDS.map((f) => (
                  <span key={f.key} className="px-2.5 py-1 rounded-lg bg-white border border-surface-200 text-xs font-medium text-surface-500">
                    {f.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-surface-400 mt-2">คอลัมน์เหล่านี้เว้นว่างได้ ระบบจะใช้ค่าเริ่มต้นแทน</p>
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
              {FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-50">
                  <div className="w-48 shrink-0">
                    <span className="text-sm font-medium text-surface-700">{field.label}</span>
                    {field.required && <span className="text-error-500 ml-1">*</span>}
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
                  {mapping[field.key] && rawRows.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-surface-400 max-w-[120px] truncate" title={String(rawRows[0][mapping[field.key]!] ?? '')}>
                        {String(rawRows[0][mapping[field.key]!] ?? '')}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-success-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
              </Button>
              <Button onClick={goToReview} loading={importing}>
                ตรวจสอบ <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <p className="text-xs text-surface-500">จะข้าม (SKU ซ้ำ)</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-50 border border-primary-200">
                <p className="text-2xl font-bold text-primary-600">{groupHeaderRows.length}</p>
                <p className="text-xs text-surface-500">หมวดจัดกลุ่ม</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-[400px] overflow-auto rounded-xl border border-surface-200">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">แถว</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">ชื่อสินค้า</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500 hidden md:table-cell">หมวด/แบรนด์</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500 hidden md:table-cell">จำนวน</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500 hidden lg:table-cell">ทุนเก่า</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500 hidden lg:table-cell">ทุนใหม่</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500 hidden lg:table-cell">หน้าร้านเก่า</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500 hidden lg:table-cell">หน้าร้านใหม่</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {parsedRows.slice(0, 200).map((r) => (
                    <tr key={r.rowIndex} className={cn(
                      r.isGroupHeader ? 'bg-primary-50/60' : '',
                      r.status === 'error' ? 'bg-error-50/50' : '',
                      r.status === 'duplicate' ? 'bg-warning-50/50' : '',
                    )}>
                      <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                      <td className="px-3 py-2 font-medium text-surface-700">
                        {r.isGroupHeader ? <span className="inline-flex px-2 py-0.5 rounded-lg bg-primary-100 text-primary-700 text-xs font-medium">หมวด</span> : (r.mapped.sku || <span className="text-error-400">—</span>)}
                      </td>
                      <td className="px-3 py-2 text-surface-600 max-w-[200px] truncate">{r.isGroupHeader ? <span className="font-semibold text-primary-700">{r.mapped.name}</span> : (r.mapped.name || <span className="text-error-400">—</span>)}</td>
                      <td className="px-3 py-2 text-surface-500 hidden md:table-cell">{[r.mapped.category, r.mapped.brand].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="px-3 py-2 text-right text-surface-500 hidden md:table-cell">{r.isGroupHeader ? '—' : (r.mapped.quantity || '-')}</td>
                      <td className="px-3 py-2 text-right text-surface-600 hidden lg:table-cell tabular-nums">{r.isGroupHeader ? '—' : (r.mapped.old_cost_price || '-')}</td>
                      <td className="px-3 py-2 text-right text-surface-600 hidden lg:table-cell tabular-nums font-medium text-primary-600">{r.isGroupHeader ? '—' : (r.mapped.new_cost_price || '-')}</td>
                      <td className="px-3 py-2 text-right text-surface-600 hidden lg:table-cell tabular-nums">{r.isGroupHeader ? '—' : (r.mapped.old_retail_price || '-')}</td>
                      <td className="px-3 py-2 text-right text-surface-600 hidden lg:table-cell tabular-nums font-medium text-primary-600">{r.isGroupHeader ? '—' : (r.mapped.new_retail_price || '-')}</td>
                      <td className="px-3 py-2">
                        {r.isGroupHeader ? <span className="text-xs text-primary-500">กลุ่มจัดกลุ่ม</span> : r.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success-100 text-success-700 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> พร้อม</span>
                        ) : r.status === 'error' ? (
                          <div className="space-y-0.5">{r.errors.map((err, i) => <div key={i} className="text-xs text-error-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" /> {err}</div>)}</div>
                        ) : (
                          <div className="flex items-center gap-1.5"><span className="inline-flex px-2 py-0.5 rounded-lg bg-warning-100 text-warning-700 text-xs font-medium whitespace-nowrap">SKU ซ้ำ</span><select value={r.duplicateAction ?? 'skip'} onChange={(e) => setDuplicateAction(r.rowIndex, e.target.value as 'skip' | 'update')} className="text-xs px-1.5 py-0.5 rounded-lg border border-surface-200 bg-white outline-none" onClick={(e) => e.stopPropagation()}><option value="skip">ข้าม</option><option value="update">อัปเดต</option></select></div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 200 && (
              <p className="text-xs text-surface-400 text-center">แสดง 200 จาก {parsedRows.length} แถว (เลื่อนเพื่อดูเพิ่มเติมในตารางด้านบน)</p>
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
                  <p className="text-sm text-surface-500">นำเข้าสินค้า {successCount} รายการเรียบร้อยแล้ว</p>
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

            {/* Results table */}
            {results.length > 0 && (
              <div className="max-h-[300px] overflow-auto rounded-xl border border-surface-200">
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">แถว</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">SKU</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">ชื่อสินค้า</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">ผล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {results.map((r, i) => (
                      <tr key={i} className={r.status === 'failed' ? 'bg-error-50/50' : ''}>
                        <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                        <td className="px-3 py-2 font-medium text-surface-700">{r.sku}</td>
                        <td className="px-3 py-2 text-surface-600 max-w-[200px] truncate">{r.name}</td>
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
