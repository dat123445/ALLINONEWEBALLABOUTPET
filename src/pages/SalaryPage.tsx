import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle, Clock,
  Banknote, TrendingDown, ArrowUpRight, ArrowDownRight, QrCode, Eye,
  LayoutGrid, List, ChevronLeft, Calendar as CalendarIcon, Users,
  HandCoins, Landmark, FileText, Search, Calculator, RefreshCw, CheckCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, Spinner, EmptyState, Avatar, ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatNumber, formatDate, cn } from '@/lib/format';
import { isAdmin as checkAdmin, type Role } from '@/types/permissions';

// ===================== TYPES =====================
type SalarySettings = {
  profile_id: string;
  employment_type: 'daily' | 'monthly';
  monthly_salary: number;
  daily_wage: number;
  hourly_rate: number;
  ot_rate: number;
};

type AttendanceRecord = {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  work_hours: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  ot_hours: number | null;
  status: string;
  shift_id: string | null;
  shifts: { start_time: string; end_time: string; name: string } | null;
};

type SalaryAdvance = {
  id: string;
  profile_id: string;
  amount: number;
  request_date: string;
  reason: string | null;
  status: string;
  admin_created: boolean;
  deducted_from_period: string | null;
  is_deducted: boolean;
  profiles: { display_name: string | null; first_name: string | null; email: string } | null;
};

type EmployeeLoan = {
  id: string;
  profile_id: string;
  loan_amount: number;
  installments: number;
  monthly_payment: number;
  remaining_balance: number;
  reason: string | null;
  status: string;
  admin_created: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  profiles: { display_name: string | null; first_name: string | null; email: string } | null;
  loan_installments: { id: string; installment_number: number; amount: number; paid: boolean; paid_at: string | null; note: string | null }[];
};

type EmployeeWithSalary = {
  profile: Profile;
  settings: SalarySettings | null;
  attendance: AttendanceRecord[];
  advances: SalaryAdvance[];
  loans: EmployeeLoan[];
  computedSalary: ComputedSalary;
};

type ComputedSalary = {
  baseAmount: number;
  actualWorkedHours: number;
  standardShiftHours: number;
  hourlyRate: number;
  otHours: number;
  otPay: number;
  latePenalty: number;
  lateCount: number;
  earlyLeaveDays: number;
  advanceDeductions: number;
  advanceItems: { id: string; amount: number; reason: string | null; date: string }[];
  totalPay: number;
  lineItems: { label: string; amount: number; type: 'add' | 'sub'; detail?: string }[];
};

// ===================== CONSTANTS =====================
const LATE_PENALTY_PER_5_MIN = 10;
const LATE_THRESHOLD_MINUTES = 5;

// ===================== HELPERS =====================
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function computeLatePenalty(lateMinutes: number): number {
  if (lateMinutes < LATE_THRESHOLD_MINUTES) return 0;
  const full5MinBlocks = Math.floor(lateMinutes / 5);
  return full5MinBlocks * LATE_PENALTY_PER_5_MIN;
}

function mapShiftAssignmentToAttendance(sa: any): AttendanceRecord {
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  if (sa.shifts && sa.actual_check_in_time) {
    const shiftStart = timeStrToMinutes(sa.shifts.start_time);
    const actualStart = new Date(sa.actual_check_in_time);
    const actualStartMin = actualStart.getHours() * 60 + actualStart.getMinutes();
    if (actualStartMin > shiftStart) lateMinutes = actualStartMin - shiftStart;
    if (sa.actual_check_out_time) {
      const shiftEnd = timeStrToMinutes(sa.shifts.end_time);
      const actualEnd = new Date(sa.actual_check_out_time);
      const actualEndMin = actualEnd.getHours() * 60 + actualEnd.getMinutes();
      if (actualEndMin < shiftEnd) earlyLeaveMinutes = shiftEnd - actualEndMin;
    }
  }
  // Compute work_hours from check-in/out if not stored
  let workHours = sa.actual_work_hours;
  if (workHours == null && sa.actual_check_in_time && sa.actual_check_out_time) {
    const inTime = new Date(sa.actual_check_in_time).getTime();
    const outTime = new Date(sa.actual_check_out_time).getTime();
    workHours = Math.max(0, Math.round(((outTime - inTime) / (1000 * 60 * 60)) * 10) / 10);
  }
  return {
    id: sa.id,
    check_in_time: sa.actual_check_in_time,
    check_out_time: sa.actual_check_out_time,
    work_hours: workHours,
    late_minutes: lateMinutes,
    early_leave_minutes: earlyLeaveMinutes,
    ot_hours: 0,
    status: 'present',
    shift_id: sa.shift_id,
    shifts: sa.shifts ? { start_time: sa.shifts.start_time, end_time: sa.shifts.end_time, name: sa.shifts.name } : null,
  };
}

