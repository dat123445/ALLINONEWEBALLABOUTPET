import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Package, AlertTriangle, ClipboardCheck, Search, TrendingDown, TrendingUp, ArrowRightLeft, ScanLine, FileSpreadsheet, Download, Trash2, Tag, X, CheckCircle2, AlertCircle, LayoutGrid, List, Image as ImageIcon, ImagePlus, ShoppingCart, Filter, XCircle, Pencil, Save, ArrowDownToLine, ArrowUpFromLine, Minus, Plus as PlusIcon, Zap, Calendar, Upload, Building2, Copy, ArrowLeft, ChevronRight, ChevronDown, GitMerge } from 'lucide-react';
const ParentVariantImportModal = lazy(() => import('@/components/ParentVariantImportModal').then((m) => ({ default: m.ParentVariantImportModal })));
const GenericImportModal = lazy(() => import('@/components/GenericImportModal').then((m) => ({ default: m.GenericImportModal })));
const ImportStockQuantitiesModal = lazy(() => import('@/components/ImportStockQuantitiesModal').then((m) => ({ default: m.ImportStockQuantitiesModal })));
import { ImageUploader } from '@/components/ImageUploader';
import { ProductDetailView } from '@/components/ProductDetailView';
import { EditPriceModal } from '@/components/EditPriceModal';
import { supabase, fetchAllPaginated } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner, ProgressBar, Pagination, ConfirmDialog, ErrorBoundary, HelpTooltip } from '@/components/ui';
import { formatCurrency, formatNumber, formatDateTime, formatDate, formatDateBE, cn } from '@/lib/format';
import { getVariantQuantity, computeFifoPicks } from '@/lib/stockMetrics';
import { IMPORT_CONFIGS, setMovementImportContext } from '@/lib/importConfigs';
import type { ImportableModule } from '@/lib/importConfigs';

type ProductBarcode = { id: string; barcode: string; variant_name: string | null; parent_ref: string | null; unit: string; unit_multiplier: number; label: string | null; image_url: string | null; cost_price: number | null; price: number | null; stock_qty: number | null; is_available: boolean | null; variant_lot_prices?: { id: string; lot_label: string; quantity: number; cost_price: number; retail_price: number }[] };

type Product = {
  id: string;
  sku: string | null;
  name: string;
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
  parent_product_id: string | null;
  parent_ref: string | null;
  stock_lots: { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; expiry_date?: string | null; lot_number?: string | null; product_barcode_id?: string | null }[];
  product_barcodes?: ProductBarcode[];
};

type StockLot = { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number; branch_id?: string; expiry_date?: string | null; lot_number?: string | null };

type StockMovement = {
  id: string;
  movement_type: string;
  type_config: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_percent: number;
  reference_note: string | null;
  created_at: string;
  lot_id: string | null;
  product_barcode_id: string | null;
  to_branch_id: string | null;
  products: { name: string; sku: string } | null;
  product_barcodes: { barcode: string; label: string | null; variant_name: string | null } | null;
  branch: { name: string } | null;
  to_branch: { name: string } | null;
  profiles: { display_name: string | null; first_name: string | null } | null;
};

type WithdrawalType = { id: string; name: string; pricing_rule: string; platform_link: string | null; sort_order: number };
type ReceivingType = { id: string; name: string; pricing_rule: string; sort_order: number };
type PlatformSetting = { platform: string; margin_percent: number; platform_fee_percent: number; low_cost_margin_percent?: number; low_cost_fee_percent?: number; low_cost_threshold?: number; is_connected?: boolean };

const UNIT_OPTIONS = ['ชิ้น', 'ถุง', 'โหล', 'ลัง', 'กก.', 'ลิตร', 'เมตร'];

const PLATFORM_MAP: Record<string, string> = {
  'Tiktok': 'tiktok', 'Shopee': 'shopee', 'Lazada': 'lazada',
};

function CopySkuButton({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  const hasSku = !!sku;
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!hasSku) return;
    try {
      await navigator.clipboard.writeText(sku);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = sku; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      title={hasSku ? 'คัดลอก SKU' : 'ไม่มี SKU'}
      className={cn('relative inline-flex items-center transition-colors', hasSku ? 'text-surface-400 hover:text-primary-600' : 'text-surface-300 cursor-not-allowed')}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-md bg-success-600 text-white text-[10px] font-medium whitespace-nowrap shadow-sm animate-fade-in z-10">
          คัดลอกแล้ว
        </span>
      )}
    </button>
  );
}

