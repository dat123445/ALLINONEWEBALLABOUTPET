import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Building2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/format';
import { useDashboardData } from './dashboard/data';
import { defaultDateRange, dateRangeFromPreset, formatThaiDate, tabFromHash, TAB_HASHES } from './dashboard/helpers';
import type { DashboardTab, DatePreset, DateRange } from './dashboard/types';
import { OverviewTab } from './dashboard/OverviewTab';
import { SalesTab } from './dashboard/SalesTab';
import { StockTab } from './dashboard/StockTab';
import { WorkforceTab } from './dashboard/WorkforceTab';
import { CustomersTab } from './dashboard/CustomersTab';
import { MarketingTab } from './dashboard/MarketingTab';
import { FinanceTab } from './dashboard/FinanceTab';
import { SettingsTab, loadSettings, type DashboardSettings } from './dashboard/SettingsTab';
import { DrillDownModal } from './dashboard/DrillDownModal';
import { formatMoney, formatNumber, formatThaiDateFull } from './dashboard/helpers';
import type { Role } from '@/types/permissions';

const TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'ภาพรวม',
  sales: 'ยอดขาย',
  stock: 'สต๊อก',
  workforce: 'พนักงาน',
  customers: 'ลูกค้า',
  marketing: 'การตลาด',
  finance: 'การเงิน',
  settings: 'ตั้งค่า',
};

const FINANCE_ALLOWED_ROLES: Role[] = ['owner', 'super_admin', 'admin', 'finance'];

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: 'custom', label: 'กำหนดเอง' },
];

const REFRESH_INTERVAL = 60_000;