function computeSalary(
  settings: SalarySettings | null,
  attendance: AttendanceRecord[],
  advances: SalaryAdvance[],
  periodKey: string
): ComputedSalary {
  const lineItems: ComputedSalary['lineItems'] = [];
  let baseAmount = 0;
  let actualWorkedHours = 0;
  let standardShiftHours = 0;
  let hourlyRate = 0;
  let otHours = 0;
  let otPay = 0;
  let latePenalty = 0;
  let lateCount = 0;
  let earlyLeaveDays = 0;

  if (settings) {
    if (settings.employment_type === 'monthly') {
      baseAmount = Number(settings.monthly_salary || 0);
      lineItems.push({ label: 'เงินเดือนประจำ', amount: baseAmount, type: 'add' });
    } else {
      // Daily wage: compute per-day based on actual hours vs shift hours
      const dailyWage = Number(settings.daily_wage || 0);
      for (const rec of attendance) {
        if (!rec.check_in_time) continue;
        const workedHours = Number(rec.work_hours || 0);
        actualWorkedHours += workedHours;

        // Get shift hours from linked shift, or default to 9
        let shiftHours = 9;
        if (rec.shifts) {
          const startMin = timeStrToMinutes(rec.shifts.start_time);
          const endMin = timeStrToMinutes(rec.shifts.end_time);
          shiftHours = (endMin - startMin) / 60;
          if (shiftHours <= 0) shiftHours = 9;
        }
        standardShiftHours += shiftHours;

        const hrRate = dailyWage / shiftHours;
        hourlyRate = hrRate; // last one wins for display

        const earlyLeave = Number(rec.early_leave_minutes || 0);
        // Pay proportionally if worked hours are less than shift hours
        // (covers both early-leave records and edited check-in/out times)
        if (workedHours < shiftHours - 0.01) {
          earlyLeaveDays++;
          const dayPay = hrRate * workedHours;
          baseAmount += dayPay;
          lineItems.push({
            label: `ค่าจ้างวันที่ ${formatDate(rec.check_in_time)}`,
            amount: dayPay,
            type: 'add',
            detail: `ทำงาน ${workedHours.toFixed(1)} ชม. (ขาด ${(shiftHours - workedHours).toFixed(1)} ชม.)`,
          });
        } else {
          // Full day pay
          baseAmount += dailyWage;
          lineItems.push({
            label: `ค่าจ้างวันที่ ${formatDate(rec.check_in_time)}`,
            amount: dailyWage,
            type: 'add',
            detail: `ทำงานครบ ${shiftHours} ชม.`,
          });
        }

        // Late penalty
        const late = Number(rec.late_minutes || 0);
        if (late >= LATE_THRESHOLD_MINUTES) {
          lateCount++;
          const penalty = computeLatePenalty(late);
          latePenalty += penalty;
        }
      }
    }

    // Sum OT hours from attendance records
    for (const rec of attendance) {
      otHours += Number(rec.ot_hours || 0);
    }

    // OT pay (both types)
    const otRate = Number(settings.ot_rate || 0);
    if (otRate > 0 && otHours > 0) {
      otPay = otHours * otRate;
      lineItems.push({ label: `OT ${otHours} ชม.`, amount: otPay, type: 'add', detail: `อัตรา ${formatCurrency(otRate)}/ชม.` });
    }
  }

  // Late penalty total
  if (latePenalty > 0) {
    lineItems.push({
      label: `ค่าปรับมาสาย ${lateCount} ครั้ง`,
      amount: latePenalty,
      type: 'sub',
      detail: `10 บาท ทุก 5 นาที`,
    });
  }

  // Advance deductions
  const periodAdvances = advances.filter(
    (a) => a.status === 'approved' && !a.is_deducted
  );
  let advanceDeductions = 0;
  const advanceItems: ComputedSalary['advanceItems'] = [];
  for (const adv of periodAdvances) {
    advanceDeductions += Number(adv.amount || 0);
    advanceItems.push({
      id: adv.id,
      amount: Number(adv.amount),
      reason: adv.reason,
      date: adv.request_date,
    });
    lineItems.push({
      label: `เบิกล่วงหน้า ${formatDate(adv.request_date)}`,
      amount: Number(adv.amount),
      type: 'sub',
      detail: adv.reason ?? undefined,
    });
  }

  const totalPay = Math.max(0, baseAmount + otPay - latePenalty - advanceDeductions);

  return {
    baseAmount,
    actualWorkedHours,
    standardShiftHours,
    hourlyRate,
    otHours,
    otPay,
    latePenalty,
    lateCount,
    earlyLeaveDays,
    advanceDeductions,
    advanceItems,
    totalPay,
    lineItems,
  };
}

