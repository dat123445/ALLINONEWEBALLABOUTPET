import { Users, UserPlus, Repeat, Wallet, Star, Headphones } from 'lucide-react';
import type { CustomersData } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, SectionCard, EmptyState } from './ChartKit';
import { formatMoney, formatNumber, formatThaiDateFull } from './helpers';

export function CustomersTab({ data }: { data: CustomersData }) {
  const hasData = data.kpis.length > 0 && data.kpis.some((k) => k.value > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลลูกค้าในช่วงที่เลือก" />
      </div>
    );
  }

  const channelPieData = data.customerByChannels.map((c) => ({ name: c.channel, value: c.totalSpent, color: c.color }));
  const newVsReturningData = data.newVsReturning.map((p) => ({ label: p.label, newCount: p.newCount, returningCount: p.returningCount }));

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <SectionCard title="ลูกค้าใหม่ vs ซื้อซ้ำ" subtitle="เปรียบเทียบลูกค้าใหม่กับลูกค้าที่กลับมาซื้อซ้ำ" icon={<UserPlus className="h-5 w-5 text-primary-500" />}>
        {newVsReturningData.length > 0 ? (
          <MultiLineChart
            data={data.customerTrend}
            series={[
              { key: 'newCount', name: 'ลูกค้าใหม่', color: '#3D7BF5' },
              { key: 'returningCount', name: 'ลูกค้าซื้อซ้ำ', color: '#16a34a' },
            ]}
            height={300}
            yFormatter={(v) => String(v)}
          />
        ) : <EmptyState message="ยังไม่มีข้อมูล" />}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="ลูกค้าแยกช่องทาง" subtitle="มูลค่าการซื้อแยกตามช่องทาง" icon={<Users className="h-5 w-5 text-primary-500" />}>
          {channelPieData.length > 0 ? (
            <SimplePieChart data={channelPieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="รีวิวและคะแนน" subtitle="คะแนนรีวิวเฉลี่ยแยกแพลตฟอร์ม" icon={<Star className="h-5 w-5 text-primary-500" />}>
          {data.reviewSummary.length > 0 ? (
            <div className="space-y-3">
              {data.reviewSummary.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-surface-800">{r.platform}</p>
                    <p className="text-xs text-surface-400">{r.count} รีวิว · {r.negativeCount} รีวิวลบ</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-warning-500" />
                    <span className="text-lg font-bold text-surface-900">{r.avgRating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState message="ยังไม่มีรีวิว" />}
        </SectionCard>
      </div>

      {data.csIssues.length > 0 && (
        <SectionCard title="ปัญหาบริการลูกค้า" subtitle="สรุปเคลม ร้องเรียน คืนสินค้า" icon={<Headphones className="h-5 w-5 text-primary-500" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.csIssues.map((issue, i) => (
              <div key={i} className="rounded-xl border border-surface-100 p-4">
                <p className="text-sm font-medium text-surface-700">{issue.type}</p>
                <p className="mt-1 text-2xl font-bold text-surface-900">{issue.count}</p>
                <p className="text-xs text-error-600">{issue.openCount} รอดำเนินการ</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data.topCustomers.length > 0 && (
        <SectionCard title="อันดับลูกค้า" subtitle="เรียงตามมูลค่าการซื้อรวม" icon={<Wallet className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">ชื่อลูกค้า</th>
                  <th className="px-4 py-2 text-right">จำนวนครั้ง</th>
                  <th className="px-4 py-2 text-right">ยอดซื้อรวม</th>
                  <th className="px-4 py-2">สินค้าที่ซื้อบ่อย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.topCustomers.slice(0, 20).map((c, i) => (
                  <tr key={c.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-semibold text-primary-600">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-surface-800">{c.name}</td>
                    <td className="px-4 py-3 text-right text-surface-700">{formatNumber(c.orderCount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-surface-700">{formatMoney(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-surface-500">{c.topProduct}</td>
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
