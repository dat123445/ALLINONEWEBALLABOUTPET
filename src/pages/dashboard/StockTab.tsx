import { useState, useMemo } from 'react';
import { Boxes, Activity, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Repeat, Filter, ChevronRight } from 'lucide-react';
import type { StockData } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, SectionCard, EmptyState } from './ChartKit';
import { DrillDownModal } from './DrillDownModal';
import { formatMoney, formatNumber, formatThaiDateFull } from './helpers';

const TYPE_LABELS: Record<string, string> = {
  receive: 'รับเข้า', withdraw: 'เบิกออก', transfer_in: 'รับโอน', transfer_out: 'ส่งโอน', adjust: 'ปรับปรุง',
};

type StockFilter = 'all' | 'low' | 'out' | 'normal';

export function StockTab({ data, onProductClick }: { data: StockData; onProductClick?: (productId: string) => void }) {
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selectedProduct, setSelectedProduct] = useState<{ productId: string; name: string } | null>(null);

  const hasData = data.kpis.length > 0 && (data.kpis.some((k) => k.value > 0) || data.recentMovements.length > 0 || data.lowStockAlerts.length > 0);

  const filteredLowStock = useMemo(() => {
    if (stockFilter === 'all') return data.lowStockAlerts;
    if (stockFilter === 'low') return data.lowStockAlerts.filter((a) => a.stockQty > 0);
    if (stockFilter === 'out') return data.lowStockAlerts.filter((a) => a.stockQty === 0);
    return data.lowStockAlerts;
  }, [data.lowStockAlerts, stockFilter]);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลสต๊อกในช่วงที่เลือก" />
      </div>
    );
  }

  const typePieData = data.movementByType.map((m) => ({ name: m.type, value: m.quantity, color: m.color }));
  const topMovedData = data.topMovedProducts.slice(0, 10).map((p) => ({ label: p.name.length > 15 ? p.name.slice(0, 13) + '…' : p.name, value: p.movedQty }));
  const branchStockData = data.branchStockValue.map((b) => ({ label: b.branch, value: b.stockValue }));

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <SectionCard title="แนวโน้มการเคลื่อนไหวสต๊อก" subtitle="รับเข้า / เบิกออก / โอน รายวัน" icon={<Activity className="h-5 w-5 text-primary-500" />}>
        <MultiLineChart
          data={data.movementTrend}
          series={[
            { key: 'received', name: 'รับเข้า', color: '#16a34a' },
            { key: 'withdrawn', name: 'เบิกออก', color: '#ef4444' },
            { key: 'transferred', name: 'โอน', color: '#0ea5e9' },
          ]}
          height={320}
          yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="สัดส่วนการเคลื่อนไหวตามประเภท" subtitle="แยกประเภทรับเข้า/เบิกออก/โอน ตามจำนวนชิ้น" icon={<Repeat className="h-5 w-5 text-primary-500" />}>
          {typePieData.length > 0 ? (
            <SimplePieChart data={typePieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="มูลค่าสต๊อกแยกสาขา" subtitle="มูลค่าสินค้าคงคลังแยกตามสาขา" icon={<Boxes className="h-5 w-5 text-primary-500" />}>
          {branchStockData.length > 0 ? (
            <SimpleBarChart data={branchStockData} dataKey="value" name="มูลค่าสต๊อก" color="#0ea5e9" height={280} yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>
      </div>

      <SectionCard title="สินค้าที่เคลื่อนไหวมากสุด Top 10" subtitle="เรียงตามจำนวนชิ้นที่รับ/เบิก/โอนรวม" icon={<Package className="h-5 w-5 text-primary-500" />}>
        {topMovedData.length > 0 ? (
          <div className="space-y-1">
            {data.topMovedProducts.slice(0, 10).map((p, i) => (
              <button
                key={i}
                onClick={() => onProductClick?.(p.productId)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-50"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600">{i + 1}</span>
                  <span className="truncate text-sm font-medium text-surface-800">{p.name}</span>
                  <span className="shrink-0 text-xs text-surface-400">{p.category}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-surface-700">{formatNumber(p.movedQty)}</span>
                  <ChevronRight className="h-4 w-4 text-surface-300" />
                </span>
              </button>
            ))}
          </div>
        ) : <EmptyState message="ยังไม่มีข้อมูล" />}
      </SectionCard>

      {data.lowStockAlerts.length > 0 && (
        <SectionCard
          title="แจ้งเตือนสต๊อกต่ำ"
          subtitle="สินค้าที่สต๊อกต่ำกว่าระดับขั้นต่ำ"
          icon={<AlertTriangle className="h-5 w-5 text-error-500" />}
          action={
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-surface-400" />
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="low">สต๊อกต่ำ</option>
                <option value="out">หมดสต๊อก</option>
              </select>
            </div>
          }
        >
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-error-50 text-xs text-error-700">
                <tr>
                  <th className="px-4 py-2">สินค้า</th>
                  <th className="px-4 py-2">หมวด</th>
                  <th className="px-4 py-2 text-right">สต๊อกปัจจุบัน</th>
                  <th className="px-4 py-2 text-right">ระดับขั้นต่ำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filteredLowStock.map((item, i) => (
                  <tr
                    key={i}
                    className="cursor-pointer hover:bg-surface-50"
                    onClick={() => onProductClick?.(item.productId)}
                  >
                    <td className="px-4 py-3 font-medium text-surface-800">{item.name}</td>
                    <td className="px-4 py-3 text-surface-500">{item.category}</td>
                    <td className="px-4 py-3 text-right font-semibold text-error-600">{formatNumber(item.stockQty)}</td>
                    <td className="px-4 py-3 text-right text-surface-500">{formatNumber(item.minStock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {data.recentMovements.length > 0 && (
        <SectionCard title="รายการเคลื่อนไหวล่าสุด" subtitle="50 รายการล่าสุด" icon={<Activity className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">วันที่</th>
                  <th className="px-4 py-2">สินค้า</th>
                  <th className="px-4 py-2">ประเภท</th>
                  <th className="px-4 py-2 text-right">จำนวน</th>
                  <th className="px-4 py-2">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.recentMovements.map((m, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className="px-4 py-2.5 text-surface-500">{formatThaiDateFull(m.date.slice(0, 10))}</td>
                    <td className="px-4 py-2.5 font-medium text-surface-800">{m.product}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-surface-600">
                        {m.type === 'receive' || m.type === 'transfer_in' ? (
                          <ArrowDownToLine className="h-3.5 w-3.5 text-success-600" />
                        ) : m.type === 'withdraw' || m.type === 'transfer_out' ? (
                          <ArrowUpFromLine className="h-3.5 w-3.5 text-error-600" />
                        ) : (
                          <Repeat className="h-3.5 w-3.5 text-warning-600" />
                        )}
                        {TYPE_LABELS[m.type] ?? m.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-700">{formatNumber(m.quantity)}</td>
                    <td className="px-4 py-2.5 text-surface-500">{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