// ===================== MAIN COMPONENT =====================
export function SalaryPage() {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const isAdmin = checkAdmin(roles);
  const isSuperAdmin = roles.includes('super_admin');

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithSalary[]>([]);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithSalary | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showQrZoom, setShowQrZoom] = useState<string | null>(null);
  const [calculating, setCalcul] = useState(false);
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcTotal, setCalcTotal] = useState(0);
  const [salaryRecords, setSalaryRecords] = useState<Record<string, { computed_at: string; total_pay: number }>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [year, month] = periodMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const startStr = toLocalDateStr(monthStart);
    const endStr = toLocalDateStr(monthEnd);
    const startISO = monthStart.toISOString();
    const endISO = monthEnd.toISOString();

    // Get employees (exclude super_admin from salary calculations)
    const profilesQuery = supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    // If not admin, only load own profile
    if (!isAdmin) {
      profilesQuery.eq('id', profile.id);
    }

    const [profilesRes, settingsRes, attendanceRes, advancesRes, loansRes, recordsRes, shiftAssignmentsRes] = await Promise.all([
      profilesQuery,
      supabase.from('salary_settings').select('*'),
      supabase
        .from('attendance')
        .select('*, shifts(name, start_time, end_time)')
        .gte('check_in_time', startISO)
        .lt('check_in_time', endISO),
      supabase
        .from('salary_advances')
        .select('*, profiles(display_name, first_name, email)')
        .gte('request_date', startStr)
        .lte('request_date', endStr)
        .order('created_at', { ascending: false }),
      supabase
        .from('employee_loans')
        .select('*, profiles(display_name, first_name, email), loan_installments(*)')
        .order('created_at', { ascending: false }),
      supabase.from('salary_records').select('profile_id, computed_at, total_pay').eq('period_month', periodMonth),
      supabase
        .from('shift_assignments')
        .select('*, shifts(name, start_time, end_time)')
        .not('actual_check_in_time', 'is', null)
        .gte('assignment_date', startStr)
        .lte('assignment_date', endStr),
    ]);

    const profilesList = (profilesRes.data ?? []) as Profile[];
    const settingsList = (settingsRes.data ?? []) as SalarySettings[];
    const attendanceList = (attendanceRes.data ?? []) as AttendanceRecord[];
    const advancesList = (advancesRes.data ?? []) as SalaryAdvance[];
    const loansList = (loansRes.data ?? []) as EmployeeLoan[];
    const shiftAssignmentsList = (shiftAssignmentsRes.data ?? []) as any[];

    const recordsMap: Record<string, { computed_at: string; total_pay: number }> = {};
    for (const r of (recordsRes.data ?? []) as any[]) {
      recordsMap[r.profile_id] = { computed_at: r.computed_at, total_pay: Number(r.total_pay) };
    }
    setSalaryRecords(recordsMap);

    // Filter out pure super_admin (but keep owner) from salary computation
    const nonSuperAdminProfiles = isAdmin
      ? profilesList.filter((p) => {
          const r = (p.roles ?? []) as Role[];
          return !(r.includes('super_admin') && !r.includes('owner'));
        })
      : profilesList;

    const empData: EmployeeWithSalary[] = nonSuperAdminProfiles.map((p) => {
      const settings = settingsList.find((s) => s.profile_id === p.id) ?? null;
      const attRecords = attendanceList.filter((a) => (a as any).profile_id === p.id);
      const shiftAssignmentsForEmp = shiftAssignmentsList.filter((sa) => sa.profile_id === p.id);
      const recordsByDate = new Map<string, AttendanceRecord>();
      for (const a of attRecords) {
        if (a.check_in_time) recordsByDate.set(a.check_in_time.slice(0, 10), a);
      }
      for (const sa of shiftAssignmentsForEmp) {
        if (sa.actual_check_in_time) recordsByDate.set(sa.assignment_date, mapShiftAssignmentToAttendance(sa));
      }
      const attendance = [...recordsByDate.values()];
      const advances = advancesList.filter((a) => a.profile_id === p.id);
      const loans = loansList.filter((l) => l.profile_id === p.id);
      const computedSalary = computeSalary(settings, attendance, advances, periodMonth);
      return { profile: p, settings, attendance, advances, loans, computedSalary };
    });

    setEmployees(empData);
    setLoading(false);
  }, [profile, isAdmin, periodMonth]);

  useEffect(() => { load(); }, [load]);

  async function persistSalaryRecord(emp: EmployeeWithSalary) {
    await supabase.from('salary_records').upsert({
      profile_id: emp.profile.id,
      period_month: periodMonth,
      computed_payload: emp.computedSalary as any,
      total_pay: emp.computedSalary.totalPay,
      computed_at: new Date().toISOString(),
      computed_by: profile?.id ?? null,
    }, { onConflict: 'profile_id,period_month' });
  }

  async function calculateAll() {
    if (employees.length === 0) return;
    const missingSettings = employees.filter((e) => !e.settings);
    if (missingSettings.length === employees.length) {
      setToast({ type: 'warning', msg: 'ยังไม่ได้ตั้งค่าเงินเดือนให้พนักงาน — ไปที่หน้าผู้ใช้เพื่อตั้งค่าก่อน' });
      return;
    }
    setCalculating(true);
    setCalcTotal(employees.length);
    setCalcProgress(0);
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      await persistSalaryRecord(emp);
      setCalcProgress(i + 1);
    }
    setCalculating(false);
    await load();
    setToast({ type: 'success', msg: `คำนวณเงินเดือน ${employees.length} คนเรียบร้อยแล้ว${missingSettings.length > 0 ? ` (${missingSettings.length} คนยังไม่ได้ตั้งค่า — ได้ ฿0)` : ''}` });
  }

  async function calculateOne(emp: EmployeeWithSalary) {
    if (!emp.settings) {
      setToast({ type: 'warning', msg: `ยังไม่ได้ตั้งค่าเงินเดือนให้ ${emp.profile.display_name ?? emp.profile.email} — ไปที่หน้าผู้ใช้เพื่อตั้งค่าก่อน` });
      return;
    }
    setCalculating(true);
    setCalcTotal(1);
    setCalcProgress(0);
    await persistSalaryRecord(emp);
    setCalcProgress(1);
    setCalculating(false);
    await load();
    setToast({ type: 'success', msg: `คำนวณเงินเดือน ${emp.profile.display_name ?? emp.profile.email} เรียบร้อย — ยอดที่ต้องจ่าย ${formatCurrency(emp.computedSalary.totalPay)}` });
  }

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        (e.profile.display_name ?? '').toLowerCase().includes(q) ||
        e.profile.email.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const totalPayroll = useMemo(
    () => employees.reduce((s, e) => s + e.computedSalary.totalPay, 0),
    [employees]
  );

  const tabs = [
    { key: 'overview', label: 'ภาพรวมเงินเดือน' },
    { key: 'advances', label: 'เบิกล่วงหน้า' },
    { key: 'loans', label: 'เงินกู้' },
  ];

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {toast && (
        <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-slide-up', toast.type === 'success' ? 'bg-success-100 text-success-700' : toast.type === 'warning' ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {tab === 'overview' && (
        <>
          {/* Period selector + view toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-surface-400" />
              <input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="input-base !w-auto cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={calculateAll}
                  loading={calculating}
                  disabled={employees.length === 0}
                >
                  {calculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  คำนวณเงินเดือนทุกคน
                </Button>
              )}
              {isAdmin && (
                <div className="flex gap-1 p-1 bg-surface-100 rounded-lg">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={cn('p-1.5 rounded-md transition-all', viewMode === 'cards' ? 'bg-white shadow-sm text-primary-600' : 'text-surface-400')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn('p-1.5 rounded-md transition-all', viewMode === 'table' ? 'bg-white shadow-sm text-primary-600' : 'text-surface-400')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {calculating && (
            <Card className="p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-700">กำลังคำนวณเงินเดือน... ({calcProgress}/{calcTotal})</p>
                  <div className="h-2 rounded-full bg-surface-100 overflow-hidden mt-1.5">
                    <div className="h-full rounded-full bg-primary-500 transition-all duration-300" style={{ width: `${calcTotal > 0 ? (calcProgress / calcTotal) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Summary card */}
          <Card className="p-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-400">ยอดเงินเดือนรวม (เดือน {periodMonth})</p>
                <p className="text-3xl font-bold text-surface-900 mt-1">{formatCurrency(totalPayroll)}</p>
                <p className="text-xs text-surface-400 mt-1">{employees.length} พนักงาน</p>
              </div>
              <div className="p-4 rounded-2xl bg-primary-100">
                <Wallet className="w-8 h-8 text-primary-600" />
              </div>
            </div>
          </Card>

          {/* Search */}
          {isAdmin && (
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                className="input-base pl-11"
                placeholder="ค้นหาพนักงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Employee list */}
          {filteredEmployees.length === 0 ? (
            <EmptyState icon={<Wallet className="w-8 h-8" />} title="ไม่มีข้อมูล" description="ไม่พบพนักงานในเดือนนี้" />
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp, i) => (
                <Card
                  key={emp.profile.id}
                  className="p-5 animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all"
                  onClick={() => { setSelectedEmployee(emp); setShowDetail(true); }}
                >
                  <div style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={emp.profile.display_name ?? emp.profile.email} src={emp.profile.avatar_url} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-surface-900 truncate">
                          {emp.profile.display_name ?? emp.profile.first_name ?? 'ไม่ระบุ'}
                        </p>
                        <p className="text-xs text-surface-400 truncate">{emp.profile.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant={emp.settings?.employment_type === 'monthly' ? 'info' : 'default'}>
                            {emp.settings?.employment_type === 'monthly' ? 'ประจำ' : 'รายวัน'}
                          </Badge>
                          {salaryRecords[emp.profile.id] && (
                            <Badge variant="success"><CheckCircle className="w-3 h-3" /> คำนวณแล้ว</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-surface-100">
                      <span className="text-xs text-surface-400">ยอดที่ต้องจ่าย</span>
                      <span className="text-xl font-bold text-primary-600">
                        {formatCurrency(emp.computedSalary.totalPay)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant={salaryRecords[emp.profile.id] ? 'secondary' : 'primary'}
                          onClick={() => calculateOne(emp)}
                          disabled={calculating}
                          className="flex-1"
                        >
                          {salaryRecords[emp.profile.id]
                            ? <><RefreshCw className="w-3.5 h-3.5" /> คำนวณใหม่</>
                            : <><Calculator className="w-3.5 h-3.5" /> คำนวณ</>}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-surface-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">พนักงาน</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">ประเภท</th>
                      <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">ชม.ทำงาน</th>
                      <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">มาสาย</th>
                      <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">เบิกล่วงหน้า</th>
                      <th className="text-right px-4 py-3 font-medium">ยอดจ่าย</th>
                      <th className="text-center px-4 py-3 font-medium">รายละเอียด</th>
                      {isAdmin && <th className="text-center px-4 py-3 font-medium">คำนวณ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp.profile.id}
                        className="hover:bg-surface-50 cursor-pointer transition-colors"
                        onClick={() => { setSelectedEmployee(emp); setShowDetail(true); }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={emp.profile.display_name ?? emp.profile.email} src={emp.profile.avatar_url} size="sm" />
                            <div>
                              <p className="font-medium text-surface-900">{emp.profile.display_name ?? 'ไม่ระบุ'}</p>
                              <p className="text-xs text-surface-400">{emp.profile.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant={emp.settings?.employment_type === 'monthly' ? 'info' : 'default'}>
                            {emp.settings?.employment_type === 'monthly' ? 'ประจำ' : 'รายวัน'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-surface-500">
                          {emp.computedSalary.actualWorkedHours.toFixed(1)} ชม.
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {emp.computedSalary.lateCount > 0 ? (
                            <span className="text-error-600 font-medium">{emp.computedSalary.lateCount} ครั้ง</span>
                          ) : (
                            <span className="text-surface-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-surface-500">
                          {emp.computedSalary.advanceDeductions > 0 ? formatCurrency(emp.computedSalary.advanceDeductions) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary-600">
                          {formatCurrency(emp.computedSalary.totalPay)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setShowDetail(true); }}
                            className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-surface-400" />
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant={salaryRecords[emp.profile.id] ? 'secondary' : 'primary'}
                              onClick={() => calculateOne(emp)}
                              disabled={calculating}
                            >
                              {salaryRecords[emp.profile.id]
                                ? <><RefreshCw className="w-3.5 h-3.5" /> คำนวณใหม่</>
                                : <><Calculator className="w-3.5 h-3.5" /> คำนวณ</>}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'advances' && (
        <AdvanceTab periodMonth={periodMonth} isAdmin={isAdmin} profile={profile} onReload={load} />
      )}

      {tab === 'loans' && (
        <LoanTab isAdmin={isAdmin} profile={profile} onReload={load} />
      )}

      {/* Detail modal */}
      {showDetail && selectedEmployee && (
        <SalaryDetailModal
          employee={selectedEmployee}
          periodMonth={periodMonth}
          onClose={() => setShowDetail(false)}
          onQrZoom={(url) => setShowQrZoom(url)}
        />
      )}

      {/* QR zoom */}
      {showQrZoom && (
        <Modal open onClose={() => setShowQrZoom(null)} title="QR Code พร้อมเพย์" size="sm">
          <div className="flex flex-col items-center gap-4">
            <img src={showQrZoom} alt="QR PromptPay" className="w-full max-w-sm rounded-xl" />
            <p className="text-sm text-surface-400">คลิกที่ภาพเพื่อบันทึก หรือสแกนเพื่อโอนเงิน</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== SALARY DETAIL MODAL =====================
function SalaryDetailModal({ employee, periodMonth, onClose, onQrZoom }: {
  employee: EmployeeWithSalary;
  periodMonth: string;
  onClose: () => void;
  onQrZoom: (url: string) => void;
}) {
  const { profile, settings, computedSalary } = employee;
  const [year, month] = periodMonth.split('-').map(Number);
  const monthName = new Date(year, month - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <Modal open onClose={onClose} title={`เงินเดือน ${profile.display_name ?? profile.email} - ${monthName}`} size="lg">
      <div className="space-y-5">
        {/* Employee info */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-50">
          <Avatar name={profile.display_name ?? profile.email} src={profile.avatar_url} size="lg" />
          <div className="flex-1">
            <p className="font-semibold text-surface-900">{profile.display_name ?? 'ไม่ระบุ'}</p>
            <p className="text-sm text-surface-400">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={settings?.employment_type === 'monthly' ? 'info' : 'default'}>
                {settings?.employment_type === 'monthly' ? 'พนักงานประจำ' : 'พนักงานรายวัน'}
              </Badge>
              {settings?.employment_type === 'monthly' && (
                <span className="text-xs text-surface-400">เงินเดือน {formatCurrency(settings?.monthly_salary ?? 0)}</span>
              )}
              {settings?.employment_type === 'daily' && (
                <span className="text-xs text-surface-400">ค่าจ้าง {formatCurrency(settings?.daily_wage ?? 0)}/วัน</span>
              )}
              {settings && Number(settings.ot_rate) > 0 && (
                <span className="text-xs text-surface-400">OT {formatCurrency(settings.ot_rate)}/ชม.</span>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div>
          <h4 className="text-sm font-semibold text-surface-700 mb-3">รายละเอียดการคำนวณ</h4>
          <div className="space-y-2">
            {computedSalary.lineItems.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">ไม่มีข้อมูลการทำงานในเดือนนี้</p>
            ) : (
              computedSalary.lineItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-3 rounded-lg bg-surface-50 animate-slide-up"
                  style={{ animationDelay: `${i * 20}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn('p-1 rounded-lg mt-0.5', item.type === 'add' ? 'bg-success-100' : 'bg-error-100')}>
                      {item.type === 'add' ? <ArrowUpRight className="w-3 h-3 text-success-600" /> : <ArrowDownRight className="w-3 h-3 text-error-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-700">{item.label}</p>
                      {item.detail && <p className="text-xs text-surface-400">{item.detail}</p>}
                    </div>
                  </div>
                  <span className={cn('text-sm font-semibold', item.type === 'add' ? 'text-success-600' : 'text-error-600')}>
                    {item.type === 'add' ? '+' : '-'}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary */}
        {computedSalary.lineItems.length > 0 && (
          <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary-700">ยอดสุทธิที่ต้องจ่าย</span>
              <span className="text-2xl font-bold text-primary-600">{formatCurrency(computedSalary.totalPay)}</span>
            </div>
          </div>
        )}

        {/* Bank info + QR */}
        <div className="pt-2 border-t border-surface-200">
          <h4 className="text-sm font-semibold text-surface-700 mb-3">ข้อมูลการโอนเงิน</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Landmark className="w-4 h-4 text-surface-400" />
                <span className="text-surface-400">ธนาคาร:</span>
                <span className="font-medium text-surface-700">{profile.bank_name ?? '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Banknote className="w-4 h-4 text-surface-400" />
                <span className="text-surface-400">เลขบัญชี:</span>
                <span className="font-medium text-surface-700">{profile.bank_account ?? '-'}</span>
              </div>
              {profile.bank_account_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-surface-400" />
                  <span className="text-surface-400">ชื่อบัญชี:</span>
                  <span className="font-medium text-surface-700">{profile.bank_account_name}</span>
                </div>
              )}
            </div>
            <div>
              {profile.qr_code_url ? (
                <button
                  onClick={() => onQrZoom(profile.qr_code_url!)}
                  className="block w-full max-w-[160px] mx-auto group"
                >
                  <div className="relative rounded-xl overflow-hidden border border-surface-200 transition-all group-hover:ring-2 group-hover:ring-primary-400">
                    <img src={profile.qr_code_url} alt="QR PromptPay" className="w-full" />
                    <div className="absolute inset-0 bg-primary-600/0 group-hover:bg-primary-600/10 transition-colors flex items-center justify-center">
                      <QrCode className="w-6 h-6 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p className="text-xs text-surface-400 text-center mt-1">คลิกเพื่อขยาย</p>
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 rounded-xl bg-surface-50 text-center">
                  <QrCode className="w-8 h-8 text-surface-300 mb-1" />
                  <p className="text-xs text-surface-400">ยังไม่ได้ตั้งค่า QR Code</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ===================== ADVANCE TAB =====================
function AdvanceTab({ periodMonth, isAdmin, profile, onReload }: {
  periodMonth: string;
  isAdmin: boolean;
  profile: Profile | null;
  onReload: () => void;
}) {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; display_name: string; email: string; employment_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryAdvance | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [year, month] = periodMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const startStr = toLocalDateStr(monthStart);
    const endStr = toLocalDateStr(monthEnd);

    let advanceQuery = supabase
      .from('salary_advances')
      .select('*, profiles(display_name, first_name, email)')
      .gte('request_date', startStr)
      .lte('request_date', endStr)
      .order('created_at', { ascending: false });

    if (!isAdmin && profile) {
      advanceQuery = advanceQuery.eq('profile_id', profile.id);
    }

    const [advRes, empRes] = await Promise.all([
      advanceQuery,
      isAdmin
        ? supabase.from('profiles').select('id, display_name, email, employment_type').eq('is_active', true).order('display_name')
        : Promise.resolve({ data: null, error: null }),
    ]);

    setAdvances((advRes.data ?? []) as SalaryAdvance[]);
    if (empRes.data) {
      // Filter out super_admin
      const filtered = (empRes.data as any[]).filter((e) => !((e.roles ?? []).includes('super_admin')));
      setEmployees(filtered.map((e) => ({ id: e.id, display_name: e.display_name ?? e.first_name ?? e.email, email: e.email, employment_type: e.employment_type ?? 'daily' })));
    }
    setLoading(false);
  }, [periodMonth, isAdmin, profile]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    await supabase.from('salary_advances').update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id);
    load();
    onReload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('salary_advances').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
    onReload();
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-surface-900">เบิกเงินล่วงหน้า</h3>
          <p className="text-sm text-surface-400">ยอดเบิกจะถูกหักออกจากเงินเดือนอัตโนมัติ</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> เบิกเงินล่วงหน้า
        </Button>
      </div>

      {advances.length === 0 ? (
        <EmptyState icon={<HandCoins className="w-8 h-8" />} title="ไม่มีรายการเบิก" description="คำขอเบิกเงินล่วงหน้าจะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {advances.map((adv, i) => (
            <Card key={adv.id} className="p-4 flex items-center justify-between animate-slide-up" >
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-3 flex-1">
                <div className="p-2.5 rounded-xl bg-warning-100">
                  <HandCoins className="w-5 h-5 text-warning-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900">{formatCurrency(adv.amount)}</p>
                  <p className="text-xs text-surface-400">
                    {formatDate(adv.request_date)}
                    {isAdmin && adv.profiles && ` · ${adv.profiles.display_name ?? adv.profiles.first_name ?? adv.profiles.email}`}
                    {adv.admin_created && ' (แอดมินกรอกแทน)'}
                  </p>
                  {adv.reason && <p className="text-xs text-surface-400 mt-0.5">{adv.reason}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={adv.status === 'approved' ? 'success' : adv.status === 'rejected' ? 'error' : 'warning'}>
                  {adv.status === 'pending' ? 'รออนุมัติ' : adv.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
                </Badge>
                {isAdmin && adv.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(adv.id, 'approved')} className="p-1.5 rounded-lg hover:bg-success-50 text-success-600 transition-colors" title="อนุมัติ">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => updateStatus(adv.id, 'rejected')} className="p-1.5 rounded-lg hover:bg-error-50 text-error-600 transition-colors" title="ปฏิเสธ">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => setDeleteTarget(adv)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors" title="ลบ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AdvanceFormModal
          isAdmin={isAdmin}
          employees={employees}
          profileId={profile?.id}
          employmentType={profile?.employment_type ?? 'daily'}
          dailyWage={0}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); onReload(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันลบรายการเบิก"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">{formatCurrency(deleteTarget?.amount ?? 0)}</p>
        <p>การลบนี้เป็นการลบถาวร ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </div>
  );
}

type DayInfo = {
  checkIn: string;
  checkOut: string;
  fullDayWage: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  lateDeduction: number;
  earlyLeaveDeduction: number;
  netPay: number;
};

// ===================== ADVANCE FORM MODAL =====================
function AdvanceFormModal({ isAdmin, employees, profileId, employmentType, dailyWage, onClose, onSaved }: {
  isAdmin: boolean;
  employees: { id: string; display_name: string; email: string; employment_type: string }[];
  profileId?: string;
  employmentType: string;
  dailyWage: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedEmp, setSelectedEmp] = useState(isAdmin ? '' : profileId ?? '');
  const [amount, setAmount] = useState('');
  const [requestDate, setRequestDate] = useState(toLocalDateStr(new Date()));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // For daily employees: multi-date selection
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [empSettings, setEmpSettings] = useState<{ daily_wage: number; employment_type: string } | null>(null);
  const [rawAttendance, setRawAttendance] = useState<any[]>([]);
  const [rawShiftAssignments, setRawShiftAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin && selectedEmp) {
      supabase
        .from('salary_settings')
        .select('daily_wage, employment_type')
        .eq('profile_id', selectedEmp)
        .maybeSingle()
        .then(({ data }) => setEmpSettings(data as any));
    } else if (!isAdmin) {
      setEmpSettings({ daily_wage: dailyWage, employment_type: employmentType });
    }
  }, [isAdmin, selectedEmp, dailyWage, employmentType]);

  useEffect(() => {
    const targetId = isAdmin ? selectedEmp : profileId;
    if (!targetId) { setRawAttendance([]); setRawShiftAssignments([]); return; }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 23);
    const startStr = toLocalDateStr(startDate);
    const endStr = toLocalDateStr(endDate);
    Promise.all([
      supabase.from('attendance')
        .select('*, shifts(name, start_time, end_time)')
        .eq('profile_id', targetId)
        .gte('check_in_time', `${startStr}T00:00:00`)
        .lte('check_in_time', `${endStr}T23:59:59`),
      supabase.from('shift_assignments')
        .select('*, shifts(name, start_time, end_time)')
        .eq('profile_id', targetId)
        .not('actual_check_in_time', 'is', null)
        .gte('assignment_date', startStr)
        .lte('assignment_date', endStr),
    ]).then(([attRes, saRes]) => {
      setRawAttendance(attRes.data ?? []);
      setRawShiftAssignments(saRes.data ?? []);
    });
  }, [isAdmin, selectedEmp, profileId]);

  const currentEmpType = isAdmin
    ? (employees.find((e) => e.id === selectedEmp)?.employment_type ?? 'daily')
    : employmentType;
  const currentDailyWage = isAdmin
    ? Number(empSettings?.daily_wage ?? 0)
    : dailyWage;

  const dayDataMap = useMemo(() => {
    const map: Record<string, DayInfo> = {};
    const fmtTime = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    for (const a of rawAttendance) {
      if (!a.check_in_time) continue;
      const dateKey = a.check_in_time.slice(0, 10);
      let lateMin = 0;
      let earlyMin = 0;
      if (a.shifts) {
        const shiftStart = timeStrToMinutes(a.shifts.start_time);
        const shiftEnd = timeStrToMinutes(a.shifts.end_time);
        const actualStart = new Date(a.check_in_time);
        const actualStartMin = actualStart.getHours() * 60 + actualStart.getMinutes();
        if (actualStartMin > shiftStart) lateMin = actualStartMin - shiftStart;
        if (a.check_out_time) {
          const actualEnd = new Date(a.check_out_time);
          const actualEndMin = actualEnd.getHours() * 60 + actualEnd.getMinutes();
          if (actualEndMin < shiftEnd) earlyMin = shiftEnd - actualEndMin;
        }
      }
      const lateDed = computeLatePenalty(lateMin);
      const earlyDed = computeLatePenalty(earlyMin);
      map[dateKey] = {
        checkIn: fmtTime(a.check_in_time),
        checkOut: a.check_out_time ? fmtTime(a.check_out_time) : '-',
        fullDayWage: currentDailyWage,
        lateMinutes: lateMin,
        earlyLeaveMinutes: earlyMin,
        lateDeduction: lateDed,
        earlyLeaveDeduction: earlyDed,
        netPay: currentDailyWage - lateDed - earlyDed,
      };
    }
    for (const sa of rawShiftAssignments) {
      if (!sa.actual_check_in_time) continue;
      const dateKey = sa.assignment_date;
      const rec = mapShiftAssignmentToAttendance(sa);
      const lateDed = computeLatePenalty(rec.late_minutes);
      const earlyDed = computeLatePenalty(rec.early_leave_minutes);
      map[dateKey] = {
        checkIn: fmtTime(sa.actual_check_in_time),
        checkOut: sa.actual_check_out_time ? fmtTime(sa.actual_check_out_time) : '-',
        fullDayWage: currentDailyWage,
        lateMinutes: rec.late_minutes,
        earlyLeaveMinutes: rec.early_leave_minutes,
        lateDeduction: lateDed,
        earlyLeaveDeduction: earlyDed,
        netPay: currentDailyWage - lateDed - earlyDed,
      };
    }
    return map;
  }, [rawAttendance, rawShiftAssignments, currentDailyWage]);

  function toggleDate(date: string) {
    setSelectedDates((prev) => prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]);
  }

  async function submit() {
    setLoading(true);
    setError('');
    const targetId = isAdmin ? selectedEmp : profileId;
    if (!targetId) { setError('กรุณาเลือกพนักงาน'); setLoading(false); return; }

    try {
      if (currentEmpType === 'daily') {
        // Create one advance per selected date
        const dates = selectedDates.length > 0 ? selectedDates : [requestDate];
        for (const d of dates) {
          const advAmount = currentDailyWage;
          const { error: insErr } = await supabase.from('salary_advances').insert({
            profile_id: targetId,
            amount: advAmount,
            request_date: d,
            reason: reason || null,
            status: isAdmin ? 'approved' : 'pending',
            admin_created: isAdmin,
            approved_by: isAdmin ? (profileId ?? null) : null,
            approved_at: isAdmin ? new Date().toISOString() : null,
          });
          if (insErr) throw insErr;
        }
      } else {
        // Monthly: use entered amount
        const amt = Number(amount);
        if (!amt || amt <= 0) { setError('กรุณากรอกจำนวนเงิน'); setLoading(false); return; }
        const { error: insErr } = await supabase.from('salary_advances').insert({
          profile_id: targetId,
          amount: amt,
          request_date: requestDate,
          reason: reason || null,
          status: isAdmin ? 'approved' : 'pending',
          admin_created: isAdmin,
          approved_by: isAdmin ? (profileId ?? null) : null,
          approved_at: isAdmin ? new Date().toISOString() : null,
        });
        if (insErr) throw insErr;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    }
    setLoading(false);
  }

  return (
    <Modal open onClose={onClose} title="เบิกเงินล่วงหน้า" size="md">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-error-50 text-error-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {isAdmin && (
          <Select label="เลือกพนักงาน" value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
            <option value="">— เลือกพนักงาน —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
          </Select>
        )}

        {currentEmpType === 'daily' ? (
          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">
              เลือกวันที่ต้องการเบิก (ค่าจ้าง {formatCurrency(currentDailyWage)}/วัน)
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 31 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i - 7);
                const dateStr = toLocalDateStr(d);
                const selected = selectedDates.includes(dateStr);
                const info = dayDataMap[dateStr];
                const hasAtt = !!info;
                return (
                  <div key={i} className="relative group">
                    <button
                      onClick={() => toggleDate(dateStr)}
                      className={cn(
                        'w-full aspect-square rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5',
                        selected ? 'bg-primary-600 text-white' : hasAtt ? 'bg-success-50 text-surface-700 ring-1 ring-success-200 hover:bg-success-100' : 'bg-surface-50 text-surface-500 hover:bg-surface-100'
                      )}
                    >
                      <span>{d.getDate()}</span>
                      {hasAtt && (
                        <span className={cn('text-[8px] leading-none font-normal', selected ? 'text-white/70' : 'text-success-600')}>
                          {info.checkIn}
                        </span>
                      )}
                    </button>
                    {hasAtt && (
                      <div
                        className={cn(
                          'absolute bottom-full mb-2 hidden group-hover:block z-50 w-max min-w-[13rem] max-w-[calc(100vw-2rem)] p-3 rounded-xl bg-surface-900 text-white text-xs shadow-2xl pointer-events-none whitespace-nowrap',
                          i % 7 === 0 ? 'left-0' : i % 7 === 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        )}
                      >
                        <div className="font-semibold mb-2">{d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-white/60">เวลาเข้า</span>
                            <span>{info.checkIn}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-white/60">เวลาออก</span>
                            <span>{info.checkOut}</span>
                          </div>
                          <div className="h-px bg-white/10 my-2" />
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-white/60">ค่าจ้างเต็มวัน</span>
                            <span className="font-medium">{formatCurrency(info.fullDayWage)}</span>
                          </div>
                          {info.lateDeduction > 0 && (
                            <div className="flex items-center justify-between gap-6 text-error-300">
                              <span>หักมาสาย ({info.lateMinutes} นาที)</span>
                              <span>-{formatCurrency(info.lateDeduction)}</span>
                            </div>
                          )}
                          {info.earlyLeaveDeduction > 0 && (
                            <div className="flex items-center justify-between gap-6 text-error-300">
                              <span>หักออกก่อนเวลา ({info.earlyLeaveMinutes} นาที)</span>
                              <span>-{formatCurrency(info.earlyLeaveDeduction)}</span>
                            </div>
                          )}
                          <div className="h-px bg-white/10 my-2" />
                          <div className="flex items-center justify-between gap-6 font-semibold">
                            <span>ยอดได้รับ</span>
                            <span>{formatCurrency(info.netPay)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedDates.length > 0 && (
              <p className="text-xs text-primary-600 mt-2">
                เบิก {selectedDates.length} วัน = {formatCurrency(selectedDates.length * currentDailyWage)}
              </p>
            )}
          </div>
        ) : (
          <Input
            label="จำนวนเงินที่ต้องการเบิก"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        )}

        <Input label="วันที่เบิก" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
        <Textarea label="เหตุผล/หมายเหตุ" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลในการเบิก" />

        {isAdmin && (
          <div className="p-3 rounded-xl bg-info-50 text-xs text-primary-700">
            แอดมินกรอกแทน: สถานะจะเป็น "อนุมัติ" อัตโนมัติ
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={submit} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== LOAN TAB =====================
function LoanTab({ isAdmin, profile, onReload }: {
  isAdmin: boolean;
  profile: Profile | null;
  onReload: () => void;
}) {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeLoan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let loanQuery = supabase
      .from('employee_loans')
      .select('*, profiles(display_name, first_name, email), loan_installments(*)')
      .order('created_at', { ascending: false });

    if (!isAdmin && profile) {
      loanQuery = loanQuery.eq('profile_id', profile.id);
    }

    const [loanRes, empRes] = await Promise.all([
      loanQuery,
      isAdmin
        ? supabase.from('profiles').select('id, display_name, email').eq('is_active', true).order('display_name')
        : Promise.resolve({ data: null, error: null }),
    ]);

    setLoans((loanRes.data ?? []) as EmployeeLoan[]);
    if (empRes.data) {
      const filtered = (empRes.data as any[]).filter((e) => !((e.roles ?? []).includes('super_admin')));
      setEmployees(filtered.map((e) => ({ id: e.id, display_name: e.display_name ?? e.first_name ?? e.email, email: e.email })));
    }
    setLoading(false);
  }, [isAdmin, profile]);

  useEffect(() => { load(); }, [load]);

  async function toggleInstallmentPaid(installmentId: string, currentPaid: boolean) {
    if (currentPaid) {
      // Unmark as paid
      await supabase.from('loan_installments').update({
        paid: false,
        paid_at: null,
        paid_by: null,
      }).eq('id', installmentId);
    } else {
      await supabase.from('loan_installments').update({
        paid: true,
        paid_at: new Date().toISOString(),
        paid_by: profile?.id ?? null,
      }).eq('id', installmentId);
    }
    load();
    onReload();
  }

  async function updateLoanStatus(id: string, status: string) {
    await supabase.from('employee_loans').update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: status === 'approved' ? (profile?.id ?? null) : null,
    }).eq('id', id);
    load();
    onReload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('employee_loans').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
    onReload();
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-surface-900">เงินกู้</h3>
          <p className="text-sm text-surface-400">ระบบเงินกู้แบ่งชำระเป็นงวด — ไม่หักจากเงินเดือนอัตโนมัติ</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> ขอกู้เงิน
        </Button>
      </div>

      {loans.length === 0 ? (
        <EmptyState icon={<Landmark className="w-8 h-8" />} title="ไม่มีรายการเงินกู้" description="คำขอกู้เงินจะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {loans.map((loan, i) => {
            const installments = (loan.loan_installments ?? []).sort((a, b) => a.installment_number - b.installment_number);
            const paidCount = installments.filter((ii) => ii.paid).length;
            const isExpanded = expandedLoan === loan.id;
            return (
              <Card key={loan.id} className="p-4 animate-slide-up">
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2.5 rounded-xl bg-accent-100">
                        <Landmark className="w-5 h-5 text-accent-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900">{formatCurrency(loan.loan_amount)}</p>
                        <p className="text-xs text-surface-400">
                          {loan.installments} งวด · {formatCurrency(loan.monthly_payment)}/งวด
                          {isAdmin && loan.profiles && ` · ${loan.profiles.display_name ?? loan.profiles.first_name ?? loan.profiles.email}`}
                          {loan.admin_created && ' (แอดมินกรอกแทน)'}
                        </p>
                        {loan.reason && <p className="text-xs text-surface-400 mt-0.5">{loan.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={loan.status === 'approved' ? 'success' : loan.status === 'rejected' ? 'error' : 'warning'}>
                        {loan.status === 'pending' ? 'รออนุมัติ' : loan.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
                      </Badge>
                      {isAdmin && loan.status === 'pending' && (
                        <>
                          <button onClick={() => updateLoanStatus(loan.id, 'approved')} className="p-1.5 rounded-lg hover:bg-success-50 text-success-600 transition-colors" title="อนุมัติ">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => updateLoanStatus(loan.id, 'rejected')} className="p-1.5 rounded-lg hover:bg-error-50 text-error-600 transition-colors" title="ปฏิเสธ">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button onClick={() => setExpandedLoan(isExpanded ? null : loan.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors" title="ดูงวด">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(loan)} className="p-1.5 rounded-lg hover:bg-error-50 text-surface-400 transition-colors" title="ลบ">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {loan.status === 'approved' && installments.length > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-surface-400 mb-1">
                        <span>ชำระแล้ว {paidCount}/{installments.length} งวด</span>
                        <span>คงเหลือ {formatCurrency(loan.remaining_balance)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-success-500 transition-all duration-500"
                          style={{ width: `${(paidCount / installments.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Installments list */}
                  {isExpanded && installments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-100 space-y-2">
                      {installments.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                              inst.paid ? 'bg-success-100 text-success-600' : 'bg-surface-200 text-surface-400'
                            )}>
                              {inst.installment_number}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-surface-700">{formatCurrency(inst.amount)}</p>
                              {inst.paid && inst.paid_at && (
                                <p className="text-xs text-surface-400">ชำระเมื่อ {formatDate(inst.paid_at)}</p>
                              )}
                              {inst.note && <p className="text-xs text-surface-400">{inst.note}</p>}
                            </div>
                          </div>
                          {isAdmin && loan.status === 'approved' && (
                            <button
                              onClick={() => toggleInstallmentPaid(inst.id, inst.paid)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                inst.paid
                                  ? 'bg-surface-100 text-surface-500 hover:bg-error-50 hover:text-error-600'
                                  : 'bg-success-600 text-white hover:bg-success-700'
                              )}
                            >
                              {inst.paid ? 'ยกเลิกการชำระ' : 'ติ๊กชำระแล้ว'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <LoanFormModal
          isAdmin={isAdmin}
          employees={employees}
          profileId={profile?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); onReload(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันลบรายการเงินกู้"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">{formatCurrency(deleteTarget?.loan_amount ?? 0)}</p>
        <p>การลบนี้เป็นการลบถาวร ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </div>
  );
}

// ===================== LOAN FORM MODAL =====================
function LoanFormModal({ isAdmin, employees, profileId, onClose, onSaved }: {
  isAdmin: boolean;
  employees: { id: string; display_name: string; email: string }[];
  profileId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedEmp, setSelectedEmp] = useState(isAdmin ? '' : profileId ?? '');
  const [loanAmount, setLoanAmount] = useState('');
  const [installments, setInstallments] = useState('3');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amt = Number(loanAmount) || 0;
  const inst = Number(installments) || 1;
  const perInstallment = inst > 0 ? amt / inst : 0;

  async function submit() {
    setLoading(true);
    setError('');
    const targetId = isAdmin ? selectedEmp : profileId;
    if (!targetId) { setError('กรุณาเลือกพนักงาน'); setLoading(false); return; }
    if (amt <= 0) { setError('กรุณากรอกจำนวนเงิน'); setLoading(false); return; }
    if (inst < 1) { setError('จำนวนงวดต้องมากกว่า 0'); setLoading(false); return; }

    try {
      const { data: loanData, error: loanErr } = await supabase.from('employee_loans').insert({
        profile_id: targetId,
        loan_amount: amt,
        installments: inst,
        monthly_payment: perInstallment,
        remaining_balance: amt,
        reason: reason || null,
        status: isAdmin ? 'approved' : 'pending',
        admin_created: isAdmin,
        approved_by: isAdmin ? (profileId ?? null) : null,
        approved_at: isAdmin ? new Date().toISOString() : null,
      }).select().single();

      if (loanErr) throw loanErr;

      // Create installment records
      const instRows = Array.from({ length: inst }, (_, i) => ({
        loan_id: loanData.id,
        installment_number: i + 1,
        amount: perInstallment,
        paid: false,
      }));
      await supabase.from('loan_installments').insert(instRows);

      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    }
    setLoading(false);
  }

  return (
    <Modal open onClose={onClose} title="ขอกู้เงิน" size="md">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-error-50 text-error-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {isAdmin && (
          <Select label="เลือกพนักงาน" value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
            <option value="">— เลือกพนักงาน —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
          </Select>
        )}

        <Input label="จำนวนเงินที่ต้องการกู้" type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="0" />
        <Input label="จำนวนงวดผ่อนชำระ" type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder="3" min="1" />

        {amt > 0 && inst > 0 && (
          <div className="p-3 rounded-xl bg-primary-50 text-sm text-primary-700">
            ผ่อน {inst} งวด · งวดละ {formatCurrency(perInstallment)}
          </div>
        )}

        <Textarea label="เหตุผล/หมายเหตุ" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลในการกู้" />

        {isAdmin && (
          <div className="p-3 rounded-xl bg-info-50 text-xs text-primary-700">
            แอดมินกรอกแทน: สถานะจะเป็น "อนุมัติ" อัตโนมัติ
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={submit} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}
