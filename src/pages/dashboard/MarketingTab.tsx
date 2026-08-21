import { Megaphone, Tag, FileText, TrendingUp, Globe } from 'lucide-react';
import type { MarketingData } from './types';
import { KpiGrid, SectionCard, EmptyState } from './ChartKit';
import { formatMoney, formatNumber } from './helpers';

export function MarketingTab({ data }: { data: MarketingData }) {
  const hasData = data.kpis.length > 0 && data.kpis.some((k) => k.value > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลการตลาด" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      {data.campaignPerformance.length > 0 && (
        <SectionCard title="ผลการรันแคมเปญ" subtitle="สรุปผลแคมเปญการตลาด" icon={<Megaphone className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">แคมเปญ</th>
                  <th className="px-4 py-2">แพลตฟอร์ม</th>
                  <th className="px-4 py-2 text-right">งบประมาณ</th>
                  <th className="px-4 py-2 text-right">ใช้จ่ายจริง</th>
                  <th className="px-4 py-2 text-right">ยอดขาย</th>
                  <th className="px-4 py-2 text-right">ROI</th>
                  <th className="px-4 py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.campaignPerformance.map((c, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-800">{c.name}</td>
                    <td className="px-4 py-3 text-surface-500">{c.platform}</td>
                    <td className="px-4 py-3 text-right text-surface-700">{formatMoney(c.budget)}</td>
                    <td className="px-4 py-3 text-right text-surface-700">{formatMoney(c.spend)}</td>
                    <td className="px-4 py-3 text-right font-medium text-surface-700">{formatMoney(c.sales)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${c.roi >= 0 ? 'text-success-600' : 'text-error-600'}`}>{c.roi}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                        c.status === 'active' ? 'bg-success-50 text-success-700' :
                        c.status === 'ended' ? 'bg-surface-100 text-surface-500' : 'bg-warning-50 text-warning-700'
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {data.promotionPerformance.length > 0 && (
        <SectionCard title="ผลโปรโมชั่น" subtitle="สรุปการใช้งานโปรโมชั่น" icon={<Tag className="h-5 w-5 text-primary-500" />}>
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-surface-50 text-xs text-surface-400">
                <tr>
                  <th className="px-4 py-2">โปรโมชั่น</th>
                  <th className="px-4 py-2">รหัส</th>
                  <th className="px-4 py-2">ประเภท</th>
                  <th className="px-4 py-2 text-right">ใช้งาน</th>
                  <th className="px-4 py-2 text-right">ยอดขาย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.promotionPerformance.map((p, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-800">{p.name}</td>
                    <td className="px-4 py-3 text-surface-500">{p.code}</td>
                    <td className="px-4 py-3 text-surface-500">{p.discountType === 'percent' ? 'เปอร์เซ็นต์' : 'จำนวนเงิน'} {p.discountValue}{p.discountType === 'percent' ? '%' : '฿'}</td>
                    <td className="px-4 py-3 text-right text-surface-700">{formatNumber(p.usageCount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-surface-700">{formatMoney(p.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.contentPipeline.length > 0 && (
          <SectionCard title="คอนเทนต์ Pipeline" subtitle="แผนคอนเทนต์ที่กำลังดำเนินการ" icon={<FileText className="h-5 w-5 text-primary-500" />}>
            <div className="space-y-2">
              {data.contentPipeline.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-surface-800">{c.title}</p>
                    <p className="text-xs text-surface-400">{c.platform} · {c.type} · {c.assignee}</p>
                  </div>
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                    c.status === 'published' ? 'bg-success-50 text-success-700' :
                    c.status === 'draft' ? 'bg-surface-100 text-surface-500' : 'bg-warning-50 text-warning-700'
                  }`}>{c.status}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {data.platformSettings.length > 0 && (
          <SectionCard title="ตั้งค่าแพลตฟอร์ม" subtitle="อัตรากำไรและค่าธรรมเนียม" icon={<Globe className="h-5 w-5 text-primary-500" />}>
            <div className="space-y-2">
              {data.platformSettings.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.connected ? 'bg-success-500' : 'bg-surface-300'}`} />
                    <span className="text-sm font-medium text-surface-800">{p.platform}</span>
                  </div>
                  <div className="text-right text-xs text-surface-500">
                    <span>กำไร {p.margin}% · ค่าธรรมเนียม {p.fee}%</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
