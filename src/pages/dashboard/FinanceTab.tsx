import { TrendingUp, Wallet, ShoppingCart, DollarSign, CreditCard, FileText, BarChart3 } from 'lucide-react';
import type { FinanceData } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, SectionCard, EmptyState } from './ChartKit';
import { formatMoney, formatNumber } from './helpers';

export function FinanceTab({ data }: { data: FinanceData }) {
  const hasData = data.kpis.length > 0 && data.kpis.some((k) => k.value > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลการเงินในช่วงที่เลือก" />
      </div>
    );
  }

  const channelPieData = data.revenueByChannel.map((c) => ({ name: c.channel, value: c.revenue, color: c.color }));
  const expensePieData = data.expenseBreakdown.map((e) => ({ name: e.category, value: e.amount, color: e.color }));
  const profitByCategoryData = data.profitByCategory.map((p) => ({ label: p.category.length > 12 ? p.category.slice(0, 10) + '…' : p.category, value: p.profit, color: p.color }));

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <SectionCard title="แนวโน้มรายได้" subtitle="รายได้รายวันในช่วงที่เลือก" icon={<TrendingUp className="h-5 w-5 text-primary-500" />}>
        <MultiLineChart
          data={data.revenueTrend}
          series={[{ key: 'sales', name: 'รายได้', color: '#3D7BF5' }]}
          height={300}
        />
      </SectionCard>

      {profitByCategoryData.length > 0 && (
        <SectionCard title="กำไรเปรียบเทียบตามหมวดสินค้า" subtitle="เปรียบเทียบกำไรขั้นต้นแยกตามหมวดหมู่" icon={<BarChart3 className="h-5 w-5 text-primary-500" />}>
          <SimpleBarChart
            data={profitByCategoryData}
            dataKey="value"
            name="กำไร"
            color="#16a34a"
            height={320}
            yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v <= -1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="รายได้แยกช่องทาง" subtitle="สัดส่วนรายได้ตามช่องทางขาย" icon={<CreditCard className="h-5 w-5 text-primary-500" />}>
          {channelPieData.length > 0 ? (
            <SimplePieChart data={channelPieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="โครงสร้างค่าใช้จ่าย" subtitle="แยกตามหมวดค่าใช้จ่าย" icon={<Wallet className="h-5 w-5 text-primary-500" />}>
          {expensePieData.length > 0 ? (
            <SimplePieChart data={expensePieData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูลค่าใช้จ่าย" />}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="เงินเดือน" subtitle="สรุปค่าใช้จ่ายพนักงาน" icon={<Wallet className="h-5 w-5 text-primary-500" />}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">เงินเดือนรวม</span>
              <span className="font-semibold text-surface-900">{formatMoney(data.salaryOverview.totalSalaries)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">พนักงาน</span>
              <span className="font-semibold text-surface-900">{formatNumber(data.salaryOverview.employeeCount)} คน</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">เบิกล่วงหน้า</span>
              <span className="font-semibold text-warning-600">{formatMoney(data.salaryOverview.advances)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">เงินกู้คงค้าง</span>
              <span className="font-semibold text-error-600">{formatMoney(data.salaryOverview.loans)}</span>
            </div>
            <div className="border-t border-surface-100 pt-3 flex justify-between">
              <span className="text-sm font-medium text-surface-700">เงินจ่ายสุทธิ</span>
              <span className="font-bold text-primary-600">{formatMoney(data.salaryOverview.netPay)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="การจัดซื้อ" subtitle="สรุปคำขอจัดซื้อ" icon={<ShoppingCart className="h-5 w-5 text-primary-500" />}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">คำขอทั้งหมด</span>
              <span className="font-semibold text-surface-900">{formatNumber(data.purchaseSummary.totalRequests)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">รออนุมัติ</span>
              <span className="font-semibold text-warning-600">{formatNumber(data.purchaseSummary.pendingCount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">อนุมัติแล้ว</span>
              <span className="font-semibold text-success-600">{formatNumber(data.purchaseSummary.approvedCount)}</span>
            </div>
            <div className="border-t border-surface-100 pt-3 flex justify-between">
              <span className="text-sm font-medium text-surface-700">มูลค่ารวม</span>
              <span className="font-bold text-surface-900">{formatMoney(data.purchaseSummary.totalAmount)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="การเรียกเก็บ" subtitle="สรุปยอดเรียกเก็บ" icon={<FileText className="h-5 w-5 text-primary-500" />}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">ยอดเรียกเก็บแล้ว</span>
              <span className="font-semibold text-surface-900">{formatMoney(data.billingSummary.billedTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">รอเรียกเก็บ</span>
              <span className="font-semibold text-warning-600">{formatNumber(data.billingSummary.pendingCount)} รายการ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-surface-500">ยอดรอเก็บ</span>
              <span className="font-semibold text-warning-600">{formatMoney(data.billingSummary.pendingTotal)}</span>
            </div>
            <div className="border-t border-surface-100 pt-3 flex justify-between">
              <span className="text-sm font-medium text-surface-700">ชำระแล้ว</span>
              <span className="font-bold text-success-600">{formatMoney(data.billingSummary.paidTotal)}</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
