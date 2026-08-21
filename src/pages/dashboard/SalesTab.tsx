import { useState } from 'react';
import { TrendingUp, Package, Target, Layers, Clock, BarChart3, Store, Undo2, Receipt, Scale } from 'lucide-react';
import type { SalesData } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, SectionCard, ProgressRing, EmptyState } from './ChartKit';
import { DrillDownModal } from './DrillDownModal';
import { formatMoney, formatNumber, formatThaiDateFull } from './helpers';

const CHANNEL_COLORS: Record<string, string> = {
  'หน้าร้าน': '#3D7BF5', 'TikTok': '#ec4899', 'Shopee': '#f97316', 'Lazada': '#0ea5e9', 'LINE OA': '#16a34a', 'เบิกออกมือ': '#f59e0b', 'อื่นๆ': '#64748b',
};

export function SalesTab({ data, onProductClick }: { data: SalesData; onProductClick?: (productId: string) => void }) {
  const [showBillList, setShowBillList] = useState(false);
  const hasData = data.kpis.length > 0 && data.kpis.some((k) => k.value > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลยอดขายในช่วงที่เลือก ลองขยายช่วงวันที่หรือเปลี่ยนสาขา" />
      </div>
    );
  }

  const channelPieData = data.channelBreakdown.map((c) => ({ name: c.channel, value: c.sales, color: c.color }));
  const topProductData = data.topProducts.slice(0, 10).map((p) => ({ label: p.name.length > 15 ? p.name.slice(0, 13) + '…' : p.name, value: p.salesValue }));
  const hourlyData = data.hourlyPattern.map((h) => ({ label: h.hour, count: h.count }));
  const branchData = data.branchComparison.length > 0
    ? Object.keys(data.branchComparison[0]).filter((k) => k !== 'date' && k !== 'label').map((branch) => ({
        branch,
        sales: data.branchComparison.reduce((sum, p) => sum + (Number(p[branch]) || 0), 0),
      })).sort((a, b) => b.sales - a.sales)
    : [];

  const normalVsCostData = [
    { label: 'ขายราคาปกติ', value: data.normalSales, color: '#3D7BF5' },
    { label: 'ขายราคาทุน', value: data.costSales, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <SectionCard title="แนวโน้มยอดขายรายวัน" subtitle="ยอดขายและจำนวนชิ้นที่ขาย เทียบช่วงก่อนหน้า" icon={<TrendingUp className="h-5 w-5 text-primary-500" />}>
        <MultiLineChart
          data={data.dailyTrend}
          series={[
            { key: 'sales', name: 'ยอดขาย (฿)', color: '#3D7BF5' },
            { key: 'units', name: 'จำนวนชิ้น', color: '#16a34a' },
          ]}
          height={320}
        />
      </SectionCard>

      {data.targetInfo.targetAmount > 0 && (
        <SectionCard title="ความคืบหน้าเป้าหมาย" subtitle={`เป้าหมาย ${data.targetInfo.type === 'daily' ? 'รายวัน' : 'รายเดือน'}: ${formatMoney(data.targetInfo.targetAmount)}`} icon={<Target className="h-5 w-5 text-primary-500" />}>
          <div className="flex items-center gap-8">
            <ProgressRing percent={data.targetInfo.percent} label="บรรลุเป้า" color="#3D7BF5" size={140} />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-surface-400">ยอดขายจริง</p>
                <p className="text-2xl font-bold text-surface-900">{formatMoney(data.targetInfo.actualAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">ยอดที่เหลือถึงเป้า</p>
                <p className="text-lg font-semibold text-primary-600">{formatMoney(data.targetInfo.remaining)}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="ยอดขายตามช่องทาง" subtitle="สัดส่วนยอดขายแยกช่องทางขาย" icon={<Layers className="h-5 w-5 text-primary-500" />}>
          {channelPieData.length > 0 ? (
            <SimplePieChart data={channelPieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="ขายราคาปกติ vs ขายราคาทุน" subtitle="เปรียบเทียบยอดขายจริงกับยอดขายภายใน (ราคาทุน)" icon={<Scale className="h-5 w-5 text-primary-500" />}>
          {normalVsCostData.length > 0 ? (
            <div className="space-y-4">
              {normalVsCostData.map((d) => {
                const total = normalVsCostData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div key={d.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-surface-700">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.label}
                      </span>
                      <span className="text-sm font-semibold text-surface-800">{formatMoney(d.value)} ({pct}%)</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-50">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 flex items-center justify-between border-t border-surface-50 pt-3">
                <span className="text-sm text-surface-500">ยอดขายรวม</span>
                <span className="text-lg font-bold text-surface-900">{formatMoney(data.normalSales + data.costSales)}</span>
              </div>
            </div>
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>
      </div>

      {branchData.length > 1 && (
        <SectionCard title="เปรียบเทียบยอดขายตามสาขา" subtitle="ยอดขายแยกตามสาขา (แสดงเมื่อเลือกทุกสาขา)" icon={<Store className="h-5 w-5 text-primary-500" />}>
          <SimpleBarChart data={branchData.map((b) => ({ label: b.branch.length > 12 ? b.branch.slice(0, 10) + '…' : b.branch, value: b.sales }))} dataKey="value" name="ยอดขาย" color="#3D7BF5" height={280} yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="สินค้าขายดี Top 10" subtitle="เรียงตามมูลค่ายอดขาย" icon={<Package className="h-5 w-5 text-primary-500" />}>
          {topProductData.length > 0 ? (
            <div className="space-y-1">
              {data.topProducts.slice(0, 10).map((p, i) => (
                <button
                  key={i}
                  onClick={() => onProductClick?.(p.productId)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-50"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600">{i + 1}</span>
                    <span className="truncate text-sm font-medium text-surface-800">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-surface-700">{formatMoney(p.salesValue)}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="ช่วงเวลาที่ขายดี" subtitle="จำนวนรายการขายแยกตามชั่วโมง" icon={<Clock className="h-5 w-5 text-primary-500" />}>
          {hourlyData.length > 0 ? (
            <SimpleBarChart data={hourlyData} dataKey="count" name="จำนวนรายการ" color="#f59e0b" height={300} yFormatter={(v) => String(v)} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>
      </div>

      {data.recentMovements.length > 0 && (
        <SectionCard title="รายการขายล่าสุด" subtitle="50 รายการล่าสุด" icon={<BarChart3 className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">วันที่</th>
                  <th className="px-4 py-2">สินค้า</th>
                  <th className="px-4 py-2">ช่องทาง</th>
                  <th className="px-4 py-2 text-right">จำนวน</th>
                  <th className="px-4 py-2 text-right">ราคา/ชิ้น</th>
                  <th className="px-4 py-2 text-right">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.recentMovements.map((m, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className="px-4 py-2.5 text-surface-500">{formatThaiDateFull(m.date.slice(0, 10))}</td>
                    <td className="px-4 py-2.5 font-medium text-surface-800">{m.product}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[m.channel] ?? '#64748b' }} />
                        <span className="text-surface-600">{m.channel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-700">{formatNumber(m.quantity)}</td>
                    <td className="px-4 py-2.5 text-right text-surface-500">{formatMoney(m.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-surface-700">{formatMoney(m.quantity * m.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <DrillDownModal
        open={showBillList}
        onClose={() => setShowBillList(false)}
        title="รายการขายทั้งหมด"
        subtitle={`${data.billCount} รายการ · ยอดรวม ${formatMoney(data.kpis[0]?.value ?? 0)}`}
        maxWidth="max-w-4xl"
      >
        <div className="table-scroll">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-surface-50 text-xs text-surface-400">
              <tr>
                <th className="px-4 py-2">วันที่</th>
                <th className="px-4 py-2">สินค้า</th>
                <th className="px-4 py-2">ช่องทาง</th>
                <th className="px-4 py-2 text-right">จำนวน</th>
                <th className="px-4 py-2 text-right">ราคา/ชิ้น</th>
                <th className="px-4 py-2 text-right">ยอดรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {data.recentMovements.map((m, i) => (
                <tr key={i} className="hover:bg-surface-50">
                  <td className="px-4 py-2.5 text-surface-500">{formatThaiDateFull(m.date.slice(0, 10))}</td>
                  <td className="px-4 py-2.5 font-medium text-surface-800">{m.product}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[m.channel] ?? '#64748b' }} />
                      <span className="text-surface-600">{m.channel}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-surface-700">{formatNumber(m.quantity)}</td>
                  <td className="px-4 py-2.5 text-right text-surface-500">{formatMoney(m.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-surface-700">{formatMoney(m.quantity * m.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DrillDownModal>
    </div>
  );
}