export function DashboardPage() {
  const { profile } = useAuth();
  const userBranchId = profile?.active_branch_id ?? null;
  const userRoles = profile?.roles ?? [];
  const canSeeFinance = userRoles.some((r) => FINANCE_ALLOWED_ROLES.includes(r));

  const visibleTabs = useMemo(() => {
    const all = Object.keys(TAB_LABELS) as DashboardTab[];
    return all.filter((key) => key !== 'finance' || canSeeFinance);
  }, [canSeeFinance]);

  const [tab, setTab] = useState<DashboardTab>(() => {
    const settings = loadSettings();
    const hashTab = tabFromHash(window.location.hash);
    return hashTab !== 'overview' ? hashTab : (settings.defaultTab as DashboardTab) ?? 'overview';
  });

  useEffect(() => {
    if (tab === 'finance' && !canSeeFinance) {
      setTab('overview');
      window.location.hash = TAB_HASHES['overview'];
    }
  }, [tab, canSeeFinance]);
  const [preset, setPreset] = useState<DatePreset>('7d');
  const [range, setRange] = useState<DateRange>(() => dateRangeFromPreset('7d'));
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(userBranchId);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [settings, setSettings] = useState<DashboardSettings>(() => loadSettings());
  const [drillProduct, setDrillProduct] = useState<{ productId: string; name: string } | null>(null);
  const [drillMovements, setDrillMovements] = useState<Array<{ id: string; type: string; quantity: number; date: string; note: string; branch: string }>>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const isDateFilteredTab = tab !== 'settings';
  const queryRange = useMemo(() => isDateFilteredTab ? range : defaultDateRange(), [isDateFilteredTab, range]);
  const { data, loading, error, reload } = useDashboardData(queryRange, selectedBranchId, { brand: brandFilter, category: categoryFilter });

  const dataRef = useRef(data);
  dataRef.current = data;

  const handleProductClick = useCallback(async (productId: string) => {
    const d = dataRef.current;
    const allProducts = [
      ...d.sales.topProducts.map((p) => ({ productId: p.productId, name: p.name })),
      ...d.stock.topMovedProducts.map((p) => ({ productId: p.productId, name: p.name })),
      ...d.stock.lowStockAlerts.map((p) => ({ productId: p.productId, name: p.name })),
      ...d.overview.topProducts.map((p) => ({ productId: p.productId, name: p.name })),
    ];
    const found = allProducts.find((p) => p.productId === productId);
    setDrillProduct({ productId, name: found?.name ?? 'สินค้า' });
    setDrillLoading(true);
    try {
      const { data: mov } = await supabase
        .from('stock_movements')
        .select('id, movement_type, quantity, created_at, reference_note, branches(name)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);
      setDrillMovements((mov ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        type: m.movement_type as string,
        quantity: Number(m.quantity ?? 0),
        date: m.created_at as string,
        note: (m.reference_note as string) ?? '',
        branch: ((m.branches as { name: string } | null)?.name) ?? 'ไม่ระบุ',
      })));
    } catch {
      setDrillMovements([]);
    }
    setDrillLoading(false);
  }, []);

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const id = setInterval(() => { void reload(); }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [reload]);

  function switchTab(next: DashboardTab) {
    setTab(next);
    window.location.hash = TAB_HASHES[next];
  }

  function applyPreset(p: DatePreset) {
    setPreset(p);
    if (p !== 'custom') setRange(dateRangeFromPreset(p));
  }

  function shiftRange(days: number) {
    setPreset('custom');
    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    start.setDate(start.getDate() + days);
    end.setDate(end.getDate() + days);
    setRange({ start: toLocalDate(start), end: toLocalDate(end) });
  }

  const rangeLabel = useMemo(() => {
    if (range.start === range.end) return formatThaiDate(range.start);
    return `${formatThaiDate(range.start)} - ${formatThaiDate(range.end)}`;
  }, [range]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-100 p-1">
          {visibleTabs.map((key) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={cn(
                'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300',
                tab === key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Filters */}
        {isDateFilteredTab && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch filter */}
            <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
              <Building2 className="h-4 w-4 text-surface-400" />
              <select
                value={selectedBranchId ?? ''}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
                className="bg-transparent text-sm font-medium text-surface-700 outline-none cursor-pointer"
              >
                <option value="">ทุกสาขา</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Brand filter */}
            {data.brands.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
                <Tag className="h-4 w-4 text-surface-400" />
                <select
                  value={brandFilter ?? ''}
                  onChange={(e) => setBrandFilter(e.target.value || null)}
                  className="bg-transparent text-sm font-medium text-surface-700 outline-none cursor-pointer"
                >
                  <option value="">แบรนด์ทั้งหมด</option>
                  {data.brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category filter */}
            {data.categories.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
                <Tag className="h-4 w-4 text-surface-400" />
                <select
                  value={categoryFilter ?? ''}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="bg-transparent text-sm font-medium text-surface-700 outline-none cursor-pointer"
                >
                  <option value="">หมวดหมู่ทั้งหมด</option>
                  {data.categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date presets */}
            <div className="flex rounded-lg bg-surface-50 p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    preset === p.key ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date navigation */}
            <button onClick={() => shiftRange(-7)} className="rounded-lg bg-surface-50 p-2 text-surface-400 transition-colors hover:bg-surface-100" title="ย้อนหลัง 7 วัน">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
              <Calendar className="h-4 w-4 text-surface-400" />
              <span className="text-sm font-medium text-surface-700">{rangeLabel}</span>
              {preset === 'custom' && (
                <>
                  <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="ml-2 rounded-md border border-surface-200 px-2 py-1 text-xs outline-none" />
                  <span className="text-surface-400">-</span>
                  <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="rounded-md border border-surface-200 px-2 py-1 text-xs outline-none" />
                </>
              )}
            </div>
            <button onClick={() => shiftRange(7)} className="rounded-lg bg-surface-50 p-2 text-surface-400 transition-colors hover:bg-surface-100" title="ถัดไป 7 วัน">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={reload} className="rounded-lg bg-surface-50 p-2 text-surface-400 transition-colors hover:bg-surface-100" title="รีเฟรช">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && isDateFilteredTab && (
        <div className="rounded-xl bg-error-50 p-4 text-sm text-error-700">
          เกิดข้อผิดพลาดในการโหลดข้อมูล: {error}
          <button onClick={reload} className="ml-3 font-medium underline">ลองใหม่</button>
        </div>
      )}

      {/* Content */}
      {loading && isDateFilteredTab ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : tab === 'overview' ? (
        <OverviewTab data={data.overview} onProductClick={handleProductClick} />
      ) : tab === 'sales' ? (
        <SalesTab data={data.sales} onProductClick={handleProductClick} />
      ) : tab === 'stock' ? (
        <StockTab data={data.stock} onProductClick={handleProductClick} />
      ) : tab === 'workforce' ? (
        <WorkforceTab data={data.workforce} />
      ) : tab === 'customers' ? (
        <CustomersTab data={data.customers} />
      ) : tab === 'marketing' ? (
        <MarketingTab data={data.marketing} />
      ) : tab === 'finance' ? (
        <FinanceTab data={data.finance} />
      ) : tab === 'settings' ? (
        <SettingsTab settings={settings} onChange={setSettings} />
      ) : null}

      <DrillDownModal
        open={drillProduct !== null}
        onClose={() => { setDrillProduct(null); setDrillMovements([]); }}
        title={drillProduct?.name ?? 'สินค้า'}
        subtitle="ประวัติการเคลื่อนไหวสินค้า (50 รายการล่าสุด)"
        maxWidth="max-w-3xl"
      >
        {drillLoading ? (
          <div className="flex justify-center py-12"><Spinner size="md" /></div>
        ) : drillMovements.length === 0 ? (
          <p className="py-8 text-center text-sm text-surface-400">ยังไม่มีข้อมูลการเคลื่อนไหว</p>
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">วันที่</th>
                  <th className="px-4 py-2">ประเภท</th>
                  <th className="px-4 py-2 text-right">จำนวน</th>
                  <th className="px-4 py-2">สาขา</th>
                  <th className="px-4 py-2">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {drillMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-50">
                    <td className="px-4 py-2.5 text-surface-500">{formatThaiDateFull(m.date.slice(0, 10))}</td>
                    <td className="px-4 py-2.5 text-surface-600">{m.type}</td>
                    <td className="px-4 py-2.5 text-right text-surface-700">{formatNumber(m.quantity)}</td>
                    <td className="px-4 py-2.5 text-surface-500">{m.branch}</td>
                    <td className="px-4 py-2.5 text-surface-400">{m.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DrillDownModal>
    </div>
  );
}

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
