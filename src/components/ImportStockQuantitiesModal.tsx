import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, RefreshCw, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button } from '@/components/ui';
import { supabase, fetchAllPaginated } from '@/lib/supabase';
import { cn } from '@/lib/format';

type Step = 1 | 2 | 3 | 4;

interface StockRow {
  rowIndex: number;
  sku: string;
  quantity: number;
  matched: boolean;
  productId?: string;
  productName?: string;
  barcodeId?: string;
  currentQty?: number;
  hasVariants?: boolean;
}

interface ImportResult {
  rowIndex: number;
  sku: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

function stripLeadingZeros(s: string): string {
  const stripped = s.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

export function ImportStockQuantitiesModal({ open, onClose, branchId, profileId, profileName, onImported }: {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  profileId?: string;
  profileName?: string;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1); setFileName(''); setRows([]); setImporting(false);
    setResults([]); setParseError(null); setDragOver(false);
  }, []);

  function handleClose() { reset(); onClose(); }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { SKU: '52742523804', 'จำนวนคงเหลือ': 50 },
      { SKU: 'FD-001', 'จำนวนคงเหลือ': 30 },
    ]);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, 'template-import-stock-quantities.xlsx');
  }

  function handleFile(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onerror = () => setParseError('อ่านไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง');
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let ws: XLSX.WorkSheet;
        if (file.name.toLowerCase().endsWith('.csv')) {
          let text = String(data);
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          const wb = XLSX.read(text, { type: 'string', cellDates: true });
          ws = wb.Sheets[wb.SheetNames[0]];
        } else {
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          ws = wb.Sheets[wb.SheetNames[0]];
        }
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (json.length === 0) { setParseError('ไฟล์ไม่มีข้อมูล'); return; }

        const headers = Object.keys(json[0]).map((h) => h.toLowerCase().trim());
        const skuCol = Object.keys(json[0]).find((h) => {
          const n = h.toLowerCase().trim();
          return n === 'sku' || n === 'รหัสสินค้า' || n === 'รหัส' || n === 'barcode' || n === 'บาร์โค้ด' || n === 'code' || n === 'item code';
        });
        const qtyCol = Object.keys(json[0]).find((h) => {
          const n = h.toLowerCase().trim();
          return n === 'จำนวนคงเหลือ' || n === 'จำนวน' || n === 'quantity' || n === 'qty' || n === 'stock' || n === 'สต๊อก' || n === 'สต็อก';
        });

        if (!skuCol || !qtyCol) {
          setParseError('ไม่พบคอลัมน์ SKU หรือ จำนวนคงเหลือ ในไฟล์ — ต้องมีคอลัมน์ SKU และจำนวนคงเหลือ');
          return;
        }

        const parsed: StockRow[] = json.map((raw, idx) => {
          const sku = String(raw[skuCol] ?? '').trim();
          const qtyRaw = String(raw[qtyCol] ?? '').trim();
          const quantity = Number(qtyRaw);
          return {
            rowIndex: idx + 2,
            sku,
            quantity: isNaN(quantity) ? 0 : quantity,
            matched: false,
          };
        }).filter((r) => r.sku !== '');

        if (parsed.length === 0) { setParseError('ไม่พบแถวที่มี SKU ในไฟล์'); return; }

        setRows(parsed);
        setFileName(file.name);
        setStep(2);
      } catch (err: any) {
        setParseError(`อ่านไฟล์ไม่สำเร็จ: ${err.message ?? 'ไฟล์ไม่ถูกต้อง'}`);
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file, 'utf-8');
    else reader.readAsArrayBuffer(file);
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

  async function goToPreview() {
    setPreparing(true);
    try {
      const [prodRows, bcRows] = await Promise.all([
        fetchAllPaginated<{ id: string; sku: string | null; name: string }>(() => supabase.from('products').select('id, sku, name').eq('is_active', true)),
        fetchAllPaginated<{ id: string; product_id: string; barcode: string | null }>(() => supabase.from('product_barcodes').select('id, product_id, barcode')),
      ]);

      const skuToProduct = new Map<string, { id: string; name: string }>();
      prodRows.forEach((p) => {
        if (p.sku) {
          const norm = p.sku.trim().toLowerCase();
          skuToProduct.set(norm, { id: p.id, name: p.name });
          skuToProduct.set(stripLeadingZeros(norm), { id: p.id, name: p.name });
        }
      });

      const barcodeToVariant = new Map<string, { id: string; product_id: string }>();
      bcRows.forEach((b) => {
        if (b.barcode) {
          const norm = b.barcode.trim().toLowerCase();
          barcodeToVariant.set(norm, { id: b.id, product_id: b.product_id });
          barcodeToVariant.set(stripLeadingZeros(norm), { id: b.id, product_id: b.product_id });
        }
      });

      const productIds = new Set(prodRows.map((p) => p.id));
      const variantProductIds = new Set(bcRows.map((b) => b.product_id));

      const matchedRows = rows.map((r) => {
        const norm = r.sku.trim().toLowerCase();
        const stripped = stripLeadingZeros(norm);

        const variantMatch = barcodeToVariant.get(norm) ?? barcodeToVariant.get(stripped);
        if (variantMatch) {
          const prod = prodRows.find((p) => p.id === variantMatch.product_id);
          return {
            ...r,
            matched: true,
            productId: variantMatch.product_id,
            productName: prod?.name ?? '—',
            barcodeId: variantMatch.id,
            hasVariants: true,
            currentQty: undefined,
          };
        }

        const prodMatch = skuToProduct.get(norm) ?? skuToProduct.get(stripped);
        if (prodMatch) {
          const hasVariants = variantProductIds.has(prodMatch.id);
          return {
            ...r,
            matched: true,
            productId: prodMatch.id,
            productName: prodMatch.name,
            hasVariants,
            currentQty: undefined,
          };
        }

        return r;
      });

      const productIdsToQuery = new Set<string>();
      matchedRows.forEach((r) => {
        if (r.matched && r.productId) productIdsToQuery.add(r.productId);
      });

      const lotMap = new Map<string, number>();
      if (productIdsToQuery.size > 0 && branchId) {
        const lotRows = await fetchAllPaginated<{ product_id: string; quantity: number }>(
          () => supabase.from('stock_lots').select('product_id, quantity').eq('branch_id', branchId).in('product_id', [...productIdsToQuery])
        );
        lotRows.forEach((l) => {
          lotMap.set(l.product_id, (lotMap.get(l.product_id) ?? 0) + Number(l.quantity ?? 0));
        });
      } else if (productIdsToQuery.size > 0) {
        const lotRows = await fetchAllPaginated<{ product_id: string; quantity: number }>(
          () => supabase.from('stock_lots').select('product_id, quantity').in('product_id', [...productIdsToQuery])
        );
        lotRows.forEach((l) => {
          lotMap.set(l.product_id, (lotMap.get(l.product_id) ?? 0) + Number(l.quantity ?? 0));
        });
      }

      const variantLotMap = new Map<string, number>();
      const barcodeIdsToQuery = new Set<string>();
      matchedRows.forEach((r) => {
        if (r.matched && r.barcodeId) barcodeIdsToQuery.add(r.barcodeId);
      });
      if (barcodeIdsToQuery.size > 0) {
        const vlpRows = await fetchAllPaginated<{ product_barcode_id: string; quantity: number }>(
          () => supabase.from('variant_lot_prices').select('product_barcode_id, quantity').in('product_barcode_id', [...barcodeIdsToQuery])
        );
        vlpRows.forEach((v) => {
          variantLotMap.set(v.product_barcode_id, (variantLotMap.get(v.product_barcode_id) ?? 0) + Number(v.quantity ?? 0));
        });
      }

      const enriched = matchedRows.map((r) => {
        if (!r.matched) return r;
        if (r.barcodeId) {
          return { ...r, currentQty: variantLotMap.get(r.barcodeId) ?? 0 };
        }
        if (r.productId) {
          return { ...r, currentQty: lotMap.get(r.productId) ?? 0 };
        }
        return r;
      });

      setRows(enriched);
      setStep(3);
    } catch (err: any) {
      setParseError(`เตรียมข้อมูลไม่สำเร็จ: ${err.message ?? 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setPreparing(false);
    }
  }

  const matchedRows = rows.filter((r) => r.matched);
  const unmatchedRows = rows.filter((r) => !r.matched);

  async function doImport() {
    setImporting(true);
    const importResults: ImportResult[] = [];
    const resolvedBranchId = branchId ?? null;

    for (const row of matchedRows) {
      try {
        if (row.barcodeId) {
          const { data: existingVlps, error: vlpErr } = await supabase
            .from('variant_lot_prices')
            .select('id, lot_label, quantity')
            .eq('product_barcode_id', row.barcodeId);
          if (vlpErr) throw new Error(vlpErr.message);

          const vlps = existingVlps ?? [];
          if (vlps.length > 0) {
            const totalCurrent = vlps.reduce((s, v) => s + Number(v.quantity ?? 0), 0);
            const diff = row.quantity - totalCurrent;
            if (diff !== 0) {
              const firstLot = vlps[0];
              const newQty = Math.max(0, Number(firstLot.quantity) + diff);
              const { error: updErr } = await supabase
                .from('variant_lot_prices')
                .update({ quantity: newQty })
                .eq('id', firstLot.id);
              if (updErr) throw new Error(updErr.message);
            }
          } else {
            const { error: insErr } = await supabase
              .from('variant_lot_prices')
              .insert({ product_barcode_id: row.barcodeId, lot_label: 'old', quantity: row.quantity, cost_price: 0, retail_price: 0 });
            if (insErr) throw new Error(insErr.message);
          }

          if (resolvedBranchId) {
            const { error: vbsErr } = await supabase
              .from('variant_branch_stock')
              .upsert({ variant_id: row.barcodeId, branch_id: resolvedBranchId, quantity: row.quantity }, { onConflict: 'variant_id,branch_id' });
            if (vbsErr) throw new Error(vbsErr.message);
          }

          if (row.productId) {
            await supabase.from('stock_movements').insert({
              product_id: row.productId,
              product_barcode_id: row.barcodeId,
              branch_id: resolvedBranchId,
              movement_type: 'adjust',
              type_config: 'นำเข้าคงเหลือจาก Excel',
              quantity: row.quantity,
              unit_price: 0,
              discount_amount: 0,
              discount_percent: 0,
              reference_note: `นำเข้าคงเหลือ: ${fileName}`,
              profile_id: profileId ?? null,
            });
          }
        } else if (row.productId) {
          const lotQuery = supabase
            .from('stock_lots')
            .select('id, lot_label, quantity, branch_id')
            .eq('product_id', row.productId);
          const { data: existingLots, error: lotErr } = resolvedBranchId
            ? await lotQuery.eq('branch_id', resolvedBranchId)
            : await lotQuery;
          if (lotErr) throw new Error(lotErr.message);

          const lots = existingLots ?? [];
          if (lots.length > 0) {
            const totalCurrent = lots.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
            const diff = row.quantity - totalCurrent;
            if (diff !== 0) {
              const firstLot = lots[0];
              const newQty = Math.max(0, Number(firstLot.quantity) + diff);
              const { error: updErr } = await supabase
                .from('stock_lots')
                .update({ quantity: newQty })
                .eq('id', firstLot.id);
              if (updErr) throw new Error(updErr.message);
            }
          } else {
            const { error: insErr } = await supabase
              .from('stock_lots')
              .insert({
                product_id: row.productId,
                branch_id: resolvedBranchId,
                lot_label: 'old',
                quantity: row.quantity,
                cost_price: 0,
              });
            if (insErr) throw new Error(insErr.message);
          }

          await supabase.from('stock_movements').insert({
            product_id: row.productId,
            branch_id: resolvedBranchId,
            movement_type: 'adjust',
            type_config: 'นำเข้าคงเหลือจาก Excel',
            quantity: row.quantity,
            unit_price: 0,
            discount_amount: 0,
            discount_percent: 0,
            reference_note: `นำเข้าคงเหลือ: ${fileName}`,
            profile_id: profileId ?? null,
          });
        }

        importResults.push({ rowIndex: row.rowIndex, sku: row.sku, status: 'success' });
      } catch (err: any) {
        importResults.push({ rowIndex: row.rowIndex, sku: row.sku, status: 'failed', error: err.message ?? 'ไม่ทราบสาเหตุ' });
      }
    }

    unmatchedRows.forEach((r) => {
      importResults.push({ rowIndex: r.rowIndex, sku: r.sku, status: 'skipped', error: 'ไม่พบ SKU ในระบบ' });
    });

    setResults(importResults);
    setImporting(false);
    setStep(4);
    onImported();
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const stepLabels = ['อัปโหลด', 'พรีวิว', 'ยืนยัน', 'เสร็จสิ้น'];

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="นำเข้าคงเหลือสินค้า (อัปเดตจาก SKU)" size="xl">
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
                <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์แม่แบบ
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100 text-sm text-surface-600 space-y-1">
              <p className="font-medium text-primary-700">วิธีใช้งาน</p>
              <p>ไฟล์ต้องมี 2 คอลัมน์: <span className="font-medium">SKU</span> และ <span className="font-medium">จำนวนคงเหลือ</span></p>
              <p>ระบบจะค้นหาสินค้าจาก SKU (หรือบาร์โค้ด) และอัปเดตจำนวนคงเหลือใหม่ทับค่าเดิม</p>
              <p>หากไม่พบ SKU ในระบบ จะข้ามแถวนั้น — ไม่สร้างสินค้าใหม่</p>
              <p className="text-xs text-surface-400 mt-2">ระบบตัดเลข 0 ที่นำหน้า SKU ออกก่อนเทียบ เช่น 052742523804 = 52742523804</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { if (fileName) setStep(2); }} disabled={!fileName}>
                ถัดไป <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preparing preview */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-primary-50 text-sm text-primary-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              ไฟล์: <span className="font-medium">{fileName}</span> · พบ {rows.length} แถว
            </div>

            <div className="max-h-[200px] overflow-auto rounded-xl border border-surface-200">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">แถว</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">SKU</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500">จำนวนคงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.rowIndex}>
                      <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                      <td className="px-3 py-2 font-mono text-surface-700">{r.sku}</td>
                      <td className="px-3 py-2 text-right text-surface-600 tabular-nums">{r.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && <p className="text-xs text-surface-400 text-center">แสดง 100 จาก {rows.length} แถว</p>}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
              </Button>
              <Button onClick={goToPreview} loading={preparing}>
                ตรวจสอบ <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview with match results */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-success-50 border border-success-200">
                <p className="text-2xl font-bold text-success-600">{matchedRows.length}</p>
                <p className="text-xs text-surface-500">จะอัปเดตคงเหลือ</p>
              </div>
              <div className="p-3 rounded-xl bg-error-50 border border-error-200">
                <p className="text-2xl font-bold text-error-600">{unmatchedRows.length}</p>
                <p className="text-xs text-surface-500">ไม่พบ SKU — ข้าม</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-50 border border-primary-200">
                <p className="text-2xl font-bold text-primary-600">{rows.length}</p>
                <p className="text-xs text-surface-500">ทั้งหมดในไฟล์</p>
              </div>
            </div>

            {/* Matched table */}
            {matchedRows.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-surface-700 mb-2">จะอัปเดตคงเหลือ ({matchedRows.length} รายการ)</p>
                <div className="max-h-[250px] overflow-auto rounded-xl border border-surface-200">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-surface-500">SKU</th>
                        <th className="text-left px-3 py-2 font-medium text-surface-500">ชื่อสินค้า</th>
                        <th className="text-right px-3 py-2 font-medium text-surface-500">เดิม</th>
                        <th className="text-right px-3 py-2 font-medium text-surface-500">ใหม่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {matchedRows.slice(0, 200).map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-surface-50">
                          <td className="px-3 py-2 font-mono text-surface-700">{r.sku}</td>
                          <td className="px-3 py-2 text-surface-600 max-w-[200px] truncate">{r.productName}</td>
                          <td className="px-3 py-2 text-right text-surface-500 tabular-nums">{r.currentQty ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-primary-600 tabular-nums">{r.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {matchedRows.length > 200 && <p className="text-xs text-surface-400 text-center mt-1">แสดง 200 จาก {matchedRows.length} แถว</p>}
              </div>
            )}

            {/* Unmatched table */}
            {unmatchedRows.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-error-700 mb-2">ไม่พบ SKU — ข้ามการนำเข้า ({unmatchedRows.length} รายการ)</p>
                <div className="max-h-[200px] overflow-auto rounded-xl border border-error-200">
                  <table className="w-full text-xs">
                    <thead className="bg-error-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-error-600">แถว</th>
                        <th className="text-left px-3 py-2 font-medium text-error-600">SKU</th>
                        <th className="text-left px-3 py-2 font-medium text-error-600">จำนวน</th>
                        <th className="text-left px-3 py-2 font-medium text-error-600">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {unmatchedRows.slice(0, 100).map((r) => (
                        <tr key={r.rowIndex} className="bg-error-50/30">
                          <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                          <td className="px-3 py-2 font-mono text-surface-700">{r.sku}</td>
                          <td className="px-3 py-2 text-surface-500">{r.quantity}</td>
                          <td className="px-3 py-2 text-error-600">ไม่พบสินค้า — กรุณาเพิ่มผ่านเมนูนำเข้าสินค้าก่อน</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {unmatchedRows.length > 100 && <p className="text-xs text-surface-400 text-center mt-1">แสดง 100 จาก {unmatchedRows.length} แถว</p>}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
              </Button>
              <Button onClick={doImport} loading={importing} disabled={matchedRows.length === 0}>
                <Upload className="w-4 h-4" /> ยืนยันนำเข้า {matchedRows.length} รายการ
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
                  <p className="text-sm text-surface-500">
                    อัปเดต {successCount} รายการ · ข้าม {skippedCount} รายการ (ไม่พบ SKU)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-warning-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-warning-600" />
                  </div>
                  <p className="text-xl font-bold text-surface-900">นำเข้าเสร็จสิ้น</p>
                  <p className="text-sm text-surface-500">
                    สำเร็จ {successCount} · ล้มเหลว {failedCount} · ข้าม {skippedCount}
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
                      <th className="text-left px-3 py-2 font-medium text-surface-500">SKU</th>
                      <th className="text-left px-3 py-2 font-medium text-surface-500">ผล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {results.map((r, i) => (
                      <tr key={i} className={cn(r.status === 'failed' && 'bg-error-50/50', r.status === 'skipped' && 'bg-warning-50/30')}>
                        <td className="px-3 py-2 text-surface-400">{r.rowIndex}</td>
                        <td className="px-3 py-2 font-mono text-surface-700">{r.sku}</td>
                        <td className="px-3 py-2">
                          {r.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-success-600"><CheckCircle2 className="w-3 h-3" /> อัปเดตสำเร็จ</span>
                          ) : r.status === 'skipped' ? (
                            <span className="inline-flex items-center gap-1 text-warning-600"><X className="w-3 h-3" /> {r.error}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-error-600"><AlertCircle className="w-3 h-3" /> {r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { reset(); }}>
                <RefreshCw className="w-4 h-4" /> นำเข้าไฟล์ใหม่
              </Button>
              <Button onClick={handleClose}>
                <CheckCircle2 className="w-4 h-4" /> เสร็จสิ้น
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
