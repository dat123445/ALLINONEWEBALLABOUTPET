import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Check, ChevronDown, ChevronRight, Edit3, Image as ImageIcon, ImagePlus, Minus, Package, Plus, Save, Sparkles, Tag, Trash2, X, ZoomIn } from 'lucide-react';
import { EditPriceModal } from '@/components/EditPriceModal';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime, formatNumber, cn } from '@/lib/format';
import { Card, Button, Badge, Spinner } from '@/components/ui';

type ProductDetailProduct = {
  id: string;
  sku: string;
  name: string;
  name_en?: string | null;
  category: string | null;
  brand: string | null;
  description: string | null;
  note: string | null;
  unit: string | null;
  cost_price: number;
  retail_price: number;
  image_url: string | null;
  min_stock: number;
  is_active: boolean;
  stock_lots: { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; expiry_date?: string | null }[];
  product_barcodes?: { id: string; barcode: string; unit: string; unit_multiplier: number; label: string | null; image_url: string | null; cost_price: number | null; price: number | null; stock_qty: number | null; is_available: boolean | null; variant_lot_prices?: { id: string; lot_label: string; cost_price: number; retail_price: number }[] }[];
};

type VariantLotPrice = { old?: { cost_price: number; retail_price: number }; new?: { cost_price: number; retail_price: number } };

type PlatformSetting = { platform: string; margin_percent: number; platform_fee_percent: number; low_cost_margin_percent?: number; low_cost_fee_percent?: number; low_cost_threshold?: number; is_connected?: boolean };
type PlatformPrice = { product_id: string; lot_label: string; platform: string; price: number };
type Branch = { id: string; name: string };
type BranchStock = { id: string; name: string; quantity: number };
type InlineUpdate = (product: ProductDetailProduct, field: 'quantity' | 'retail' | 'platform', value: number, lotLabel: 'old' | 'new', platform?: string) => Promise<void>;

const CHANNELS = [
  { key: 'store', label: 'หน้าร้าน' },
  { key: 'lazada', label: 'Lazada' },
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok', label: 'TikTok Shop' },
  { key: 'line', label: 'LINE' },
];

const CHANNEL_CHIP_STYLES: Record<string, { colorVar: string; bgVar: string }> = {
  store: { colorVar: 'var(--color-surface-800)', bgVar: 'var(--color-surface-100)' },
  lazada: { colorVar: 'rgb(var(--ch-lazada) / 1)', bgVar: 'rgb(var(--ch-lazada-bg) / 1)' },
  shopee: { colorVar: 'rgb(var(--ch-shopee) / 1)', bgVar: 'rgb(var(--ch-shopee-bg) / 1)' },
  tiktok: { colorVar: 'rgb(var(--ch-tiktok) / 1)', bgVar: 'rgb(var(--ch-tiktok-bg) / 1)' },
  line: { colorVar: 'rgb(var(--ch-line) / 1)', bgVar: 'rgb(var(--ch-line-bg) / 1)' },
};

type BarcodeRow = {
  id?: string;
  barcode: string;
  unit: string;
  unit_multiplier: number;
  cost_price: number;
  price: number;
  stock_qty: number;
  is_available: boolean;
  label: string;
  image_url: string;
};

type ProductDetailVariant = {
  id: string;
  barcode: string;
  unit: string;
  unit_multiplier: number;
  label: string | null;
  image_url: string | null;
  cost_price: number | null;
  price: number | null;
  stock_qty: number | null;
  is_available: boolean | null;
  variant_lot_prices?: { id: string; lot_label: 'old' | 'new'; cost_price: number; retail_price: number }[];
};

type VariantPlatformPrice = { variant_id: string; platform: string; price: number };

function LotSegmentedControl({ selectedLotLabel, setSelectedLotLabel, show, hasOld, hasNew }: { selectedLotLabel: 'old' | 'new'; setSelectedLotLabel: React.Dispatch<React.SetStateAction<'old' | 'new'>>; show: boolean; hasOld: boolean; hasNew: boolean }) {
  if (!show) return null;
  return (
    <div className="inline-flex rounded-full border border-surface-200 bg-surface-50 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setSelectedLotLabel('old')}
        className={cn(
          'rounded-full px-5 py-1.5 text-sm font-bold transition-all duration-200',
          selectedLotLabel === 'old'
            ? 'bg-warning-500 text-white shadow-sm'
            : hasOld ? 'text-warning-700 hover:bg-warning-50' : 'text-surface-300'
        )}
      >
        ล็อตเก่า
      </button>
      <button
        type="button"
        onClick={() => setSelectedLotLabel('new')}
        className={cn(
          'rounded-full px-5 py-1.5 text-sm font-bold transition-all duration-200',
          selectedLotLabel === 'new'
            ? 'bg-success-500 text-white shadow-sm'
            : hasNew ? 'text-success-700 hover:bg-success-50' : 'text-surface-300'
        )}
      >
        ล็อตใหม่
      </button>
    </div>
  );
}

function LotInfoBadge({ lot, label }: { lot: { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number; expiry_date?: string | null } | undefined; label: 'old' | 'new' }) {
  if (!lot) return null;
  const isExpiringSoon = lot.expiry_date && new Date(lot.expiry_date) <= new Date(Date.now() + 30 * 86400000);
  return (
    <div className={cn('rounded-lg border p-3 space-y-1', label === 'old' ? 'border-warning-200 bg-warning-50/30' : 'border-success-200 bg-success-50/30')}>
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold', label === 'old' ? 'text-warning-700' : 'text-success-700')}>
          <span className={cn('w-2 h-2 rounded-full', label === 'old' ? 'bg-warning-500' : 'bg-success-500')} />
          {label === 'old' ? 'ล็อตเก่า' : 'ล็อตใหม่'}
        </span>
        <span className="font-mono font-bold text-surface-800 text-sm">{formatNumber(Number(lot.quantity))}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-surface-500">
        <span>ทุน: ฿{formatNumber(Number(lot.cost_price ?? 0))}</span>
        <span>ราคา: ฿{formatNumber(Number(lot.retail_price ?? 0))}</span>
        {lot.expiry_date && <span className={isExpiringSoon ? 'text-error-600 font-medium' : ''}>หมดอายุ: {lot.expiry_date.slice(0, 10)}{isExpiringSoon ? ' ⚠' : ''}</span>}
      </div>
    </div>
  );
}

type ProductImage = { id?: string; image_url: string; sort_order: number };

const UNIT_OPTIONS = [
  { value: 'piece', label: 'หน่วยเดี่ยว', multiplier: 1 },
  { value: 'dozen', label: 'หน่วยโหล', multiplier: 12 },
  { value: 'carton', label: 'หน่วยลัง', multiplier: 1 },
];

