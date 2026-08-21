import { Users, Clock, Wallet, Timer, CalendarCheck, CalendarX } from 'lucide-react';
import type { WorkforceData } from './types';
import { KpiGrid, MultiLineChart, SimpleBarChart, SimplePieChart, SectionCard, EmptyState } from './ChartKit';
import { formatNumber } from './helpers';

export function WorkforceTab({ data }: { data: WorkforceData }) {
  const hasData = data.kpis.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <KpiGrid kpis={data.kpis} />
        <EmptyState message="ยังไม่มีข้อมูลพนักงาน" />
      </div>
    );
  }

  const branchData = data.employeesByBranch.map((e) => ({ label: e.branch, value: e.count }));
  const shiftPieData = data.shiftDistribution.map((s) => ({ name: s.shift, value: s.count, color: s.color }));
  const statusData = [
    { name: 'มาตรงเวลา', value: data.attendanceStatus.onTime, color: '#16a34a' },
    { name: 'มาสาย', value: data.attendanceStatus.late, color: '#f59e0b' },
    { name: 'ลา', value: data.attendanceStatus.leave, color: '#0ea5e9' },
    { name: 'ขาด', value: data.attendanceStatus.absent, color: '#ef4444' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid kpis={data.kpis} />

      <SectionCard title="แนวโน้มการเข้างาน" subtitle="จำนวนผู้มีกะ ผู้เข้างานจริง และชั่วโมงทำงาน (ตามตาราง vs จริง) รายวัน" icon={<CalendarCheck className="h-5 w-5 text-primary-500" />}>
        <MultiLineChart
          data={data.attendanceTrend}
          series={[
            { key: 'scheduled', name: 'จำนวนกะที่ตั้งไว้', color: '#94a3b8' },
            { key: 'present', name: 'จำนวนผู้เข้างาน', color: '#3D7BF5' },
            { key: 'scheduledHours', name: 'ชั่วโมงตามตารางกะ', color: '#0ea5e9' },
            { key: 'hours', name: 'ชั่วโมงทำงานจริง', color: '#16a34a' },
          ]}
          height={300}
          yFormatter={(v) => String(v)}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="พนักงานแยกสาขา" subtitle="จำนวนพนักงานในแต่ละสาขา" icon={<Users className="h-5 w-5 text-primary-500" />}>
          {branchData.length > 0 ? (
            <SimpleBarChart data={branchData} dataKey="value" name="จำนวนพนักงาน" color="#3D7BF5" height={280} yFormatter={(v) => String(v)} />
          ) : <EmptyState message="ยังไม่มีข้อมูล" />}
        </SectionCard>

        <SectionCard title="สัดส่วนการเข้างาน" subtitle="มาตรงเวลา / สาย / ลา / ขาด" icon={<Clock className="h-5 w-5 text-primary-500" />}>
          {statusData.length > 0 ? (
            <SimplePieChart data={statusData} height={280} />
          ) : <EmptyState message="ยังไม่มีข้อมูลการเข้างาน" />}
        </SectionCard>
      </div>

      {shiftPieData.length > 0 && (
        <SectionCard title="การกระจายกะการทำงาน" subtitle="จำนวนพนักงานในแต่ละกะ" icon={<Clock className="h-5 w-5 text-primary-500" />}>
          <SimplePieChart data={shiftPieData} height={280} />
        </SectionCard>
      )}

      <SectionCard title="รายชื่อพนักงาน" subtitle={`${data.employeeList.length} คน`} icon={<Users className="h-5 w-5 text-primary-500" />}>
        <div className="table-scroll">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-surface-50 text-xs text-surface-400">
              <tr>
                <th className="px-4 py-2">ชื่อ</th>
                <th className="px-4 py-2">สาขา</th>
                <th className="px-4 py-2">ประเภท</th>
                <th className="px-4 py-2">ตำแหน่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {data.employeeList.map((e) => (
                <tr key={e.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3 font-medium text-surface-800">{e.name}</td>
                  <td className="px-4 py-3 text-surface-500">{e.branch}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${e.type === 'daily' ? 'bg-primary-50 text-primary-700' : 'bg-success-50 text-success-700'}`}>
                      {e.type === 'daily' ? 'รายวัน' : 'รายเดือน'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-500">{e.position ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