function HoverPreview({ src, alt, children }: { src?: string | null; alt: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        onMouseEnter={() => { if (src) setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
      {open && src && createPortal(
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-surface-950/60 backdrop-blur-sm animate-fade-in pointer-events-none"
          style={{ top: 0 }}
        >
          <div className="rounded-2xl bg-white shadow-2xl border border-surface-200 overflow-hidden max-w-[min(90vw,32rem)] max-h-[min(80vh,32rem)]">
            <img src={src} alt={alt} className="w-full h-full object-contain" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function isExpiringSoon(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

export function StockPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [withdrawalTypes, setWithdrawalTypes] = useState<WithdrawalType[]>([]);
  const [receivingTypes, setReceivingTypes] = useState<ReceivingType[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showMove, setShowMove] = useState(false);
  const [moveType, setMoveType] = useState<'receive' | 'withdraw' | 'transfer'>('receive');
  const [showProduct, setShowProduct] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [platformPrices, setPlatformPrices] = useState<{ product_id: string; lot_label: string; platform: string; price: number }[]>([]);
  const [lotFilter, setLotFilter] = useState<string>('all');
  const [lotOverrides, setLotOverrides] = useState<Record<string, 'old' | 'new'>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(50);
  const [productTotal, setProductTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(50);
  const [movementTotal, setMovementTotal] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<StockMovement | null>(null);
  const [deletingMovement, setDeletingMovement] = useState(false);
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showStockQtyImport, setShowStockQtyImport] = useState(false);
  const [movementImport, setMovementImport] = useState<null | 'stockReceive' | 'stockWithdraw'>(null);
  const [historyImport, setHistoryImport] = useState(false);
  const [allBrandsList, setAllBrandsList] = useState<string[]>([]);
  const [allCategoriesList, setAllCategoriesList] = useState<string[]>([]);
  const [brandCategories, setBrandCategories] = useState<string[]>([]);
  const brandCatCache = useRef<Record<string, string[]>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkPriceEdit, setBulkPriceEdit] = useState(false);
  const [editPriceProduct, setEditPriceProduct] = useState<Product | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [variantBranchStock, setVariantBranchStock] = useState<Map<string, Map<string, number>>>(new Map());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeWorking, setMergeWorking] = useState(false);

  const getVariantBranchQty = useCallback((variantId: string, branchId: string | null): number | null => {
    const branchMap = variantBranchStock.get(variantId);
    if (!branchMap) return null;
    if (!branchId) {
      let total = 0; let hasAny = false;
      branchMap.forEach((q) => { total += q; hasAny = true; });
      return hasAny ? total : null;
    }
    return branchMap.get(branchId) ?? null;
  }, [variantBranchStock]);

  const loadProducts = useCallback(async () => {
    let query = supabase.from('products').select('*, parent_product_id, stock_lots(id, quantity, lot_label, cost_price, retail_price, branch_id, expiry_date, lot_number, product_barcode_id), product_barcodes(id, barcode, variant_name, parent_ref, unit, unit_multiplier, label, image_url, cost_price, price, stock_qty, is_available, variant_lot_prices(id, lot_label, quantity, cost_price, retail_price))', { count: 'exact' });
    if (statusFilter === 'active') query = query.eq('is_active', true);
    else if (statusFilter === 'closed') query = query.eq('is_active', false);
    if (brandFilter !== 'all') query = query.eq('brand', brandFilter);
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
    let barcodeProductIds: string[] = [];
    if (search.trim()) {
      const s = search.trim();
      const bcData = await fetchAllPaginated<{ product_id: string }>(() => supabase.from('product_barcodes').select('product_id').ilike('barcode', `%${s}%`));
      barcodeProductIds = Array.from(new Set(bcData.map((r) => r.product_id)));
    }
    if (search.trim()) {
      const s = search.trim();
      const orParts = [`name.ilike.%${s}%,sku.ilike.%${s}%,category.ilike.%${s}%`];
      if (barcodeProductIds.length > 0) {
        orParts.push(`id.in.(${barcodeProductIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }
    query = query.order('name').range((productPage - 1) * productPageSize, productPage * productPageSize - 1);
    const { data, error, count } = await query;
    if (error) console.error('[Stock] loadProducts error:', error.message);
    const loadedProducts = data as Product[] ?? [];
    const visibleProducts = statusFilter === 'expiring'
      ? loadedProducts.filter((product) => (product.stock_lots ?? []).some((lot) => isExpiringSoon(lot.expiry_date)))
      : loadedProducts;
    setProducts(visibleProducts);
    setProductTotal(statusFilter === 'expiring' ? visibleProducts.length : count ?? 0);

    const variantIds = (visibleProducts as Product[]).flatMap((p) => (p.product_barcodes ?? []).map((v) => v.id));
    if (variantIds.length > 0) {
      const { data: vbsData } = await supabase.from('variant_branch_stock').select('variant_id, branch_id, quantity').in('variant_id', variantIds);
      const vbsMap = new Map<string, Map<string, number>>();
      (vbsData as { variant_id: string; branch_id: string; quantity: number }[] ?? []).forEach((r) => {
        if (!vbsMap.has(r.variant_id)) vbsMap.set(r.variant_id, new Map());
        vbsMap.get(r.variant_id)!.set(r.branch_id, Number(r.quantity));
      });
      setVariantBranchStock(vbsMap);
    } else {
      setVariantBranchStock(new Map());
    }
  }, [statusFilter, brandFilter, categoryFilter, search, productPage, productPageSize]);

  const loadMovements = useCallback(async () => {
    let query = supabase.from('stock_movements')
      .select('*, products(name, sku), product_barcodes(barcode, label, variant_name), branch:branches!stock_movements_branch_id_fkey(name), to_branch:branches!stock_movements_to_branch_id_fkey(name), profiles(display_name, first_name)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (profile?.active_branch_id) query = query.eq('branch_id', profile.active_branch_id);
    const { data, error, count } = await query.range((movementPage - 1) * movementPageSize, movementPage * movementPageSize - 1);
    if (error) console.error('[Stock] loadMovements error:', error.message);
    setMovements(data as StockMovement[] ?? []);
    setMovementTotal(count ?? 0);
  }, [movementPage, movementPageSize, profile?.active_branch_id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [brRes, wtRes, rtRes, psRes] = await Promise.all([
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('stock_withdrawal_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('stock_receiving_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('online_platform_settings').select('platform, margin_percent, platform_fee_percent, low_cost_margin_percent, low_cost_fee_percent, low_cost_threshold, is_connected'),
    ]);
    const [ppData, brandData, catData] = await Promise.all([
      fetchAllPaginated<{ product_id: string; lot_label: string; platform: string; price: number }>(() => supabase.from('product_platform_prices').select('product_id, lot_label, platform, price')),
      fetchAllPaginated<{ brand: string }>(() => supabase.from('products').select('brand').not('brand', 'is', null).order('brand')),
      fetchAllPaginated<{ category: string }>(() => supabase.from('products').select('category').not('category', 'is', null).order('category')),
    ]);
    setBranches(brRes.data as { id: string; name: string }[] ?? []);
    setWithdrawalTypes(wtRes.data as WithdrawalType[] ?? []);
    setReceivingTypes(rtRes.data as ReceivingType[] ?? []);
    setPlatformSettings(psRes.data as PlatformSetting[] ?? []);
    setPlatformPrices(ppData);
    setAllBrandsList(Array.from(new Set(brandData.map(r => r.brand))).sort());
    setAllCategoriesList(Array.from(new Set(catData.map(r => r.category))).sort());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  useEffect(() => {
    if (!detailProduct) return;
    const updated = products.find((p) => p.id === detailProduct.id);
    if (updated && updated !== detailProduct) setDetailProduct(updated);
  }, [products, detailProduct]);

  const reloadPlatformPrices = useCallback(async () => {
    const data = await fetchAllPaginated<{ product_id: string; lot_label: string; platform: string; price: number }>(() => supabase.from('product_platform_prices').select('product_id, lot_label, platform, price'));
    setPlatformPrices(data);
  }, []);

  // Reset page when filters change
  useEffect(() => { setProductPage(1); }, [statusFilter, brandFilter, categoryFilter, search, productPageSize]);
  useEffect(() => { setMovementPage(1); }, [movementPageSize]);

  // Dependent category filter: load categories for the selected brand
  useEffect(() => {
    if (brandFilter === 'all') { setBrandCategories([]); return; }
    if (brandCatCache.current[brandFilter]) { setBrandCategories(brandCatCache.current[brandFilter]); return; }
    let cancelled = false;
    fetchAllPaginated<{ category: string }>(() => supabase.from('products').select('category').eq('brand', brandFilter).not('category', 'is', null))
      .then((data) => {
        if (cancelled) return;
        const cats = Array.from(new Set(data.map(r => r.category))).sort();
        brandCatCache.current[brandFilter] = cats;
        setBrandCategories(cats);
      });
    return () => { cancelled = true; };
  }, [brandFilter]);

  // Reset category filter if it's not available for the current brand
  useEffect(() => {
    if (categoryFilter !== 'all' && brandFilter !== 'all' && brandCategories.length > 0 && !brandCategories.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [brandFilter, brandCategories, categoryFilter]);

  const allBrands = allBrandsList;
  const availableCategories = brandFilter !== 'all' ? brandCategories : allCategoriesList;

  function clearFilters() {
    setBrandFilter('all');
    setCategoryFilter('all');
    setSearch('');
    setLotFilter('all');
    setLotOverrides({});
    setStatusFilter('all');
  }

  function toggleLotOverride(id: string, current: 'old' | 'new' | undefined) {
    const next = current === undefined ? 'new' : current === 'new' ? 'old' : undefined;
    setLotOverrides(prev => {
      if (next === undefined) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  }

  const hasActiveFilters = brandFilter !== 'all' || categoryFilter !== 'all' || search !== '' || lotFilter !== 'all' || statusFilter !== 'all';

  const activeBranchId = profile?.active_branch_id ?? null;

  const branchFilteredLots = (lots: Product['stock_lots']) =>
    activeBranchId ? (lots ?? []).filter((l) => l.branch_id === activeBranchId) : (lots ?? []);

  const sellableUnitCount = products.reduce((sum, p) => {
    const variants = p.product_barcodes ?? [];
    return sum + (variants.length > 0 ? variants.length : 1);
  }, 0);

  const lowStockUnitCount = products.reduce((sum, p) => {
    const variants = p.product_barcodes ?? [];
    if (variants.length > 0) {
      return sum + variants.filter((v) => {
        const branchQty = getVariantBranchQty(v.id, activeBranchId);
        const qty = branchQty != null ? branchQty : getVariantQuantity(v);
        return qty <= p.min_stock;
      }).length;
    }
    const qty = branchFilteredLots(p.stock_lots).reduce((s, l) => s + Number(l.quantity), 0);
    return sum + (qty <= p.min_stock ? 1 : 0);
  }, 0);

  const totalStockValue = products.reduce((sum, p) => {
    const variants = p.product_barcodes ?? [];
    if (variants.length > 0) {
      return sum + variants.reduce((s, v) => {
        const branchQty = getVariantBranchQty(v.id, activeBranchId);
        const qty = branchQty != null ? branchQty : getVariantQuantity(v);
        return s + qty * (Number(v.cost_price) || Number(p.cost_price) || 0);
      }, 0);
    }
    const qty = branchFilteredLots(p.stock_lots).reduce((s, l) => s + Number(l.quantity), 0);
    return sum + qty * Number(p.cost_price);
  }, 0);

  const lowStock = products.filter((p) => {
    const variants = p.product_barcodes ?? [];
    let qty: number;
    if (variants.length > 0) {
      qty = variants.reduce((s, v) => {
        const branchQty = getVariantBranchQty(v.id, activeBranchId);
        return s + (branchQty != null ? branchQty : (Number(v.stock_qty) || 0));
      }, 0);
    } else {
      qty = branchFilteredLots(p.stock_lots).reduce((s, l) => s + Number(l.quantity), 0);
    }
    return qty <= p.min_stock;
  });

  async function toggleProductActive(product: Product) {
    const variants = product.product_barcodes ?? [];
    const anyAvailable = variants.length > 0 && variants.some((b) => b.is_available ?? true);
    const newActive = variants.length > 0 ? !anyAvailable : !product.is_active;
    const { error } = await supabase.from('products').update({ is_active: newActive }).eq('id', product.id);
    if (error) { console.error('Toggle active error:', error.message); return; }
    if (variants.length > 0) {
      await supabase.from('product_barcodes').update({ is_available: newActive }).eq('product_id', product.id);
    }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: newActive, product_barcodes: (p.product_barcodes ?? []).map(b => ({ ...b, is_available: newActive })) } : p));
  }

  function toggleProductSelection(id: string) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisibleProducts() {
    setSelectedProductIds((current) => current.size === products.length ? new Set() : new Set(products.map((product) => product.id)));
  }

  async function updateInlineProduct(product: Product, field: 'quantity' | 'retail' | 'platform', value: number, lotLabel: 'old' | 'new', platform?: string) {
    if (!Number.isFinite(value) || value < 0) return;
    const lot = (product.stock_lots ?? []).find((item) => item.lot_label === lotLabel);
    let error: { message: string } | null = null;
    if (field === 'quantity' && lot) {
      ({ error } = await supabase.from('stock_lots').update({ quantity: value }).eq('id', lot.id));
    } else if (field === 'retail' && lot) {
      ({ error } = await supabase.from('stock_lots').update({ retail_price: value }).eq('id', lot.id));
    } else if (field === 'retail') {
      ({ error } = await supabase.from('products').update({ retail_price: value }).eq('id', product.id));
    } else if (field === 'platform' && platform) {
      ({ error } = await supabase.from('product_platform_prices').upsert({ product_id: product.id, lot_label: lotLabel, platform, price: value, cost_price: Number(lot?.cost_price ?? product.cost_price), margin_percent: calcMarginPercent(Number(lot?.cost_price ?? product.cost_price), value) }, { onConflict: 'product_id,lot_label,platform' }));
    }
    if (error) { console.error('Inline product update error:', error.message); return; }
    if (field === 'platform') await reloadPlatformPrices();
    await loadProducts();
  }

  async function copyProduct(p: Product) {
    setCopyLoading(true);
    try {
      const { data: newProd, error: pErr } = await supabase.from('products').insert({
        sku: `${p.sku}-copy`,
        name: `${p.name} (สำเนา)`,
        category: p.category,
        brand: p.brand,
        description: p.description,
        note: p.note,
        unit: p.unit,
        cost_price: p.cost_price,
        retail_price: p.retail_price,
        image_url: p.image_url,
        min_stock: p.min_stock,
        is_active: false,
      }).select().single();
      if (pErr || !newProd) throw pErr;
      const variants = p.product_barcodes ?? [];
      if (variants.length > 0) {
        const rows = variants.map((v) => ({
          product_id: newProd.id,
          barcode: v.barcode,
          unit: v.unit,
          unit_multiplier: v.unit_multiplier,
          label: v.label,
          image_url: v.image_url,
          cost_price: v.cost_price,
          price: v.price,
          stock_qty: 0,
          is_available: v.is_available,
        }));
        await supabase.from('product_barcodes').insert(rows);
      }
      const { data: imgData } = await supabase.from('product_images').select('image_url, sort_order').eq('product_id', p.id).order('sort_order');
      if (imgData && imgData.length > 0) {
        await supabase.from('product_images').insert(imgData.map((img) => ({ product_id: newProd.id, image_url: (img as { image_url: string }).image_url, sort_order: (img as { sort_order: number }).sort_order })));
      }
      await loadProducts();
      setDetailProduct(newProd as Product);
      setCopyLoading(false);
    } catch {
      setCopyLoading(false);
    }
  }

  async function deleteProduct(p: Product) {
    setDeletingProduct(true);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    setDeletingProduct(false);
    if (error) { console.error('Delete product error:', error.message); return; }
    setDeleteProductConfirm(null);
    await loadProducts();
  }

  async function applyBulkAction(action: 'disable' | 'delete') {
    if (selectedProductIds.size === 0) return;
    if (action === 'delete' && !window.confirm(`ยืนยันลบสินค้า ${selectedProductIds.size} รายการออกจากระบบหรือไม่`)) return;
    setBulkWorking(true);
    const ids = Array.from(selectedProductIds);
    const result = action === 'disable'
      ? await supabase.from('products').update({ is_active: false }).in('id', ids)
      : await supabase.from('products').delete().in('id', ids);
    setBulkWorking(false);
    if (result.error) { console.error('Bulk product action error:', result.error.message); return; }
    setSelectedProductIds(new Set());
    await loadProducts();
  }

  async function deleteMovement(m: StockMovement) {
    setDeletingMovement(true);
    const { error } = await supabase.from('stock_movements').delete().eq('id', m.id);
    setDeletingMovement(false);
    if (error) { console.error('Delete movement error:', error.message); return; }
    setDeleteConfirm(null);
    loadMovements();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (detailProduct) {
    const effectiveLot = getEffectiveLot(lotFilter, lotOverrides[detailProduct.id]);
    const initialLotLabel: 'old' | 'new' | undefined = effectiveLot === 'old' ? 'old' : effectiveLot === 'new' ? 'new' : undefined;
    return (
      <ProductDetailView
        product={detailProduct}
        onBack={() => setDetailProduct(null)}
        platformSettings={platformSettings}
        platformPrices={platformPrices}
        profileId={profile?.id}
        profileName={profile?.display_name ?? profile?.email}
        onSaved={() => { loadProducts(); reloadPlatformPrices(); }}
        onDeleted={() => { setDetailProduct(null); loadProducts(); }}
        onInlineUpdate={updateInlineProduct}
        branches={branches}
        activeBranchId={activeBranchId}
        initialLotLabel={initialLotLabel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="สินค้าทั้งหมด" value={formatNumber(sellableUnitCount)} icon={<Package className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="มูลค่าสต๊อก" value={formatCurrency(totalStockValue)} icon={<TrendingUp className="w-5 h-5" />} color="success" delay="animate-delay-200" />
        <StatCard label="ใกล้หมด" value={formatNumber(lowStockUnitCount)} icon={<AlertTriangle className="w-5 h-5" />} color="warning" delay="animate-delay-300" />
        <StatCard label="การเคลื่อนไหว" value={formatNumber(movementTotal)} icon={<ArrowRightLeft className="w-5 h-5" />} color="accent" delay="animate-delay-400" />
      </div>

      <div className="flex w-fit max-w-full gap-1 rounded-2xl border border-surface-200 bg-white p-1 shadow-sm overflow-x-auto scrollbar-hide">
        {[{ key: 'products', label: 'สินค้า' }, { key: 'movements', label: 'ประวัติรายการ' }, { key: 'lowstock', label: 'ใกล้หมด', count: lowStockUnitCount }].map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={cn('rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all', tab === item.key ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800')}>
            {item.label}{item.count != null && <span className={cn('ml-2 rounded-full px-1.5 py-0.5 text-[11px]', tab === item.key ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500')}>{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input className="input-base pl-11" placeholder="ค้นหาสินค้า, SKU, บาร์โค้ด, หมวดหมู่..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex p-1 bg-surface-100 rounded-lg">
                <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')} title="มุมมองตาราง">
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')} title="มุมมองการ์ด">
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => { setMoveType('receive'); setShowMove(true); }} className="!bg-success-600 !text-white hover:!bg-success-700 !px-5 !py-2.5 !text-sm font-semibold shadow-sm">
                  <ArrowDownToLine className="w-4 h-4" /> รับสินค้า
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setMovementImportContext({ branchId: activeBranchId ?? undefined, profileId: profile?.id }); setMovementImport('stockReceive'); }} title="นำเข้ารับสินค้าจาก Excel/CSV" className="!px-2 !py-2.5 !text-success-700 hover:!bg-success-50">
                  <FileSpreadsheet className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => { setMoveType('withdraw'); setShowMove(true); }} className="!bg-error-600 !text-white hover:!bg-error-700 !px-5 !py-2.5 !text-sm font-semibold shadow-sm">
                  <ArrowUpFromLine className="w-4 h-4" /> เบิกสินค้า
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setMovementImportContext({ branchId: activeBranchId ?? undefined, profileId: profile?.id }); setMovementImport('stockWithdraw'); }} title="นำเข้าเบิกสินค้าจาก Excel/CSV" className="!px-2 !py-2.5 !text-error-700 hover:!bg-error-50">
                  <FileSpreadsheet className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setMoveType('transfer'); setShowMove(true); }}>
                <ArrowRightLeft className="w-4 h-4" /> โอนสินค้า
              </Button>
              <Button size="sm" onClick={() => setShowProduct(true)}><Plus className="w-4 h-4" /> เพิ่มสินค้า</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}><Upload className="w-4 h-4" /> นำเข้าสินค้าใหม่</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowStockQtyImport(true)} className="!bg-accent-600 !text-white hover:!bg-accent-700"><Upload className="w-4 h-4" /> นำเข้าคงเหลือ</Button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-surface-200 overflow-x-auto scrollbar-hide">
            {[
              { key: 'all', label: 'ทั้งหมด', count: statusFilter === 'all' ? sellableUnitCount : undefined },
              { key: 'active', label: 'แอคทีฟ' },
              { key: 'closed', label: 'ไม่ใช้งาน' },
              { key: 'expiring', label: 'ใกล้หมดอายุ' },
            ].map((item) => (
              <button key={item.key} onClick={() => setStatusFilter(item.key)} className={cn('px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors', statusFilter === item.key ? 'text-primary-600 border-primary-600' : 'text-surface-500 border-transparent hover:text-surface-800')}>
                {item.label}
                <span className={cn('ml-2 inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[11px]', statusFilter === item.key ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500')}>{item.count ?? (item.key === 'active' ? products.filter((p) => p.is_active).reduce((s, p) => s + ((p.product_barcodes ?? []).length > 0 ? (p.product_barcodes ?? []).length : 1), 0) : item.key === 'closed' ? products.filter((p) => !p.is_active).reduce((s, p) => s + ((p.product_barcodes ?? []).length > 0 ? (p.product_barcodes ?? []).length : 1), 0) : item.key === 'expiring' ? products.filter((p) => (p.stock_lots ?? []).some((lot) => isExpiringSoon(lot.expiry_date))).reduce((s, p) => s + ((p.product_barcodes ?? []).length > 0 ? (p.product_barcodes ?? []).length : 1), 0) : sellableUnitCount)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-surface-400 mr-1" />
                <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setCategoryFilter('all'); }} className="h-10 rounded-full border border-surface-200 bg-white px-4 text-sm text-surface-700 outline-none focus:border-primary-500">
                  <option value="all">ทุกแบรนด์</option>{allBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-full border border-surface-200 bg-white px-4 text-sm text-surface-700 outline-none focus:border-primary-500">
                  <option value="all">ทุกหมวดหมู่</option>{availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={lotFilter} onChange={(e) => setLotFilter(e.target.value)} className="h-10 rounded-full border border-surface-200 bg-white px-4 text-sm text-surface-700 outline-none focus:border-primary-500">
                  <option value="all">ทุกล็อต</option><option value="old">ล็อตเก่า</option><option value="new">ล็อตใหม่</option>
                </select>
                {hasActiveFilters && <button onClick={clearFilters} className="h-10 px-4 rounded-full text-sm text-error-600 hover:bg-error-50 transition-colors"><XCircle className="w-3.5 h-3.5 inline mr-1" />ล้างตัวกรอง</button>}
              </div>
            {selectedProductIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success-300 bg-success-50 px-4 py-3 shadow-sm animate-slide-down">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-success-800"><CheckCircle2 className="h-4 w-4" />เลือกแล้ว {selectedProductIds.size} รายการ</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button disabled={bulkWorking} onClick={() => setShowMergeModal(true)} className="h-9 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-1.5"><GitMerge className="w-4 h-4" /> รวมเป็นตัวเลือกย่อย</button>
                  <button disabled={bulkWorking} onClick={() => setBulkPriceEdit(true)} className="h-9 rounded-full bg-success-600 px-4 text-sm font-semibold text-white hover:bg-success-700 disabled:opacity-50">แก้ไขราคา</button>
                  <button disabled={bulkWorking} onClick={() => applyBulkAction('disable')} className="h-9 rounded-full border border-surface-400 bg-white px-4 text-sm font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50">ปิดการใช้งาน</button>
                  <button disabled={bulkWorking} onClick={() => applyBulkAction('delete')} className="h-9 rounded-full border border-error-300 bg-white px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-50">ลบออก</button>
                  <button onClick={() => setSelectedProductIds(new Set())} className="h-9 rounded-full px-3 text-sm text-success-800 hover:bg-success-100">ยกเลิก</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-surface-600 mr-2"><input type="checkbox" checked={products.length > 0 && selectedProductIds.size === products.length} onChange={toggleAllVisibleProducts} className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />เลือกทั้งหมด</label>
              <span className="text-xs text-surface-400 ml-auto">แสดง {products.length > 0 ? (productPage - 1) * productPageSize + 1 : 0}-{Math.min(productPage * productPageSize, productTotal)} จาก {formatNumber(sellableUnitCount)} สินค้า</span>
            </div>
          </div>

          {products.length === 0 ? (
            <EmptyState icon={<Package className="w-8 h-8" />} title="ไม่พบสินค้า" description="เพิ่มสินค้าเพื่อเริ่มจัดการสต๊อก" action={<Button onClick={() => setShowProduct(true)}><Plus className="w-4 h-4" /> เพิ่มสินค้า</Button>} />
          ) : viewMode === 'list' ? (
            <ProductListView products={products} platformSettings={platformSettings} platformPrices={platformPrices} lotFilter={lotFilter} lotOverrides={lotOverrides} onToggleLot={toggleLotOverride} onOrderMore={() => { setMoveType('receive'); setShowMove(true); }} onSelect={(p) => setDetailProduct(p)} onToggleActive={toggleProductActive} onQuickAdjust={(p) => setQuickAdjustProduct(p)} activeBranchId={activeBranchId} variantBranchStock={variantBranchStock} selectedProductIds={selectedProductIds} onToggleSelected={toggleProductSelection} onToggleAllVisible={toggleAllVisibleProducts} onInlineUpdate={updateInlineProduct} onRefresh={loadProducts} onEditPrice={(p) => setEditPriceProduct(p)} onCopyProduct={copyProduct} onDeleteProduct={(p) => setDeleteProductConfirm(p)} searchQuery={search} />
          ) : (
            <ProductGridView products={products} platformSettings={platformSettings} platformPrices={platformPrices} lotFilter={lotFilter} lotOverrides={lotOverrides} onToggleLot={toggleLotOverride} onOrderMore={() => { setMoveType('receive'); setShowMove(true); }} onSelect={(p) => setDetailProduct(p)} onToggleActive={toggleProductActive} onQuickAdjust={(p) => setQuickAdjustProduct(p)} activeBranchId={activeBranchId} variantBranchStock={variantBranchStock} selectedProductIds={selectedProductIds} onToggleSelected={toggleProductSelection} onEditPrice={(p) => setEditPriceProduct(p)} />
          )}
          <Pagination page={productPage} totalPages={Math.max(1, Math.ceil(productTotal / productPageSize))} totalItems={productTotal} pageSize={productPageSize} onPageChange={setProductPage} onPageSizeChange={setProductPageSize} />
        </>
      )}

      {tab === 'movements' && (
        <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => { setMovementImportContext({ branchId: activeBranchId ?? undefined, profileId: profile?.id }); setHistoryImport(true); }} className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> นำเข้าประวัติรายการ
          </Button>
        </div>
        {movements.length === 0 ? (
          <EmptyState icon={<ArrowRightLeft className="w-8 h-8" />} title="ไม่มีประวัติรายการ" description="ทุกครั้งที่รับเข้า/เบิกออก/โอนย้าย จะบันทึกไว้ที่นี่" />
        ) : (
          <Card className="overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">วันที่-เวลา</th>
                    <th className="text-left px-4 py-3 font-medium">สาขา</th>
                    <th className="text-left px-4 py-3 font-medium">ประเภท</th>
                    <th className="text-left px-4 py-3 font-medium">สินค้า/SKU</th>
                    <th className="text-right px-4 py-3 font-medium">จำนวน</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">ช่องทาง</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">มูลค่ารวม</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">ผู้ทำรายการ</th>
                    <th className="text-center px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {movements.map((m) => {
                    const typeConfig: Record<string, { label: string; color: string }> = {
                      receive: { label: 'รับเข้า', color: 'text-success-700 bg-success-100' },
                      withdraw: { label: 'เบิกออก', color: 'text-error-700 bg-error-100' },
                      transfer_in: { label: 'รับโอน', color: 'text-primary-700 bg-primary-100' },
                      transfer_out: { label: 'โอนออก', color: 'text-warning-700 bg-warning-100' },
                      adjust: { label: 'ปรับปรุง', color: 'text-surface-700 bg-surface-100' },
                    };
                    const cfg = typeConfig[m.movement_type] ?? typeConfig.adjust;
                    const totalValue = (Number(m.unit_price) - Number(m.discount_amount)) * Number(m.quantity);
                    const isIn = m.movement_type === 'receive' || m.movement_type === 'transfer_in';
                    return (
                      <tr key={m.id} className="hover:bg-surface-50 transition-colors group">
                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 text-surface-600">{m.branch?.name ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-block px-2 py-1 rounded-lg text-xs font-medium', cfg.color)}>{cfg.label}</span>
                          {m.type_config && <p className="text-xs text-surface-400 mt-0.5">{m.type_config}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-surface-900">{m.products?.name ?? '-'}</p>
                          <p className="text-xs text-surface-400">{m.products?.sku ?? ''}</p>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold', isIn ? 'text-success-600' : 'text-error-600')}>
                          {isIn ? '+' : '-'}{formatNumber(m.quantity)}
                        </td>
                        <td className="px-4 py-3 text-surface-500 hidden lg:table-cell">
                          {m.to_branch ? `→ ${m.to_branch.name}` : m.type_config ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-surface-600 hidden lg:table-cell">
                          {totalValue > 0 ? formatCurrency(totalValue) : '-'}
                        </td>
                        <td className="px-4 py-3 text-surface-500 hidden md:table-cell">
                          {m.profiles?.display_name ?? m.profiles?.first_name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDeleteConfirm(m)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="ลบประวัติ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {movementTotal > movementPageSize && (
              <div className="p-4">
                <Pagination page={movementPage} totalPages={Math.ceil(movementTotal / movementPageSize)} totalItems={movementTotal} pageSize={movementPageSize} onPageChange={setMovementPage} onPageSizeChange={setMovementPageSize} />
              </div>
            )}
          </Card>
        )}
        </div>
      )}

      {tab === 'lowstock' && (
        lowStock.length === 0 ? (
          <EmptyState icon={<Package className="w-8 h-8" />} title="สต๊อกเพียงพอ" description="ไม่มีสินค้าใกล้หมด" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lowStock.map((p, i) => {
              const v = getVariantStockTotal(p, activeBranchId, variantBranchStock);
              const qty = v >= 0 ? v : (activeBranchId ? (p.stock_lots ?? []).filter((l) => l.branch_id === activeBranchId) : (p.stock_lots ?? [])).reduce((s, l) => s + Number(l.quantity), 0) ?? 0;
              return (
                <Card key={p.id} className={cn('p-5 animate-slide-up border-warning-200')}>
                  <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-surface-900">{p.name}</p>
                        <p className="text-xs text-surface-400">{p.sku}</p>
                      </div>
                      <Badge variant="error"><AlertTriangle className="w-3 h-3" /> เหลือ {qty}</Badge>
                    </div>
                    <ProgressBar value={qty} max={p.min_stock * 3} color="warning" label={`ขั้นต่ำ: ${p.min_stock}`} />
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}


      <StockMoveModal
        open={showMove}
        onClose={() => setShowMove(false)}
        type={moveType}
        products={products}
        branches={branches}
        activeBranchId={activeBranchId ?? undefined}
        withdrawalTypes={withdrawalTypes}
        receivingTypes={receivingTypes}
        platformSettings={platformSettings}
        platformPrices={platformPrices}
        profileId={profile?.id}
        onCreated={load}
      />
      <ProductModal open={showProduct} onClose={() => setShowProduct(false)} onCreated={load} platformSettings={platformSettings} profileId={profile?.id} profileName={profile?.display_name ?? profile?.email} branchId={profile?.active_branch_id ?? undefined} />

      {quickAdjustProduct && <QuickAdjustModal product={quickAdjustProduct} profileId={profile?.id} profileName={profile?.display_name ?? profile?.email} branchId={profile?.active_branch_id ?? undefined} onClose={() => setQuickAdjustProduct(null)} onSaved={loadProducts} />}
      <Suspense fallback={null}>
        <ParentVariantImportModal open={showImport} onClose={() => setShowImport(false)} branchId={profile?.active_branch_id ?? undefined} onImported={() => { load(); loadProducts(); }} />
        <Suspense fallback={null}>
          <ImportStockQuantitiesModal open={showStockQtyImport} onClose={() => setShowStockQtyImport(false)} branchId={profile?.active_branch_id ?? undefined} profileId={profile?.id} profileName={profile?.display_name ?? profile?.email} onImported={() => { loadProducts(); loadMovements(); }} />
        </Suspense>
      </Suspense>
      <ErrorBoundary>
        <Suspense fallback={null}>
          {movementImport && (
            <GenericImportModal
              open={!!movementImport}
              onClose={() => setMovementImport(null)}
              config={{ ...IMPORT_CONFIGS[movementImport as ImportableModule], onImported: () => { load(); loadProducts(); } }}
            />
          )}
          {historyImport && (
            <GenericImportModal
              open={!!historyImport}
              onClose={() => setHistoryImport(false)}
              config={{ ...IMPORT_CONFIGS.movementHistory, onImported: () => { loadMovements(); } }}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMovement(deleteConfirm)}
        title="ยืนยันลบประวัติรายการ"
        confirmLabel="ลบถาวร"
        loading={deletingMovement}
      >
        <p>คุณแน่ใจหรือไม่ว่าต้องการลบประวัติรายการนี้ออกจากฐานข้อมูลถาวร?</p>
        <p className="text-xs text-surface-400">คำเตือน: การลบประวัติจะไม่คืนยอดสต็อกกลับให้อัตโนมัติ</p>
        {deleteConfirm && (
          <div className="mt-2 p-3 rounded-lg bg-surface-100 text-xs space-y-1">
            <p><span className="text-surface-400">สินค้า:</span> {deleteConfirm.products?.name ?? '-'}</p>
            <p><span className="text-surface-400">วันที่:</span> {formatDateTime(deleteConfirm.created_at)}</p>
            <p><span className="text-surface-400">ประเภท:</span> {deleteConfirm.movement_type} — {deleteConfirm.type_config ?? '-'}</p>
          </div>
        )}
      </ConfirmDialog>
      {bulkPriceEdit && <BulkPriceEditModal selectedIds={selectedProductIds} products={products} onClose={() => setBulkPriceEdit(false)} onSaved={() => { setBulkPriceEdit(false); setSelectedProductIds(new Set()); loadProducts(); }} />}

      {showMergeModal && (
        <MergeProductsModal
          selectedIds={selectedProductIds}
          products={products}
          onClose={() => setShowMergeModal(false)}
          onMerged={() => { setShowMergeModal(false); setSelectedProductIds(new Set()); loadProducts(); }}
          working={mergeWorking}
          setWorking={setMergeWorking}
        />
      )}

      {editPriceProduct && (() => { const el = getEffectiveLot(lotFilter, lotOverrides[editPriceProduct.id]); const ill: 'old' | 'new' | undefined = el === 'old' ? 'old' : el === 'new' ? 'new' : undefined; return <EditPriceModal productId={editPriceProduct.id} productName={editPriceProduct.name} stockLots={editPriceProduct.stock_lots ?? []} branchId={activeBranchId ?? null} initialLotLabel={ill} onClose={() => setEditPriceProduct(null)} onSaved={() => { setEditPriceProduct(null); loadProducts(); }} />; })()}

      <ConfirmDialog
        open={deleteProductConfirm !== null}
        onClose={() => setDeleteProductConfirm(null)}
        onConfirm={() => { if (deleteProductConfirm) deleteProduct(deleteProductConfirm); }}
        title={`ลบสินค้า "${deleteProductConfirm?.name}"?`}
        confirmLabel={deletingProduct ? 'กำลังลบ...' : 'ลบออก'}
        loading={deletingProduct}
      >
        <p>สินค้านี้และตัวเลือกย่อยทั้งหมดจะถูกลบออกจากระบบ ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </div>
  );
}

// ============ LINE ITEM for bulk add ============
type LineItem = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit: string;
  unit_multiplier: number;
  type_config: string;
  lot_id: string;
  lot_label: 'old' | 'new';
  unit_price: string;
  discount_value: string;
  discount_mode: 'baht' | 'percent';
  variant_id?: string;
};

function StockMoveModal({ open, onClose, type, products, branches, activeBranchId, withdrawalTypes, receivingTypes, platformSettings, platformPrices, profileId, onCreated }: {
  open: boolean;
  onClose: () => void;
  type: 'receive' | 'withdraw' | 'transfer';
  products: Product[];
  branches: { id: string; name: string }[];
  activeBranchId?: string;
  withdrawalTypes: WithdrawalType[];
  receivingTypes: ReceivingType[];
  platformSettings: PlatformSetting[];
  platformPrices: { product_id: string; lot_label: string; platform: string; price: number }[];
  profileId?: string;
  onCreated: () => void;
}) {
  const [branchId, setBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [scanErrorFlash, setScanErrorFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const scanQueueRef = useRef<string[]>([]);
  const scanQueueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeList = type === 'receive' ? receivingTypes : withdrawalTypes;
  const defaultTypeConfig = typeList[0]?.name ?? '';

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => { if (activeBranchId && type !== 'transfer') setBranchId(activeBranchId); }, [activeBranchId, type]);

  const CREDIT_TYPES: Record<string, 'buddy' | 'nike'> = {
    'ขายบัดดี้รอวางบิล': 'buddy',
    'ขายNikeรอวางบิล': 'nike',
  };

  const WITHDRAWAL_GROUPS: { label: string; types: string[] }[] = [
    { label: 'ขายออนไลน์', types: ['Tiktok', 'Lazada', 'Shopee', 'ส่งด่วน_SPX', 'ส่งด่วน_FOOD'] },
    { label: 'ขายรอวางบิล', types: ['ขายบัดดี้รอวางบิล', 'ขายNikeรอวางบิล'] },
    { label: 'ขายราคาทุน', types: ['โอนไปสาขาอื่น', 'รพส.ลาดพร้าว', 'ขายพม่า', 'หมอปรมะ', 'รพส.ศรีวรา'] },
    { label: 'ขายราคาปกติ', types: ['ขายไลน์แอด'] },
    { label: 'ไม่มีมูลค่า / ตียอดเป็น 0', types: ['ปรับสต๊อก', 'ส่งเคลม', 'เติมหน้าร้าน', 'ออกบู๊ท', 'ของแถม'] },
  ];

  const RECEIVING_GROUPS: { label: string; types: string[] }[] = [
    { label: 'รับเข้าราคาทุน', types: ['ซื้อเข้าจากซัพ', 'ซื้อเข้าจากบัดดี้'] },
    { label: 'รับเข้าไม่มีมูลค่า / ตียอดเป็น 0', types: ['ออดิตปรับสต็อก', 'โอนย้ายจากหน้าร้าน', 'โอนย้ายจากสาขาอื่น', 'ของตีกลับ', 'ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า', 'กลับจากบู๊ท', 'ลูกค้ายกเลิก', 'ของแถม'] },
  ];

  function reset() {
    setBranchId(''); setToBranchId(''); setScanInput(''); setLines([]); setNote('');
  }

  function findProductByScan(query: string): { product: Product; barcode?: ProductBarcode; scannedUnit: string; multiplier: number } | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    // 1) Match barcode in product_barcodes
    for (const p of products) {
      const bc = (p.product_barcodes ?? []).find((b) => b.barcode.toLowerCase() === q);
      if (bc) return { product: p, barcode: bc, scannedUnit: bc.unit, multiplier: Number(bc.unit_multiplier) || 1 };
    }
    // 2) Match by SKU
    const bySku = products.find((p) => p.sku.toLowerCase() === q);
    if (bySku) return { product: bySku, scannedUnit: bySku.unit ?? 'ชิ้น', multiplier: 1 };
    // 3) Match by name (partial)
    const byName = products.find((p) => p.name.toLowerCase().includes(q));
    if (byName) return { product: byName, scannedUnit: byName.unit ?? 'ชิ้น', multiplier: 1 };
    return undefined;
  }

  function findProduct(query: string): Product | undefined {
    return findProductByScan(query)?.product;
  }

  function getOnlinePrice(product: Product, typeName: string, lot?: StockLot): string {
    const wt = withdrawalTypes.find((t) => t.name === typeName);
    const platformKey = wt?.platform_link ?? PLATFORM_MAP[typeName];
    if (!platformKey) return String(product.retail_price);
    const lotLabel = lot?.lot_label ?? 'old';
    const saved = platformPrices.find((pp) => pp.product_id === product.id && pp.lot_label === lotLabel && pp.platform === platformKey);
    if (saved && saved.price > 0) return String(saved.price);
    const setting = platformSettings.find((s) => s.platform === platformKey);
    if (!setting) return String(product.retail_price);
    const cost = lot?.cost_price != null ? Number(lot.cost_price) : Number(product.cost_price);
    return String(calcPlatformPrice(cost, platformKey, platformSettings));
  }

  function getPriceForType(product: Product, typeName: string, lot: StockLot | undefined): string {
    const wt = withdrawalTypes.find((t) => t.name === typeName);
    if (!wt) return String(product.retail_price);
    switch (wt.pricing_rule) {
      case 'cost': return String(lot?.cost_price ?? product.cost_price);
      case 'online': return getOnlinePrice(product, typeName, lot);
      case 'zero': return '0';
      default: return String(product.retail_price);
    }
  }

  function getReceivePriceForType(product: Product, typeName: string): string {
    const rt = receivingTypes.find((t) => t.name === typeName);
    if (!rt) return String(product.cost_price);
    switch (rt.pricing_rule) {
      case 'zero': return '0';
      default: return String(product.cost_price);
    }
  }

  function addLine(product: Product, opts?: { scannedUnit?: string; multiplier?: number; barcode?: ProductBarcode }) {
    const scannedUnit = opts?.scannedUnit ?? product.unit ?? 'ชิ้น';
    const multiplier = opts?.multiplier ?? 1;
    const variant = opts?.barcode;
    const availableLots = (product.stock_lots ?? []).filter((l) => !branchId || l.branch_id === branchId);
    const lot = availableLots[0];
    const lotId = lot?.id ?? '';
    const lotLabel = (lot?.lot_label as 'old' | 'new') ?? 'new';
    const price = type === 'receive'
      ? getReceivePriceForType(product, defaultTypeConfig)
      : getPriceForType(product, defaultTypeConfig, lot);
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.product_id === product.id && l.unit === scannedUnit && l.variant_id === (variant?.id ?? undefined));
      if (existingIdx >= 0) {
        const newQty = (Number(prev[existingIdx].quantity) || 0) + 1;
        triggerFlash(existingIdx);
        return prev.map((l, i) => i === existingIdx ? { ...l, quantity: String(newQty) } : l);
      }
      const newIdx = prev.length;
      triggerFlash(newIdx);
      return [...prev, {
        product_id: product.id,
        product_name: multiplier > 1 ? `${product.name} (หน่วย: ${scannedUnit})` : product.name,
        sku: product.sku ?? '',
        quantity: '1',
        unit: scannedUnit,
        unit_multiplier: multiplier,
        type_config: defaultTypeConfig,
        lot_id: lotId,
        lot_label: lotLabel,
        unit_price: price,
        discount_value: '0',
        discount_mode: 'baht',
        variant_id: variant?.id,
      }];
    });
  }

  function triggerFlash(idx: number) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashIdx(idx);
    flashTimer.current = setTimeout(() => setFlashIdx(null), 1000);
  }

  function handleScan() {
    const q = scanInput.trim();
    if (!q) return;
    scanQueueRef.current.push(q);
    setScanInput('');
    if (scanQueueTimer.current) clearTimeout(scanQueueTimer.current);
    scanQueueTimer.current = setTimeout(() => {
      const queue = [...scanQueueRef.current];
      scanQueueRef.current = [];
      for (const item of queue) {
        const match = findProductByScan(item);
        if (match) {
          addLine(match.product, { scannedUnit: match.scannedUnit, multiplier: match.multiplier, barcode: match.barcode });
        } else {
          setToast({ type: 'error', msg: `ไม่พบสินค้าสำหรับ "${item}" — ตรวจสอบบาร์โค้ดหรือ SKU อีกครั้ง` });
          setScanErrorFlash(true);
          setTimeout(() => setScanErrorFlash(false), 500);
        }
      }
      requestAnimationFrame(() => scanRef.current?.focus());
    }, 80);
  }

  function adjustQty(idx: number, delta: number) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const newQty = Math.max(1, (Number(l.quantity) || 0) + delta);
      return { ...l, quantity: String(newQty) };
    }));
  }

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      if (patch.type_config || patch.lot_id) {
        const product = products.find((p) => p.id === l.product_id);
        if (product) {
          const lot = (product.stock_lots ?? []).find((lot) => lot.id === (patch.lot_id ?? l.lot_id));
          updated.unit_price = type === 'receive'
            ? getReceivePriceForType(product, patch.type_config ?? l.type_config)
            : getPriceForType(product, patch.type_config ?? l.type_config, lot);
          if (patch.lot_id) {
            updated.lot_label = (lot?.lot_label as 'old' | 'new') ?? 'new';
          }
        }
      }
      return updated;
    }));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split('\n').map((r) => r.split(',').map((c) => c.trim()));
      const newLines: LineItem[] = [];
      for (const row of rows.slice(1)) {
        if (!row[0]) continue;
        const sku = row[0];
        const scanMatch = findProductByScan(sku);
        const product = scanMatch?.product ?? findProduct(sku);
        if (!product) continue;
        const lot = (product.stock_lots ?? []).filter((l) => !branchId || l.branch_id === branchId)[0];
        newLines.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku ?? '',
          quantity: row[1] || '1',
          unit: row[2] || 'ชิ้น',
          unit_multiplier: scanMatch?.multiplier ?? 1,
          type_config: row[3] || defaultTypeConfig,
          lot_id: lot?.id ?? '',
          lot_label: (lot?.lot_label as 'old' | 'new') ?? 'new',
          unit_price: type === 'receive' ? getReceivePriceForType(product, row[3] || defaultTypeConfig) : getPriceForType(product, row[3] || defaultTypeConfig, lot),
          discount_value: row[4] || '0',
          discount_mode: 'baht',
          variant_id: scanMatch?.barcode?.id,
        });
      }
      setLines((prev) => [...prev, ...newLines]);
      setShowExcel(false);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function downloadTemplate() {
    const header = 'SKU,จำนวน,หน่วย,ประเภท,ส่วนลด\n';
    const example = 'FD-001,10,ชิ้น,Tiktok,0\nFD-002,5,ถุง,Shopee,50\n';
    const blob = new Blob([header + example], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'receive' ? 'template-receive.csv' : 'template-withdraw.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!branchId) { setToast({ type: 'error', msg: 'กรุณาเลือกสาขา' }); return; }
    if (lines.length === 0) { setToast({ type: 'error', msg: 'กรุณาเพิ่มอย่างน้อย 1 รายการ' }); return; }
    if (type === 'transfer' && !toBranchId) { setToast({ type: 'error', msg: 'กรุณาเลือกสาขาปลายทาง' }); return; }
    setLoading(true);
    const movementType = type === 'receive' ? 'receive' : type === 'withdraw' ? 'withdraw' : 'transfer_out';
    let successCount = 0;
    let errorMsg = '';

    try {
      for (const line of lines) {
        const qty = Number(line.quantity) || 0;
        if (qty <= 0) continue;
        const baseQty = qty * (line.unit_multiplier || 1);
        const unitPrice = Number(line.unit_price) || 0;
        const discVal = Number(line.discount_value) || 0;
        const discountAmount = line.discount_mode === 'percent' ? unitPrice * (discVal / 100) : discVal;

        const { data: movementData, error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: line.product_id,
          product_barcode_id: line.variant_id || null,
          branch_id: branchId,
          movement_type: movementType,
          type_config: line.type_config,
          quantity: baseQty,
          lot_id: line.lot_id || null,
          lot_label: line.lot_label,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          discount_percent: line.discount_mode === 'percent' ? discVal : 0,
          reference_note: note || null,
          profile_id: profileId || null,
          to_branch_id: type === 'transfer' ? toBranchId : null,
        }).select('id').single();

        if (moveErr) {
          errorMsg = `บันทึก "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`;
          break;
        }

        const movementId = movementData?.id;
        const variantId = line.variant_id;

        if (type === 'receive') {
          if (variantId) {
            const { data: existingVlp } = await supabase.from('variant_lot_prices')
              .select('id, quantity')
              .eq('product_barcode_id', variantId)
              .eq('lot_label', line.lot_label)
              .maybeSingle();
            if (existingVlp) {
              const newQty = Number(existingVlp.quantity) + baseQty;
              const vlpUpdate: { quantity: number; cost_price?: number; retail_price?: number } = { quantity: newQty };
              if (unitPrice > 0) vlpUpdate.cost_price = unitPrice;
              if (unitPrice > 0) vlpUpdate.retail_price = unitPrice;
              const { error: vlpErr } = await supabase.from('variant_lot_prices').update(vlpUpdate).eq('id', existingVlp.id);
              if (vlpErr) { errorMsg = `บันทึกข้อมูลรุ่นย่อย "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
            } else {
              const { error: vlpErr } = await supabase.from('variant_lot_prices').insert({
                product_barcode_id: variantId,
                lot_label: line.lot_label,
                quantity: baseQty,
                cost_price: unitPrice,
                retail_price: unitPrice,
              });
              if (vlpErr) { errorMsg = `บันทึกข้อมูลรุ่นย่อย "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
            }
          }
          const { data: existingLot } = await supabase.from('stock_lots')
            .select('id, quantity')
            .eq('product_id', line.product_id)
            .eq('branch_id', branchId)
            .eq('lot_label', line.lot_label)
            .maybeSingle();

          if (existingLot) {
            const newQty = Number(existingLot.quantity) + baseQty;
            const lotUpdate: { quantity: number; cost_price?: number; product_barcode_id?: string } = { quantity: newQty };
            if (unitPrice > 0) lotUpdate.cost_price = unitPrice;
            if (variantId) lotUpdate.product_barcode_id = variantId;
            const { error: lotErr } = await supabase.from('stock_lots').update(lotUpdate).eq('id', existingLot.id);
            if (lotErr) { errorMsg = `บันทึกล็อตสินค้า "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
          } else {
            const { error: lotErr } = await supabase.from('stock_lots').insert({
              product_id: line.product_id,
              branch_id: branchId,
              lot_label: line.lot_label,
              quantity: baseQty,
              cost_price: unitPrice,
              product_barcode_id: variantId || null,
            });
            if (lotErr) { errorMsg = `บันทึกล็อตสินค้า "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
          }
        } else if (type === 'withdraw' || type === 'transfer') {
          if (variantId) {
            if (line.lot_id) {
              const { data: curLot } = await supabase.from('variant_lot_prices').select('id, quantity').eq('id', line.lot_id).maybeSingle();
              const curQty = Number(curLot?.quantity ?? 0);
              if (curQty < baseQty) {
                errorMsg = `สต๊อกล็อต${line.lot_label === 'old' ? 'เก่า' : 'ใหม่'} ไม่พอสำหรับ ${line.product_name} (มี ${curQty} ต้องการ ${baseQty})`;
                break;
              }
              const newQty = Math.max(0, curQty - baseQty);
              const { error: vlpErr } = await supabase.from('variant_lot_prices').update({ quantity: newQty }).eq('id', line.lot_id);
              if (vlpErr) { errorMsg = `ตัดสต๊อกรุ่นย่อย "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
            } else {
              const { data: vLots } = await supabase.from('variant_lot_prices')
                .select('id, lot_label, quantity, received_date, created_at')
                .eq('product_barcode_id', variantId)
                .order('received_date', { ascending: true });
              const picks = computeFifoPicks(vLots ?? [], baseQty);
              if (picks.length === 0) {
                errorMsg = `สต๊อก variant ไม่เพียงพอสำหรับ ${line.product_name}`;
                break;
              }
              const totalPickable = picks.reduce((s, p) => s + p.take, 0);
              if (totalPickable < baseQty) {
                errorMsg = `สต๊อก variant ไม่เพียงพอสำหรับ ${line.product_name} (มี ${totalPickable} ต้องการ ${baseQty})`;
                break;
              }
              for (const pick of picks) {
                const { data: curLot } = await supabase.from('variant_lot_prices').select('quantity').eq('id', pick.lot_id).maybeSingle();
                const curQty = Number(curLot?.quantity ?? 0);
                const newQty = Math.max(0, curQty - pick.take);
                const { error: vlpErr } = await supabase.from('variant_lot_prices').update({ quantity: newQty }).eq('id', pick.lot_id);
                if (vlpErr) { errorMsg = `ตัดสต๊อกรุ่นย่อย "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
              }
              if (errorMsg) break;
            }
          }
          if (line.lot_id && !variantId) {
            const { data: lotData } = await supabase.from('stock_lots').select('quantity').eq('id', line.lot_id).maybeSingle();
            const currentQty = Number(lotData?.quantity ?? 0);
            const newQty = Math.max(0, currentQty - baseQty);
            const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: newQty }).eq('id', line.lot_id);
            if (lotErr) { errorMsg = `ตัดสต๊อก "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
          }
          if (type === 'transfer' && toBranchId) {
            const { data: destLot } = await supabase.from('stock_lots')
              .select('id, quantity')
              .eq('product_id', line.product_id)
              .eq('branch_id', toBranchId)
              .eq('lot_label', line.lot_label)
              .maybeSingle();
            if (destLot) {
              const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: Number(destLot.quantity) + baseQty }).eq('id', destLot.id);
              if (lotErr) { errorMsg = `เพิ่มสต๊อกสาขาปลายทาง "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
            } else {
              const { error: lotErr } = await supabase.from('stock_lots').insert({
                product_id: line.product_id,
                branch_id: toBranchId,
                lot_label: line.lot_label,
                quantity: baseQty,
                cost_price: unitPrice,
                product_barcode_id: variantId || null,
              });
              if (lotErr) { errorMsg = `เพิ่มสต๊อกสาขาปลายทาง "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
            }
            if (variantId) {
              const { data: destVlp } = await supabase.from('variant_lot_prices')
                .select('id, quantity')
                .eq('product_barcode_id', variantId)
                .eq('lot_label', line.lot_label)
                .maybeSingle();
              if (destVlp) {
                const { error: vlpErr } = await supabase.from('variant_lot_prices').update({ quantity: Number(destVlp.quantity) + baseQty }).eq('id', destVlp.id);
                if (vlpErr) { errorMsg = `เพิ่มสต๊อกรุ่นย่อยสาขาปลายทาง "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
              } else {
                const { error: vlpErr } = await supabase.from('variant_lot_prices').insert({
                  product_barcode_id: variantId,
                  lot_label: line.lot_label,
                  quantity: baseQty,
                  cost_price: unitPrice,
                  retail_price: unitPrice,
                });
                if (vlpErr) { errorMsg = `เพิ่มสต๊อกรุ่นย่อยสาขาปลายทาง "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
              }
            }
          }

          const billType = CREDIT_TYPES[line.type_config];
          if (billType) {
            const { error: billErr } = await supabase.from('cs_pending_bills').insert({
              movement_id: movementId,
              product_id: line.product_id,
              branch_id: branchId,
              bill_type: billType,
              quantity: baseQty,
              unit_price: unitPrice,
              total_amount: (unitPrice - discountAmount) * baseQty,
              status: 'pending',
              lot_label: line.lot_label,
              withdrawn_at: new Date().toISOString(),
            });
            if (billErr) { errorMsg = `สร้างรายการรอวางบิล "${line.product_name}" ไม่สำเร็จ กรุณาลองอีกครั้ง`; break; }
          }
        }

        successCount++;
      }
    } catch (err: any) {
      errorMsg = `เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง หากยัไม่สำเร็จโปรดติดต่อผู้ดูแลระบบ`;
    }

    setLoading(false);

    if (errorMsg) {
      setToast({ type: 'error', msg: errorMsg });
    } else {
      setToast({ type: 'success', msg: `บันทึกสำเร็จ ${successCount} รายการ` });
      onClose(); onCreated(); reset();
    }
  }

  const title = type === 'receive' ? 'รับสินค้าเข้า' : type === 'withdraw' ? 'เบิกสินค้าออก' : 'โอนสินค้าระหว่างสาขา';
  const totalValue = lines.reduce((sum, l) => {
    const price = Number(l.unit_price) || 0;
    const disc = l.discount_mode === 'percent' ? price * (Number(l.discount_value) / 100) : Number(l.discount_value) || 0;
    return sum + (price - disc) * (Number(l.quantity) || 0);
  }, 0);

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-5">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}
        {/* Branch — auto from header for receive/withdraw, picker for transfer */}
        <div className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-surface-500" />
            <p className="text-sm font-semibold text-surface-700">สาขาที่ทำรายการ <HelpTooltip text="สาขาที่สินค้าจะถูกรับเข้าหรือเบิกออก สำหรับการโอน ให้เลือกทั้งสาขาต้นทางและสาขาปลายทาง" /></p>
          </div>
          {type !== 'transfer' ? (
            <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 flex items-center gap-2">
              <span className="text-sm text-primary-700 font-medium">
                {branches.find((b) => b.id === branchId)?.name ?? '—'}
              </span>
              <span className="text-xs text-primary-500 ml-auto">(อ้างอิงจากสาขาที่เลือกไว้ด้านบน)</span>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1.5 block">สาขาต้นทาง</label>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBranchId(b.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                      branchId === b.id
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20 scale-105'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {type === 'transfer' && (
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1.5 block">โอนไปสาขา <HelpTooltip text="สาขาปลายทางที่จะรับสินค้าที่โอน ต้องเป็นคนละสาขาจากต้นทาง" /></label>
              <div className="flex flex-wrap gap-2">
                {branches.filter((b) => b.id !== branchId).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setToBranchId(b.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      toBranchId === b.id
                        ? 'bg-success-600 text-white shadow-md shadow-success-600/20 scale-105'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barcode/SKU scan + Excel import */}
        <div className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-surface-500" />
            <p className="text-sm font-semibold text-surface-700">สแกนสินค้า <HelpTooltip text="สแกนบาร์โค้ดหรือพิมพ์ SKU แล้วกด Enter ระบบจะค้นหาสินค้าและเพิ่มเข้ารายการอัตโนมัติ หากสแกนซ้ำจะเพิ่มจำนวนให้อัตโนมัติ รองรับการยิงต่อเนื่องหลายชนิดสลับกัน" /></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                ref={scanRef}
                className={cn('input-base pl-11', scanErrorFlash && 'animate-scan-error border-error-400')}
                placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }}
                autoFocus
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleScan}><Plus className="w-4 h-4" /> เพิ่ม</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowExcel(!showExcel)}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          </div>

          {showExcel && (
            <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="w-4 h-4" /> เลือกไฟล์ CSV</Button>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4" /> ดาวน์โหลดแม่แบบ</Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleExcelUpload} />
              </div>
              <p className="text-xs text-surface-500">รูปแบบ: SKU, จำนวน, หน่วย, ประเภท, ส่วนลด — ระบบจะค้นสินค้าจาก SKU และเพิ่มเข้ารายการอัตโนมัติ</p>
            </div>
          )}
        </div>

        {/* Line items */}
        {lines.length > 0 && (
          <div className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-surface-700">รายการ ({lines.length})</p>
              <Button variant="ghost" size="sm" onClick={() => setLines([])}><Trash2 className="w-3.5 h-3.5" /> ล้างทั้งหมด</Button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {lines.map((line, idx) => {
                const product = products.find((p) => p.id === line.product_id);
                const parentLots = (product?.stock_lots ?? []).filter((l) => (!branchId || l.branch_id === branchId) && l.quantity > 0);
                const variant = product?.product_barcodes?.find((v) => v.id === line.variant_id);
                const variantLots = (variant?.variant_lot_prices ?? []).filter((l) => l.quantity > 0);
                const hasVariantLots = variantLots.length > 0;
                const availableLotOptions = hasVariantLots
                  ? variantLots.map((vl) => ({ id: vl.id, lot_label: vl.lot_label, cost_price: vl.cost_price, quantity: vl.quantity, isVariant: true }))
                  : parentLots.map((sl) => ({ id: sl.id, lot_label: sl.lot_label, cost_price: sl.cost_price, quantity: sl.quantity, isVariant: false }));
                return (
                  <div key={idx} className={cn('p-3 rounded-xl bg-surface-50 border space-y-2 transition-colors', flashIdx === idx ? 'border-success-400 animate-flash-row' : 'border-surface-200')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-surface-900 truncate">{line.product_name}</p>
                        <p className="text-xs text-surface-400">{line.sku}</p>
                        {line.unit_multiplier > 1 && (
                          <p className="text-xs text-primary-600">1 {line.unit} = {line.unit_multiplier} {product?.unit ?? 'ชิ้น'}</p>
                        )}
                      </div>
                      <button onClick={() => removeLine(idx)} className="p-1 rounded-lg hover:bg-error-100 text-surface-400 hover:text-error-600 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-surface-500">จำนวน</label>
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjustQty(idx, -1)} className="shrink-0 w-8 h-8 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input className="input-base text-sm py-1.5 text-center min-w-0 flex-1" type="number" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                          <button onClick={() => adjustQty(idx, 1)} className="shrink-0 w-8 h-8 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors flex items-center justify-center">
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-surface-500">หน่วยนับ</label>
                        <select className="input-base text-sm py-1.5 cursor-pointer" value={line.unit} onChange={(e) => updateLine(idx, { unit: e.target.value })}>
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-surface-500 flex items-center gap-1">ประเภท{type === 'receive' ? 'การรับเข้า' : 'การเบิกออก'} <HelpTooltip text={type === 'receive' ? 'ประเภทการรับสินค้าเข้า เช่น ซื้อจากซัพพลายเออร์ โอนย้ายจากสาขาอื่น แต่ละประเภทมีผลต่อการคำนวณราคาทุน' : 'ประเภทการเบิกสินค้าออก เช่น ขายออนไลน์ ขายราคาทุน ปรับสต๊อก แต่ละประเภทมีผลต่อการคำนวณราคาและบัญชี'} /></label>
                        <select className="input-base text-sm py-1.5 cursor-pointer" value={line.type_config} onChange={(e) => updateLine(idx, { type_config: e.target.value })}>
                          {(type === 'receive' ? RECEIVING_GROUPS : WITHDRAWAL_GROUPS).map((grp) => (
                            <optgroup key={grp.label} label={grp.label}>
                              {grp.types.filter((name) => typeList.some((t) => t.name === name)).map((name) => {
                                const t = typeList.find((tt) => tt.name === name);
                                return t ? <option key={t.id} value={t.name}>{t.name}</option> : null;
                              })}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {type === 'receive' ? (
                        <div className="col-span-2">
                          <label className="text-xs text-surface-500">ทุน (บาท)</label>
                          <input className="input-base text-sm py-1.5" type="number" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                        </div>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <label className="text-xs text-surface-500">ราคาที่ใช้ (บาท)</label>
                            <input className="input-base text-sm py-1.5" type="number" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                          </div>
                          {availableLotOptions.length > 0 && (
                            <div className="col-span-2">
                              <label className="text-xs text-surface-500 flex items-center gap-1">เลือกล็อต {hasVariantLots && <span className="text-primary-600">(รุ่นย่อย)</span>} <HelpTooltip text="เลือกล็อตสินค้าที่ต้องการเบิก ล็อตเก่าจะถูกเบิกก่อนล็อตใหม่ตามหลัก FIFO หากมีรุ่นย่อยจะเลือกจากสต๊อกของรุ่นย่อยโดยเฉพาะ" /></label>
                              <select className="input-base text-sm py-1.5 cursor-pointer" value={line.lot_id} onChange={(e) => {
                                const selectedLot = availableLotOptions.find((l) => l.id === e.target.value);
                                updateLine(idx, { lot_id: e.target.value, lot_label: (selectedLot?.lot_label as 'old' | 'new') ?? line.lot_label });
                              }}>
                                <option value="">— เลือกล็อต —</option>
                                {availableLotOptions.map((lot) => (
                                  <option key={lot.id} value={lot.id}>
                                    {lot.lot_label === 'old' ? 'ทุนเก่า' : 'ทุนใหม่'} — {formatCurrency(lot.cost_price)} (เหลือ {lot.quantity})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {type === 'receive' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-surface-500 flex items-center gap-1.5">
                          <input type="checkbox" checked={line.lot_label === 'new'} onChange={(e) => updateLine(idx, { lot_label: e.target.checked ? 'new' : 'old' })} className="rounded" />
                          เป็นล็อตใหม่ (แยกจากล็อตเก่า)
                        </label>
                      </div>
                    )}
                    {type !== 'receive' && (
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="text-xs text-surface-500">ส่วนลดลูกค้า</label>
                          <input className="input-base text-sm py-1.5" type="number" value={line.discount_value} onChange={(e) => updateLine(idx, { discount_value: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-surface-500 flex items-center gap-1">ประเภทส่วนลด <HelpTooltip text="เลือกลดเป็นบาท (จำนวนเงินตรงๆ) หรือลดเป็นเปอร์เซ็นต์ (คำนวณจากราคาสินค้า)" /></label>
                          <select className="input-base text-sm py-1.5 cursor-pointer" value={line.discount_mode} onChange={(e) => updateLine(idx, { discount_mode: e.target.value as 'baht' | 'percent' })}>
                            <option value="baht">บาท</option>
                            <option value="percent">%</option>
                          </select>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-surface-400">รวม</p>
                          <p className="text-sm font-semibold text-surface-900">
                            {formatCurrency((Number(line.unit_price) - (line.discount_mode === 'percent' ? Number(line.unit_price) * (Number(line.discount_value) / 100) : Number(line.discount_value))) * (Number(line.quantity) || 0))}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Note + Total + Submit */}
        <div className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3 shadow-sm">
          <Input label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เลขที่เอกสาร, ชื่อซัพพลายเออร์, เลขใบสั่งซื้อ" />
          {lines.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50">
              <span className="text-sm text-surface-600">มูลค่ารวมทั้งหมด</span>
              <span className="text-lg font-bold text-primary-600">{formatCurrency(totalValue)}</span>
            </div>
          )}
          <Button onClick={submit} loading={loading} disabled={!branchId || lines.length === 0 || (type === 'transfer' && !toBranchId)} className="w-full">
            ยืนยัน ({lines.length} รายการ)
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({ open, onClose, onCreated, platformSettings, profileId, profileName, branchId }: {
  open: boolean; onClose: () => void; onCreated: () => void;
  platformSettings: PlatformSetting[]; profileId?: string; profileName?: string; branchId?: string;
}) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [unit, setUnit] = useState('ชิ้น');
  const [minStock, setMinStock] = useState('5');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [oldCost, setOldCost] = useState('');
  const [newCost, setNewCost] = useState('');
  const [oldRetail, setOldRetail] = useState('');
  const [newRetail, setNewRetail] = useState('');
  const [oldQty, setOldQty] = useState('');
  const [newQty, setNewQty] = useState('');
  const [oldLotNumber, setOldLotNumber] = useState('');
  const [newLotNumber, setNewLotNumber] = useState('');
  const [oldExpiry, setOldExpiry] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const [barcodes, setBarcodes] = useState<{ barcode: string; unit: string; unit_multiplier: number; label: string; image_url: string; price: string; stock_qty: string; is_available: boolean }[]>([
    { barcode: '', unit: 'piece', unit_multiplier: 1, label: '', image_url: '', price: '', stock_qty: '', is_available: true },
  ]);

  const [platformPrices, setPlatformPrices] = useState<Record<string, { old: string; new: string }>>({});

  const competitors = [
    { platform: 'tiktok', label: 'TikTok Shop' },
    { platform: 'shopee', label: 'Shopee' },
    { platform: 'lazada', label: 'Lazada' },
    { platform: 'line', label: 'LINE MyShop' },
  ];

  useEffect(() => {
    if (!open) return;
    setSku(''); setName(''); setCategory(''); setBrand(''); setDescription(''); setNote('');
    setUnit('ชิ้น'); setMinStock('5'); setIsActive(true); setImageUrl(null); setError('');
    setOldCost(''); setNewCost(''); setOldRetail(''); setNewRetail(''); setOldQty(''); setNewQty('');
    setOldLotNumber(''); setNewLotNumber(''); setOldExpiry(''); setNewExpiry('');
    setBarcodes([{ barcode: '', unit: 'piece', unit_multiplier: 1, label: '', image_url: '', price: '', stock_qty: '', is_available: true }]);
    setPlatformPrices({});
  }, [open]);

  function calcAutoPrice(costStr: string, platform: string): number {
    const cost = Number(costStr);
    if (!cost || cost <= 0) return 0;
    return calcPlatformPrice(cost, platform, platformSettings);
  }

  function getMargin(cost: number, price: number): number {
    if (!price || price <= 0) return 0;
    return Math.round(((price - cost) / price) * 100);
  }

  function addBarcodeRow() {
    setBarcodes((prev) => [...prev, { barcode: '', unit: 'piece', unit_multiplier: 1, label: '', image_url: '', price: '', stock_qty: '', is_available: true }]);
  }
  function removeBarcodeRow(idx: number) {
    setBarcodes((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateBarcode(idx: number, field: 'barcode' | 'unit' | 'unit_multiplier' | 'label' | 'image_url' | 'price' | 'stock_qty' | 'is_available', value: string | boolean) {
    setBarcodes((prev) => prev.map((b, i) => i === idx ? {
      ...b,
      [field]: field === 'unit_multiplier' ? Number(value) || 1
        : field === 'is_available' ? Boolean(value)
        : field === 'price' || field === 'stock_qty' ? String(value)
        : String(value),
    } : b));
  }

  async function submit() {
    if (!sku.trim() || !name.trim()) { setError('กรุณากรอก SKU และชื่อสินค้า'); return; }
    setLoading(true); setError('');
    try {
      const costPrice = Number(newCost || oldCost) || 0;
      const retailPrice = Number(newRetail || oldRetail) || 0;

      const { data: product, error: insErr } = await supabase.from('products').insert({
        sku, name, category: category || null, brand: brand || null,
        description: description || null, note: note || null, unit: unit || 'ชิ้น',
        cost_price: costPrice, retail_price: retailPrice, image_url: imageUrl,
        min_stock: Number(minStock) || 5, is_active: isActive,
      }).select('id').single();
      if (insErr) throw new Error(insErr.message);

      const productId = product.id;

      if (branchId) {
        if (oldCost && oldQty) {
          const { error: lotErr } = await supabase.from('stock_lots').insert({
            product_id: productId, branch_id: branchId, lot_label: 'old',
            quantity: Number(oldQty) || 0, cost_price: Number(oldCost) || 0,
            retail_price: Number(oldRetail) || 0, lot_number: oldLotNumber || null,
            expiry_date: oldExpiry || null,
          });
          if (lotErr) throw new Error(lotErr.message);
          await supabase.from('stock_movements').insert({
            product_id: productId, branch_id: branchId, movement_type: 'receive',
            type_config: 'รับเข้าจากการสร้างสินค้า', quantity: Number(oldQty) || 0,
            unit_price: Number(oldCost) || 0, discount_amount: 0, discount_percent: 0,
            reference_note: `สร้างสินค้าใหม่ (ล็อตเก่า): ${name}`, profile_id: profileId ?? null,
          });
        }
        if (newCost && newQty) {
          const { error: lotErr } = await supabase.from('stock_lots').insert({
            product_id: productId, branch_id: branchId, lot_label: 'new',
            quantity: Number(newQty) || 0, cost_price: Number(newCost) || 0,
            retail_price: Number(newRetail) || 0, lot_number: newLotNumber || null,
            expiry_date: newExpiry || null,
          });
          if (lotErr) throw new Error(lotErr.message);
          await supabase.from('stock_movements').insert({
            product_id: productId, branch_id: branchId, movement_type: 'receive',
            type_config: 'รับเข้าจากการสร้างสินค้า', quantity: Number(newQty) || 0,
            unit_price: Number(newCost) || 0, discount_amount: 0, discount_percent: 0,
            reference_note: `สร้างสินค้าใหม่ (ล็อตใหม่): ${name}`, profile_id: profileId ?? null,
          });
        }
      }

      const validBarcodes = barcodes.filter((b) => b.barcode.trim() || b.label.trim());
      for (const bc of validBarcodes) {
        const { error: bcErr } = await supabase.from('product_barcodes').insert({
          product_id: productId, barcode: bc.barcode.trim(), unit: bc.unit, unit_multiplier: bc.unit_multiplier,
          label: bc.label.trim() || null, image_url: bc.image_url || null,
          price: Number(bc.price) || 0, stock_qty: Number(bc.stock_qty) || 0, is_available: bc.is_available,
        });
        if (bcErr) throw new Error(bcErr.message);
      }

      const priceUpserts: { product_id: string; lot_label: string; platform: string; price: number; cost_price: number; margin_percent: number }[] = [];
      for (const c of competitors) {
        const pp = platformPrices[c.platform];
        if (pp) {
          if (pp.old && Number(pp.old) > 0) {
            const cost = Number(oldCost) || 0;
            priceUpserts.push({ product_id: productId, lot_label: 'old', platform: c.platform, price: Number(pp.old), cost_price: cost, margin_percent: getMargin(cost, Number(pp.old)) });
          }
          if (pp.new && Number(pp.new) > 0) {
            const cost = Number(newCost) || 0;
            priceUpserts.push({ product_id: productId, lot_label: 'new', platform: c.platform, price: Number(pp.new), cost_price: cost, margin_percent: getMargin(cost, Number(pp.new)) });
          }
        }
      }
      if (priceUpserts.length > 0) {
        const { error: ppErr } = await supabase.from('product_platform_prices').upsert(priceUpserts, { onConflict: 'product_id,lot_label,platform' });
        if (ppErr) throw new Error(ppErr.message);
      }

      await supabase.from('product_audit_logs').insert({
        product_id: productId, action: 'create', actor_profile_id: profileId ?? null, actor_name: profileName ?? null,
        new_value: { sku, name, category, brand, unit, cost_price: costPrice, retail_price: retailPrice, image_url: imageUrl, barcodes: validBarcodes, platform_prices: priceUpserts },
        note: `สร้างสินค้าใหม่: ${name}`,
      });

      onClose(); onCreated();
    } catch (err: any) {
      setError(err.message ?? 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มสินค้าใหม่" size="xl">
      <div className="space-y-5 max-h-[80vh] overflow-y-auto">
        {error && <div className="p-3 rounded-xl bg-error-50 text-error-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {/* Basic info */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-surface-700">ข้อมูลพื้นฐาน</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="SKU *" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="เช่น FD-001" />
            <Input label="ชื่อสินค้า *" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="หมวดหมู่" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="อาหาร, ของใช้..." />
            <Input label="แบรนด์" value={brand} onChange={(e) => setBrand(e.target.value)} />
            <Input label="ขนาดบรรจุ" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="เช่น 1kg, 500ml" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">หน่วยฐาน</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-base">
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Input label="แจ้งเตือนต่ำกว่า (สต็อกขั้นต่ำ)" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">หมายเหตุ</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-base" placeholder="หมายเหตุเพิ่มเติม..." />
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-surface-700">รูปภาพสินค้า</p>
          <ImageUploader value={imageUrl ?? ''} onChange={(url: string) => setImageUrl(url || null)} />
        </div>

        {/* Variants (sub-units) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-surface-700">ราคา สต๊อก และหน่วยนับย่อย</p>
            <Button size="sm" variant="ghost" onClick={addBarcodeRow}><Plus className="w-3.5 h-3.5" /> เพิ่มหน่วยนับย่อย</Button>
          </div>
          <div className="table-scroll">
            <table className="w-full text-sm border border-surface-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-surface-500 bg-surface-50">
                  <th className="px-2 py-2 min-w-[140px]">ชื่อหน่วยนับย่อย</th>
                  <th className="px-2 py-2 w-20 text-center">รูปภาพ</th>
                  <th className="px-2 py-2 w-24 text-right">ราคา</th>
                  <th className="px-2 py-2 min-w-[120px]">บาร์โค้ด/SKU</th>
                  <th className="px-2 py-2 w-20 text-right">จำนวน</th>
                  <th className="px-2 py-2 w-16 text-center">หน่วย</th>
                  <th className="px-2 py-2 w-16 text-center">ตัวคูณ</th>
                  <th className="px-2 py-2 w-12 text-center">เปิด</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {barcodes.map((bc, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="px-2 py-1.5">
                      <input value={bc.label} onChange={(e) => updateBarcode(idx, 'label', e.target.value)} placeholder="เช่น แซมพูแมว 300มล." className="input-base !py-1 !px-2 !text-sm w-full" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <VariantImageUploader value={bc.image_url} onChange={(url) => updateBarcode(idx, 'image_url', url)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={bc.price} onChange={(e) => updateBarcode(idx, 'price', e.target.value)} placeholder="0" className="input-base !py-1 !px-2 !text-sm w-full text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={bc.barcode} onChange={(e) => updateBarcode(idx, 'barcode', e.target.value)} placeholder="บาร์โค้ด/SKU" className="input-base !py-1 !px-2 !text-sm w-full font-mono" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={bc.stock_qty} onChange={(e) => updateBarcode(idx, 'stock_qty', e.target.value)} placeholder="0" className="input-base !py-1 !px-2 !text-sm w-full text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={bc.unit} onChange={(e) => updateBarcode(idx, 'unit', e.target.value)} className="input-base !py-1 !px-2 !text-sm w-full">
                        <option value="piece">ชิ้น</option>
                        <option value="dozen">โหล</option>
                        <option value="carton">ลัง</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={bc.unit_multiplier} onChange={(e) => updateBarcode(idx, 'unit_multiplier', e.target.value)} className="input-base !py-1 !px-2 !text-sm w-full text-center" />
                    </td>
                    <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <ToggleSwitch checked={bc.is_available} onChange={() => updateBarcode(idx, 'is_available', !bc.is_available)} size="sm" label="เปิด/ปิดหน่วยนับย่อย" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {barcodes.length > 1 && (
                        <button onClick={() => removeBarcodeRow(idx)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50"><X className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lots: old + new */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-surface-700">ล็อตสินค้า (ต้นทุน / ราคา / จำนวน)</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Old lot */}
            <div className="p-4 rounded-xl border border-warning-200 bg-warning-50/30 space-y-3">
              <div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-lg bg-warning-500 text-white text-xs font-bold">ล็อตเก่า</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="ทุนเก่า" type="number" value={oldCost} onChange={(e) => setOldCost(e.target.value)} />
                <Input label="หน้าร้านเก่า" type="number" value={oldRetail} onChange={(e) => setOldRetail(e.target.value)} />
                <Input label="จำนวน" type="number" value={oldQty} onChange={(e) => setOldQty(e.target.value)} />
                <Input label="เลขล็อต" value={oldLotNumber} onChange={(e) => setOldLotNumber(e.target.value)} />
                <Input label="วันหมดอายุ" type="date" value={oldExpiry} onChange={(e) => setOldExpiry(e.target.value)} />
              </div>
            </div>
            {/* New lot */}
            <div className="p-4 rounded-xl border border-success-200 bg-success-50/30 space-y-3">
              <div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-lg bg-success-500 text-white text-xs font-bold">ล็อตใหม่</span><span className="text-xs text-surface-400">(เว้นว่างได้ถ้ายังไม่มี)</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="ทุนใหม่" type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
                <Input label="หน้าร้านใหม่" type="number" value={newRetail} onChange={(e) => setNewRetail(e.target.value)} />
                <Input label="จำนวน" type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                <Input label="เลขล็อต" value={newLotNumber} onChange={(e) => setNewLotNumber(e.target.value)} />
                <Input label="วันหมดอายุ" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Platform prices */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-surface-700">ราคาออนไลน์ (แพลตฟอร์มต่าง ๆ)</p>
          <p className="text-xs text-surface-400">ระบบคำนวณอัตโนมัติจากต้นทุน + Margin ที่ตั้งไว้ แก้ไขได้</p>
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-surface-500">
                  <th className="pb-2 pr-3">แพลตฟอร์ม</th>
                  <th className="pb-2 px-3">ทุนเก่า → ราคา (Margin)</th>
                  <th className="pb-2 px-3">ทุนใหม่ → ราคา (Margin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {competitors.map((c) => {
                  const pp = platformPrices[c.platform] ?? { old: '', new: '' };
                  const autoOld = oldCost ? String(calcAutoPrice(oldCost, c.platform)) : '';
                  const autoNew = newCost ? String(calcAutoPrice(newCost, c.platform)) : '';
                  const marginOld = pp.old ? getMargin(Number(oldCost) || 0, Number(pp.old)) : (autoOld ? getMargin(Number(oldCost) || 0, Number(autoOld)) : 0);
                  const marginNew = pp.new ? getMargin(Number(newCost) || 0, Number(pp.new)) : (autoNew ? getMargin(Number(newCost) || 0, Number(autoNew)) : 0);
                  return (
                    <tr key={c.platform}>
                      <td className="py-2 pr-3 font-medium text-surface-700 whitespace-nowrap">{c.label}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={pp.old || autoOld}
                            onChange={(e) => setPlatformPrices((prev) => ({ ...prev, [c.platform]: { ...(prev[c.platform] ?? { old: '', new: '' }), old: e.target.value } }))}
                            placeholder={autoOld || '0'}
                            className="input-base !py-1 !px-2 w-24 text-sm"
                          />
                          <span className="text-xs text-surface-400 whitespace-nowrap">({marginOld}%)</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={pp.new || autoNew}
                            onChange={(e) => setPlatformPrices((prev) => ({ ...prev, [c.platform]: { ...(prev[c.platform] ?? { old: '', new: '' }), new: e.target.value } }))}
                            placeholder={autoNew || '0'}
                            className="input-base !py-1 !px-2 w-24 text-sm"
                          />
                          <span className="text-xs text-surface-400 whitespace-nowrap">({marginNew}%)</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status */}
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
          เปิดใช้งานสินค้านี้ (ขายได้)
        </label>

        <div className="flex gap-3 pt-2 sticky bottom-0 bg-white -mx-1 px-1 py-2 border-t border-surface-100">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={submit} loading={loading} className="flex-1">เพิ่มสินค้า</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ VARIANT IMAGE UPLOADER (compact, for table rows) ============
function VariantImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
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
        className="w-10 h-10 rounded-lg border border-surface-200 bg-surface-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 transition-colors"
        onClick={() => value ? inputRef.current?.click() : inputRef.current?.click()}
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

// ============ PRODUCT LIST VIEW ============
function ToggleSwitch({ checked, onChange, label, size = 'md' }: { checked: boolean; onChange: () => void; label?: string; size?: 'md' | 'sm' }) {
  const dims = size === 'sm'
    ? { w: 'w-9', h: 'h-5', knob: 'w-4 h-4', translate: 'translate-x-4', top: 'top-0.5', left: 'left-0.5' }
    : { w: 'w-11', h: 'h-6', knob: 'w-5 h-5', translate: 'translate-x-5', top: 'top-0.5', left: 'left-0.5' };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn('relative rounded-full transition-colors duration-200 shrink-0', dims.w, dims.h, checked ? 'bg-primary-600' : 'bg-surface-300')}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
    >
      <span className={cn('absolute rounded-full bg-white shadow-sm transition-transform duration-200', dims.knob, dims.top, dims.left, checked && dims.translate)} />
    </button>
  );
}

function InlineEditCell({ displayValue, editValue, onSave, variant = 'default' }: { displayValue: string; editValue: string; onSave: (v: number) => void; variant?: 'default' | 'plain' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);

  function commit() {
    const num = Number(draft);
    if (Number.isFinite(num) && num >= 0) onSave(num);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={commit}
          className="w-20 px-2 py-1 text-sm rounded-lg border border-primary-400 bg-white outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn('inline-flex items-center gap-1 rounded-lg transition-colors group/edit w-full justify-between', variant === 'default' ? 'px-1.5 py-0.5 hover:bg-surface-100 text-surface-700' : 'px-0 py-0 hover:bg-black/5 text-inherit')}
    >
      <span className="font-bold text-[11px]">{displayValue}</span>
      <ChevronRight className={cn('w-3 h-3 transition-colors shrink-0', variant === 'default' ? 'text-surface-400 group-hover/edit:text-primary-500' : 'opacity-50 group-hover/edit:opacity-100')} />
    </button>
  );
}

const CHANNEL_CHIP_STYLES: Record<string, { colorVar: string; bgVar: string }> = {
  retail: { colorVar: 'var(--color-surface-800)', bgVar: 'var(--color-surface-100)' },
  lazada: { colorVar: 'rgb(var(--ch-lazada) / 1)', bgVar: 'rgb(var(--ch-lazada-bg) / 1)' },
  shopee: { colorVar: 'rgb(var(--ch-shopee) / 1)', bgVar: 'rgb(var(--ch-shopee-bg) / 1)' },
  tiktok: { colorVar: 'rgb(var(--ch-tiktok) / 1)', bgVar: 'rgb(var(--ch-tiktok-bg) / 1)' },
  line: { colorVar: 'rgb(var(--ch-line) / 1)', bgVar: 'rgb(var(--ch-line-bg) / 1)' },
};

function ChannelPrice({ label, value, onSave, platform }: { label: string; value: number; onSave: (v: number) => void; platform: string }) {
  const styles = CHANNEL_CHIP_STYLES[platform];
  return (
    <div className="rounded-lg flex items-center justify-between gap-1 px-2.5 py-1.5" style={{ background: styles.bgVar, color: styles.colorVar }}>
      <span className="text-[11px] font-bold shrink-0">{label}</span>
      <InlineEditCell displayValue={formatCurrency(value)} editValue={String(value)} onSave={onSave} variant="plain" />
    </div>
  );
}

function calcMarginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

function MarginTag({ cost, price }: { cost: number; price: number }) {
  const margin = calcMarginPercent(cost, price);
  const color = margin >= 50 ? 'text-success-700 bg-success-100' :
                margin >= 20 ? 'text-warning-700 bg-warning-100' :
                'text-error-700 bg-error-100';
  return (
    <span className={cn('text-[10px] px-1 py-0.5 rounded font-medium ml-1', color)}>
      {margin >= 0 ? '+' : ''}{margin}%
    </span>
  );
}

function getLotRetail(lot: { retail_price?: number } | undefined, product: Product): number {
  return Number(lot?.retail_price) || Number(product.retail_price) || 0;
}

function getVariantStockTotal(p: Product, branchId?: string | null, vbsMap?: Map<string, Map<string, number>>): number {
  const variants = p.product_barcodes ?? [];
  if (variants.length > 0) {
    return variants.reduce((s, v) => {
      if (vbsMap) {
        const branchMap = vbsMap.get(v.id);
        if (branchMap) {
          if (branchId) return s + (branchMap.get(branchId) ?? 0);
          let total = 0; branchMap.forEach((q) => { total += q; }); return s + total;
        }
      }
      return s + getVariantQuantity(v);
    }, 0);
  }
  return -1;
}
function aggregateLot(lots: StockLot[] | undefined, label: 'old' | 'new', productBarcodeId?: string): StockLot | undefined {
  if (!lots || lots.length === 0) return undefined;
  const matching = lots.filter((l) => l.lot_label === label && (!productBarcodeId || l.product_barcode_id === productBarcodeId || l.product_barcode_id === null));
  if (matching.length === 0) return undefined;
  if (matching.length === 1) return matching[0];
  const totalQty = matching.reduce((s, l) => s + Number(l.quantity), 0);
  return { ...matching[0], quantity: totalQty };
}
function getLotCost(lot: { cost_price?: number } | undefined, product: Product): number {
  return Number(lot?.cost_price) || Number(product.cost_price) || 0;
}

function getEffectiveLot(lotFilter: string, override: 'old' | 'new' | undefined): 'both' | 'old' | 'new' {
  if (lotFilter !== 'all') return lotFilter as 'old' | 'new';
  return override ?? 'both';
}

function LotToggleButton({ override, hasBothLots, globalFilter, onToggle, size = 'sm' }: {
  override: 'old' | 'new' | undefined;
  hasBothLots: boolean;
  globalFilter: string;
  onToggle: () => void;
  size?: 'sm' | 'xs';
}) {
  if (!hasBothLots) return null;
  const isGlobal = globalFilter !== 'all';
  const effective = isGlobal ? globalFilter : (override ?? 'both');
  const cfg = effective === 'old'
    ? { label: 'เก่า', cls: 'bg-warning-100 text-warning-700' }
    : effective === 'new'
    ? { label: 'ใหม่', cls: 'bg-success-100 text-success-700' }
    : { label: 'ทั้งหมด', cls: 'bg-surface-100 text-surface-500' };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!isGlobal) onToggle(); }}
      disabled={isGlobal}
      className={cn(
        'flex items-center gap-1 rounded-lg font-medium transition-all whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        cfg.cls,
        isGlobal ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'
      )}
      title={isGlobal ? 'ตัวกรองส่วนกลางเปิดอยู่ — ปุ่มนี้ใช้ไม่ได้ชั่วคราว' : 'สลับดูทุนเก่า/ใหม่'}
    >
      <ArrowRightLeft className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </button>
  );
}
function LotPriceCell({ oldLot, newLot, product, platform, platformSettings, platformPrices, displayMode = 'both' }: {
  oldLot: { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number } | undefined;
  newLot: { id: string; quantity: number; lot_label: string; cost_price: number; retail_price?: number } | undefined;
  product: Product; platform: string; platformSettings: PlatformSetting[]; platformPrices?: { product_id: string; lot_label: string; platform: string; price: number }[];
  displayMode?: 'both' | 'old' | 'new';
}) {
  function priceFor(lot: { cost_price?: number; retail_price?: number; lot_label?: string } | undefined): number {
    if (platform === 'retail') return getLotRetail(lot, product);
    const lotLabel = lot?.lot_label ?? 'old';
    const saved = platformPrices?.find((pp) => pp.product_id === product.id && pp.lot_label === lotLabel && pp.platform === platform);
    if (saved && Number(saved.price) > 0) return Number(saved.price);
    const cost = getLotCost(lot, product);
    return calcPlatformPrice(cost, platform, platformSettings);
  }
  if (oldLot && newLot && displayMode === 'both') {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] text-warning-600">เก่า</span>
          <span className="text-surface-600">{formatCurrency(priceFor(oldLot))}</span>
          <MarginTag cost={getLotCost(oldLot, product)} price={priceFor(oldLot)} />
        </div>
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] text-success-600">ใหม่</span>
          <span className="text-surface-600">{formatCurrency(priceFor(newLot))}</span>
          <MarginTag cost={getLotCost(newLot, product)} price={priceFor(newLot)} />
        </div>
      </div>
    );
  }
  const lot = displayMode === 'new' ? (newLot ?? oldLot) : (oldLot ?? newLot);
  const price = priceFor(lot);
  const cost = getLotCost(lot, product);
  return <span className="text-surface-600">{formatCurrency(price)}<MarginTag cost={cost} price={price} /></span>;
}

const SUBROW_THRESHOLD = 3;

function getVariantPriceRange(p: Product, lotLabel?: 'old' | 'new'): { min: number; max: number; isRange: boolean } {
  const variants = p.product_barcodes ?? [];
  if (variants.length > 0) {
    const prices = variants.map((v) => {
      if (lotLabel) {
        const vlp = v.variant_lot_prices?.find((lp) => lp.lot_label === lotLabel);
        if (vlp && Number(vlp.retail_price) > 0) return Number(vlp.retail_price);
        const otherVlp = v.variant_lot_prices?.find((lp) => lp.lot_label !== lotLabel);
        if (otherVlp && Number(otherVlp.retail_price) > 0) return Number(otherVlp.retail_price);
      }
      return Number(v.price) || 0;
    }).filter((pr) => pr > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { min, max, isRange: min !== max };
    }
  }
  const retail = Number(p.retail_price) || 0;
  return { min: retail, max: retail, isRange: false };
}

function getVariantCostRange(p: Product, lotLabel?: 'old' | 'new'): { min: number; max: number; isRange: boolean } {
  const variants = p.product_barcodes ?? [];
  if (variants.length > 0) {
    const costs = variants.map((v) => {
      if (lotLabel) {
        const vlp = v.variant_lot_prices?.find((lp) => lp.lot_label === lotLabel);
        if (vlp && Number(vlp.cost_price) > 0) return Number(vlp.cost_price);
        const otherVlp = v.variant_lot_prices?.find((lp) => lp.lot_label !== lotLabel);
        if (otherVlp && Number(otherVlp.cost_price) > 0) return Number(otherVlp.cost_price);
      }
      return Number(v.cost_price) || 0;
    }).filter((c) => c > 0);
    if (costs.length > 0) {
      const min = Math.min(...costs);
      const max = Math.max(...costs);
      return { min, max, isRange: min !== max };
    }
  }
  return { min: 0, max: 0, isRange: false };
}

function formatCostRange(p: Product, lotLabel?: 'old' | 'new'): string {
  const { min, max, isRange } = getVariantCostRange(p, lotLabel);
  if (min === 0 && max === 0) return '—';
  if (isRange) return `${formatCurrency(min)}-${formatCurrency(max).replace('฿', '')}`;
  return formatCurrency(min);
}

function formatPriceRange(p: Product, lotLabel?: 'old' | 'new'): string {
  const { min, max, isRange } = getVariantPriceRange(p, lotLabel);
  if (min === 0 && max === 0) return '—';
  if (isRange) return `${formatCurrency(min)}-${formatCurrency(max).replace('฿', '')}`;
  return formatCurrency(min);
}

function PriceHoverPopup({ children, prices }: { children: React.ReactNode; prices: { label: string; price: number; platform: string }[] }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <div
      onMouseEnter={(e) => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {rect && (
        <div className="fixed z-[80] pointer-events-none animate-fade-in" style={{ left: Math.min(rect.right + 8, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 180), top: rect.top - 4 }}>
          <div className="rounded-xl bg-white shadow-2xl border border-surface-200 p-1.5 space-y-0.5 min-w-[160px]">
            {prices.map((p) => {
              const styles = CHANNEL_CHIP_STYLES[p.platform];
              return (
                <div key={p.platform} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs" style={{ background: styles.bgVar, color: styles.colorVar }}>
                  <span className="font-bold shrink-0">{p.label}</span>
                  <span className="font-bold tabular-nums">{formatCurrency(p.price)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductListView({ products, platformSettings, platformPrices, lotFilter, lotOverrides, onToggleLot, onOrderMore, onSelect, onToggleActive, onQuickAdjust, activeBranchId, variantBranchStock, selectedProductIds, onToggleSelected, onToggleAllVisible, onInlineUpdate, onRefresh, onEditPrice, onCopyProduct, onDeleteProduct, searchQuery }: { products: Product[]; platformSettings: PlatformSetting[]; platformPrices: { product_id: string; lot_label: string; platform: string; price: number }[]; lotFilter: string; lotOverrides: Record<string, 'old' | 'new'>; onToggleLot: (id: string, current: 'old' | 'new' | undefined) => void; onOrderMore: () => void; onSelect: (p: Product) => void; onToggleActive: (p: Product) => void; onQuickAdjust: (p: Product) => void; activeBranchId?: string | null; variantBranchStock: Map<string, Map<string, number>>; selectedProductIds: Set<string>; onToggleSelected: (id: string) => void; onToggleAllVisible: () => void; onInlineUpdate: (product: Product, field: 'quantity' | 'retail' | 'platform', value: number, lotLabel: 'old' | 'new', platform?: string) => void; onRefresh: () => void; onEditPrice: (p: Product) => void; onCopyProduct: (p: Product) => void; onDeleteProduct: (p: Product) => void; searchQuery: string }) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  if (products.length === 0) {
    return <EmptyState icon={<Package className="w-8 h-8" />} title="ไม่พบสินค้า" description="ลองปรับตัวกรองหรือเพิ่มสินค้าใหม่" />;
  }
  const gridCols = 'grid-cols-[36px_minmax(240px,1fr)_100px_90px_110px_90px_120px_140px_72px]';
  const subGridCols = gridCols;
  return (
    <div className="table-scroll">
      <div className="min-w-[1140px] overflow-hidden rounded-xl border border-surface-200/80 bg-white shadow-sm">
        {/* Header */}
        <div className={cn('grid items-center gap-3 border-b border-surface-200 bg-surface-50/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-surface-500', gridCols)}>
          <span><input type="checkbox" checked={selectedProductIds.size === products.length && products.length > 0} onChange={onToggleAllVisible} className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer" /></span>
          <span>สินค้า</span>
          <span>รหัส</span>
          <span className="text-center">ทุน</span>
          <span className="text-center">ราคาหน้าร้าน</span>
          <span className="text-center">คงเหลือ</span>
          <span className="text-center">วันหมดอายุ</span>
          <span className="text-center">สถานะ</span>
          <span className="text-center">แก้ไข</span>
        </div>
        {/* Rows */}
        <div className="bg-surface-50/30">
          {products.map((p, i) => {
            const branchLots = activeBranchId ? (p.stock_lots ?? []).filter((l) => l.branch_id === activeBranchId) : (p.stock_lots ?? []);
            const oldLot = aggregateLot(branchLots, 'old');
            const newLot = aggregateLot(branchLots, 'new');
            const oldQty = oldLot ? Number(oldLot.quantity) : 0;
            const newQty = newLot ? Number(newLot.quantity) : 0;
            const variantTotal = getVariantStockTotal(p, activeBranchId, variantBranchStock);
            const qty = variantTotal >= 0 ? variantTotal : oldQty + newQty;
            const isLow = qty <= p.min_stock;
            const isSelected = selectedProductIds.has(p.id);
            const displayMode = getEffectiveLot(lotFilter, lotOverrides[p.id]);
            const effectiveMode: 'old' | 'new' = displayMode === 'new' ? 'new' : 'old';
            const activeLot = effectiveMode === 'new' ? (newLot ?? oldLot) : (oldLot ?? newLot);
            const activeLotLabel = (activeLot?.lot_label ?? 'old') as 'old' | 'new';
            const hasBothLots = !!oldLot && !!newLot;
            const costRange = hasBothLots && Number(oldLot.cost_price) !== Number(newLot.cost_price);
            const oldCost = oldLot ? getLotCost(oldLot, p) : 0;
            const newCost = newLot ? getLotCost(newLot, p) : 0;
            const retailPrice = getLotRetail(activeLot, p);
            const costPrice = getLotCost(activeLot, p);
            function getPlatformPrice(platform: string): number {
              if (platform === 'retail') return retailPrice;
              const saved = platformPrices.find((pp) => pp.product_id === p.id && pp.lot_label === activeLotLabel && pp.platform === platform);
              if (saved && Number(saved.price) > 0) return Number(saved.price);
              return calcPlatformPrice(costPrice, platform, platformSettings);
            }
            const barcodes = p.product_barcodes ?? [];
            const isExpanded = expandedProducts.has(p.id);
            const visibleBarcodes = isExpanded ? barcodes : barcodes.slice(0, SUBROW_THRESHOLD);
            const hiddenCount = barcodes.length - SUBROW_THRESHOLD;
            const searchMatch = searchQuery.trim().toLowerCase();
            const parentMatches = !!(searchMatch && (p.name?.toLowerCase().includes(searchMatch) || p.sku?.toLowerCase().includes(searchMatch) || p.category?.toLowerCase().includes(searchMatch) || p.brand?.toLowerCase().includes(searchMatch)));
            const hasVariantMatch = !!(searchMatch && barcodes.some((b) => b.barcode?.toLowerCase().includes(searchMatch) || b.variant_name?.toLowerCase().includes(searchMatch) || b.label?.toLowerCase().includes(searchMatch)));
            const hasGroupedVariants = barcodes.some((b) => !!b.parent_ref);
            const parentOrChildMatches = parentMatches || hasVariantMatch;
            const allPrices = [
              { label: 'หน้าร้าน', price: retailPrice, platform: 'retail' },
              { label: 'Lazada', price: getPlatformPrice('lazada'), platform: 'lazada' },
              { label: 'Shopee', price: getPlatformPrice('shopee'), platform: 'shopee' },
              { label: 'TikTok', price: getPlatformPrice('tiktok'), platform: 'tiktok' },
              { label: 'LINE', price: getPlatformPrice('line'), platform: 'line' },
            ];
            return (
              <div key={p.id} className="animate-slide-up" style={{ animationDelay: `${i * 15}ms`, animationFillMode: 'backwards' }}>
                {/* Main row */}
                <div
                  className={cn(
                    'grid items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-surface-100',
                    gridCols,
                    isSelected ? 'bg-primary-50/40' : parentMatches ? 'bg-primary-50/50' : hasVariantMatch ? 'bg-primary-50/20' : 'bg-white hover:bg-surface-50/60',
                    parentOrChildMatches && 'border-l-2 border-l-primary-400',
                  )}
                  onClick={() => onSelect(p)}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-self-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => onToggleSelected(p.id)} className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                  </div>
                  {/* Product: thumb + name + desc */}
                  <div className="flex items-center gap-3 min-w-0">
                    <HoverPreview src={p.image_url} alt={p.name}>
                      <div className="w-14 h-14 rounded-lg bg-surface-100 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-surface-400" />}
                      </div>
                    </HoverPreview>
                    <div className="min-w-0">
                      <p className="font-bold text-surface-900 text-sm truncate leading-snug">{p.name}</p>
                      <p className="text-[11px] text-surface-400 truncate mt-0.5">{p.brand || p.category || '—'}</p>
                    </div>
                    {parentMatches && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> ตรงกับที่ค้นหา
                      </span>
                    )}
                  </div>
                  {/* Code */}
                  <div className="flex items-center gap-1 text-xs text-surface-500 font-mono truncate" onClick={(e) => e.stopPropagation()}>
                    <span className="truncate">{p.sku || (barcodes.length > 0 ? (barcodes.length === 1 ? barcodes[0].barcode : `${barcodes[0].barcode} +${barcodes.length - 1}`) : '—')}</span>
                    <CopySkuButton sku={p.sku || (barcodes.length > 0 ? barcodes[0].barcode : '')} />
                  </div>
                  {/* Cost */}
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      if (barcodes.length > 0) {
                        const costStr = formatCostRange(p, activeLotLabel);
                        return <span className={cn('text-sm font-bold tabular-nums', costStr !== '—' ? 'text-surface-600' : 'text-surface-300')}>{costStr}</span>;
                      }
                      if (lotFilter === 'old') {
                        return <span className={cn('text-sm font-bold tabular-nums', oldCost > 0 ? 'text-surface-600' : 'text-surface-300')}>{oldCost > 0 ? formatCurrency(oldCost) : '—'}</span>;
                      }
                      if (lotFilter === 'new') {
                        return <span className={cn('text-sm font-bold tabular-nums', newCost > 0 ? 'text-surface-600' : 'text-surface-300')}>{newCost > 0 ? formatCurrency(newCost) : '—'}</span>;
                      }
                      if (hasBothLots && costRange) {
                        const minC = Math.min(oldCost, newCost);
                        const maxC = Math.max(oldCost, newCost);
                        return <span className="text-sm font-bold tabular-nums text-surface-600">฿{formatCurrency(minC).replace('฿','')}-{formatCurrency(maxC).replace('฿','')}</span>;
                      }
                      return <span className={cn('text-sm font-bold tabular-nums', costPrice > 0 ? 'text-surface-600' : 'text-surface-300')}>{costPrice > 0 ? formatCurrency(costPrice) : '—'}</span>;
                    })()}
                  </div>
                  {/* Retail price */}
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {barcodes.length > 0 ? (
                      <PriceHoverPopup prices={allPrices}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEditPrice(p); }}
                          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-primary-50 transition-colors"
                        >
                          <span className="text-sm font-bold text-primary-600 tabular-nums">{formatPriceRange(p, activeLotLabel)}</span>
                          <Pencil className="w-3 h-3 text-primary-400 shrink-0" />
                        </button>
                      </PriceHoverPopup>
                    ) : (
                      <PriceHoverPopup prices={allPrices}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEditPrice(p); }}
                          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-primary-50 transition-colors"
                        >
                          <span className="text-sm font-bold text-primary-600 tabular-nums">{formatPriceRange(p, activeLotLabel)}</span>
                          <Pencil className="w-3 h-3 text-primary-400 shrink-0" />
                        </button>
                      </PriceHoverPopup>
                    )}
                  </div>
                  {/* Stock — disabled if has variants (parent row) */}
                  <div className="flex items-center justify-center gap-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                    {barcodes.length > 0 ? (
                      <span className="text-sm font-bold text-surface-400 tabular-nums cursor-not-allowed" title="คงเหลือตามตัวเลือกย่อย">{formatNumber(qty)}</span>
                    ) : (
                      <>
                        <InlineEditCell displayValue={formatNumber(qty)} editValue={String(qty)} onSave={(v) => onInlineUpdate(p, 'quantity', v, activeLotLabel)} />
                        <Pencil className="w-3 h-3 text-primary-400 shrink-0" />
                      </>
                    )}
                    {isLow && <Badge variant="error"><AlertTriangle className="w-3 h-3" /></Badge>}
                  </div>
                  {/* Expiry */}
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {activeLot?.expiry_date ? (
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs tabular-nums', isExpiringSoon(activeLot.expiry_date) ? 'text-error-600 font-semibold' : 'text-surface-600')}>{formatDateBE(activeLot.expiry_date)}</span>
                        {isExpiringSoon(activeLot.expiry_date) && <Badge variant="warning">ใกล้หมดอายุ</Badge>}
                      </div>
                    ) : <span className="text-surface-300">—</span>}
                  </div>
                  {/* Status toggle + badge */}
                  {(() => { const parentActive = barcodes.length > 0 ? barcodes.some((b) => b.is_available ?? true) : p.is_active; return (
                  <div className="flex items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                    <ToggleSwitch checked={parentActive} onChange={() => onToggleActive(p)} size="sm" label="" />
                    {parentActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500" />เปิดขาย
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-surface-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />ปิดขาย
                      </span>
                    )}
                  </div>
                  ); })()}
                  {/* Edit link with dropdown */}
                  <div className="flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(p); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> แก้ไข
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openMenuId === p.id) {
                          setOpenMenuId(null);
                          setMenuPosition(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const menuHeight = 76;
                        const menuWidth = 144;
                        const top = rect.bottom + menuHeight <= window.innerHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
                        const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
                        setMenuPosition({ top, left });
                        setOpenMenuId(p.id);
                      }}
                      className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors', openMenuId === p.id && 'bg-surface-100 text-surface-600')}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {openMenuId === p.id && (
                      <>
                        {createPortal(
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setMenuPosition(null); }} />
                            <div style={{ top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0 }} className="fixed z-50 w-36 rounded-xl bg-white shadow-xl border border-surface-200 py-1 animate-slide-down">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setMenuPosition(null); onCopyProduct(p); }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                              >คัดลอก</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setMenuPosition(null); onDeleteProduct(p); }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-error-600 hover:bg-error-50 transition-colors"
                              >ลบออก</button>
                            </div>
                          </>, document.body,
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Sub-rows for variants — mirrors main row columns exactly */}
                {hasGroupedVariants && barcodes.length > 0 && (
                  <div className={cn('overflow-hidden border-b border-l-2 border-r border-surface-200', isSelected ? 'bg-primary-50/15 border-l-primary-300' : 'bg-surface-50/40 border-l-primary-200')}>
                    {visibleBarcodes.map((b, bi) => {
                      const vbsBranchMap = variantBranchStock.get(b.id);
                      const branchQty = vbsBranchMap ? (activeBranchId ? (vbsBranchMap.get(activeBranchId) ?? null) : (() => { let t = 0; let h = false; vbsBranchMap.forEach((q) => { t += q; h = true; }); return h ? t : null; })()) : null;
                      const bVlp = b.variant_lot_prices?.find((lp) => lp.lot_label === activeLotLabel);
                      const bQty = branchQty != null ? branchQty : (bVlp ? Number(bVlp.quantity || 0) : getVariantQuantity(b));
                      const bPrice = bVlp ? (Number(bVlp.retail_price) || Number(b.price) || 0) : (Number(b.price) || 0);
                      const bCost = bVlp ? (Number(bVlp.cost_price) || Number(b.cost_price) || 0) : (Number(b.cost_price) || 0);
                      const bIsLow = bQty <= (p.min_stock || 0);
                      const bAvailable = b.is_available ?? true;
                      const variantMatches = !!(searchMatch && (b.barcode?.toLowerCase().includes(searchMatch) || b.variant_name?.toLowerCase().includes(searchMatch) || b.label?.toLowerCase().includes(searchMatch)));
                      const variantParentMatches = parentMatches || hasVariantMatch;
                      return (
                        <div
                          key={b.id}
                          className={cn('grid items-center gap-3 px-4 py-2.5 transition-colors', subGridCols, variantMatches ? 'bg-primary-50/60' : bi % 2 === 0 ? 'bg-surface-50/25' : 'bg-white', bi >= SUBROW_THRESHOLD && 'animate-slide-down')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Col 1: empty (aligns with checkbox) */}
                          <div></div>
                          {/* Col 2: variant thumb + name — aligns with product col, indented */}
                          <div className="flex items-center gap-2.5 min-w-0 pl-6">
                            <HoverPreview src={b.image_url} alt={b.label ?? b.barcode}>
                              <div className="w-9 h-9 rounded-md bg-white border border-surface-200 flex items-center justify-center overflow-hidden shrink-0">
                                {b.image_url ? <img src={b.image_url} alt={b.label ?? b.barcode} className="w-full h-full object-cover" /> : <ImageIcon className="w-3.5 h-3.5 text-surface-300" />}
                              </div>
                            </HoverPreview>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-surface-700 truncate">{b.variant_name || b.label || b.barcode}</p>
                              <p className="text-[10px] text-surface-400 truncate">Variant · {b.parent_ref || p.parent_ref || 'กลุ่มสินค้า'}</p>
                            </div>
                            {variantMatches && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700 shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> ตรงกับที่ค้นหา
                              </span>
                            )}
                          </div>
                          {/* Col 3: barcode/SKU + copy — aligns with code col */}
                          <div className="flex items-center gap-1 text-xs text-surface-500 font-mono truncate" onClick={(e) => e.stopPropagation()}>
                            <span className="truncate">{b.barcode || '—'}</span>
                            <CopySkuButton sku={b.barcode} />
                          </div>
                          {/* Col 4: variant cost — aligns with cost col */}
                          <div className="flex items-center justify-center">
                            <span className={cn('text-xs font-medium tabular-nums', bCost > 0 ? 'text-surface-500' : 'text-surface-300')}>{bCost > 0 ? formatCurrency(bCost) : '—'}</span>
                          </div>
                          {/* Col 5: variant price — inline editable + hover popup showing platform prices */}
                          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const vCost = bCost;
                              function getVariantPlatformPrice(platform: string): number {
                                if (platform === 'retail') return bPrice;
                                return calcPlatformPrice(vCost, platform, platformSettings);
                              }
                              return (
                            <PriceHoverPopup prices={[
                              { label: 'หน้าร้าน', price: bPrice, platform: 'retail' },
                              { label: 'Lazada', price: getVariantPlatformPrice('lazada'), platform: 'lazada' },
                              { label: 'Shopee', price: getVariantPlatformPrice('shopee'), platform: 'shopee' },
                              { label: 'TikTok', price: getVariantPlatformPrice('tiktok'), platform: 'tiktok' },
                              { label: 'LINE', price: getVariantPlatformPrice('line'), platform: 'line' },
                            ]}>
                              <div className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-primary-50 transition-colors duration-150">
                                <InlineEditCell displayValue={formatCurrency(bPrice)} editValue={String(bPrice)} onSave={(v) => { supabase.from('variant_lot_prices').upsert({ product_barcode_id: b.id, lot_label: activeLotLabel, quantity: bQty, cost_price: bCost, retail_price: v }, { onConflict: 'product_barcode_id,lot_label' }).then(() => onRefresh()); }} />
                                <Pencil className="w-3 h-3 text-primary-400 shrink-0" />
                              </div>
                            </PriceHoverPopup>
                              );
                            })()}
                          </div>
                          {/* Col 5: variant stock — inline editable + hover + low badge, aligns with stock col */}
                          <div className="flex items-center justify-center gap-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-primary-50 transition-colors duration-150">
                              <InlineEditCell displayValue={formatNumber(bQty)} editValue={String(bQty)} onSave={(v) => { supabase.from('product_barcodes').update({ stock_qty: v }).eq('id', b.id).then(() => onRefresh()); }} />
                              <Pencil className="w-3 h-3 text-primary-400 shrink-0" />
                            </div>
                            {bIsLow && bQty > 0 && <Badge variant="warning"><AlertTriangle className="w-3 h-3" /></Badge>}
                            {bQty === 0 && <Badge variant="error"><AlertTriangle className="w-3 h-3" /></Badge>}
                          </div>
                          {/* Col 6: expiry — barcodes have no expiry, show dash */}
                          <div className="flex items-center justify-center">
                            <span className="text-surface-300">—</span>
                          </div>
                          {/* Col 7: status toggle + label — aligns with status col */}
                          <div className="flex items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                            <ToggleSwitch checked={bAvailable} onChange={() => { supabase.from('product_barcodes').update({ is_available: !bAvailable }).eq('id', b.id).then(() => onRefresh()); }} size="sm" label="" />
                            {bAvailable ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-success-500" />เปิดขาย
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-surface-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />ปิดขาย
                              </span>
                            )}
                          </div>
                          {/* Col 8: edit button — aligns with edit col */}
                          <div className="flex items-center justify-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelect(p); }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg px-2 py-1.5 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" /> แก้ไข
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {/* Expand toggle — plain link at bottom, Lazada-style */}
                    {hiddenCount > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedProducts((prev) => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; }); }}
                        className="w-full flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300 ease-in-out', isExpanded && 'rotate-180')} />
                        {isExpanded ? 'ย่อรายการ' : `ดู ${hiddenCount} ตัวเลือกสินค้าเพิ่มเติม`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ PRODUCT GRID VIEW ============
function ProductGridView({ products, platformSettings, platformPrices, lotFilter, lotOverrides, onToggleLot, onOrderMore, onSelect, onToggleActive, onQuickAdjust, activeBranchId, variantBranchStock, selectedProductIds, onToggleSelected, onEditPrice }: { products: Product[]; platformSettings: PlatformSetting[]; platformPrices: { product_id: string; lot_label: string; platform: string; price: number }[]; lotFilter: string; lotOverrides: Record<string, 'old' | 'new'>; onToggleLot: (id: string, current: 'old' | 'new' | undefined) => void; onOrderMore: () => void; onSelect: (p: Product) => void; onToggleActive: (p: Product) => void; onQuickAdjust: (p: Product) => void; activeBranchId?: string | null; variantBranchStock: Map<string, Map<string, number>>; selectedProductIds: Set<string>; onToggleSelected: (id: string) => void; onEditPrice: (p: Product) => void }) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((p, i) => {
        const branchLots = activeBranchId ? (p.stock_lots ?? []).filter((l) => l.branch_id === activeBranchId) : (p.stock_lots ?? []);
        const oldLot = aggregateLot(branchLots, 'old');
        const newLot = aggregateLot(branchLots, 'new');
        const oldQty = oldLot ? Number(oldLot.quantity) : 0;
        const newQty = newLot ? Number(newLot.quantity) : 0;
        const variantTotal = getVariantStockTotal(p, activeBranchId, variantBranchStock);
        const qty = variantTotal >= 0 ? variantTotal : oldQty + newQty;
        const isLow = qty <= p.min_stock;
        const hasBothLots = !!oldLot && !!newLot;
        const displayMode = getEffectiveLot(lotFilter, lotOverrides[p.id]);
        const isSelected = selectedProductIds.has(p.id);
        const effectiveMode: 'old' | 'new' = displayMode === 'new' ? 'new' : 'old';
        const activeLot = effectiveMode === 'new' ? (newLot ?? oldLot) : (oldLot ?? newLot);
        const activeCost = getLotCost(activeLot, p);
        const activeExpiry = activeLot?.expiry_date ?? null;
        const expiringSoon = isExpiringSoon(activeExpiry);
        const metaParts = [p.sku, p.brand, p.category].filter(Boolean);
        const channelList = [
          { key: 'retail', label: 'หน้าร้าน' },
          { key: 'tiktok', label: 'TikTok' },
          { key: 'shopee', label: 'Shopee' },
          { key: 'lazada', label: 'Lazada' },
          { key: 'line', label: 'LINE' },
        ];
        const barcodes = p.product_barcodes ?? [];
        const activeLotLabel = (activeLot?.lot_label ?? 'old') as 'old' | 'new';
        const sortedVariants = barcodes.map((b) => {
          const vbsBranchMap = variantBranchStock.get(b.id);
          const branchQty = vbsBranchMap ? (activeBranchId ? (vbsBranchMap.get(activeBranchId) ?? null) : (() => { let t = 0; let h = false; vbsBranchMap.forEach((q) => { t += q; h = true; }); return h ? t : null; })()) : null;
          const bVlp = b.variant_lot_prices?.find((lp) => lp.lot_label === activeLotLabel);
          const bQty = branchQty != null ? branchQty : (bVlp ? Number(bVlp.quantity || 0) : getVariantQuantity(b));
          return { b, bQty };
        }).sort((a, b) => a.bQty - b.bQty);
        const isCardExpanded = expandedCards.has(p.id);
        return (
          <Card key={p.id} hover className={cn('animate-slide-up cursor-pointer overflow-hidden p-0 relative flex flex-col', isSelected && 'border-primary-400 ring-2 ring-primary-100')} onClick={() => onSelect(p)}>
            {/* Checkbox */}
            <label className="absolute left-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggleSelected(p.id)} className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
            </label>

            {/* Price badge */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditPrice(p); }}
              title="แก้ไขราคา"
              aria-label="แก้ไขราคา"
              className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors duration-150 text-xs font-bold"
            >
              <Pencil className="w-3 h-3" />
              <span>{formatPriceRange(p, (activeLot?.lot_label ?? 'old') as 'old' | 'new')}</span>
            </button>

            {/* Image */}
            <div className="pt-3 px-3" onClick={(e) => e.stopPropagation()}>
              <HoverPreview src={p.image_url} alt={p.name}>
                <div className="w-full aspect-square rounded-xl bg-surface-50 flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 hover:scale-105" onClick={(e) => { e.stopPropagation(); setPreviewImage(p.image_url!); }} />
                  ) : (
                    <Package className="w-10 h-10 text-surface-300" strokeWidth={1.5} />
                  )}
                </div>
              </HoverPreview>
            </div>

            {/* Name + meta */}
            <div className="px-3.5 mt-2.5 min-w-0">
              <p className="font-semibold text-sm text-surface-900 leading-snug line-clamp-2">{p.name}</p>
              <p className="text-[11px] text-surface-400 truncate mt-0.5">{metaParts.join(' · ')}</p>
            </div>

            {barcodes.length > 1 ? (
              <>
                {/* Total stock + cost for variant products */}
                <div className="flex items-stretch gap-2 px-3.5 mt-2.5">
                  <div className="flex-1 rounded-lg bg-surface-50 px-2.5 py-1.5 text-center">
                    <p className="text-[10px] text-surface-400 leading-none">คงเหลือรวม</p>
                    <p className={cn('text-lg font-bold leading-tight mt-0.5 tabular-nums', isLow ? 'text-error-600' : 'text-surface-900')}>
                      {formatNumber(qty)}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg bg-surface-50 px-2.5 py-1.5 text-center">
                    <p className="text-[10px] text-surface-400 leading-none">ทุน</p>
                    {(() => {
                      const costStr = formatCostRange(p, (activeLot?.lot_label ?? 'old') as 'old' | 'new');
                      const isRange = costStr.includes('-');
                      return <p className={cn('font-bold text-primary-600 leading-tight mt-0.5', isRange ? 'text-sm' : 'text-lg')}>{costStr}</p>;
                    })()}
                  </div>
                </div>
                {/* Variant list */}
                <div className="px-3.5 mt-2">
                  <div className="rounded-lg border border-surface-200/80 divide-y divide-surface-100 overflow-hidden">
                    {sortedVariants.slice(0, isCardExpanded ? undefined : SUBROW_THRESHOLD).map(({ b, bQty }) => {
                      const bIsLow = bQty <= (p.min_stock || 0);
                      const bAvailable = b.is_available ?? true;
                      return (
                        <div key={b.id} className={cn('flex items-center justify-between px-2.5 py-1.5 transition-colors', bQty === 0 ? 'bg-error-50' : 'bg-white hover:bg-surface-50/60')}>
                          <div className="min-w-0 flex-1 mr-2">
                            <p className={cn('text-xs font-medium truncate', bQty === 0 ? 'text-surface-500' : 'text-surface-700')}>{b.variant_name || b.label || b.barcode}</p>
                            <p className="text-[10px] text-surface-400 font-mono truncate">{b.barcode} · x{b.unit_multiplier}{b.unit}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn('text-sm font-bold tabular-nums', bQty === 0 ? 'text-error-600' : bIsLow ? 'text-warning-600' : 'text-surface-700')}>{formatNumber(bQty)}</span>
                            {bQty === 0 && <AlertTriangle className="w-3 h-3 text-error-500" />}
                            {bQty > 0 && bIsLow && <AlertTriangle className="w-3 h-3 text-warning-500" />}
                            {!bAvailable && <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {barcodes.length > SUBROW_THRESHOLD && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedCards((prev) => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; }); }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300 ease-in-out', isCardExpanded && 'rotate-180')} />
                      {isCardExpanded ? 'ย่อรายการ' : `ดูเพิ่มเติม (+${barcodes.length - SUBROW_THRESHOLD})`}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Single product: stock + cost stat boxes */}
                <div className="flex items-stretch gap-2 px-3.5 mt-2.5">
                  <div className="flex-1 rounded-lg bg-surface-50 px-2.5 py-1.5 text-center">
                    <p className="text-[10px] text-surface-400 leading-none">คงเหลือ</p>
                    <p className={cn('text-lg font-bold leading-tight mt-0.5 tabular-nums', isLow ? 'text-error-600' : 'text-surface-900')}>
                      {formatNumber(qty)}
                    </p>
                    {oldQty > 0 && newQty > 0 && (
                      <p className="text-[9px] text-surface-400 mt-0.5">เก่า {formatNumber(oldQty)} · ใหม่ {formatNumber(newQty)}</p>
                    )}
                  </div>
                  <div className="flex-1 rounded-lg bg-surface-50 px-2.5 py-1.5 text-center">
                    <p className="text-[10px] text-surface-400 leading-none">ทุน</p>
                    {(() => {
                      const oldCostG = getLotCost(oldLot, p);
                      const newCostG = getLotCost(newLot, p);
                      const costRangeG = hasBothLots && Number(oldLot.cost_price) !== Number(newLot.cost_price);
                      if (lotFilter === 'old') return <p className="text-lg font-bold text-primary-600 leading-tight mt-0.5">{oldCostG > 0 ? formatCurrency(oldCostG) : '—'}</p>;
                      if (lotFilter === 'new') return <p className="text-lg font-bold text-primary-600 leading-tight mt-0.5">{newCostG > 0 ? formatCurrency(newCostG) : '—'}</p>;
                      if (costRangeG) { const mn = Math.min(oldCostG, newCostG); const mx = Math.max(oldCostG, newCostG); return <p className="text-sm font-bold text-primary-600 leading-tight mt-0.5">฿{formatCurrency(mn).replace('฿','')}-{formatCurrency(mx).replace('฿','')}</p>; }
                      return <p className="text-lg font-bold text-primary-600 leading-tight mt-0.5">{activeCost > 0 ? formatCurrency(activeCost) : '—'}</p>;
                    })()}
                  </div>
                </div>
                {/* Lot + expiry meta line */}
                <div className="flex items-center gap-2 px-3.5 mt-2 text-[10px] text-surface-400">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="font-medium">ล็อต</span>
                    <span className="inline-flex items-center rounded px-1 py-0.5 font-semibold" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-600)' }}>
                      {activeLot?.lot_number || '—'}
                    </span>
                  </span>
                  <span className="text-surface-200">|</span>
                  <span className="inline-flex items-center gap-0.5">
                    หมดอายุ <span className={cn('font-medium', expiringSoon ? 'text-error-600' : 'text-surface-500')}>{activeExpiry ? formatDateBE(activeExpiry) : '—'}</span>
                  </span>
                  {expiringSoon && <Badge variant="error"><AlertTriangle className="w-2.5 h-2.5" />ใกล้หมด</Badge>}
                </div>
              </>
            )}

            {/* Platform prices — compact horizontal strip */}
            <div className="flex items-center gap-1 px-3.5 mt-2.5 overflow-x-auto scrollbar-thin">
              {channelList.map((pf) => {
                const price = pf.key === 'retail'
                  ? Number(activeLot?.retail_price) || Number(p.retail_price) || 0
                  : (() => {
                      const saved = platformPrices.find((pp) => pp.product_id === p.id && pp.lot_label === (activeLot?.lot_label ?? 'old') && pp.platform === pf.key);
                      if (saved && Number(saved.price) > 0) return Number(saved.price);
                      return calcPlatformPrice(activeCost, pf.key, platformSettings);
                    })();
                const styles = CHANNEL_CHIP_STYLES[pf.key];
                return (
                  <div key={pf.key} className="rounded-md px-1.5 py-1 flex flex-col items-center gap-0 shrink-0" style={{ background: styles.bgVar, color: styles.colorVar }}>
                    <span className="text-[9px] font-bold leading-none">{pf.label}</span>
                    <span className="text-[10px] font-bold leading-tight mt-0.5">{formatCurrency(price)}</span>
                  </div>
                );
              })}
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between px-3.5 py-2.5 mt-auto border-t border-surface-100 mt-3">
              <div className="flex items-center gap-1.5">
                <span className={cn('inline-block w-2 h-2 rounded-full', isLow ? 'bg-error-500' : 'bg-success-500')} />
                <span className="text-[11px] text-surface-500">{isLow ? 'สต็อกต่ำ' : 'พร้อมขาย'}</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOrderMore(); }}
                className="inline-flex items-center gap-1 rounded-full border border-primary-300 px-2.5 py-1 text-[11px] font-medium text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <ArrowDownToLine className="w-3 h-3" /> สั่งเพิ่ม
              </button>
            </div>
          </Card>
        );
      })}
    </div>
    {previewImage && (
      <div className="fixed inset-x-0 bottom-0 top-16 z-[70] flex items-center justify-center bg-surface-950/70 p-6" onClick={() => setPreviewImage(null)}>
        <button type="button" aria-label="ปิดรูปภาพ" onClick={() => setPreviewImage(null)} className="absolute right-5 top-5 z-10 rounded-full bg-white/90 p-2 text-surface-700 shadow-lg"><X className="h-5 w-5" /></button>
        <img src={previewImage} alt="รูปสินค้าแบบขยาย" className="max-h-[calc(100vh-9rem)] max-w-[90vw] rounded-2xl bg-white object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    </>
  );
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


function ExpiryCell({ lot, label }: { lot: StockLot; label: string }) {
  const [showEdit, setShowEdit] = useState(false);
  const [editValue, setEditValue] = useState(lot.expiry_date ?? '');
  const [saving, setSaving] = useState(false);

  async function saveExpiry() {
    setSaving(true);
    await supabase.from('stock_lots').update({ expiry_date: editValue || null }).eq('id', lot.id);
    setSaving(false);
    setShowEdit(false);
    lot.expiry_date = editValue || null;
  }

  const labelColor = label === 'เก่า' ? 'text-warning-600' : 'text-success-600';
  const expiring = isExpiringSoon(lot.expiry_date);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowEdit(!showEdit); }}
        className={cn('text-xs flex items-center gap-1 hover:bg-surface-100 rounded px-1.5 py-0.5 transition-colors', expiring && 'bg-error-50')}
      >
        <span className={labelColor}>{label}</span>
        {lot.expiry_date ? (
          <>
            <span className={cn(expiring ? 'text-error-600 font-semibold' : 'text-surface-500')}>{formatDate(lot.expiry_date)}</span>
            {expiring && <span className="ml-1 rounded bg-error-100 px-1 py-0.5 text-[10px] font-medium text-error-600">ใกล้หมดอายุ</span>}
          </>
        ) : (
          <span className="text-surface-400">—</span>
        )}
        <ChevronRight className="w-3 h-3 text-surface-400 group-hover/edit:text-primary-500 transition-colors" />
      </button>
      {showEdit && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowEdit(false); }} />
          <div className="absolute z-40 top-full left-0 mt-1 p-3 bg-white rounded-xl shadow-lg border border-surface-200 w-56 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-medium text-surface-600 mb-2">วันหมดอายุล็อต{label}</p>
            <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input-base !py-1.5 text-sm" autoFocus />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 px-2 py-1.5 rounded-lg text-sm bg-surface-100 text-surface-600 hover:bg-surface-200">ยกเลิก</button>
              <button onClick={saveExpiry} disabled={saving} className="flex-1 px-2 py-1.5 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">บันทึก</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickAdjustModal({ product, profileId, profileName, branchId, onClose, onSaved }: {
  product: Product;
  profileId?: string;
  profileName?: string;
  branchId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const branchLots = (product.stock_lots ?? []).filter((l) => !branchId || l.branch_id === branchId);
  const oldLot = branchLots.find((l) => l.lot_label === 'old');
  const newLot = branchLots.find((l) => l.lot_label === 'new');
  const hasBoth = oldLot && newLot;
  const [selectedLotLabel, setSelectedLotLabel] = useState<'old' | 'new'>(oldLot ? 'old' : 'new');
  const [newQty, setNewQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const selectedLot = selectedLotLabel === 'old' ? oldLot : newLot;
  const currentQty = selectedLot ? Number(selectedLot.quantity) : 0;

  async function save() {
    const qty = Number(newQty);
    if (isNaN(qty) || qty < 0) { setToast({ type: 'error', msg: 'กรุณากรอกจำนวนที่ถูกต้อง' }); return; }
    setLoading(true);

    const diff = qty - currentQty;
    if (diff === 0) { setToast({ type: 'error', msg: 'จำนวนไม่เปลี่ยนแปลง' }); setLoading(false); return; }

    if (selectedLot) {
      const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: qty }).eq('id', selectedLot.id);
      if (lotErr) { setToast({ type: 'error', msg: `บันทึกไม่สำเร็จ: ${lotErr.message}` }); setLoading(false); return; }
    } else {
      const { error: lotErr } = await supabase.from('stock_lots').insert({
        product_id: product.id,
        branch_id: branchId ?? null,
        lot_label: selectedLotLabel,
        lot_number: selectedLotLabel,
        quantity: qty,
        cost_price: 0,
      });
      if (lotErr) { setToast({ type: 'error', msg: `สร้างล็อตไม่สำเร็จ: ${lotErr.message}` }); setLoading(false); return; }
    }

    const movementType = diff > 0 ? 'receive' : 'withdraw';
    const { error: moveErr } = await supabase.from('stock_movements').insert({
      product_id: product.id,
      branch_id: branchId ?? null,
      movement_type: movementType,
      type_config: 'adjust',
      quantity: Math.abs(diff),
      lot_id: selectedLot?.id ?? null,
      lot_label: selectedLotLabel,
      unit_price: 0,
      discount_amount: 0,
      discount_percent: 0,
      reference_note: `ปรับสต็อกด่วน (${selectedLotLabel === 'old' ? 'ล็อตเก่า' : 'ล็อตใหม่'})`,
      profile_id: profileId ?? null,
    });
    if (moveErr) { setToast({ type: 'error', msg: `บันทึกประวัติไม่สำเร็จ: ${moveErr.message}` }); setLoading(false); return; }

    await supabase.from('product_audit_logs').insert({
      product_id: product.id,
      action: 'adjust',
      actor_profile_id: profileId ?? null,
      actor_name: profileName ?? null,
      previous_value: { lot_label: selectedLotLabel, quantity: currentQty },
      new_value: { lot_label: selectedLotLabel, quantity: qty },
      note: `ปรับสต็อกด่วน ${selectedLotLabel === 'old' ? 'ล็อตเก่า' : 'ล็อตใหม่'}: ${currentQty} → ${qty}`,
    });

    setLoading(false);
    setToast({ type: 'success', msg: 'ปรับสต็อกสำเร็จ' });
    onSaved();
    setTimeout(() => onClose(), 1000);
  }

  return (
    <Modal open onClose={onClose} title="ปรับคงเหลือด่วน" size="sm">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
          <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-surface-400" />
          </div>
          <div>
            <p className="font-medium text-sm text-surface-900">{product.name}</p>
            <p className="text-xs text-surface-400">{product.sku}</p>
          </div>
        </div>

        {hasBoth ? (
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เลือกล็อต</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSelectedLotLabel('old')} className={cn('p-3 rounded-xl border-2 text-sm font-medium transition-colors', selectedLotLabel === 'old' ? 'border-warning-500 bg-warning-50 text-warning-700' : 'border-surface-200 text-surface-500')}>
                ล็อตเก่า
                {oldLot && <span className="block text-xs text-surface-400 mt-0.5">คงเหลือ {formatNumber(Number(oldLot.quantity))}</span>}
              </button>
              <button onClick={() => setSelectedLotLabel('new')} className={cn('p-3 rounded-xl border-2 text-sm font-medium transition-colors', selectedLotLabel === 'new' ? 'border-success-500 bg-success-50 text-success-700' : 'border-surface-200 text-surface-500')}>
                ล็อตใหม่
                {newLot && <span className="block text-xs text-surface-400 mt-0.5">คงเหลือ {formatNumber(Number(newLot.quantity))}</span>}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-surface-50 text-sm text-surface-600">
            {selectedLotLabel === 'old' ? 'ล็อตเก่า' : 'ล็อตใหม่'} · คงเหลือ {formatNumber(currentQty)} ชิ้น
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">จำนวนคงเหลือใหม่</label>
          <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)} className="input-base" placeholder={String(currentQty)} autoFocus />
          <p className="text-xs text-surface-400 mt-1">คงเหลือปัจจุบัน: {formatNumber(currentQty)} ชิ้น</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1"><Zap className="w-4 h-4" /> บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkPriceEditModal({ selectedIds, products, onClose, onSaved }: {
  selectedIds: Set<string>;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const selected = products.filter((p) => selectedIds.has(p.id));
  const [retailPrice, setRetailPrice] = useState('');
  const [lazadaPrice, setLazadaPrice] = useState('');
  const [shopeePrice, setShopeePrice] = useState('');
  const [tiktokPrice, setTiktokPrice] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function save() {
    setLoading(true);
    let updated = 0;
    for (const p of selected) {
      const lots = p.stock_lots ?? [];
      for (const lot of lots) {
        const lotLabel = lot.lot_label as 'old' | 'new';
        if (retailPrice) {
          await supabase.from('stock_lots').update({ retail_price: Number(retailPrice) }).eq('id', lot.id);
        }
        if (lazadaPrice) {
          await supabase.from('product_platform_prices').upsert({ product_id: p.id, lot_label: lotLabel, platform: 'lazada', price: Number(lazadaPrice) });
        }
        if (shopeePrice) {
          await supabase.from('product_platform_prices').upsert({ product_id: p.id, lot_label: lotLabel, platform: 'shopee', price: Number(shopeePrice) });
        }
        if (tiktokPrice) {
          await supabase.from('product_platform_prices').upsert({ product_id: p.id, lot_label: lotLabel, platform: 'tiktok', price: Number(tiktokPrice) });
        }
        if (linePrice) {
          await supabase.from('product_platform_prices').upsert({ product_id: p.id, lot_label: lotLabel, platform: 'line', price: Number(linePrice) });
        }
      }
      updated++;
    }
    setLoading(false);
    setToast({ type: 'success', msg: `อัปเดตราคา ${updated} รายการสำเร็จ` });
    setTimeout(() => onSaved(), 1000);
  }

  const fields: { label: string; value: string; set: (v: string) => void; color: string }[] = [
    { label: 'หน้าร้าน', value: retailPrice, set: setRetailPrice, color: 'text-surface-800' },
    { label: 'Lazada', value: lazadaPrice, set: setLazadaPrice, color: 'text-blue-600' },
    { label: 'Shopee', value: shopeePrice, set: setShopeePrice, color: 'text-orange-600' },
    { label: 'TikTok', value: tiktokPrice, set: setTiktokPrice, color: 'text-surface-800' },
    { label: 'LINE', value: linePrice, set: setLinePrice, color: 'text-green-600' },
  ];

  return (
    <Modal open onClose={onClose} title={`แก้ไขราคา (${selected.length} รายการ)`} size="sm">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}
        <p className="text-xs text-surface-400">กรอกเฉพาะช่องที่ต้องการเปลี่ยน ปล่อยว่าง = ไม่เปลี่ยน</p>
        {fields.map((f) => (
          <div key={f.label}>
            <label className={cn('block text-sm font-medium mb-1.5', f.color)}>{f.label}</label>
            <input type="number" min={0} value={f.value} onChange={(e) => f.set(e.target.value)} className="input-base" placeholder="ปล่อยว่าง = ไม่เปลี่ยน" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

function MergeProductsModal({ selectedIds, products, onClose, onMerged, working, setWorking }: {
  selectedIds: Set<string>;
  products: Product[];
  onClose: () => void;
  onMerged: () => void;
  working: boolean;
  setWorking: (v: boolean) => void;
}) {
  const selected = products.filter((p) => selectedIds.has(p.id) && !p.parent_product_id);
  const [parentId, setParentId] = useState<string>('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const parent = selected.find((p) => p.id === parentId) ?? null;
  const variants = selected.filter((p) => p.id !== parentId);

  async function doMerge() {
    if (!parent || variants.length === 0) return;
    setWorking(true);
    setToast(null);
    try {
      const childIds = variants.map((v) => v.id);
      const { data, error } = await supabase.rpc('merge_products_into_parent', {
        p_parent_id: parent.id,
        p_child_ids: childIds,
      });
      if (error) throw error;
      const moved = (data as { moved_barcodes?: number } | null)?.moved_barcodes ?? 0;
      setToast({ type: 'success', msg: `รวม ${variants.length} สินค้าเข้ากับ "${parent.name}" สำเร็จ (ย้าย ${moved} ตัวเลือกย่อย)` });
      setTimeout(() => onMerged(), 1000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด';
      setToast({ type: 'error', msg });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`รวมสินค้าเป็นตัวเลือกย่อย (${selected.length} รายการ)`} size="md">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}
        <p className="text-sm text-surface-500">
          เลือกสินค้าที่จะเป็น <strong>สินค้าหลัก (parent)</strong> สินค้าที่เหลือจะกลายเป็น <strong>ตัวเลือกย่อย (variant)</strong> ของสินค้าหลัก
        </p>
        {selected.length < 2 && (
          <div className="p-3 rounded-xl bg-warning-100 text-warning-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            ต้องเลือกอย่างน้อย 2 สินค้าที่ไม่มีตัวเลือกย่อยอยู่แล้ว
          </div>
        )}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParentId(p.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                parentId === p.id ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-surface-300 bg-white'
              )}
            >
              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', parentId === p.id ? 'border-primary-500 bg-primary-500' : 'border-surface-300')}>
                {parentId === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-800 truncate">{p.name}</p>
                <p className="text-xs text-surface-400">{p.sku} · ฿{p.retail_price.toLocaleString()}</p>
              </div>
              {parentId === p.id && <span className="text-xs font-bold text-primary-600 shrink-0">สินค้าหลัก</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={doMerge} loading={working} disabled={!parent || variants.length === 0} className="flex-1">
            รวม {variants.length} รายการ
          </Button>
        </div>
      </div>
    </Modal>
  );
}