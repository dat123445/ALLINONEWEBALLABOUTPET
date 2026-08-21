import { useState } from 'react';
import { TrendingUp, Package, Target, Store, Layers, AlertTriangle, DollarSign, BarChart3, Clock } from 'lucide-react';
import type { OverviewData, TrendPoint, OverviewAlert } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, ProgressRing, SectionCard, InsightBanner, EmptyState } from './ChartKit';
import { formatMoney, formatNumber } from './helpers';

const ALERT_CONFIG: Record<OverviewAlert['type'], { color: string; bg: string; label: string; icon: typeof AlertTriangle }> = {
  urgent: { color: 'text-error-700', bg: 'bg-error-50 border-error-200', label: 'ต้องสั่งด่วน', icon: AlertTriangle },
  low: { color: 'text-warning-700', bg: 'bg-warning-50 border-warning-200', label: 'ใกล้หมด', icon: AlertTriangle },
  expiry: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'ใกล้หมดอายุ', icon: Clock },
  slow: { color: 'text-surface-600', bg: 'bg-surface-50 border-surface-200', label: 'ขายช้า', icon: Clock },
};

function AlertCard({ alert }: { alert: OverviewAlert }) {
  const cfg = ALERT_CONFIG[alert.type];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.bg} transition-transform hover:scale-[1.02]`}>
      <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-surface-800">{alert.productName}</p>
        <p className="truncate text-xs text-surface-500">{alert.detail}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
    </div>
  );
}

export function OverviewTab({ data, onProductClick }: { data: OverviewData; onProductClick?: (productId: string) => void }) {
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d');
  const hasData = data.kpis.length > 0 && data.kpis.some((k) => k.value > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลในช่วงที่เลือก ลองขยายช่วงวันที่หรือเปลี่ยนสาขา" />
      </div>
    );
  }

  const branchColors = ['#3D7BF5', '#16a34a', '#f59e0b', '#ec4899', '#0ea5e9', '#f97316'];
  const channelPieData = data.salesByChannel.map((c) => ({ name: c.channel, value: c.sales, color: c.color }));
  const topProductData = data.topProducts.map((p) => ({ label: p.name.length > 15 ? p.name.slice(0, 13) + '…' : p.name, value: p.salesValue }));
  const categoryBarData = data.salesByCategory.map((c) => ({ label: c.category.length > 12 ? c.category.slice(0, 10) + '…' : c.category, value: c.sales, color: c.color }));

  // Slice trend data based on toggle
  const slicedTrend = trendRange === '7d' ? data.salesTrend.slice(-7) : data.salesTrend;
  const slicedProfit = trendRange === '7d' ? data.profitTrend.slice(-7) : data.profitTrend;

  // Merge sales + profit into combined trend points for the overlay chart
  const combinedTrend: TrendPoint[] = slicedTrend.map((p, i) => ({
    date: p.date,
    label: p.label,
    sales: Number(p.sales),
    profit: Number(slicedProfit[i]?.profit ?? 0),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <InsightBanner text={data.insight} />

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <SectionCard title="การแจ้งเตือน" subtitle="สินค้าที่ต้องดูแล" icon={<AlertTriangle className="h-5 w-5 text-error-500" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Sales + Profit combined trend with 7d/30d toggle */}
      <SectionCard
        title="แนวโน้มยอดขายและกำไร"
        subtitle="เปรียบเทียบยอดขายกับกำไรขั้นต้นในกราฟเดียวกัน"
        icon={<TrendingUp className="h-5 w-5 text-primary-500" />}
        action={
          <div className="flex rounded-lg bg-surface-50 p-1">
            <button
              onClick={() => setTrendRange('7d')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${trendRange === '7d' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
            >7 วัน</button>
            <button
              onClick={() => setTrendRange('30d')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${trendRange === '30d' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
            >30 วัน</button>
          </div>
        }
      >
        <MultiLineChart
          data={combinedTrend}
          series={[
            { key: 'sales', name: 'ยอดขาย', color: '#3D7BF5' },
            { key: 'profit', name: 'กำไรขั้นต้น', color: '#16a34a' },
          ]}
          height={320}
        />
      </SectionCard>

      {data.forecast.length > 0 && (
        <SectionCard title="คาดการณ์ยอดขาย" subtitle="พยากรณ์อีก 7 วัน จากแนวโน้มปัจจุบัน" icon={<Target className="h-5 w-5 text-primary-500" />}>
          <MultiLineChart
            data={[...data.salesTrend.map((p) => ({ date: p.date, label: p.label, actual: Number(p.sales), predicted: 0 })), ...data.forecast.map((f) => ({ date: f.date, label: f.label, actual: 0, predicted: f.predicted }))]}
            series={[
              { key: 'actual', name: 'ยอดขายจริง', color: '#3D7BF5' },
              { key: 'predicted', name: 'คาดการณ์', color: '#f59e0b' },
            ]}
            height={280}
          />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales by Category — Bar chart */}
        <SectionCard title="ยอดขายแยกหมวดหมู่" subtitle="เปรียบเทียบยอดขายตามหมวดสินค้า" icon={<BarChart3 className="h-5 w-5 text-primary-500" />}>
          {categoryBarData.length > 0 ? (
            <SimpleBarChart data={categoryBarData} dataKey="value" name="ยอดขาย" color="#3D7BF5" height={280} yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          ) : <EmptyState message="ยังไม่มีข้อมูลหมวดหมู่" />}
        </SectionCard>

        {/* Sales by Channel — Pie chart */}
        <SectionCard title="ยอดขายตามช่องทาง" subtitle="สัดส่วนยอดขายแยกตามช่องทางการขาย" icon={<Layers className="h-5 w-5 text-primary-500" />}>
          {channelPieData.length > 0 ? (
            <SimplePieChart data={channelPieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูลช่องทาง" />}
        </SectionCard>
      </div>

      {/* Top 10 Products */}
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
                  <span className="shrink-0 text-xs text-surface-400">{p.category}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-surface-700">{formatMoney(p.salesValue)}</span>
              </button>
            ))}
          </div>
        ) : <EmptyState message="ยังไม่มีข้อมูลสินค้าขายดี" />}
      </SectionCard>

      {data.targetProgress.length > 0 && (
        <SectionCard title="ความคืบหน้าเป้าหมายยอดขาย" subtitle="เปรียบเทียบยอดขายจริงกับเป้าหมาย" icon={<Target className="h-5 w-5 text-primary-500" />}>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {data.targetProgress.map((t, i) => (
              <div key={i} className="flex flex-col items-center">
                <ProgressRing percent={t.percent} label={t.branch} color={branchColors[i % branchColors.length]} size={100} />
                <div className="mt-2 text-center">
                  <p className="text-xs text-surface-400">เป้า: {formatMoney(t.target)}</p>
                  <p className="text-xs font-medium text-surface-600">ทำได้: {formatMoney(t.actual)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data.salesByBranch.length > 0 && (
        <SectionCard title="ยอดขายแยกสาขา" subtitle="เปรียบเทียบยอดขายรายสาขา" icon={<Store className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">สาขา</th>
                  <th className="px-4 py-2 text-right">ยอดขาย</th>
                  <th className="px-4 py-2 text-right">จำนวนชิ้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.salesByBranch.map((b, i) => (
                  <tr key={i} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-surface-800">{b.branch}</td>
                    <td className="px-4 py-3 text-right text-surface-700">{formatMoney(b.sales)}</td>
                    <td className="px-4 py-3 text-right text-surface-500">{formatNumber(b.units)}</td>
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
