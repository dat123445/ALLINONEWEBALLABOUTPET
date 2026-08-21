import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, AlertCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cn } from '@/lib/format';
import { Spinner } from '@/components/ui';

export type VariantRow = {
  id: string;
  label: string;
  barcode: string;
  image_url: string | null;
  cost_price: number;
  retail_price: number;
  stock_qty: number;
};

type StockLotInfo = {
  id: string;
  lot_label: string;
  cost_price: number;
  retail_price?: number;
  branch_id?: string;
};

type VariantDraft = {
  id: string;
  label: string;
  barcode: string;
  image_url: string | null;
  cost_price: string;
  retail_price: string;
  stock_qty: number;
  lotCost: Record<string, string>;
  lotRetail: Record<string, string>;
};

export function EditPriceModal({ productId, productName, stockLots, branchId, onClose, onSaved, initialLotLabel }: {
  productId: string;
  productName: string;
  stockLots: StockLotInfo[];
  branchId: string | null;
  onClose: () => void;
  onSaved: () => void;
  initialLotLabel?: 'old' | 'new';
}) {
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [selectedLot, setSelectedLot] = useState<'old' | 'new'>(initialLotLabel ?? 'new');
  const [hasVariants, setHasVariants] = useState(false);

  const availableLots = useMemo(() => {
    const branchLots = branchId ? stockLots.filter((l) => l.branch_id === branchId) : stockLots;
    return {
      old: branchLots.find((l) => l.lot_label === 'old') ?? stockLots.find((l) => l.lot_label === 'old'),
      new: branchLots.find((l) => l.lot_label === 'new') ?? stockLots.find((l) => l.lot_label === 'new'),
    };
  }, [stockLots, branchId]);

  const hasBothLots = !!availableLots.old && !!availableLots.new;
  const hasAnyLot = !!availableLots.old || !!availableLots.new;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_barcodes')
        .select('id, label, barcode, image_url, cost_price, price, stock_qty')
        .eq('product_id', productId)
        .order('label');
      if (cancelled) return;
      if (error) {
        setToast({ type: 'error', msg: 'โหลดข้อมูลไม่สำเร็จ' });
        setLoading(false);
        return;
      }
      const rows: VariantDraft[] = (data as VariantRow[] ?? []).map((r) => ({
        id: r.id,
        label: r.label ?? '',
        barcode: r.barcode ?? '',
        image_url: r.image_url,
        cost_price: String(Number(r.cost_price) || 0),
        retail_price: String(Number(r.retail_price ?? (r as unknown as { price: number }).price) || 0),
        stock_qty: Number(r.stock_qty) || 0,
        lotCost: {},
        lotRetail: {},
      }));
      if (rows.length === 0) {
        rows.push({ id: '', label: 'สินค้าหลัก', barcode: '', image_url: null, cost_price: '0', retail_price: '0', stock_qty: 0, lotCost: {}, lotRetail: {} });
        setHasVariants(false);
      } else {
        setHasVariants(true);
      }
      setVariants(rows);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [productId]);

  function getLotCost(lot: StockLotInfo | undefined): string {
    if (!lot) return '0';
    return String(Number(lot.cost_price) || 0);
  }

  function getLotRetail(lot: StockLotInfo | undefined): string {
    if (!lot) return '0';
    return String(Number(lot.retail_price) || 0);
  }

  function getCurrentCost(v: VariantDraft): string {
    if (hasVariants) {
      return v.cost_price || '0';
    }
    const lotKey = selectedLot;
    if (v.lotCost[lotKey] != null && v.lotCost[lotKey] !== '') return v.lotCost[lotKey];
    const lot = lotKey === 'old' ? availableLots.old : availableLots.new;
    return lot ? getLotCost(lot) : '0';
  }

  function getCurrentRetail(v: VariantDraft): string {
    if (hasVariants) {
      return v.retail_price || '0';
    }
    const lotKey = selectedLot;
    if (v.lotRetail[lotKey] != null && v.lotRetail[lotKey] !== '') return v.lotRetail[lotKey];
    const lot = lotKey === 'old' ? availableLots.old : availableLots.new;
    return lot ? getLotRetail(lot) : '0';
  }

  function updateField(idx: number, field: 'cost_price' | 'retail_price', value: string) {
    setVariants((prev) => prev.map((v, i) => {
      if (i !== idx) return v;
      if (hasVariants) {
        return { ...v, [field]: value };
      }
      const lotKey = selectedLot;
      if (field === 'cost_price') return { ...v, lotCost: { ...v.lotCost, [lotKey]: value } };
      return { ...v, lotRetail: { ...v.lotRetail, [lotKey]: value } };
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (hasVariants) {
        for (const v of variants) {
          if (!v.id) continue;
          const cost = Number(v.cost_price) || 0;
          const retail = Number(v.retail_price) || 0;
          const { error } = await supabase
            .from('product_barcodes')
            .update({ cost_price: cost, price: retail })
            .eq('id', v.id);
          if (error) throw error;
          for (const label of ['old', 'new'] as const) {
            const { error: vlpError } = await supabase
              .from('variant_lot_prices')
              .upsert({ product_barcode_id: v.id, lot_label: label, cost_price: cost, retail_price: retail }, { onConflict: 'product_barcode_id,lot_label' });
            if (vlpError) throw vlpError;
          }
        }
      } else {
        const cost = Number(variants[0]?.lotCost[selectedLot] ?? variants[0]?.cost_price) || 0;
        const retail = Number(variants[0]?.lotRetail[selectedLot] ?? variants[0]?.retail_price) || 0;
        const targetLot = selectedLot === 'old' ? availableLots.old : availableLots.new;

        if (targetLot) {
          const { error } = await supabase
            .from('stock_lots')
            .update({ cost_price: cost, retail_price: retail })
            .eq('id', targetLot.id);
          if (error) throw error;
          const { error: prodError } = await supabase
            .from('products')
            .update({ cost_price: cost, retail_price: retail })
            .eq('id', productId);
          if (prodError) throw prodError;
        } else if (selectedLot === 'new' && !availableLots.new && availableLots.old) {
          const { error } = await supabase
            .from('stock_lots')
            .insert({
              product_id: productId,
              branch_id: branchId ?? availableLots.old.branch_id ?? null,
              lot_label: 'new',
              quantity: 0,
              cost_price: cost,
              retail_price: retail,
            });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('products')
            .update({ cost_price: cost, retail_price: retail })
            .eq('id', productId);
          if (error) throw error;
        }
      }
      setToast({ type: 'success', msg: 'บันทึกราคาเรียบร้อยแล้ว' });
      setTimeout(() => { onSaved(); }, 800);
    } catch {
      setToast({ type: 'error', msg: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' });
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return variants;
    const q = search.trim().toLowerCase();
    return variants.filter((v) => (v.label || '').toLowerCase().includes(q) || (v.barcode || '').toLowerCase().includes(q));
  }, [variants, search]);

  const priceRange = useMemo(() => {
    const prices = variants.map((v) => Number(getCurrentRetail(v)) || 0).filter((p) => p > 0);
    if (prices.length === 0) return '—';
    if (prices.length === 1) return formatCurrency(prices[0]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  }, [variants, selectedLot, availableLots]);

  const showLotToggle = hasAnyLot;
  const targetLotMissing = selectedLot === 'new' && !availableLots.new && !!availableLots.old;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[65] flex items-center justify-center bg-surface-950/50 backdrop-blur-sm p-3 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-surface-200 max-h-[calc(100vh-8rem)] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-surface-100 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-surface-900">แก้ไขราคา</h2>
              <p className="text-xs text-surface-400 mt-0.5 truncate">{productName} · ช่วงราคา: <span className="font-semibold text-primary-600">{priceRange}</span></p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-surface-400 hover:bg-surface-100 transition-colors shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Lot toggle */}
            {showLotToggle && (
              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-surface-50 border border-surface-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-surface-500" />
                  <span className="text-sm font-medium text-surface-700">เลือกล็อตที่จะแก้ไข</span>
                </div>
                <div className="inline-flex rounded-full border border-surface-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedLot('old')}
                    className={cn(
                      'rounded-full px-5 py-1.5 text-sm font-bold transition-all duration-200',
                      selectedLot === 'old'
                        ? 'bg-warning-500 text-white shadow-sm'
                        : availableLots.old ? 'text-warning-700 hover:bg-warning-50' : 'text-surface-300'
                    )}
                  >
                    ล็อตเก่า
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLot('new')}
                    className={cn(
                      'rounded-full px-5 py-1.5 text-sm font-bold transition-all duration-200',
                      selectedLot === 'new'
                        ? 'bg-success-500 text-white shadow-sm'
                        : availableLots.new ? 'text-success-700 hover:bg-success-50' : 'text-surface-300'
                    )}
                  >
                    ล็อตใหม่
                  </button>
                </div>
              </div>
            )}
            {targetLotMissing && (
              <div className="flex items-center gap-2 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-warning-600 shrink-0" />
                <span className="text-xs text-warning-700">ยังไม่มีข้อมูลล็อตใหม่ — กรอกราคาแล้วกดยืนยันเพื่อสร้างล็อตใหม่อัตโนมัติ</span>
              </div>
            )}

            {/* Search */}
            {variants.length > 4 && (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-base pl-11"
                  placeholder="ค้นหาตัวเลือกย่อยด้วยชื่อหรือ SKU..."
                />
              </div>
            )}

            {/* Variant table */}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm border border-surface-200 rounded-xl overflow-hidden" style={{ tableLayout: 'fixed', minWidth: 640 }}>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '140px' }} />
                </colgroup>
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-surface-500 bg-surface-50 border-b border-surface-200">
                    <th className="px-3 py-2.5 text-center">รูป</th>
                    <th className="px-3 py-2.5">ตัวเลือกย่อย / SKU</th>
                    <th className="px-3 py-2.5 text-right">ราคาทุน{hasAnyLot ? ` (ล็อต${selectedLot === 'old' ? 'เก่า' : 'ใหม่'})` : ''}</th>
                    <th className="px-3 py-2.5 text-right">ราคาขาย{hasAnyLot ? ` (ล็อต${selectedLot === 'old' ? 'เก่า' : 'ใหม่'})` : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-surface-400">ไม่พบตัวเลือกย่อยที่ตรงกับการค้นหา</td></tr>
                  )}
                  {filtered.map((v, i) => {
                    const realIdx = variants.indexOf(v);
                    const displayCost = getCurrentCost(v);
                    const displayRetail = getCurrentRetail(v);
                    return (
                      <tr key={v.id || i} className="bg-white hover:bg-surface-50/40 transition-colors">
                        <td className="px-3 py-2.5 text-center align-middle">
                          <div className="w-10 h-10 rounded-lg border border-surface-200 bg-surface-50 flex items-center justify-center overflow-hidden mx-auto">
                            {v.image_url ? <img src={v.image_url} alt={v.label} className="w-full h-full object-cover" /> : <span className="text-[10px] text-surface-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <p className="text-xs font-semibold text-surface-800 truncate">{v.label || 'ไม่ระบุชื่อ'}</p>
                          <p className="text-[10px] text-surface-400 font-mono truncate">{v.barcode || '—'}</p>
                          <p className="text-[10px] text-surface-400 mt-0.5">สต๊อก: {v.stock_qty}</p>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={displayCost}
                              onChange={(e) => updateField(realIdx, 'cost_price', e.target.value)}
                              className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums text-right"
                              placeholder={targetLotMissing ? 'กรอกทุนล็อตใหม่' : '0'}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={displayRetail}
                              onChange={(e) => updateField(realIdx, 'retail_price', e.target.value)}
                              className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums text-right"
                              placeholder={targetLotMissing ? 'กรอกราคาล็อตใหม่' : '0'}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="sticky bottom-0 bg-white border-t border-surface-100 px-5 py-4 flex justify-end gap-2.5 rounded-b-2xl">
            <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors">ยกเลิก</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}ยืนยัน
            </button>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] rounded-full px-5 py-3 text-sm font-medium text-white shadow-xl flex items-center gap-2 ${toast.type === 'success' ? 'bg-success-600' : 'bg-error-600'}`}>
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