function money(value: number) {
  return `฿${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcPlatformPrice(cost: number, platform: string, settings: PlatformSetting[]): number {
  const setting = settings.find((s) => s.platform === platform);
  if (!setting) return 0;
  if (setting.is_connected === false) return 0;
  const c = Number(cost) || 0;
  if (c <= 0) return 0;
  const threshold = Number(setting.low_cost_threshold) || 100;
  const isLowCost = c < threshold;
  const margin = isLowCost
    ? Number(setting.low_cost_margin_percent) || Number(setting.margin_percent) || 0
    : Number(setting.margin_percent) || 0;
  const fee = isLowCost
    ? Number(setting.low_cost_fee_percent) || Number(setting.platform_fee_percent) || 0
    : Number(setting.platform_fee_percent) || 0;
  const denom = 1 - (margin + fee) / 100;
  return denom <= 0 ? 0 : Math.round(c / denom);
}

function InlineMoney({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || 0));
  useEffect(() => setDraft(String(value || 0)), [value]);
  function commit() {
    const next = Number(draft);
    if (Number.isFinite(next) && next >= 0) onSave(next);
    setEditing(false);
  }
  if (editing) return <input autoFocus type="number" min="0" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setEditing(false); }} className="w-32 h-9 px-3 rounded-full border border-primary-400 bg-white text-right font-mono font-bold text-primary-600 outline-none" />;
  return <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 h-9 px-4 rounded-full border border-surface-200 bg-white font-mono font-bold text-primary-600 hover:border-primary-400 transition-colors">{money(value)} <Edit3 className="w-3 h-3 text-surface-400" /></button>;
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="flex items-center gap-2 text-[15px] font-bold text-surface-900"><span className="w-1.5 h-1.5 rounded-full bg-primary-500" />{children}</h2>;
}

// ============ Content Score ============
function contentScore(name: string, nameEn: string, images: ProductImage[], brand: string, category: string, barcodes: BarcodeRow[]): number {
  let score = 0;
  if (name.trim().length >= 4) score += 20;
  else if (name.trim().length > 0) score += 10;
  if (nameEn.trim().length >= 4) score += 15;
  else if (nameEn.trim().length > 0) score += 8;
  if (images.length >= 5) score += 25;
  else if (images.length >= 3) score += 18;
  else if (images.length >= 1) score += 10;
  if (brand.trim()) score += 10;
  if (category.trim()) score += 10;
  const pricedUnits = barcodes.filter(b => b.price > 0).length;
  if (pricedUnits >= 3) score += 10;
  else if (pricedUnits >= 1) score += 6;
  const withBarcode = barcodes.filter(b => b.barcode.trim()).length;
  if (withBarcode >= 1) score += 10;
  return Math.min(100, score);
}

function DetailVariantImage({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.82)!);
      const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, blob, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      onChange(urlData.publicUrl);
    } catch { /* ignore */ } finally { setUploading(false); }
  }
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div
        className="w-10 h-10 rounded-lg border border-surface-200 bg-surface-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 transition-colors mx-auto"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <img src={value} alt="variant" className="w-full h-full object-cover" />
        ) : uploading ? (
          <span className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        ) : (
          <ImagePlus className="w-4 h-4 text-surface-400" />
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-error-500 text-white hover:bg-error-600"
          title="ลบรูป"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ============ Edit Product Modal ============
function EditProductModal({ product, onClose, onSaved }: { product: ProductDetailProduct; onClose: () => void; onSaved: () => void }) {
  const [editName, setEditName] = useState(product.name);
  const [editNameEn, setEditNameEn] = useState(product.name_en ?? '');
  const [editBrand, setEditBrand] = useState(product.brand ?? '');
  const [editCategory, setEditCategory] = useState(product.category ?? '');
  const [editSku, setEditSku] = useState(product.sku ?? '');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [imagesExpanded, setImagesExpanded] = useState(true);
  const [selectedLotLabel, setSelectedLotLabel] = useState<'old' | 'new'>('new');
  const [stockLots, setStockLots] = useState<{ id: string; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; quantity?: number; expiry_date?: string | null }[]>([]);
  const [variantLotPrices, setVariantLotPrices] = useState<VariantLotPrice[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(null), 3000); return () => window.clearTimeout(t); } }, [toast]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('timeout')), 10000);
        });
        const fetchPromise = (async () => {
          const [imgRes, bcRes, lotRes] = await Promise.all([
            supabase.from('product_images').select('id, image_url, sort_order').eq('product_id', product.id).order('sort_order'),
            supabase.from('product_barcodes').select('id, barcode, unit, unit_multiplier, cost_price, price, stock_qty, is_available, label, image_url').eq('product_id', product.id).order('unit_multiplier'),
            supabase.from('stock_lots').select('id, lot_label, cost_price, retail_price, branch_id, quantity, expiry_date').eq('product_id', product.id),
          ]);
          const bcIds = (bcRes.data ?? []).map((r: { id: string }) => r.id);
          let vlpData: { product_barcode_id: string; lot_label: string; cost_price: number; retail_price: number }[] = [];
          if (bcIds.length > 0) {
            const { data: vlpRes } = await supabase.from('variant_lot_prices').select('product_barcode_id, lot_label, cost_price, retail_price').in('product_barcode_id', bcIds);
            vlpData = (vlpRes as { product_barcode_id: string; lot_label: string; cost_price: number; retail_price: number }[] | null) ?? [];
          }
          return { imgRes, bcRes, lotRes, vlpData };
        })();
        const { imgRes, bcRes, lotRes, vlpData } = await Promise.race([fetchPromise, timeoutPromise]);
        if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = undefined; }
        if (cancelled) return;
        const vlpMap = new Map<string, VariantLotPrice>();
        vlpData.forEach((r) => {
          if (!vlpMap.has(r.product_barcode_id)) vlpMap.set(r.product_barcode_id, {});
          vlpMap.get(r.product_barcode_id)![r.lot_label as 'old' | 'new'] = { cost_price: Number(r.cost_price ?? 0), retail_price: Number(r.retail_price ?? 0) };
        });
        setStockLots((lotRes.data as { id: string; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; quantity?: number; expiry_date?: string | null }[] ?? []).map((r) => ({ id: r.id, lot_label: r.lot_label, cost_price: Number(r.cost_price ?? 0), retail_price: r.retail_price != null ? Number(r.retail_price) : undefined, branch_id: r.branch_id ?? undefined, quantity: Number(r.quantity ?? 0), expiry_date: r.expiry_date ?? null })));
        const lotList = (lotRes.data as { id: string; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; quantity?: number; expiry_date?: string | null }[] ?? []);
        const oldLot = lotList.find((l) => l.lot_label === 'old');
        const newLot = lotList.find((l) => l.lot_label === 'new');
        const imgs: ProductImage[] = (imgRes.data as { id: string; image_url: string; sort_order: number }[] ?? []).map((r) => ({ id: r.id, image_url: r.image_url, sort_order: r.sort_order }));
        if (product.image_url && !imgs.some((i) => i.image_url === product.image_url)) imgs.unshift({ image_url: product.image_url, sort_order: -1 });
        setImages(imgs);
        const bcs: BarcodeRow[] = (bcRes.data as { id: string; barcode: string; unit: string; unit_multiplier: number; cost_price: number; price: number; stock_qty: number; is_available: boolean; label: string | null; image_url: string | null }[] ?? []).map((r) => ({
          id: r.id, barcode: r.barcode, unit: r.unit, unit_multiplier: Number(r.unit_multiplier), cost_price: Number(r.cost_price ?? 0), price: Number(r.price ?? 0), stock_qty: Number(r.stock_qty ?? 0), is_available: r.is_available ?? true, label: r.label ?? '', image_url: r.image_url ?? '',
        }));
        if (bcs.length === 0) {
          const activeLot = selectedLotLabel === 'old' ? oldLot : newLot;
          const totalStockQty = lotList.reduce((sum, l) => sum + Number((l as { quantity?: number }).quantity ?? 0), 0);
          bcs.push({ barcode: product.sku ?? '', unit: 'piece', unit_multiplier: 1, cost_price: activeLot ? Number(activeLot.cost_price ?? 0) : (product.cost_price ?? 0), price: activeLot ? Number(activeLot.retail_price ?? product.retail_price ?? 0) : (product.retail_price ?? 0), stock_qty: totalStockQty, is_available: true, label: '', image_url: '' });
        }
        setBarcodes(bcs);
        setVariantLotPrices(bcs.map((bc) => vlpMap.get(bc.id ?? '') ?? {}));
        setLoading(false);
      } catch (err) {
        if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = undefined; }
        if (cancelled) return;
        const msg = err instanceof Error && err.message === 'timeout' ? 'โหลดข้อมูลนานเกินไป กรุณาปิดแล้วเปิดใหม่อีกครั้ง' : 'โหลดข้อมูลไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่อีกครั้ง';
        console.error('[EditProductModal] loadData error:', err);
        setErrorMsg(msg);
        setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; if (timeoutId) window.clearTimeout(timeoutId); };
  }, [product]);

  const score = contentScore(editName, editNameEn, images, editBrand, editCategory, barcodes);

  async function handleFileUpload(files: FileList) {
    if (!files || files.length === 0) return;
    const remaining = 9 - images.length;
    if (remaining <= 0) { setToast('อัปโหลดได้สูงสุด 9 รูป'); return; }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const newImages: ProductImage[] = [];
    for (const file of toUpload) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        newImages.push({ image_url: urlData.publicUrl, sort_order: images.length + newImages.length });
      } catch { setToast('อัปโหลดรูปไม่สำเร็จ'); }
    }
    setImages((prev) => [...prev, ...newImages]);
    setUploading(false);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index).map((img, i) => ({ ...img, sort_order: i })));
  }

  function updateBarcode(idx: number, field: keyof BarcodeRow, value: string | number | boolean) {
    setBarcodes((prev) => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  function addBarcodeRow() {
    setBarcodes((prev) => [...prev, { barcode: '', unit: 'custom', unit_multiplier: 1, cost_price: 0, price: 0, stock_qty: 0, is_available: true, label: '', image_url: '' }]);
    setVariantLotPrices((prev) => [...prev, {}]);
  }

  function removeBarcodeRow(idx: number) {
    if (barcodes[idx]?.id) {
      setConfirmDeleteIdx(idx);
    } else {
      setBarcodes((prev) => prev.filter((_, i) => i !== idx));
      setVariantLotPrices((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  function autoTranslate() {
    if (!editName.trim()) return;
    setEditNameEn((prev) => prev.trim() || editName.trim());
    setToast('สร้างชื่อภาษาอังกฤษจากชื่อไทยแล้ว (แก้ไขได้)');
  }

  async function handleSave() {
    setErrorMsg(null);

    // Validate main product SKU
    if (!editSku.trim()) {
      setErrorMsg('กรุณากรอกรหัส SKU ของสินค้าหลัก');
      setToast('กรุณากรอกรหัส SKU ของสินค้าหลัก');
      return;
    }

    // Validate variant barcodes: each manually-added variant must have a barcode/SKU
    const emptyVariantIdx = barcodes.findIndex((bc, idx) => !bc.id && !bc.barcode.trim());
    if (emptyVariantIdx !== -1) {
      const msg = `กรุณากรอกบาร์โค้ด/SKU ของตัวเลือกย่อยแถวที่ ${emptyVariantIdx + 1}`;
      setErrorMsg(msg);
      setToast(msg);
      return;
    }

    setSaving(true);
    try {
      const { error: pErr } = await supabase.from('products').update({
        name: editName.trim(),
        name_en: editNameEn.trim() || null,
        brand: editBrand.trim() || null,
        category: editCategory.trim() || null,
        sku: editSku.trim() || null,
        image_url: images[0]?.image_url ?? null,
      }).eq('id', product.id);
      if (pErr) throw pErr;

      const primaryUrl = images[0]?.image_url ?? null;
      if (primaryUrl && product.image_url !== primaryUrl) {
        await supabase.from('products').update({ image_url: primaryUrl }).eq('id', product.id);
      }

      await supabase.from('product_images').delete().eq('product_id', product.id);
      if (images.length > 0) {
        const rows = images.map((img, i) => ({ product_id: product.id, image_url: img.image_url, sort_order: i }));
        await supabase.from('product_images').insert(rows);
      }

      const { data: existingBcs } = await supabase.from('product_barcodes').select('id').eq('product_id', product.id);
      const existingIds = new Set((existingBcs as { id: string }[] ?? []).map((b) => b.id));
      const keptIds = new Set(barcodes.filter((b) => b.id).map((b) => b.id!));
      const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
      if (toDelete.length > 0) await supabase.from('product_barcodes').delete().in('id', toDelete);
      const insertedIds: string[] = [];
      for (let i = 0; i < barcodes.length; i++) {
        const bc = barcodes[i];
        if (bc.id) {
          await supabase.from('product_barcodes').update({ barcode: bc.barcode, unit: bc.unit, unit_multiplier: bc.unit_multiplier, cost_price: bc.cost_price, price: bc.price, stock_qty: bc.stock_qty, is_available: bc.is_available, label: bc.label.trim() || null, image_url: bc.image_url || null }).eq('id', bc.id);
        } else {
          const { data: ins } = await supabase.from('product_barcodes').insert({ product_id: product.id, barcode: bc.barcode || `${product.sku}-${bc.unit}`, unit: bc.unit, unit_multiplier: bc.unit_multiplier, cost_price: bc.cost_price, price: bc.price, stock_qty: bc.stock_qty, is_available: bc.is_available, label: bc.label.trim() || null, image_url: bc.image_url || null }).select('id');
          if (ins?.[0]?.id) insertedIds.push(ins[0].id);
        }
      }
      // Save per-lot prices for each variant
      const allBarcodeIds = barcodes.map((bc) => bc.id).filter(Boolean) as string[];
      allBarcodeIds.push(...insertedIds);
      for (let i = 0; i < barcodes.length; i++) {
        const bcId = barcodes[i].id ?? insertedIds.shift() ?? null;
        if (!bcId) continue;
        const vlp = variantLotPrices[i];
        if (!vlp) continue;
        for (const label of ['old', 'new'] as const) {
          const lotData = vlp[label];
          const cp = lotData?.cost_price ?? Number(barcodes[i].cost_price ?? 0);
          const rp = lotData?.retail_price ?? Number(barcodes[i].price ?? 0);
          await supabase.from('variant_lot_prices').upsert({ product_barcode_id: bcId, lot_label: label, cost_price: cp, retail_price: rp }, { onConflict: 'product_barcode_id,lot_label' });
        }
      }
      for (const lot of stockLots) {
        if (lot.id) {
          await supabase.from('stock_lots').update({ cost_price: Number(lot.cost_price ?? 0), retail_price: Number(lot.retail_price ?? 0), quantity: Number(lot.quantity ?? 0), expiry_date: lot.expiry_date || null }).eq('id', lot.id);
        } else if (lot.lot_label === 'new' && stockLots.find((l) => l.lot_label === 'old')) {
          const oldLotRef = stockLots.find((l) => l.lot_label === 'old');
          await supabase.from('stock_lots').insert({ product_id: product.id, branch_id: oldLotRef?.branch_id ?? null, lot_label: 'new', quantity: Number(lot.quantity ?? 0), cost_price: Number(lot.cost_price ?? 0), retail_price: Number(lot.retail_price ?? 0), expiry_date: lot.expiry_date || null });
        }
      }
      setToast('บันทึกข้อมูลสินค้าเรียบร้อยแล้ว');
      setSaving(false);
      onSaved();
    } catch (err: any) {
      const msg = err?.message?.includes('sku') || err?.message?.includes('duplicate')
        ? 'บันทึกไม่สำเร็จ: รหัส SKU หรือบาร์โค้ดอาจซ้ำกับสินค้าอื่น'
        : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
      setToast(msg);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-surface-950/50 backdrop-blur-sm p-3 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-surface-200 max-h-[calc(100vh-8rem)] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-surface-100 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-bold text-surface-900 shrink-0">แก้ไขสินค้า</h2>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 rounded-full bg-surface-50 px-2.5 py-1">
                  <span className="text-xs font-bold text-surface-700">{score}/100</span>
                  <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', score >= 80 ? 'bg-success-500' : score >= 50 ? 'bg-warning-500' : 'bg-error-500')} style={{ width: `${score}%` }} />
                  </div>
                  <span className={cn('text-[10px] font-semibold', score >= 80 ? 'text-success-600' : score >= 50 ? 'text-warning-600' : 'text-error-600')}>{score >= 80 ? 'ผ่านเกณฑ์' : score >= 50 ? 'ยังไม่ผ่าน' : 'ต้องปรับปรุง'}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-surface-400 hover:bg-surface-100 transition-colors shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm font-medium text-error-600">{errorMsg}</p>
            <Button variant="secondary" onClick={onClose} className="rounded-full">ปิด</Button>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-6">
            {/* Image Upload Grid */}
            <div>
              <button type="button" onClick={() => setImagesExpanded((v) => !v)} className="flex items-center justify-between w-full mb-2 group">
                <span className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                  <ChevronDown className={cn('w-4 h-4 text-surface-400 transition-transform duration-300', !imagesExpanded && '-rotate-90')} />
                  รูปภาพสินค้า
                </span>
                <span className="text-xs font-medium text-surface-500">{images.length}/9</span>
              </button>
              <div className={cn('grid grid-cols-3 sm:grid-cols-4 gap-2.5 overflow-hidden transition-all duration-300 ease-in-out', imagesExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-surface-200 bg-surface-50 group">
                    <img src={img.image_url} alt={`product-${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-surface-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-primary-600 text-white text-[9px] font-bold px-1.5 py-0.5">หลัก</span>}
                  </div>
                ))}
                {images.length < 9 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="aspect-square rounded-xl border-2 border-dashed border-surface-300 hover:border-primary-400 hover:bg-primary-50 flex flex-col items-center justify-center gap-1.5 text-surface-400 hover:text-primary-500 transition-colors">
                    {uploading ? <Spinner size="sm" /> : <><Plus className="w-6 h-6" /><span className="text-[10px] font-medium">เพิ่มรูป</span></>}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = ''; }} />
            </div>
            {imagesExpanded && <div className="-mt-4" />}

            {/* Product Name + EN */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">ชื่อสินค้า</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-base" placeholder="กรอกชื่อสินค้า" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-surface-700">ชื่อสินค้า (ภาษาอังกฤษ)</label>
                  <button type="button" onClick={autoTranslate} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                    <Sparkles className="w-3.5 h-3.5" /> สร้างชื่ออีกภาษาอัตโนมัติ
                  </button>
                </div>
                <input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className="input-base" placeholder="Product name in English" />
              </div>
            </div>

            {/* Brand + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">ยี่ห้อ (Brand)</label>
                <input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} className="input-base" placeholder="เช่น Royal Canin" list="brand-list" />
                <datalist id="brand-list"><option value="Royal Canin" /><option value="Pedigree" /><option value="Whiskas" /><option value="SmartHeart" /><option value="Me-O" /></datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">หมวดหมู่</label>
                <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="input-base" placeholder="เช่น อาหารสัตว์" list="category-list" />
                <datalist id="category-list"><option value="อาหารสัตว์" /><option value="ขนม" /><option value="อาหารเปียก" /><option value=" accessories" /><option value="สุขอนามัย" /></datalist>
              </div>
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">รหัสสินค้า (SKU)</label>
              <input value={editSku} onChange={(e) => setEditSku(e.target.value)} className="input-base font-mono" placeholder="กรอกรหัส SKU ของสินค้า" />
            </div>

            {/* Lot Cost/Price/Stock Fields */}
            {stockLots.length > 0 && (
              <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3">
                <label className="block text-sm font-semibold text-surface-700">ข้อมูลแยกตามล็อต (ราคา · จำนวน · วันหมดอายุ)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['old', 'new'] as const).map((label) => {
                    const lot = stockLots.find((l) => l.lot_label === label);
                    const exists = !!lot;
                    return (
                      <div key={label} className={cn('rounded-lg border p-3 space-y-2', label === 'old' ? 'border-warning-200 bg-warning-50/30' : 'border-success-200 bg-success-50/30')}>
                        <div className="flex items-center justify-between">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold', label === 'old' ? 'text-warning-700' : 'text-success-700')}>
                            <span className={cn('w-2 h-2 rounded-full', label === 'old' ? 'bg-warning-500' : 'bg-success-500')} />
                            {label === 'old' ? 'ล็อตเก่า' : 'ล็อตใหม่'}
                          </span>
                          {!exists && <span className="text-[10px] text-surface-400">ยังไม่มีล็อตนี้</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-surface-500 mb-0.5">ราคาทุน</label>
                            <div className="relative">
                              <input type="number" min="0" value={lot ? Number(lot.cost_price ?? 0) : ''} onChange={(e) => {
                                const val = Number(e.target.value);
                                setStockLots((prev) => {
                                  const existing = prev.find((l) => l.lot_label === label);
                                  if (existing) return prev.map((l) => l.lot_label === label ? { ...l, cost_price: val } : l);
                                  return [...prev, { id: '', lot_label: label, cost_price: val, retail_price: 0, branch_id: stockLots.find((l) => l.lot_label === 'old')?.branch_id, quantity: 0, expiry_date: null }];
                                });
                                if (selectedLotLabel === label && barcodes.length === 1 && !barcodes[0].id) setBarcodes((prev) => prev.map((b, i) => i === 0 ? { ...b, cost_price: val } : b));
                              }} className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums" placeholder="0" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-surface-500 mb-0.5">ราคาขาย</label>
                            <div className="relative">
                              <input type="number" min="0" value={lot && lot.retail_price != null ? Number(lot.retail_price) : ''} onChange={(e) => {
                                const val = Number(e.target.value);
                                setStockLots((prev) => {
                                  const existing = prev.find((l) => l.lot_label === label);
                                  if (existing) return prev.map((l) => l.lot_label === label ? { ...l, retail_price: val } : l);
                                  return [...prev, { id: '', lot_label: label, cost_price: 0, retail_price: val, branch_id: stockLots.find((l) => l.lot_label === 'old')?.branch_id, quantity: 0, expiry_date: null }];
                                });
                                if (selectedLotLabel === label && barcodes.length === 1 && !barcodes[0].id) setBarcodes((prev) => prev.map((b, i) => i === 0 ? { ...b, price: val } : b));
                              }} className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums" placeholder="0" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-surface-500 mb-0.5">จำนวนคงเหลือ</label>
                            <input type="number" min="0" value={lot ? Number(lot.quantity ?? 0) : ''} onChange={(e) => {
                              const val = Number(e.target.value);
                              setStockLots((prev) => {
                                const existing = prev.find((l) => l.lot_label === label);
                                if (existing) return prev.map((l) => l.lot_label === label ? { ...l, quantity: val } : l);
                                return [...prev, { id: '', lot_label: label, cost_price: 0, retail_price: 0, branch_id: stockLots.find((l) => l.lot_label === 'old')?.branch_id, quantity: val, expiry_date: null }];
                              });
                            }} className="input-base !py-1.5 !text-xs !px-2.5 w-full font-mono tabular-nums" placeholder="0" disabled={!exists} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-surface-500 mb-0.5">วันหมดอายุ</label>
                            <input type="date" value={lot?.expiry_date ? String(lot.expiry_date).slice(0, 10) : ''} onChange={(e) => {
                              const val = e.target.value || null;
                              setStockLots((prev) => {
                                const existing = prev.find((l) => l.lot_label === label);
                                if (existing) return prev.map((l) => l.lot_label === label ? { ...l, expiry_date: val } : l);
                                return [...prev, { id: '', lot_label: label, cost_price: 0, retail_price: 0, branch_id: stockLots.find((l) => l.lot_label === 'old')?.branch_id, quantity: 0, expiry_date: val }];
                              });
                            }} className="input-base !py-1.5 !text-xs !px-2.5 w-full" disabled={!exists} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price / Stock / Barcode Table */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <label className="text-sm font-semibold text-surface-700">ตัวเลือกย่อยของสินค้า</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {stockLots.length > 0 && (
                    <div className="inline-flex rounded-full border border-surface-200 bg-surface-50 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedLotLabel('old')}
                        className={cn(
                          'rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200',
                          selectedLotLabel === 'old'
                            ? 'bg-warning-500 text-white shadow-sm'
                            : 'text-warning-700 hover:bg-warning-50'
                        )}
                      >
                        ล็อตเก่า
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLotLabel('new')}
                        className={cn(
                          'rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200',
                          selectedLotLabel === 'new'
                            ? 'bg-success-500 text-white shadow-sm'
                            : 'text-success-700 hover:bg-success-50'
                        )}
                      >
                        ล็อตใหม่
                      </button>
                    </div>
                  )}
                  {barcodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPriceEditModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-50/50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50 hover:border-primary-400 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" /> แก้ไขราคาทั้งหมด
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm border border-surface-200 rounded-xl overflow-hidden" style={{ tableLayout: 'fixed', minWidth: 780 }}>
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '64px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '72px' }} />
                    <col style={{ width: '44px' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-surface-500 bg-surface-50 border-b border-surface-200">
                      <th className="px-3 py-2.5">ชื่อตัวเลือกย่อย</th>
                      <th className="px-1 py-2.5 text-center">รูปภาพ</th>
                      <th className="px-3 py-2.5 text-right">ราคาทุน</th>
                      <th className="px-3 py-2.5 text-right">ราคาขาย</th>
                      <th className="px-3 py-2.5">บาร์โค้ด/SKU</th>
                      <th className="px-3 py-2.5 text-right">จำนวนสต๊อก</th>
                      <th className="px-3 py-2.5 text-center">หน่วยนับ</th>
                      <th className="px-1 py-2.5 text-center">เปิด/ปิด</th>
                      <th className="px-1 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {barcodes.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-surface-400">ยังไม่มีตัวเลือกย่อย กดปุ่มด้านล่างเพื่อเพิ่ม</td></tr>
                    )}
                    {barcodes.map((bc, idx) => (
                      <tr key={idx} className="bg-white hover:bg-surface-50/40 transition-colors">
                        <td className="px-3 py-2.5 align-middle">
                          <input value={bc.label} onChange={(e) => updateBarcode(idx, 'label', e.target.value)} placeholder="เช่น แซมพูแมว 300มล." className="input-base !py-1.5 !px-2.5 !text-xs w-full" />
                        </td>
                        <td className="px-1 py-2.5 text-center align-middle">
                          <DetailVariantImage value={bc.image_url} onChange={(url) => updateBarcode(idx, 'image_url', url)} />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="relative">
                            <input type="number" min="0" value={(variantLotPrices[idx]?.[selectedLotLabel]?.cost_price ?? bc.cost_price) || ''} onChange={(e) => setVariantLotPrices((prev) => prev.map((p, i) => i === idx ? { ...p, [selectedLotLabel]: { cost_price: Number(e.target.value), retail_price: p[selectedLotLabel]?.retail_price ?? Number(bc.price ?? 0) } } : p))} className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums" placeholder="0" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="relative">
                            <input type="number" min="0" value={(variantLotPrices[idx]?.[selectedLotLabel]?.retail_price ?? bc.price) || ''} onChange={(e) => setVariantLotPrices((prev) => prev.map((p, i) => i === idx ? { ...p, [selectedLotLabel]: { cost_price: p[selectedLotLabel]?.cost_price ?? Number(bc.cost_price ?? 0), retail_price: Number(e.target.value) } } : p))} className="input-base !py-1.5 !text-xs !px-2.5 !pr-6 w-full font-mono tabular-nums" placeholder="0" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">฿</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <input value={bc.barcode} onChange={(e) => updateBarcode(idx, 'barcode', e.target.value)} className="input-base !py-1.5 !text-xs !px-2.5 w-full font-mono" placeholder="บาร์โค้ด/SKU" />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <input type="number" min="0" value={bc.stock_qty || ''} onChange={(e) => updateBarcode(idx, 'stock_qty', Number(e.target.value))} className="input-base !py-1.5 !text-xs !px-2.5 w-full font-mono tabular-nums text-right" placeholder="0" />
                        </td>
                        <td className="px-3 py-2.5 align-middle text-center">
                          <select value={bc.unit} onChange={(e) => { const opt = UNIT_OPTIONS.find(o => o.value === e.target.value); updateBarcode(idx, 'unit', e.target.value); if (opt) updateBarcode(idx, 'unit_multiplier', opt.multiplier); }} className="input-base !py-1.5 !text-xs !px-2 w-full">
                            {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            {bc.unit === 'custom' && <option value="custom">กำหนดเอง</option>}
                          </select>
                        </td>
                        <td className="px-1 py-2.5 text-center align-middle">
                          <button type="button" onClick={() => updateBarcode(idx, 'is_available', !bc.is_available)} className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0 mx-auto', bc.is_available ? 'bg-primary-500' : 'bg-surface-300')}>
                            <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', bc.is_available ? 'left-[18px]' : 'left-0.5')} />
                          </button>
                        </td>
                        <td className="px-1 py-2.5 text-center align-middle">
                          <button type="button" onClick={() => removeBarcodeRow(idx)} className="w-7 h-7 rounded-lg text-error-400 hover:bg-error-50 hover:text-error-600 flex items-center justify-center transition-colors shrink-0 mx-auto">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addBarcodeRow} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50/50 px-3 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 hover:border-primary-400 transition-colors">
                <Plus className="w-3.5 h-3.5" /> เพิ่มตัวเลือกย่อย
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="sticky bottom-0 bg-white border-t border-surface-100 px-5 py-4 flex justify-end gap-2.5 rounded-b-2xl">
            <Button variant="secondary" onClick={onClose} className="rounded-full">ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()} className="rounded-full">
              {saving ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}ยืนยัน
            </Button>
          </div>
        )}

        {confirmDeleteIdx !== null && (
          <div className="fixed inset-x-0 bottom-0 top-16 z-[70] flex items-center justify-center bg-surface-950/40 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteIdx(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-error-50 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-error-500" /></div>
                <h3 className="text-base font-bold text-surface-900">ลบตัวเลือกย่อย?</h3>
              </div>
              <p className="text-sm text-surface-500 mb-5">ตัวเลือกย่อยนี้จะถูกลบออกจากระบบ ไม่สามารถกู้คืนได้</p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setConfirmDeleteIdx(null)} className="!rounded-full">ยกเลิก</Button>
                <Button onClick={() => { if (confirmDeleteIdx !== null) { setBarcodes((prev) => prev.filter((_, i) => i !== confirmDeleteIdx)); setVariantLotPrices((prev) => prev.filter((_, i) => i !== confirmDeleteIdx)); setConfirmDeleteIdx(null); } }} className="!rounded-full !bg-error-500 hover:!bg-error-600"><Trash2 className="w-4 h-4" />ลบ</Button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-surface-900 px-5 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
      </div>
    </div>
  );
}

export function ProductDetailView({ product, onBack, platformSettings, platformPrices, profileId, profileName, onSaved, onDeleted, onInlineUpdate, branches, activeBranchId, initialLotLabel }: {
  product: ProductDetailProduct;
  onBack: () => void;
  platformSettings: PlatformSetting[];
  platformPrices: PlatformPrice[];
  profileId?: string;
  profileName?: string;
  onSaved: () => void;
  onDeleted: () => void;
  onInlineUpdate: InlineUpdate;
  branches: Branch[];
  activeBranchId?: string | null;
  initialLotLabel?: 'old' | 'new';
}) {
  const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
  const [variantBranchStocks, setVariantBranchStocks] = useState<Map<string, Map<string, number>>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [selectedImage, setSelectedImage] = useState(product.image_url ?? '');
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });
  const [draftQuantity, setDraftQuantity] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>(product.image_url ? [product.image_url] : []);
  const [variants, setVariants] = useState<ProductDetailVariant[]>([]);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [variantPlatformPrices, setVariantPlatformPrices] = useState<VariantPlatformPrice[]>([]);
  const [variantLotPrices, setVariantLotPrices] = useState<Map<string, { old?: { cost_price: number; retail_price: number }; new?: { cost_price: number; retail_price: number } }>>(new Map());
  const [selectedLotLabel, setSelectedLotLabel] = useState<'old' | 'new'>(() => {
    if (initialLotLabel) return initialLotLabel;
    const lots = product.stock_lots ?? [];
    return lots.find((l) => l.lot_label === 'new') ? 'new' : lots.find((l) => l.lot_label === 'old') ? 'old' : 'new';
  });

  const hasVariants = variants.length > 0;
  const activeVariant = hasVariants ? variants[selectedVariantIdx] : null;

  const branchLots = product.stock_lots.filter((lot) => lot.branch_id === activeBranchId);
  const oldLot = branchLots.find((lot) => lot.lot_label === 'old') ?? product.stock_lots.find((lot) => lot.lot_label === 'old');
  const newLot = branchLots.find((lot) => lot.lot_label === 'new') ?? product.stock_lots.find((lot) => lot.lot_label === 'new');
  const hasBothLots = !!oldLot && !!newLot;
  const hasAnyLot = !!oldLot || !!newLot;
  const activeLot = hasBothLots
    ? (selectedLotLabel === 'old' ? oldLot : newLot)
    : (newLot ?? oldLot ?? product.stock_lots[0]);
  const getVariantBranchQty = (variantId: string, branchId: string | null): number | null => {
    const branchMap = variantBranchStocks.get(variantId);
    if (!branchMap) return null;
    if (branchId) return branchMap.get(branchId) ?? 0;
    let total = 0; let hasAny = false;
    branchMap.forEach((q) => { total += q; hasAny = true; });
    return hasAny ? total : null;
  };
  const currentQuantity = activeVariant
    ? (getVariantBranchQty(activeVariant.id, activeBranchId) ?? Number(activeVariant.stock_qty ?? 0))
    : (branchStocks.find((branch) => branch.id === activeBranchId)?.quantity ?? Number(activeLot?.quantity ?? 0));
  const activeVariantLotData = activeVariant ? variantLotPrices.get(activeVariant.id) : null;
  const activeVariantLotPrice = activeVariantLotData?.[selectedLotLabel];
  const cost = activeVariant
    ? Number(activeVariantLotPrice?.cost_price ?? activeVariant.cost_price ?? product.cost_price ?? 0)
    : Number(activeLot?.cost_price ?? product.cost_price ?? 0);
  const displaySku = activeVariant ? (activeVariant.barcode || product.sku) : product.sku;

  const channelPrices = useMemo(() => {
    if (activeVariant) {
      const variantCost = Number(activeVariantLotPrice?.cost_price ?? activeVariant.cost_price ?? product.cost_price ?? 0);
      return CHANNELS.map((channel) => {
        if (channel.key === 'store') return { ...channel, price: Number(activeVariantLotPrice?.retail_price ?? activeVariant.price ?? 0) };
        const found = variantPlatformPrices.find((item) => item.variant_id === activeVariant.id && item.platform === channel.key);
        if (found && Number(found.price) > 0) return { ...channel, price: Number(found.price) };
        return { ...channel, price: calcPlatformPrice(variantCost, channel.key, platformSettings) };
      });
    }
    return CHANNELS.map((channel) => {
      if (channel.key === 'store') return { ...channel, price: Number(activeLot?.retail_price ?? product.retail_price ?? 0) };
      const found = platformPrices.find((item) => item.product_id === product.id && item.lot_label === (activeLot?.lot_label ?? 'new') && item.platform === channel.key);
      if (found && Number(found.price) > 0) return { ...channel, price: Number(found.price) };
      return { ...channel, price: calcPlatformPrice(cost, channel.key, platformSettings) };
    });
  }, [activeVariant, activeVariantLotPrice, variantPlatformPrices, activeLot, platformPrices, product, cost, platformSettings]);
  const averageSellingPrice = channelPrices.filter((channel) => channel.price > 0).reduce((sum, channel) => sum + channel.price, 0) / Math.max(channelPrices.filter((channel) => channel.price > 0).length, 1);
  const margin = averageSellingPrice > 0 ? Math.round(((averageSellingPrice - cost) / averageSellingPrice) * 100) : 0;
  const variantBranchRows: BranchStock[] = activeVariant
    ? branches.map((b) => ({ id: b.id, name: b.name, quantity: getVariantBranchQty(activeVariant.id, b.id) ?? 0 }))
    : branchStocks;
  const maxStock = activeVariant
    ? Math.max(...variants.map((v) => getVariantBranchQty(v.id, null) ?? Number(v.stock_qty ?? 0)), ...variantBranchRows.map((r) => r.quantity), 1)
    : Math.max(...branchStocks.map((branch) => branch.quantity), 1);
  const totalStock = activeVariant
    ? (getVariantBranchQty(activeVariant.id, null) ?? Number(activeVariant.stock_qty ?? 0))
    : branchStocks.reduce((sum, branch) => sum + branch.quantity, 0);

  useEffect(() => {
    const v = (product.product_barcodes ?? []).filter((bc) => bc.is_available !== false);
    setVariants(v);
    setSelectedVariantIdx(0);
  }, [product.id, product.product_barcodes]);

  useEffect(() => {
    if (variants.length === 0) { setVariantPlatformPrices([]); return; }
    let cancelled = false;
    async function loadVariantPrices() {
      const ids = variants.map((v) => v.id);
      const { data } = await supabase.from('product_platform_prices').select('variant_id, platform, price').in('variant_id', ids);
      if (cancelled) return;
      setVariantPlatformPrices((data as VariantPlatformPrice[]) ?? []);
    }
    loadVariantPrices();
    return () => { cancelled = true; };
  }, [variants]);

  useEffect(() => {
    const map = new Map<string, { old?: { cost_price: number; retail_price: number }; new?: { cost_price: number; retail_price: number } }>();
    variants.forEach((variant) => {
      const prices = variant.variant_lot_prices ?? [];
      const entry: { old?: { cost_price: number; retail_price: number }; new?: { cost_price: number; retail_price: number } } = {};
      prices.forEach((price) => {
        entry[price.lot_label] = { cost_price: Number(price.cost_price ?? 0), retail_price: Number(price.retail_price ?? 0) };
      });
      map.set(variant.id, entry);
    });
    setVariantLotPrices(map);
  }, [variants]);

  useEffect(() => {
    if (activeVariant?.image_url) {
      setSelectedImage(activeVariant.image_url);
    } else {
      setSelectedImage(galleryImages[0] ?? '');
    }
    if (activeVariant) {
      setDraftQuantity(Number(activeVariant.stock_qty ?? 0));
    } else {
      setDraftQuantity(Number(activeLot?.quantity ?? product.stock_lots.find((lot) => lot.branch_id === activeBranchId)?.quantity ?? product.stock_lots[0]?.quantity ?? 0));
    }
  }, [product, activeBranchId, galleryImages, activeVariant, selectedLotLabel, activeLot]);

  async function reloadGallery() {
    const { data } = await supabase.from('product_images').select('image_url').eq('product_id', product.id).order('sort_order');
    const urls = (data as { image_url: string }[] ?? []).map((r) => r.image_url);
    const all = product.image_url && !urls.includes(product.image_url) ? [product.image_url, ...urls] : urls;
    setGalleryImages(all);
  }

  useEffect(() => { reloadGallery(); }, [product.id, product.image_url]);

  useEffect(() => {
    let cancelled = false;
    async function loadBranchStocks() {
      setLoadingStocks(true);
      const { data } = await supabase.from('stock_lots').select('branch_id, quantity, created_at').eq('product_id', product.id);
      if (cancelled) return;
      const quantities = new Map<string, number>();
      let newest: string | null = null;
      (data as { branch_id: string | null; quantity: number; created_at?: string }[] ?? []).forEach((lot) => {
        if (lot.branch_id) quantities.set(lot.branch_id, (quantities.get(lot.branch_id) ?? 0) + Number(lot.quantity));
        if (lot.created_at && (!newest || lot.created_at > newest)) newest = lot.created_at;
      });
      setBranchStocks(branches.map((branch) => ({ id: branch.id, name: branch.name, quantity: quantities.get(branch.id) ?? 0 })));
      setLastUpdated(newest);
      setLoadingStocks(false);
    }
    loadBranchStocks();
    return () => { cancelled = true; };
  }, [branches, product.id]);

  useEffect(() => {
    if (variants.length === 0) { setVariantBranchStocks(new Map()); return; }
    let cancelled = false;
    async function loadVariantBranchStocks() {
      const ids = variants.map((v) => v.id);
      const { data } = await supabase.from('variant_branch_stock').select('variant_id, branch_id, quantity').in('variant_id', ids);
      if (cancelled) return;
      const vbsMap = new Map<string, Map<string, number>>();
      (data as { variant_id: string; branch_id: string; quantity: number }[] ?? []).forEach((r) => {
        if (!vbsMap.has(r.variant_id)) vbsMap.set(r.variant_id, new Map());
        vbsMap.get(r.variant_id)!.set(r.branch_id, Number(r.quantity));
      });
      setVariantBranchStocks(vbsMap);
    }
    loadVariantBranchStocks();
    return () => { cancelled = true; };
  }, [variants]);

  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(null), 3500); return () => window.clearTimeout(timer); } }, [toast]);

  // Product sales trend (last 30 days)
  const [salesTrend, setSalesTrend] = useState<{ date: string; qty: number; revenue: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadSalesTrend() {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('stock_movements')
        .select('quantity, unit_price, discount_amount, created_at')
        .eq('product_id', product.id)
        .in('movement_type', ['withdraw', 'transfer_out'])
        .gte('created_at', since.toISOString());
      if (cancelled || !data) return;
      const dailyMap = new Map<string, { qty: number; revenue: number }>();
      (data as { quantity: number; unit_price: number; discount_amount: number; created_at: string }[]).forEach((m) => {
        const dt = m.created_at.slice(0, 10);
        const entry = dailyMap.get(dt) ?? { qty: 0, revenue: 0 };
        entry.qty += Number(m.quantity ?? 0);
        entry.revenue += Number(m.quantity ?? 0) * Number(m.unit_price ?? 0) - Number(m.discount_amount ?? 0);
        dailyMap.set(dt, entry);
      });
      const trend: { date: string; qty: number; revenue: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dt = d.toISOString().slice(0, 10);
        const e = dailyMap.get(dt) ?? { qty: 0, revenue: 0 };
        trend.push({ date: dt, qty: e.qty, revenue: Math.round(e.revenue) });
      }
      setSalesTrend(trend);
    }
    loadSalesTrend();
    return () => { cancelled = true; };
  }, [product.id]);

  async function saveStock() {
    if (!Number.isFinite(draftQuantity) || draftQuantity < 0) return;
    if (activeVariant) {
      const { error } = await supabase.from('product_barcodes').update({ stock_qty: draftQuantity }).eq('id', activeVariant.id);
      if (error) { setToast('บันทึกสต๊อกไม่สำเร็จ'); return; }
      setVariants((prev) => prev.map((v, i) => i === selectedVariantIdx ? { ...v, stock_qty: draftQuantity } : v));
      setToast('บันทึกสต๊อกเรียบร้อยแล้ว');
      onSaved();
      return;
    }
    if (!activeLot) return;
    const { error } = await supabase.from('stock_lots').update({ quantity: draftQuantity }).eq('id', activeLot.id);
    if (error) { setToast('บันทึกสต๊อกไม่สำเร็จ'); return; }
    setBranchStocks((current) => current.map((branch) => branch.id === (activeLot.branch_id ?? activeBranchId) ? { ...branch, quantity: draftQuantity } : branch));
    setToast('บันทึกสต๊อกเรียบร้อยแล้ว');
    onSaved();
  }

  return (
    <div className="min-h-full -m-1 pb-10 text-surface-800">
      <div className="flex items-center gap-2 mb-5 text-xs text-surface-500 overflow-x-auto whitespace-nowrap">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"><ArrowLeft className="w-4 h-4" />จัดการสินค้า</button>
        <ChevronRight className="w-3.5 h-3.5 text-surface-300" />
        <span>{product.category || 'ไม่ระบุหมวดหมู่'}</span><ChevronRight className="w-3.5 h-3.5 text-surface-300" /><span>{product.brand || 'ไม่ระบุแบรนด์'}</span><ChevronRight className="w-3.5 h-3.5 text-surface-300" /><span className="font-medium text-surface-700">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,1fr)_minmax(460px,1.08fr)] gap-7 items-start">
        <div className="xl:sticky xl:top-5">
          {hasVariants && (
            <div className="flex flex-wrap gap-2 mb-3">
              {variants.map((v, idx) => (
                <button key={v.id} onClick={() => setSelectedVariantIdx(idx)} className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all', idx === selectedVariantIdx ? 'bg-primary-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                  {v.label || v.unit || `ตัวเลือก ${idx + 1}`}
                  {v.stock_qty != null && <span className={cn('ml-1.5 text-[10px]', idx === selectedVariantIdx ? 'text-primary-100' : 'text-surface-400')}>{formatNumber(Number(v.stock_qty))}</span>}
                </button>
              ))}
            </div>
          )}
          <Card className="p-4 rounded-2xl bg-white border-surface-200">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-50 flex items-center justify-center cursor-zoom-in" onMouseEnter={() => setZoom((current) => ({ ...current, active: true }))} onMouseLeave={() => setZoom((current) => ({ ...current, active: false }))} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setZoom({ active: true, x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }); }}>
              {selectedImage ? <img src={selectedImage} alt={product.name} className="h-full w-full object-contain transition-transform duration-100" style={{ transform: zoom.active ? 'scale(2.2)' : 'scale(1)', transformOrigin: `${zoom.x}% ${zoom.y}%` }} /> : <div className="flex flex-col items-center gap-2 text-surface-400"><Package className="w-14 h-14" /><span className="text-sm">ไม่มีรูปสินค้า</span></div>}
              <div className="absolute bottom-3 right-3 pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-surface-900/80 px-3 py-1.5 text-xs font-medium text-white"><ZoomIn className="w-3.5 h-3.5" />เลื่อนเมาส์เพื่อซูม</div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {hasVariants && variants.map((v, idx) => {
                const img = v.image_url;
                if (!img) return null;
                return (
                  <button key={`v-${v.id}`} onClick={() => setSelectedVariantIdx(idx)} className={cn('relative w-14 h-14 rounded-xl overflow-hidden border-2 bg-surface-50 flex items-center justify-center shrink-0 transition-all', idx === selectedVariantIdx ? 'border-primary-500 ring-2 ring-primary-200' : 'border-surface-200 hover:border-surface-300')} title={v.label || v.unit || ''}>
                    <img src={img} alt={v.label || 'variant'} className="w-full h-full object-contain" />
                    <span className="absolute bottom-0 left-0 right-0 bg-surface-900/60 text-white text-[8px] font-medium px-0.5 truncate">{v.label || v.unit}</span>
                  </button>
                );
              })}
              {galleryImages.length === 0 && !hasVariants && <div className="w-14 h-14 rounded-xl border border-surface-200 bg-surface-100 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-surface-300" /></div>}
              {galleryImages.filter((url) => !activeVariant?.image_url || url !== activeVariant.image_url).map((url, i) => (
                <button key={`g-${i}`} onClick={() => setSelectedImage(url)} className={cn('w-14 h-14 rounded-xl overflow-hidden border-2 bg-surface-50 flex items-center justify-center shrink-0', selectedImage === url ? 'border-primary-500' : 'border-surface-200 hover:border-surface-300')}>
                  <img src={url} alt={`thumbnail-${i}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="px-1">
            <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl lg:text-[26px] leading-tight font-bold text-surface-950">{product.name}</h1><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500"><span>แบรนด์: <b className="text-surface-800">{product.brand || '-'}</b></span><span className="text-surface-300">|</span><span>หมวดหมู่: {product.category || '-'}</span><span className="text-surface-300">|</span><span>SKU: <b className="font-mono text-surface-800">{displaySku}</b></span></div></div><Badge variant={product.is_active ? 'success' : 'default'}>{product.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}</Badge></div>
            <div className="h-px bg-surface-200 mt-5" />
          </div>

          <Card className="p-5 rounded-2xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SectionTitle>ราคาที่แสดงบนแพลตฟอร์ม</SectionTitle>
              <LotSegmentedControl selectedLotLabel={selectedLotLabel} setSelectedLotLabel={setSelectedLotLabel} show={hasAnyLot} hasOld={!!oldLot} hasNew={!!newLot} />
            </div>
            <div className="mt-4 divide-y divide-dashed divide-surface-200">{channelPrices.map((channel) => { const styles = CHANNEL_CHIP_STYLES[channel.key]; return <div key={channel.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><span className="inline-flex items-center gap-2 text-sm"><span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: styles.bgVar, color: styles.colorVar }}>{channel.label}</span><span className="text-surface-600">{channel.key === 'store' ? (branches.find((branch) => branch.id === activeBranchId)?.name ?? 'หน้าร้าน') : product.brand || 'ช่องทางออนไลน์'}</span></span><InlineMoney value={channel.price} onSave={async (value) => { if (activeVariant) { if (channel.key === 'store') { const { error } = await supabase.from('variant_lot_prices').upsert({ product_barcode_id: activeVariant.id, lot_label: selectedLotLabel, cost_price: activeVariantLotPrice?.cost_price ?? activeVariant.cost_price ?? 0, retail_price: value }, { onConflict: 'product_barcode_id,lot_label' }); if (error) { setToast('บันทึกราคาไม่สำเร็จ'); return; } setVariantLotPrices((prev) => { const next = new Map(prev); const entry = next.get(activeVariant.id) ?? {}; next.set(activeVariant.id, { ...entry, [selectedLotLabel]: { cost_price: entry[selectedLotLabel]?.cost_price ?? activeVariant.cost_price ?? 0, retail_price: value } }); return next; }); } else { const { error } = await supabase.from('product_platform_prices').upsert({ variant_id: activeVariant.id, product_id: product.id, platform: channel.key, price: value }, { onConflict: 'variant_id,platform' }); if (error) { setToast('บันทึกราคาไม่สำเร็จ'); return; } setVariantPlatformPrices((prev) => { const others = prev.filter((p) => !(p.variant_id === activeVariant.id && p.platform === channel.key)); return [...others, { variant_id: activeVariant.id, platform: channel.key, price: value }]; }); } setToast('บันทึกราคาเรียบร้อยแล้ว'); onSaved(); } else { if (channel.key === 'store') onInlineUpdate(product, 'retail', value, activeLot?.lot_label === 'old' ? 'old' : 'new'); else onInlineUpdate(product, 'platform', value, activeLot?.lot_label === 'old' ? 'old' : 'new', channel.key); } }} /></div>; })}</div>

          </Card>

          <Card className="p-5 rounded-2xl"><div className="flex items-center justify-between gap-3 flex-wrap"><SectionTitle>ราคาทุน</SectionTitle><LotSegmentedControl selectedLotLabel={selectedLotLabel} setSelectedLotLabel={setSelectedLotLabel} show={hasAnyLot} hasOld={!!oldLot} hasNew={!!newLot} /></div><div className="mt-4 flex items-center justify-between gap-4"><span className="text-sm text-surface-500">ต้นทุนต่อหน่วย (ไม่รวมค่าขนส่ง){hasBothLots ? ` · ล็อต${selectedLotLabel === 'old' ? 'เก่า' : 'ใหม่'}` : ''}</span><InlineMoney value={cost} onSave={async (value) => { if (activeVariant) { const { error } = await supabase.from('variant_lot_prices').upsert({ product_barcode_id: activeVariant.id, lot_label: selectedLotLabel, cost_price: value, retail_price: activeVariantLotPrice?.retail_price ?? activeVariant.price ?? 0 }, { onConflict: 'product_barcode_id,lot_label' }); if (error) { setToast('บันทึกราคาทุนไม่สำเร็จ'); return; } setVariantLotPrices((prev) => { const next = new Map(prev); const entry = next.get(activeVariant.id) ?? {}; next.set(activeVariant.id, { ...entry, [selectedLotLabel]: { cost_price: value, retail_price: entry[selectedLotLabel]?.retail_price ?? activeVariant.price ?? 0 } }); return next; }); } else if (selectedLotLabel === 'new' && !newLot && oldLot) { const { error } = await supabase.from('stock_lots').insert({ product_id: product.id, branch_id: activeBranchId ?? oldLot.branch_id ?? null, lot_label: 'new', quantity: 0, cost_price: value, retail_price: Number(oldLot.retail_price ?? product.retail_price ?? 0) }); if (error) { setToast('สร้างล็อตใหม่ไม่สำเร็จ'); return; } } else { if (activeLot) await supabase.from('stock_lots').update({ cost_price: value }).eq('id', activeLot.id); else await supabase.from('products').update({ cost_price: value }).eq('id', product.id); } onSaved(); setToast('บันทึกราคาทุนแล้ว'); }} /></div><span className="inline-flex mt-3 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600">มาร์จิ้นเฉลี่ยบนแพลตฟอร์ม ≈ {margin}%</span>{!hasVariants && selectedLotLabel === 'new' && !newLot && oldLot && (<p className="mt-2 text-xs text-warning-600">ยังไม่มีข้อมูลล็อตใหม่ — กรอกต้นทุนแล้วบันทึกเพื่อสร้างล็อตใหม่อัตโนมัติ</p>)}</Card>

          <Card className="p-5 rounded-2xl"><div className="flex items-center justify-between gap-3 flex-wrap"><SectionTitle>จัดการสต๊อกสินค้านี้</SectionTitle>{hasAnyLot && <LotSegmentedControl selectedLotLabel={selectedLotLabel} setSelectedLotLabel={setSelectedLotLabel} show={hasAnyLot} hasOld={!!oldLot} hasNew={!!newLot} />}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-surface-500">ปรับจำนวนคงเหลือ ({activeVariant ? (activeVariant.label || activeVariant.unit || 'ตัวเลือกย่อย') : (branches.find((branch) => branch.id === activeBranchId)?.name ?? 'คลังหลัก')}){!hasVariants && hasBothLots ? ` · ล็อต${selectedLotLabel === 'old' ? 'เก่า' : 'ใหม่'}` : ''}</span><div className="flex h-10 overflow-hidden rounded-full border border-surface-200 bg-white"><button onClick={() => setDraftQuantity((value) => Math.max(0, value - 1))} className="w-10 text-surface-700 hover:bg-surface-50"><Minus className="mx-auto w-4 h-4" /></button><span className="min-w-16 border-x border-surface-200 px-4 text-center leading-10 font-mono font-bold text-primary-600">{formatNumber(draftQuantity)}</span><button onClick={() => setDraftQuantity((value) => value + 1)} className="w-10 text-surface-700 hover:bg-surface-50"><Plus className="mx-auto w-4 h-4" /></button></div></div>{!hasVariants && hasAnyLot && (<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"><LotInfoBadge lot={oldLot} label="old" /><LotInfoBadge lot={newLot} label="new" /></div>)}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4"><Button variant="secondary" onClick={() => setShowEditModal(true)} className="w-full !rounded-full !border-primary-400 !text-primary-600"><Edit3 className="w-4 h-4" />แก้ไขสินค้า</Button><Button onClick={saveStock} className="w-full !rounded-full"><Save className="w-4 h-4" />บันทึกสต๊อก</Button></div></Card>

          {!hasVariants && hasBothLots && (() => { const oldQty = Number(oldLot?.quantity ?? 0); const newQty = Number(newLot?.quantity ?? 0); const lotMax = Math.max(oldQty, newQty, 1); return (
            <Card className="p-5 rounded-2xl">
              <SectionTitle>สต๊อกแยกตามล็อต</SectionTitle>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5"><span className="inline-flex items-center gap-2 text-sm font-medium"><span className="w-2.5 h-2.5 rounded-full bg-warning-500" />ล็อตเก่า</span><span className="font-mono font-bold text-surface-800">{formatNumber(oldQty)}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full bg-warning-500 transition-all" style={{ width: `${Math.max(oldQty > 0 ? 5 : 0, (oldQty / lotMax) * 100)}%` }} /></div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-surface-500"><span>ทุน: ฿{formatNumber(Number(oldLot?.cost_price ?? 0))}</span><span>ราคาขาย: ฿{formatNumber(Number(oldLot?.retail_price ?? 0))}</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5"><span className="inline-flex items-center gap-2 text-sm font-medium"><span className="w-2.5 h-2.5 rounded-full bg-success-500" />ล็อตใหม่</span><span className="font-mono font-bold text-surface-800">{formatNumber(newQty)}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full bg-success-500 transition-all" style={{ width: `${Math.max(newQty > 0 ? 5 : 0, (newQty / lotMax) * 100)}%` }} /></div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-surface-500"><span>ทุน: ฿{formatNumber(Number(newLot?.cost_price ?? 0))}</span><span>ราคาขาย: ฿{formatNumber(Number(newLot?.retail_price ?? 0))}</span></div>
                </div>
              </div>
            </Card>
          ); })()}

          <Card className="p-5 rounded-2xl"><div className="flex items-start justify-between gap-4"><div><SectionTitle>ชื่อสต๊อก</SectionTitle><div className="mt-3 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-lg font-bold text-primary-600">{(product.brand || product.name).slice(0, 2).toUpperCase()}</div><div><p className="font-bold text-surface-900">{activeVariant ? (activeVariant.label || activeVariant.unit || 'ตัวเลือกย่อย') : (branches.find((branch) => branch.id === activeBranchId)?.name ?? 'คลังหลัก')} · {product.name}</p><p className="text-xs text-surface-500">อัปเดตล่าสุดโดย {profileName || 'ผู้ดูแลระบบ'} · {lastUpdated ? formatDateTime(lastUpdated) : 'ยังไม่มีข้อมูล'}</p></div></div></div><div className="flex gap-7 text-right"><div><p className="font-mono text-xl font-bold text-primary-600">{formatNumber(totalStock)}</p><p className="text-xs text-surface-500">{activeVariant ? 'จำนวนคงเหลือ' : 'รวมทุกสาขา'}</p></div><div><p className="font-mono text-xl font-bold text-primary-600">{activeVariant ? variants.length : branches.length}</p><p className="text-xs text-surface-500">{activeVariant ? 'ตัวเลือกย่อย' : 'สาขา'}</p></div></div></div></Card>

          {hasVariants && (<Card className="p-5 rounded-2xl"><SectionTitle>จำนวนคงเหลือตัวเลือกย่อย</SectionTitle><div className="mt-4 space-y-3">{variants.map((v, idx) => { const qty = getVariantBranchQty(v.id, null) ?? Number(v.stock_qty ?? 0); const low = qty <= Number(product.min_stock || 0); return <div key={v.id} className="grid grid-cols-[140px_1fr_42px_auto] items-center gap-2 text-sm"><span className="truncate text-surface-600">{v.label || v.unit || `ตัวเลือก ${idx + 1}`}</span><div className="h-3 overflow-hidden rounded-full bg-surface-100"><div className={cn('h-full rounded-full transition-all', low ? 'bg-error-600' : 'bg-primary-500')} style={{ width: `${Math.max(qty > 0 ? 5 : 0, (qty / maxStock) * 100)}%` }} /></div><span className={cn('text-right font-mono font-bold', low ? 'text-error-600' : 'text-surface-800')}>{formatNumber(qty)}</span>{low && <span className="rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-semibold text-error-600">ใกล้หมด</span>}</div>; })}</div></Card>)}

          <Card className="p-5 rounded-2xl"><SectionTitle>{activeVariant ? `คงเหลือแต่ละสาขา${activeVariant.label ? ' (' + activeVariant.label + ')' : ''}` : 'คงเหลือแต่ละสาขา'}</SectionTitle>{loadingStocks ? <div className="flex justify-center py-6"><Spinner /></div> : <div className="mt-4 space-y-3">{variantBranchRows.map((branch) => { const low = branch.quantity <= Number(product.min_stock || 0); const isCurrent = !!activeBranchId && branch.id === activeBranchId; return <div key={branch.id} className={cn('grid items-center gap-2 text-sm rounded-lg transition-colors', isCurrent ? 'grid-cols-[110px_auto_1fr_42px_auto] bg-primary-50/60 ring-1 ring-primary-200 px-2 py-1.5 -mx-2' : 'grid-cols-[110px_1fr_42px_auto]')}><span className="truncate text-surface-600">{branch.name}</span>{isCurrent && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700 whitespace-nowrap">สาขาปัจจุบัน</span>}<div className="h-3 overflow-hidden rounded-full bg-surface-100"><div className={cn('h-full rounded-full transition-all', low ? 'bg-error-600' : 'bg-primary-500')} style={{ width: `${Math.max(branch.quantity > 0 ? 5 : 0, (branch.quantity / maxStock) * 100)}%` }} /></div><span className={cn('text-right font-mono font-bold', low ? 'text-error-600' : 'text-surface-800')}>{formatNumber(branch.quantity)}</span>{low && <span className="rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-semibold text-error-600">ใกล้หมด</span>}</div>; })}</div>}</Card>

          <Card className="p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-primary-500" /><SectionTitle>แนวโน้มยอดขาย 30 วัน</SectionTitle></div>
            <p className="text-xs text-surface-400 mb-4">ปริมาณขายและรายได้รายวัน</p>
            {(() => {
              const maxQty = Math.max(...salesTrend.map((d) => d.qty), 1);
              const hasSales = salesTrend.some((d) => d.qty > 0);
              if (!hasSales) return <div className="flex flex-col items-center gap-2 py-8 text-surface-400"><Package className="w-10 h-10" /><span className="text-sm">ยังไม่มีข้อมูลยอดขายใน 30 วันที่ผ่านมา</span></div>;
              const totalQty = salesTrend.reduce((s, d) => s + d.qty, 0);
              const totalRev = salesTrend.reduce((s, d) => s + d.revenue, 0);
              return (
                <>
                  <div className="flex items-end gap-[3px] h-32">
                    {salesTrend.map((d, i) => (
                      <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                        <div className="w-full rounded-t-sm bg-primary-400/70 hover:bg-primary-500 transition-all" style={{ height: `${Math.max(d.qty > 0 ? 4 : 0, (d.qty / maxQty) * 100)}%` }} />
                        <div className="absolute -top-8 hidden group-hover:block z-10 rounded-lg bg-surface-900 px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap">{d.date}: {formatNumber(d.qty)} ชิ้น / ฿{formatNumber(d.revenue)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-surface-500">
                    <span>รวม {formatNumber(totalQty)} ชิ้น</span>
                    <span>รายได้รวม ฿{formatNumber(totalRev)}</span>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      </div>

      {showEditModal && <EditProductModal product={product} onClose={() => setShowEditModal(false)} onSaved={() => { setShowEditModal(false); onSaved(); reloadGallery(); }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-surface-900 px-5 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}

      {showPriceEditModal && (
        <EditPriceModal
          productId={product.id}
          productName={product.name}
          stockLots={product.stock_lots ?? []}
          branchId={activeBranchId ?? null}
          initialLotLabel={selectedLotLabel}
          onClose={() => setShowPriceEditModal(false)}
          onSaved={() => { setShowPriceEditModal(false); onSaved(); }}
        />
      )}
    </div>
  );
}
