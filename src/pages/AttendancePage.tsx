import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapPin, Clock, LogIn, LogOut, Plus, FileText, Timer, Coffee, Plane, Stethoscope, X, CheckCircle2, AlertCircle, Home, Calendar as CalendarIcon, Users, Settings, ChevronLeft, ChevronRight, ChevronDown, Building2, Trash2, Edit2, Check, XCircle, BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, Spinner, EmptyState, ConfirmDialog } from '@/components/ui';
import { formatDate, formatTime, todayISO, cn } from '@/lib/format';
import { isAdmin as checkAdmin, type Role } from '@/types/permissions';

function canManageAttendance(roles: Role[]): boolean {
  return roles.some((r) => r === 'owner' || r === 'super_admin' || r === 'admin' || r === 'finance');
}

type AttendanceRecord = {
  id: string;
  profile_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  work_hours: number | null;
  late_minutes: number;
  early_leave_minutes: number | null;
  ot_hours: number | null;
  selfie_url: string | null;
  branch_id: string | null;
  shift_id: string | null;
  branches: { name: string } | null;
  profiles: { display_name: string | null; first_name: string | null; email: string } | null;
};

type OTRequest = {
  id: string;
  profile_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  ot_hours: number | null;
  reason: string | null;
  status: string;
  auto_generated: boolean | null;
  attendance_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  profiles: { display_name: string | null; first_name: string | null; email: string } | null;
  branches: { name: string } | null;
};

type LeaveRequest = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

type Shift = {
  id: string;
  branch_id: string | null;
  name: string;
  start_time: string;
  end_time: string;
  color: string | null;
  is_active: boolean;
  branches: { name: string } | null;
};

type ShiftAssignment = {
  id: string;
  profile_id: string;
  shift_id: string | null;
  branch_id: string | null;
  assignment_date: string;
  status: string;
  note: string | null;
  actual_check_in_time: string | null;
  actual_check_out_time: string | null;
  actual_work_hours: number | null;
  actual_note: string | null;
  shifts: { name: string; start_time: string; end_time: string; color: string } | null;
  branches: { name: string } | null;
};

type PersonalDayOff = {
  id: string;
  day_of_week: number;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
};

type EmployeeOption = { id: string; display_name: string; email: string; avatar_url: string | null };

type BranchOption = { id: string; name: string };

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const DAY_NAMES_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTH_NAMES = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const LEAVE_TYPES: Record<string, { label: string; icon: typeof Stethoscope; color: string; badgeColor: string }> = {
  sick: { label: 'ลาป่วย', icon: Stethoscope, color: 'text-error-600 bg-error-100', badgeColor: 'bg-error-500' },
  personal: { label: 'ลากิจ', icon: Coffee, color: 'text-warning-600 bg-warning-100', badgeColor: 'bg-warning-500' },
  vacation: { label: 'ลาพักร้อน', icon: Plane, color: 'text-primary-600 bg-primary-100', badgeColor: 'bg-primary-500' },
};

const CALENDAR_STATUS_OPTIONS = [
  { value: 'work', label: 'กะทำงาน', color: 'bg-success-500', textColor: 'text-success-700', icon: CheckCircle2 },
  { value: 'day_off', label: 'วันหยุด', color: 'bg-surface-400', textColor: 'text-surface-600', icon: Home },
  { value: 'sick', label: 'ลาป่วย', color: 'bg-error-500', textColor: 'text-error-700', icon: Stethoscope },
  { value: 'personal', label: 'ลากิจ', color: 'bg-warning-500', textColor: 'text-warning-700', icon: Coffee },
  { value: 'vacation', label: 'ลาพักร้อน', color: 'bg-primary-500', textColor: 'text-primary-700', icon: Plane },
];

const STATUS_COLOR_HEX: Record<string, string> = {
  work: '#22c55e',
  day_off: '#94a3b8',
  sick: '#ef4444',
  personal: '#f59e0b',
  vacation: '#3b82f6',
};

const SHIFT_COLORS = [
  { name: 'success', value: '#22c55e' },
  { name: 'primary', value: '#3b82f6' },
  { name: 'warning', value: '#f59e0b' },
  { name: 'accent', value: '#8b5cf6' },
  { name: 'error', value: '#ef4444' },
  { name: 'cyan', value: '#06b6d4' },
];

export function AttendancePage() {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const isAdmin = checkAdmin(roles);
  const isSuperAdmin = roles.includes('super_admin');
  const canManage = canManageAttendance(roles);
  const [tab, setTab] = useState(isSuperAdmin ? 'history' : 'checkin');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [dayOffs, setDayOffs] = useState<PersonalDayOff[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [myBranches, setMyBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeave, setShowLeave] = useState(false);
  const [showOT, setShowOT] = useState(false);
  const [showDayOff, setShowDayOff] = useState(false);
  const [showShiftMgmt, setShowShiftMgmt] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [checkinBranchId, setCheckinBranchId] = useState<string | null>(null);
  const [todayShiftAssignments, setTodayShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
  const [timelineData, setTimelineData] = useState<{ profile_id: string; display_name: string; check_in_time: string | null; check_out_time: string | null; shift_name: string | null; shift_color: string | null; shift_start: string | null; shift_end: string | null }[]>([]);

  // History filter
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState<string>('all');

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calEmployeeId, setCalEmployeeId] = useState<string>('');
  const [calAssignments, setCalAssignments] = useState<ShiftAssignment[]>([]);
  const [calDayOffs, setCalDayOffs] = useState<PersonalDayOff[]>([]);
  const [calAttendance, setCalAttendance] = useState<any[]>([]);
  const [calClickDate, setCalClickDate] = useState<string | null>(null);

  // History edit/delete state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const today = todayISO();

    const [todayRes, histRes, leaveRes, shiftRes, branchRes, dayOffRes, myBranchRes] = await Promise.all([
      supabase.from('attendance').select('*, branches(name)').eq('profile_id', profile.id).gte('check_in_time', `${today}T00:00:00`).order('check_in_time', { ascending: false }).limit(1).maybeSingle(),
      isAdmin
        ? supabase.from('attendance').select('*, branches(name), profiles(display_name, first_name, email)').order('check_in_time', { ascending: false }).limit(100)
        : supabase.from('attendance').select('*, branches(name)').eq('profile_id', profile.id).order('check_in_time', { ascending: false }).limit(30),
      supabase.from('leave_requests').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('shifts').select('*, branches(name)').order('name'),
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('personal_day_offs').select('*').eq('profile_id', profile.id).order('effective_from', { ascending: false }),
      supabase.from('branch_members').select('branches(id, name)').eq('profile_id', profile.id),
    ]);

    setTodayRecord(todayRes.data as AttendanceRecord | null);
    setHistory(histRes.data as AttendanceRecord[] ?? []);
    setLeaves(leaveRes.data as LeaveRequest[] ?? []);
    setShifts(shiftRes.data as Shift[] ?? []);
    setBranches(branchRes.data as BranchOption[] ?? []);
    setDayOffs(dayOffRes.data as PersonalDayOff[] ?? []);
    const mb = (myBranchRes.data as any[] ?? []).map((bm) => bm.branches).filter(Boolean) as BranchOption[];
    setMyBranches(mb);
    setCheckinBranchId(mb[0]?.id ?? profile.active_branch_id ?? null);

    // Load today's shift assignments for this employee
    if (!isSuperAdmin) {
      const todayDate = todayISO();
      const { data: todayAssigns } = await supabase
        .from('shift_assignments')
        .select('*, shifts(name, start_time, end_time, color), branches(name)')
        .eq('profile_id', profile.id)
        .eq('assignment_date', todayDate)
        .order('shifts.start_time', { ascending: true });
      setTodayShiftAssignments((todayAssigns as ShiftAssignment[]) ?? []);
    }

    // Load OT requests for admin
    if (isAdmin) {
      const { data: otData } = await supabase
        .from('ot_requests')
        .select('*, profiles(display_name, first_name, email), branches(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      setOtRequests((otData as OTRequest[]) ?? []);
    }

    setLoading(false);
  }, [profile, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Load employees for admin filters
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, first_name, email, avatar_url').eq('is_active', true).order('display_name');
      setEmployees((data as EmployeeOption[] ?? []).map(e => ({ id: e.id, display_name: e.display_name ?? e.first_name ?? e.email, email: e.email, avatar_url: e.avatar_url })));
    })();
  }, [isAdmin]);

  // Load calendar data
  const loadCalendar = useCallback(async () => {
    if (!calEmployeeId) return;
    const monthStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const monthEnd = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const startStr = monthStart.toISOString().split('T')[0];
    const endStr = monthEnd.toISOString().split('T')[0];
    const startISO = monthStart.toISOString();
    const endISO = monthEnd.toISOString();

    const [assignRes, dayOffRes, attRes] = await Promise.all([
      supabase.from('shift_assignments').select('*, shifts(name, start_time, end_time, color), branches(name)').eq('profile_id', calEmployeeId).gte('assignment_date', startStr).lte('assignment_date', endStr).order('assignment_date'),
      supabase.from('personal_day_offs').select('*').eq('profile_id', calEmployeeId).order('effective_from', { ascending: false }),
      supabase.from('attendance').select('check_in_time, check_out_time, early_leave_minutes, late_minutes, status').eq('profile_id', calEmployeeId).gte('check_in_time', startISO).lt('check_in_time', endISO),
    ]);
    setCalAssignments(assignRes.data as ShiftAssignment[] ?? []);
    setCalDayOffs(dayOffRes.data as PersonalDayOff[] ?? []);
    setCalAttendance(attRes.data ?? []);
  }, [calEmployeeId, calMonth]);

  useEffect(() => {
    if (tab === 'calendar') {
      if (!calEmployeeId && profile) setCalEmployeeId(profile.id);
      else loadCalendar();
    }
  }, [tab, calEmployeeId, loadCalendar, profile]);

  function getGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { setGpsStatus('GPS ไม่พร้อมใช้งาน'); resolve(null); return; }
      setGpsStatus('กำลังระบุตำแหน่ง...');
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsStatus(null); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { setGpsStatus('ไม่สามารถระบุตำแหน่งได้'); resolve(null); },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  async function handleCheckIn(shiftId?: string) {
    if (!profile) return;
    const gps = await getGPS();
    const now = new Date();
    let lateMinutes = 0;
    let attendanceStatus = 'present';

    if (shiftId) {
      const shift = shifts.find(s => s.id === shiftId);
      if (shift) {
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(sh, sm, 0, 0);
        const diffMs = now.getTime() - shiftStart.getTime();
        if (diffMs > 0) {
          lateMinutes = Math.floor(diffMs / (1000 * 60));
          if (lateMinutes >= 5) attendanceStatus = 'late';
        }
      }
    }

    const { error } = await supabase.from('attendance').insert({
      profile_id: profile.id,
      check_in_time: now.toISOString(),
      check_in_gps_lat: gps?.lat ?? null,
      check_in_gps_lng: gps?.lng ?? null,
      status: attendanceStatus,
      selfie_url: null,
      branch_id: checkinBranchId,
      shift_id: shiftId ?? null,
      late_minutes: lateMinutes,
    });
    if (!error) load();
  }

  async function handleCheckOut() {
    if (!todayRecord) return;
    const gps = await getGPS();
    const now = new Date();
    const checkIn = new Date(todayRecord.check_in_time!);

    let workHours: number = 0;
    let earlyLeaveMinutes = 0;
    let otMinutes = 0;
    let otHours = 0;

    if (todayRecord.shift_id) {
      const { data: shift } = await supabase.from('shifts').select('start_time, end_time').eq('id', todayRecord.shift_id).maybeSingle();
      if (shift) {
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const [eh, em] = shift.end_time.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(sh, sm, 0, 0);
        const shiftEnd = new Date(now);
        shiftEnd.setHours(eh, em, 0, 0);

        // Early arrival: work starts at shift start time, not check-in time
        const effectiveStart = checkIn < shiftStart ? shiftStart : checkIn;

        // Early leave: if checkout before shift end, deduct the full last hour
        if (now < shiftEnd) {
          earlyLeaveMinutes = Math.round((shiftEnd.getTime() - now.getTime()) / (1000 * 60));
          // Deduct the full last hour if leaving even 1 minute early
          const minutesIntoLastHour = shiftEnd.getMinutes() - now.getMinutes();
          if (earlyLeaveMinutes > 0) {
            // Round up to the next full hour for deduction
            const hoursDeducted = Math.ceil(earlyLeaveMinutes / 60);
            workHours = Math.max(0, (shiftEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60) - hoursDeducted);
          } else {
            workHours = (now.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
          }
        } else {
          // Normal or OT checkout
          workHours = (shiftEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
          // OT: only if more than 60 minutes past shift end
          const overtimeMs = now.getTime() - shiftEnd.getTime();
          if (overtimeMs >= 60 * 60 * 1000) {
            otMinutes = Math.floor(overtimeMs / (1000 * 60));
            otHours = Math.round((otMinutes / 60) * 100) / 100;
            // Auto-create OT request
            await supabase.from('ot_requests').insert({
              profile_id: profile!.id,
              ot_date: todayISO(),
              start_time: shift.end_time,
              end_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
              ot_hours: otHours,
              branch_id: todayRecord.branch_id,
              reason: 'Auto-generated from overtime checkout',
              status: 'pending',
              auto_generated: true,
              attendance_id: todayRecord.id,
            });
          }
        }
        workHours = Math.round(workHours * 100) / 100;
      }
    } else {
      // No shift linked: calculate from check-in to checkout
      workHours = Math.round(((now.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;
    }

    const { error } = await supabase.from('attendance').update({
      check_out_time: now.toISOString(),
      check_out_gps_lat: gps?.lat ?? null,
      check_out_gps_lng: gps?.lng ?? null,
      work_hours: workHours,
      early_leave_minutes: earlyLeaveMinutes,
      ot_hours: otHours,
    }).eq('id', todayRecord.id);
    if (!error) load();
  }

  // Load timeline data when tab is active
  const loadTimeline = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();
    const { data } = await supabase
      .from('attendance')
      .select('profile_id, check_in_time, check_out_time, profiles(display_name, first_name, email), shift_id, shifts(name, start_time, end_time, color)')
      .gte('check_in_time', `${today}T00:00:00`)
      .lt('check_in_time', `${today}T23:59:59`)
      .order('check_in_time', { ascending: true });
    if (data) {
      setTimelineData(data.map((r: any) => ({
        profile_id: r.profile_id,
        display_name: r.profiles?.display_name ?? r.profiles?.first_name ?? r.profiles?.email ?? 'Unknown',
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        shift_name: r.shifts?.name ?? null,
        shift_color: r.shifts?.color ?? null,
        shift_start: r.shifts?.start_time ?? null,
        shift_end: r.shifts?.end_time ?? null,
      })));
    }
  }, [profile]);

  useEffect(() => {
    if (tab === 'timeline' && isAdmin) loadTimeline();
  }, [tab, isAdmin, loadTimeline]);

  async function approveOT(requestId: string) {
    if (!profile) return;
    await supabase.from('ot_requests').update({
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', requestId);
    load();
  }

  async function rejectOT(requestId: string) {
    if (!profile) return;
    await supabase.from('ot_requests').update({
      status: 'rejected',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', requestId);
    load();
  }

  const isCheckedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time;
  const isCheckedOut = !!todayRecord?.check_out_time;

  const filteredHistory = useMemo(() => {
    if (!isAdmin || historyEmployeeFilter === 'all') return history;
    return history.filter((h) => h.profile_id === historyEmployeeFilter);
  }, [history, isAdmin, historyEmployeeFilter]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const tabs = [
    ...(!isSuperAdmin ? [{ key: 'checkin', label: 'เช็คอิน' }] : []),
    ...(!isSuperAdmin ? [{ key: 'leave', label: 'การลา / OT' }] : []),
    { key: 'history', label: 'ประวัติ' },
    ...(isAdmin ? [{ key: 'ot', label: 'ขออนุมัติ OT' }] : []),
    ...(isAdmin ? [{ key: 'timeline', label: 'กราฟเวลาเข้างาน' }] : []),
    ...(canManage ? [{ key: 'calendar', label: 'ปฏิทินกะ' }] : []),
    ...(isAdmin && !isSuperAdmin ? [{ key: 'shifts', label: 'จัดการกะ' }] : []),
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'checkin' && !isSuperAdmin && (
        <div className="max-w-md mx-auto space-y-6">
          {/* Per-shift check-in buttons */}
          {todayShiftAssignments.length > 0 && !isCheckedIn && !isCheckedOut && (
            <Card className="p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-primary-500" />
                <h3 className="text-sm font-semibold text-surface-700">กะที่ได้รับมอบหมายวันนี้</h3>
              </div>
              <div className="space-y-2">
                {todayShiftAssignments
                  .filter(a => a.status === 'work' && a.shifts)
                  .sort((a, b) => (a.shifts?.start_time ?? '').localeCompare(b.shifts?.start_time ?? ''))
                  .map((assign) => (
                    <button
                      key={assign.id}
                      onClick={() => handleCheckIn(assign.shift_id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-surface-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left group"
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: assign.shifts?.color ?? '#22c55e' }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-surface-900">{assign.shifts!.name}</p>
                        <p className="text-xs text-surface-500">{assign.shifts!.start_time.slice(0,5)} - {assign.shifts!.end_time.slice(0,5)}{assign.branches ? ` · ${assign.branches.name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 text-primary-600 group-hover:translate-x-0.5 transition-transform">
                        <LogIn className="w-5 h-5" />
                        <span className="text-sm font-medium">เช็คอิน</span>
                      </div>
                    </button>
                  ))}
              </div>
            </Card>
          )}

          {/* Fallback single check-in if no shift assignments */}
          {todayShiftAssignments.filter(a => a.status === 'work' && a.shifts).length === 0 && !isCheckedIn && !isCheckedOut && (
            <Card className="p-8 text-center animate-scale-in">
              <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 bg-surface-100">
                <Clock className="w-10 h-10 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500 mb-4">ยังไม่ได้เช็คอินวันนี้</p>
              {myBranches.length > 1 && (
                <div className="mb-4">
                  <Select label="เช็คอินที่สาขา" value={checkinBranchId ?? ''} onChange={(e) => setCheckinBranchId(e.target.value || null)}>
                    {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </div>
              )}
              <Button onClick={() => handleCheckIn()} className="w-full" size="lg">
                <LogIn className="w-5 h-5" /> เช็คอิน
              </Button>
            </Card>
          )}

          {isCheckedIn && (
            <Card className="p-8 text-center animate-scale-in">
              <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 bg-success-100">
                <Timer className="w-10 h-10 text-success-600 animate-pulse-soft" />
              </div>
              <p className="text-sm text-surface-500 mb-1">เช็คอินเวลา</p>
              <p className="text-3xl font-bold text-surface-900 mb-1">{formatTime(todayRecord?.check_in_time)}</p>
              {todayRecord?.late_minutes >= 5 && (
                <p className="text-sm text-warning-600 mb-1">มาสาย {todayRecord.late_minutes} นาที</p>
              )}
              <p className="text-sm text-success-600 mb-6">กำลังทำงาน...</p>
              <Button onClick={handleCheckOut} variant="danger" className="w-full" size="lg">
                <LogOut className="w-5 h-5" /> เช็คเอาต์
              </Button>
            </Card>
          )}

          {isCheckedOut && (
            <Card className="p-8 text-center animate-scale-in">
              <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 bg-surface-100">
                <CheckCircle2 className="w-10 h-10 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500 mb-1">ทำงานวันนี้เสร็จแล้ว</p>
              <p className="text-2xl font-bold text-surface-900 mb-1">{todayRecord?.work_hours ?? 0} ชม.</p>
              <p className="text-sm text-surface-400">เช็คอิน {formatTime(todayRecord?.check_in_time)} - เช็คเอาต์ {formatTime(todayRecord?.check_out_time)}</p>
              {todayRecord?.ot_hours != null && todayRecord.ot_hours > 0 && (
                <p className="text-sm text-success-600 mt-1">OT {todayRecord.ot_hours} ชม.</p>
              )}
              {todayRecord?.early_leave_minutes != null && todayRecord.early_leave_minutes > 0 && (
                <p className="text-sm text-error-600 mt-1">ออกก่อนเวลา {todayRecord.early_leave_minutes} นาที</p>
              )}
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-xs text-surface-400 mb-1">วันนี้</p>
              <p className="text-lg font-bold text-surface-900">{todayRecord?.work_hours ?? 0}ชม</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-surface-400 mb-1">สัปดาห์</p>
              <p className="text-lg font-bold text-surface-900">{history.filter(h => h.work_hours).slice(0, 7).reduce((s, h) => s + (h.work_hours ?? 0), 0).toFixed(0)}ชม</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-surface-400 mb-1">มาสาย</p>
              <p className="text-lg font-bold text-surface-900">{history.filter(h => h.late_minutes > 0).length}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'leave' && !isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowLeave(true)} size="sm"><Plus className="w-4 h-4" /> ขอลา</Button>
            <Button onClick={() => setShowOT(true)} variant="secondary" size="sm"><Plus className="w-4 h-4" /> ขอ OT</Button>
            <Button onClick={() => setShowDayOff(true)} variant="secondary" size="sm"><Home className="w-4 h-4" /> ตั้งวันหยุดประจำสัปดาห์</Button>
          </div>
          {leaves.length === 0 ? (
            <EmptyState icon={<FileText className="w-8 h-8" />} title="ไม่มีคำขอลา" description="คำขอลาและ OT จะแสดงที่นี่" />
          ) : (
            <div className="space-y-3">
              {leaves.map((lr) => {
                const cfg = LEAVE_TYPES[lr.leave_type] ?? LEAVE_TYPES.personal;
                const Icon = cfg.icon;
                return (
                  <Card key={lr.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2.5 rounded-xl', cfg.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-surface-900">{cfg.label}</p>
                        <p className="text-sm text-surface-500">{formatDate(lr.start_date)} - {formatDate(lr.end_date)}</p>
                      </div>
                    </div>
                    <Badge variant={lr.status === 'approved' ? 'success' : lr.status === 'rejected' ? 'error' : 'warning'}>
                      {lr.status === 'pending' ? 'รออนุมัติ' : lr.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Users className="w-4 h-4" />
                ดูประวัติของ:
              </div>
              <Select value={historyEmployeeFilter} onChange={(e) => setHistoryEmployeeFilter(e.target.value)} className="!w-auto min-w-[200px]">
                <option value="all">ทุกพนักงาน</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.display_name}</option>)}
              </Select>
            </div>
          )}
          {filteredHistory.length === 0 ? (
            <EmptyState icon={<Clock className="w-8 h-8" />} title="ไม่มีประวัติ" description="ประวัติการเช็คอินจะแสดงที่นี่" />
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((rec, i) => (
                <Card key={rec.id} className={cn('p-4 flex items-center justify-between animate-slide-up')}>
                  <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                      rec.status === 'present' ? 'bg-success-100 text-success-600' :
                      rec.status === 'late' ? 'bg-warning-100 text-warning-600' :
                      'bg-surface-100 text-surface-400'
                    )}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-surface-900">{formatDate(rec.check_in_time)}</p>
                      <p className="text-sm text-surface-500">
                        {formatTime(rec.check_in_time)} - {rec.check_out_time ? formatTime(rec.check_out_time) : '...'}
                        {rec.work_hours && ` (${rec.work_hours}ชม.)`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {rec.branches && <span className="text-xs text-surface-400">{rec.branches.name}</span>}
                        {isAdmin && rec.profiles && (
                          <span className="text-xs text-surface-500 font-medium">
                            {rec.profiles.display_name ?? rec.profiles.first_name ?? rec.profiles.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.status === 'present' ? 'success' : rec.status === 'late' ? 'warning' : 'default'}>
                      {rec.status === 'present' ? 'มา' : rec.status === 'late' ? 'สาย' : rec.status}
                    </Badge>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingRecord(rec)}
                          className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4 text-surface-400" />
                        </button>
                        <button
                          onClick={() => setDeletingRecord(rec)}
                          className="p-1.5 rounded-lg hover:bg-error-100 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4 text-error-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ot' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-surface-800">คำขอ OT รออนุมัติ</h2>
          </div>
          {otRequests.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-8 h-8" />} title="ไม่มีคำขอ OT" description="ยังไม่มีคำขอ OT รออนุมัติในขณะนี้" />
          ) : (
            <div className="space-y-3">
              {otRequests.map((req) => (
                <Card key={req.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-900">{req.profiles?.display_name ?? req.profiles?.first_name ?? req.profiles?.email}</span>
                        {req.auto_generated && <Badge color="warning" size="sm">อัตโนมัติ</Badge>}
                        {req.status === 'pending' && <Badge color="warning" size="sm">รออนุมัติ</Badge>}
                        {req.status === 'approved' && <Badge color="success" size="sm">อนุมัติแล้ว</Badge>}
                        {req.status === 'rejected' && <Badge color="error" size="sm">ปฏิเสธ</Badge>}
                      </div>
                      <p className="text-sm text-surface-500">
                        วันที่ {formatDate(req.ot_date)} · {req.start_time.slice(0,5)} - {req.end_time.slice(0,5)} · {req.ot_hours ?? 0} ชม.
                        {req.branches && ` · ${req.branches.name}`}
                      </p>
                      {req.reason && <p className="text-xs text-surface-400">เหตุผล: {req.reason}</p>}
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="success" onClick={() => approveOT(req.id)}>
                          <Check className="w-4 h-4" /> อนุมัติ
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => rejectOT(req.id)}>
                          <XCircle className="w-4 h-4" /> ปฏิเสธ
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-surface-800">กราฟเวลาเข้างานวันนี้</h2>
          </div>
          {timelineData.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="ยังไม่มีข้อมูล" description="ยังไม่มีพนักงานเช็คอินวันนี้" />
          ) : (
            <Card className="p-4 overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                {/* Hour axis */}
                <div className="flex pl-[140px]">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-surface-400 border-l border-surface-100">
                      {String(h).padStart(2, '0')}
                    </div>
                  ))}
                </div>
                {/* Timeline rows */}
                {timelineData.map((row) => {
                  const checkIn = row.check_in_time ? new Date(row.check_in_time) : null;
                  const checkOut = row.check_out_time ? new Date(row.check_out_time) : null;
                  const checkInHour = checkIn ? checkIn.getHours() + checkIn.getMinutes() / 60 : 0;
                  const checkOutHour = checkOut ? checkOut.getHours() + checkOut.getMinutes() / 60 : new Date().getHours() + new Date().getMinutes() / 60;
                  const leftPct = (checkInHour / 24) * 100;
                  const widthPct = Math.max(1, ((checkOutHour - checkInHour) / 24) * 100);
                  return (
                    <div key={row.profile_id} className="flex items-center gap-2">
                      <div className="w-[130px] shrink-0 truncate text-sm text-surface-700 font-medium">
                        {row.display_name}
                      </div>
                      <div className="flex-1 relative h-8 bg-surface-50 rounded-lg overflow-hidden">
                        {/* Shift background if available */}
                        {row.shift_start && row.shift_end && (() => {
                          const [ssH, ssM] = row.shift_start.split(':').map(Number);
                          const [seH, seM] = row.shift_end.split(':').map(Number);
                          const ssTotal = ssH + ssM / 60;
                          const seTotal = seH + seM / 60;
                          const sLeft = (ssTotal / 24) * 100;
                          const sWidth = ((seTotal - ssTotal) / 24) * 100;
                          return <div className="absolute top-0 bottom-0 opacity-15 border-l border-r border-dashed border-surface-300" style={{ left: `${sLeft}%`, width: `${sWidth}%`, backgroundColor: row.shift_color ?? '#94a3b8' }} />;
                        })()}
                        {/* Actual worked time bar */}
                        {checkIn && (
                          <div
                            className="absolute top-1 bottom-1 rounded-md flex items-center px-1 text-[9px] text-white font-medium truncate"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: row.shift_color ?? '#3b82f6',
                            }}
                          >
                            {row.shift_name && widthPct > 8 ? row.shift_name : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-surface-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary-500" /> เวลาทำงานจริง</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded border border-dashed border-surface-300 bg-surface-200 opacity-30" /> เวลากะ</div>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'calendar' && canManage && (
        <CalendarTab
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          calEmployeeId={calEmployeeId}
          setCalEmployeeId={setCalEmployeeId}
          employees={employees.filter((e) => !isSuperAdmin || e.id !== profile?.id)}
          assignments={calAssignments}
          dayOffs={calDayOffs}
          shifts={shifts}
          branches={branches}
          onReload={loadCalendar}
          calClickDate={calClickDate}
          setCalClickDate={setCalClickDate}
          attendanceRecords={calAttendance}
          canManage={canManage}
        />
      )}

      {tab === 'shifts' && isAdmin && (
        <ShiftManagementTab shifts={shifts} branches={branches} onReload={load} />
      )}


      <LeaveRequestModal open={showLeave} onClose={() => setShowLeave(false)} profileId={profile?.id} onCreated={load} />
      <OTRequestModal open={showOT} onClose={() => setShowOT(false)} profileId={profile?.id} branches={myBranches.length > 0 ? myBranches : branches} onCreated={load} />
      <DayOffModal open={showDayOff} onClose={() => setShowDayOff(false)} profileId={profile?.id} dayOffs={dayOffs} onCreated={load} />

      {editingRecord && (
        <HistoryEditModal
          record={editingRecord}
          actorProfileId={profile?.id}
          onClose={() => setEditingRecord(null)}
          onSaved={() => { setEditingRecord(null); load(); if (tab === 'calendar') loadCalendar(); }}
        />
      )}

      {deletingRecord && (
        <HistoryDeleteModal
          record={deletingRecord}
          actorProfileId={profile?.id}
          onClose={() => setDeletingRecord(null)}
          onSaved={() => { setDeletingRecord(null); load(); if (tab === 'calendar') loadCalendar(); }}
        />
      )}
    </div>
  );
}

// ============ CALENDAR TAB ============
function CalendarTab({ calMonth, setCalMonth, calEmployeeId, setCalEmployeeId, employees, assignments, dayOffs, shifts, branches, onReload, calClickDate, setCalClickDate, attendanceRecords, canManage }: {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  calEmployeeId: string;
  setCalEmployeeId: (id: string) => void;
  employees: EmployeeOption[];
  assignments: ShiftAssignment[];
  dayOffs: PersonalDayOff[];
  shifts: Shift[];
  branches: BranchOption[];
  onReload: () => void;
  calClickDate: string | null;
  setCalClickDate: (d: string | null) => void;
  attendanceRecords: { check_in_time: string | null; check_out_time: string | null; early_leave_minutes: number; late_minutes: number; status: string }[];
  canManage: boolean;
}) {
  const selectedEmployee = employees.find((e) => e.id === calEmployeeId);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [multiDates, setMultiDates] = useState<string[]>([]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const assignmentMap = useMemo(() => {
    const m: Record<string, ShiftAssignment[]> = {};
    assignments.forEach((a) => {
      if (!m[a.assignment_date]) m[a.assignment_date] = [];
      m[a.assignment_date].push(a);
    });
    return m;
  }, [assignments]);

  const attendanceMap = useMemo(() => {
    const m: Record<string, { check_in_time: string | null; check_out_time: string | null; early_leave_minutes: number; late_minutes: number; status: string }> = {};
    attendanceRecords.forEach((r) => {
      if (r.check_in_time) {
        const d = new Date(r.check_in_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        m[key] = r;
      }
    });
    return m;
  }, [attendanceRecords]);

  function isDayOff(dateStr: string, dow: number): PersonalDayOff | null {
    const date = new Date(dateStr + 'T00:00:00');
    return dayOffs.find((d) => {
      if (d.day_of_week !== dow) return false;
      const from = new Date(d.effective_from + 'T00:00:00');
      if (date < from) return false;
      if (d.effective_to) {
        const to = new Date(d.effective_to + 'T00:00:00');
        if (date > to) return false;
      }
      return true;
    }) ?? null;
  }

  const cells: ({ date: Date; dateStr: string; dow: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dow: date.getDay() });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayISO();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={calEmployeeId} onChange={(e) => setCalEmployeeId(e.target.value)} className="min-w-[200px]">
            <option value="">เลือกพนักงาน...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-surface-500" />
          </button>
          <span className="text-sm font-semibold text-surface-700 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year + 543}
          </span>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-surface-500" />
          </button>
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>วันนี้</Button>
        </div>
      </div>

      {!calEmployeeId ? (
        <EmptyState icon={<CalendarIcon className="w-8 h-8" />} title="เลือกพนักงาน" description="เลือกพนักงานจาก dropdown เพื่อดู/จัดตารางกะในปฏิทิน" />
      ) : (
        <>
        {selectedEmployee && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
            {selectedEmployee.avatar_url ? (
              <img src={selectedEmployee.avatar_url} alt={selectedEmployee.display_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
                {selectedEmployee.display_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-surface-900">{selectedEmployee.display_name}</p>
              <p className="text-xs text-surface-500">{canManage ? 'สามารถแก้ไขเวลาเข้า-ออกงานได้' : 'ดูได้อย่างเดียว'}</p>
            </div>
          </div>
        )}
        <Card className="p-4 overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[700px]">
            {DAY_NAMES_SHORT.map((d, i) => (
              <div key={i} className={cn('text-center text-xs font-semibold py-2', i === 0 || i === 6 ? 'text-error-500' : 'text-surface-400')}>
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="min-h-[90px] rounded-lg bg-surface-50/50" />;
              const dayAssigns = assignmentMap[cell.dateStr] ?? [];
              const dayOff = isDayOff(cell.dateStr, cell.dow);
              const isToday = cell.dateStr === today;
              const isWeekend = cell.dow === 0 || cell.dow === 6;
              const att = attendanceMap[cell.dateStr];
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!calEmployeeId) return;
                    if (rangeStart && !rangeEnd && cell.dateStr >= rangeStart) {
                      const dates: string[] = [];
                      const cur = new Date(rangeStart + 'T00:00:00');
                      const end = new Date(cell.dateStr + 'T00:00:00');
                      while (cur <= end) {
                        dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
                        cur.setDate(cur.getDate() + 1);
                      }
                      setRangeEnd(cell.dateStr);
                      setMultiDates(dates);
                      setCalClickDate(rangeStart);
                    } else {
                      setRangeStart(cell.dateStr);
                      setRangeEnd(null);
                      setMultiDates([]);
                      setCalClickDate(cell.dateStr);
                    }
                  }}
                  className={cn(
                    'min-h-[90px] rounded-lg border p-1.5 text-left transition-all hover:ring-2 hover:ring-primary-400',
                    isToday ? 'border-primary-400 bg-primary-50/50' : 'border-surface-100',
                    isWeekend && !isToday && 'bg-surface-50/30',
                    rangeStart && rangeEnd && cell.dateStr >= rangeStart && cell.dateStr <= rangeEnd && 'ring-2 ring-primary-400 bg-primary-50'
                  )}
                >
                  <span className={cn('text-xs font-medium', isWeekend ? 'text-error-500' : 'text-surface-600')}>
                    {cell.date.getDate()}
                  </span>
                  {dayAssigns.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayAssigns.map((assign) => (
                        <div key={assign.id}>
                          {assign.shifts ? (
                            <div className="text-[10px] px-1.5 py-0.5 rounded text-white truncate flex items-center gap-1" style={{ backgroundColor: assign.shifts.color ?? '#22c55e' }}>
                              {selectedEmployee?.avatar_url ? (
                                <img src={selectedEmployee.avatar_url} alt="" className="w-3 h-3 rounded-full object-cover shrink-0" />
                              ) : (
                                <span className="w-3 h-3 rounded-full bg-white/30 shrink-0" />
                              )}
                              <span className="truncate">{assign.shifts.name}</span>
                            </div>
                          ) : (
                            <div className={cn('text-[10px] px-1.5 py-0.5 rounded truncate', getStatusBadgeClass(assign.status))}>
                              {getStatusBadgeLabel(assign.status)}
                            </div>
                          )}
                          {assign.branches && <p className="text-[9px] text-surface-400 truncate">{assign.branches.name}</p>}
                          {assign.actual_check_in_time && (
                            <p className="text-[9px] text-success-600 font-medium">เข้าจริง {new Date(assign.actual_check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                          {assign.actual_check_out_time && (
                            <p className="text-[9px] text-surface-500 font-medium">ออกจริง {new Date(assign.actual_check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {dayAssigns.length === 0 && dayOff && (
                    <div className="mt-1">
                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200 text-surface-500 truncate">
                        หยุด{DAY_NAMES[dayOff.day_of_week]}
                      </div>
                    </div>
                  )}
                  {att && att.check_in_time && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[9px] text-success-600 font-medium">
                        เข้า {new Date(att.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {att.check_out_time && (
                        <p className="text-[9px] text-surface-500 font-medium">
                          ออก {new Date(att.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {att.early_leave_minutes > 0 && (
                        <div className="text-[9px] px-1 py-0.5 rounded bg-error-100 text-error-600 font-medium">
                          ออกก่อนเวลา
                        </div>
                      )}
                      {att.late_minutes >= 5 && (
                        <div className="text-[9px] px-1 py-0.5 rounded bg-warning-100 text-warning-600 font-medium">
                          มาสาย {att.late_minutes} นาที
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
        </>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-surface-500">
        {CALENDAR_STATUS_OPTIONS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', s.color)} />
            {s.label}
          </div>
        ))}
      </div>

      {calClickDate && calEmployeeId && (
        <CalendarDayModal
          dateStr={calClickDate}
          dateList={multiDates.length > 1 ? multiDates : undefined}
          profileId={calEmployeeId}
          employee={selectedEmployee ?? null}
          shifts={shifts}
          branches={branches}
          existingAssignments={assignmentMap[calClickDate] ?? []}
          canManage={canManage}
          onClose={() => { setCalClickDate(null); setRangeStart(null); setRangeEnd(null); setMultiDates([]); }}
          onSaved={() => { setCalClickDate(null); setRangeStart(null); setRangeEnd(null); setMultiDates([]); onReload(); }}
          onShiftsReload={onReload}
        />
      )}
    </div>
  );
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function combineDateAndTime(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr + 'T' + timeStr + ':00');
  return d.toISOString();
}

function getStatusBadgeClass(status: string): string {
  const opt = CALENDAR_STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return 'bg-surface-200 text-surface-500';
  return cn(opt.color, 'text-white');
}

function getStatusBadgeLabel(status: string): string {
  const opt = CALENDAR_STATUS_OPTIONS.find((o) => o.value === status);
  return opt?.label ?? status;
}

// ============ CALENDAR DAY MODAL ============
function CalendarDayModal({ dateStr, dateList, profileId, employee, shifts, branches, existingAssignments, canManage, onClose, onSaved, onShiftsReload }: {
  dateStr: string;
  dateList?: string[];
  profileId: string;
  employee: EmployeeOption | null;
  shifts: Shift[];
  branches: BranchOption[];
  existingAssignments: ShiftAssignment[];
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onShiftsReload: () => void;
}) {
  const [status, setStatus] = useState(existingAssignments[0]?.status ?? 'work');
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>(existingAssignments.filter(a => a.shift_id).map(a => a.shift_id!));
  const [branchId] = useState(existingAssignments[0]?.branch_id ?? '');
  const [note, setNote] = useState(existingAssignments[0]?.note ?? '');
  const [actualCheckIn, setActualCheckIn] = useState(existingAssignments[0]?.actual_check_in_time ? toLocalTimeInput(existingAssignments[0].actual_check_in_time) : '');
  const [actualCheckOut, setActualCheckOut] = useState(existingAssignments[0]?.actual_check_out_time ? toLocalTimeInput(existingAssignments[0].actual_check_out_time) : '');
  const [actualNote, setActualNote] = useState(existingAssignments[0]?.actual_note ?? '');
  const [loading, setLoading] = useState(false);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftColor, setNewShiftColor] = useState('#3b82f6');
  const [creatingShift, setCreatingShift] = useState(false);
  const [localShifts, setLocalShifts] = useState<Shift[]>(shifts);
  const [showNote, setShowNote] = useState(!!existingAssignments[0]?.note);

  const dates = dateList && dateList.length > 0 ? dateList : [dateStr];
  const multiDay = dates.length > 1;
  const allShifts = localShifts.filter(s => s.is_active);

  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();

  async function createShift() {
    if (!newShiftName.trim()) return;
    setCreatingShift(true);
    const { data, error } = await supabase.from('shifts').insert({
      name: newShiftName.trim(),
      start_time: newShiftStart,
      end_time: newShiftEnd,
      branch_id: branchId || null,
      color: newShiftColor,
      is_active: true,
    }).select('id, name, start_time, end_time, color, is_active, branch_id').single();
    setCreatingShift(false);
    if (!error && data) {
      const newShift = { ...data, branches: branchId ? branches.find(b => b.id === branchId) ?? null : null } as Shift;
      setLocalShifts(prev => [...prev, newShift]);
      setSelectedShiftIds(prev => [...prev, data.id]);
      setShowCreateShift(false);
      setNewShiftName('');
      onShiftsReload();
    }
  }

  function toggleShift(id: string) {
    setSelectedShiftIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function save() {
    setLoading(true);
    for (const d of dates) {
      // Delete existing assignments for this date that are not in selectedShiftIds
      const existingIds = existingAssignments.map(a => a.id);
      if (existingIds.length > 0) {
        await supabase.from('shift_assignments').delete().in('id', existingIds).eq('assignment_date', d);
      }

      // Build actual time fields (admin-only)
      let actualIn: string | null = null;
      let actualOut: string | null = null;
      let actualHours: number | null = null;
      if (canManage && actualCheckIn && actualCheckOut) {
        actualIn = combineDateAndTime(d, actualCheckIn);
        actualOut = combineDateAndTime(d, actualCheckOut);
        const inMs = new Date(actualIn).getTime();
        const outMs = new Date(actualOut).getTime();
        if (outMs > inMs) {
          actualHours = Math.round((outMs - inMs) / 3600000 * 100) / 100;
        }
      } else if (canManage && actualCheckIn) {
        actualIn = combineDateAndTime(d, actualCheckIn);
      }

      if (status === 'work' && selectedShiftIds.length > 0) {
        // Insert one row per selected shift
        for (const sid of selectedShiftIds) {
          await supabase.from('shift_assignments').insert({
            profile_id: profileId,
            assignment_date: d,
            status,
            shift_id: sid,
            branch_id: branchId || null,
            note: note || null,
            actual_check_in_time: actualIn,
            actual_check_out_time: actualOut,
            actual_work_hours: actualHours,
            actual_note: (canManage && actualNote) || null,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        // Non-work status: single row with no shift
        await supabase.from('shift_assignments').insert({
          profile_id: profileId,
          assignment_date: d,
          status,
          shift_id: null,
          branch_id: branchId || null,
          note: note || null,
          actual_check_in_time: actualIn,
          actual_check_out_time: actualOut,
          actual_work_hours: actualHours,
          actual_note: (canManage && actualNote) || null,
          updated_at: new Date().toISOString(),
        });
      }
    }
    setLoading(false);
    onSaved();
  }

  async function remove() {
    if (existingAssignments.length === 0) { onClose(); return; }
    setLoading(true);
    for (const a of existingAssignments) {
      await supabase.from('shift_assignments').delete().eq('id', a.id);
    }
    setLoading(false);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={multiDay ? `ตั้งตารางวันที่ (${dates.length} วัน)` : `ตั้งตารางวันที่ ${formatDate(dateStr)}`} size="sm">
      <div className="space-y-3">
        {/* Employee header */}
        {employee && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
            {employee.avatar_url ? (
              <img src={employee.avatar_url} alt={employee.display_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                {employee.display_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-surface-900 text-sm">{employee.display_name}</p>
              <p className="text-xs text-surface-500">{canManage ? 'สามารถแก้ไขเวลาได้' : 'ดูได้อย่างเดียว'}</p>
            </div>
          </div>
        )}

        {multiDay && (
          <div className="px-3 py-2 rounded-lg bg-primary-50 text-xs text-primary-700 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ตั้งกะ {dates.length} วัน ตั้งแต่ {formatDate(dates[0])} ถึง {formatDate(dates[dates.length - 1])}
          </div>
        )}

        {/* Status pills */}
        <div>
          <p className="text-xs font-semibold text-surface-500 mb-2">สถานะของวันนี้</p>
          <div className="flex flex-wrap gap-2">
            {CALENDAR_STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                    selected ? 'border-transparent text-white shadow-sm' : 'border-surface-200 text-surface-600 hover:border-surface-300 bg-white'
                  )}
                  style={selected ? { backgroundColor: STATUS_COLOR_HEX[opt.value] } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shift selection */}
        {status === 'work' && (
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-surface-500">กะทำงาน <span className="text-surface-400 font-normal">(เลือกได้หลายกะ)</span></p>
              <button onClick={() => setShowCreateShift(s => !s)} className="text-xs text-primary-600 font-medium hover:text-primary-700 flex items-center gap-0.5">
                <Plus className="w-3.5 h-3.5" /> สร้างกะใหม่
              </button>
            </div>

            {allShifts.length === 0 && !showCreateShift && (
              <p className="text-sm text-surface-400 text-center py-3">ยังไม่มีกะในระบบ กด "สร้างกะใหม่" เพื่อเพิ่ม</p>
            )}

            {allShifts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allShifts.map((s) => {
                  const selected = selectedShiftIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleShift(s.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                        selected ? 'border-primary-400 bg-primary-50' : 'border-surface-200 hover:border-surface-300'
                      )}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color ?? '#22c55e' }} />
                      <span className="font-medium text-surface-900">{s.name}</span>
                      <span className="text-xs text-surface-500">{s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-primary-500" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create shift popover */}
            {showCreateShift && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowCreateShift(false)} />
                <div className="absolute right-0 top-full mt-2 z-30 w-72 p-3 rounded-xl border border-surface-200 bg-white shadow-xl animate-scale-in">
                  <p className="text-sm font-semibold text-surface-700 mb-2">สร้างกะใหม่</p>
                  <Input label="ชื่อกะ" value={newShiftName} onChange={(e) => setNewShiftName(e.target.value)} placeholder="เช่น กะเช้า, กะบ่าย" />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input label="เริ่ม" type="time" value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)} />
                    <Input label="สิ้นสุด" type="time" value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)} />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-surface-600 mb-1.5">สีประจำกะ</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {SHIFT_COLORS.map((c) => (
                        <button key={c.value} onClick={() => setNewShiftColor(c.value)} className={cn('w-7 h-7 rounded-lg transition-all', newShiftColor === c.value && 'ring-2 ring-offset-1 ring-surface-400')} style={{ backgroundColor: c.value }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateShift(false)} className="flex-1">ยกเลิก</Button>
                    <Button size="sm" onClick={createShift} loading={creatingShift} disabled={!newShiftName.trim()} className="flex-1">
                      <Plus className="w-4 h-4" /> บันทึก
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Actual check-in/out times (admin-only) */}
        {canManage && !multiDay && (
          <div className="p-3 rounded-xl border border-primary-200 bg-primary-50/50 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary-600" />
              <p className="text-xs font-semibold text-primary-700">เวลาเข้า-ออกงานจริง (แอดมินกรอก)</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-surface-500 mb-1 block">เวลาเข้างาน</label>
                <input
                  type="time"
                  value={actualCheckIn}
                  onChange={(e) => setActualCheckIn(e.target.value)}
                  className="input-base !py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 mb-1 block">เวลาออกงาน</label>
                <input
                  type="time"
                  value={actualCheckOut}
                  onChange={(e) => setActualCheckOut(e.target.value)}
                  className="input-base !py-2 text-sm"
                />
              </div>
            </div>
            {actualCheckIn && actualCheckOut && (
              <p className="text-xs text-surface-500">
                ชั่วโมงทำงาน: {(() => {
                  const [ih, im] = actualCheckIn.split(':').map(Number);
                  const [oh, om] = actualCheckOut.split(':').map(Number);
                  const mins = (oh * 60 + om) - (ih * 60 + im);
                  return mins > 0 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที` : '—';
                })()}
              </p>
            )}
            <Input
              value={actualNote}
              onChange={(e) => setActualNote(e.target.value)}
              placeholder="หมายเหตุ เช่น มาสาย, ออกก่อน"
              className="!py-2 text-sm"
            />
          </div>
        )}

        {/* Read-only display of actual times for non-admin */}
        {!canManage && !multiDay && existingAssignments[0]?.actual_check_in_time && (
          <div className="p-3 rounded-xl border border-surface-200 bg-surface-50 space-y-1">
            <p className="text-xs font-semibold text-surface-500">เวลาเข้า-ออกงานจริง</p>
            <div className="flex gap-4 text-sm">
              <span className="text-surface-700">เข้า: <strong className="text-surface-900">{new Date(existingAssignments[0].actual_check_in_time!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</strong></span>
              {existingAssignments[0].actual_check_out_time && (
                <span className="text-surface-700">ออก: <strong className="text-surface-900">{new Date(existingAssignments[0].actual_check_out_time!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</strong></span>
              )}
              {existingAssignments[0].actual_work_hours != null && (
                <span className="text-surface-700">รวม: <strong className="text-surface-900">{existingAssignments[0].actual_work_hours} ชม.</strong></span>
              )}
            </div>
            {existingAssignments[0].actual_note && (
              <p className="text-xs text-surface-500">หมายเหตุ: {existingAssignments[0].actual_note}</p>
            )}
          </div>
        )}

        {/* Collapsible note */}
        <div>
          <button onClick={() => setShowNote(s => !s)} className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 transition-colors">
            <ChevronDown className={cn('w-4 h-4 transition-transform', showNote && 'rotate-180')} />
            หมายเหตุ
            {note && <span className="text-surface-400 text-xs">(มีข้อความ)</span>}
          </button>
          {showNote && (
            <div className="mt-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เปลี่ยนกะชั่วคราว" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {existingAssignments.length > 0 && !multiDay && canManage && (
            <Button variant="ghost" onClick={remove} loading={loading} className="text-error-600">
              <Trash2 className="w-4 h-4" /> ลบ
            </Button>
          )}
          {canManage ? (
            <>
              <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
              <Button onClick={save} loading={loading} className="flex-1">
                {multiDay ? `บันทึก ${dates.length} วัน` : 'บันทึก'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose} className="flex-1">ปิด</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============ SHIFT MANAGEMENT TAB ============
function ShiftManagementTab({ shifts, branches, onReload }: { shifts: Shift[]; branches: BranchOption[]; onReload: () => void }) {
  const [showEdit, setShowEdit] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const grouped = useMemo(() => {
    const m: Record<string, Shift[]> = {};
    shifts.forEach((s) => {
      const key = s.branch_id ?? 'none';
      if (!m[key]) m[key] = [];
      m[key].push(s);
    });
    return m;
  }, [shifts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-surface-900">จัดการกะทำงาน</h3>
          <p className="text-sm text-surface-500">ตั้งกะของแต่ละสาขาแยกกันได้</p>
        </div>
        <Button size="sm" onClick={() => { setEditingShift(null); setShowEdit(true); }}>
          <Plus className="w-4 h-4" /> เพิ่มกะ
        </Button>
      </div>

      {shifts.length === 0 ? (
        <EmptyState icon={<Settings className="w-8 h-8" />} title="ยังไม่มีกะทำงาน" description="เพิ่มกะ เช่น กะเช้า กะบ่าย กะดึก และกำหนดเวลาเข้า-ออก" />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([branchKey, branchShifts]) => {
            const branchName = branchKey === 'none' ? 'ไม่ระบุสาขา' : (branches.find((b) => b.id === branchKey)?.name ?? '-');
            return (
              <Card key={branchKey} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-primary-500" />
                  <h4 className="text-sm font-semibold text-surface-700">{branchName}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {branchShifts.map((s) => (
                    <div key={s.id} className={cn('p-3 rounded-xl border transition-colors', s.is_active ? 'border-surface-200' : 'border-surface-100 bg-surface-50/50 opacity-60')}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color ?? '#22c55e' }} />
                          <span className="font-medium text-sm text-surface-900 truncate">{s.name}</span>
                          {!s.is_active && <Badge variant="default" className="shrink-0">ปิดใช้งาน</Badge>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditingShift(s); setShowEdit(true); }} className="p-1 rounded-lg hover:bg-surface-100 transition-colors">
                            <Edit2 className="w-3.5 h-3.5 text-surface-400" />
                          </button>
                          <button onClick={() => setDeletingShift(s)} className="p-1 rounded-lg hover:bg-error-50 text-error-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-surface-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showEdit && (
        <ShiftEditModal
          shift={editingShift}
          branches={branches}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onReload(); }}
        />
      )}

      <ConfirmDialog
        open={!!deletingShift}
        onClose={() => setDeletingShift(null)}
        onConfirm={async () => {
          if (!deletingShift) return;
          setDeleteLoading(true);
          await supabase.from('shifts').delete().eq('id', deletingShift.id);
          setDeleteLoading(false);
          setDeletingShift(null);
          onReload();
        }}
        title="ลบกะ"
        confirmLabel="ลบกะ"
        loading={deleteLoading}
      >
        ต้องการลบกะ "{deletingShift?.name}" ใช่ไหม? การมอบหมายกะที่ผ่านมาจะไม่ได้รับผลกระทบ แต่จะไม่สามารถเลือกกะนี้สำหรับการมอบหมายใหม่ได้อีก
      </ConfirmDialog>
    </div>
  );
}

function ShiftEditModal({ shift, branches, onClose, onSaved }: { shift: Shift | null; branches: BranchOption[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [branchId, setBranchId] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (shift) {
      setName(shift.name);
      setStartTime(shift.start_time.slice(0, 5));
      setEndTime(shift.end_time.slice(0, 5));
      setBranchId(shift.branch_id ?? '');
      setColor(shift.color ?? '#22c55e');
      setIsActive(shift.is_active);
    } else {
      setName(''); setStartTime('08:00'); setEndTime('17:00'); setBranchId(''); setColor('#22c55e'); setIsActive(true);
    }
  }, [shift]);

  async function save() {
    if (!name.trim()) { setError('กรุณากรอกชื่อกะ'); return; }
    setLoading(true); setError('');
    const data = { name, start_time: startTime, end_time: endTime, branch_id: branchId || null, color, is_active: isActive };
    if (shift) {
      const { error } = await supabase.from('shifts').update(data).eq('id', shift.id);
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.from('shifts').insert(data);
      if (error) { setError(error.message); setLoading(false); return; }
    }
    setLoading(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={shift ? 'แก้ไขกะ' : 'เพิ่มกะใหม่'} size="sm">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-error-50 text-error-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
        <Input label="ชื่อกะ" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น กะเช้า, กะบ่าย, กะดึก" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="เวลาเข้า" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="เวลาออก" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <Select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">— ทุกสาขา —</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <div>
          <p className="text-sm font-medium text-surface-700 mb-2">สีกะ</p>
          <div className="flex gap-2">
            {SHIFT_COLORS.map((c) => (
              <button key={c.value} onClick={() => setColor(c.value)} className={cn('w-8 h-8 rounded-lg transition-all', color === c.value && 'ring-2 ring-offset-2 ring-surface-400')} style={{ backgroundColor: c.value }} />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
          เปิดใช้งานกะนี้
        </label>
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ LEAVE REQUEST MODAL ============
function LeaveRequestModal({ open, onClose, profileId, onCreated, defaultDate }: { open: boolean; onClose: () => void; profileId?: string; onCreated: () => void; defaultDate?: string }) {
  const [type, setType] = useState('sick');
  const [startDate, setStartDate] = useState(defaultDate ?? todayISO());
  const [endDate, setEndDate] = useState(defaultDate ?? todayISO());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && defaultDate) { setStartDate(defaultDate); setEndDate(defaultDate); }
  }, [open, defaultDate]);

  async function submit() {
    if (!profileId) return;
    setLoading(true);
    const { error } = await supabase.from('leave_requests').insert({
      profile_id: profileId, leave_type: type, start_date: startDate, end_date: endDate, reason, status: 'pending',
    });
    if (!error) { onClose(); onCreated(); setReason(''); }
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="ขอลา" size="sm">
      <div className="space-y-4">
        <Select label="ประเภทการลา" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="sick">ลาป่วย</option>
          <option value="personal">ลากิจ</option>
          <option value="vacation">ลาพักร้อน</option>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="วันที่เริ่ม" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="วันที่สิ้นสุด" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Textarea label="เหตุผล" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="p-3 rounded-xl bg-warning-50 text-xs text-warning-700">
          คำขอลาจะส่งให้ผู้ดูแลระบบ (Super Admin) เป็นผู้พิจารณาอนุมัติ
        </div>
        <Button onClick={submit} loading={loading} className="w-full">ส่งคำขอ</Button>
      </div>
    </Modal>
  );
}

// ============ OT REQUEST MODAL ============
function OTRequestModal({ open, onClose, profileId, branches, onCreated }: { open: boolean; onClose: () => void; profileId?: string; branches: { id: string; name: string }[]; onCreated: () => void }) {
  const [otDate, setOtDate] = useState(todayISO());
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('20:00');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (branches.length > 0 && !branchId) setBranchId(branches[0].id); }, [branches, branchId]);

  async function submit() {
    if (!profileId) return;
    setLoading(true);
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const { error } = await supabase.from('ot_requests').insert({
      profile_id: profileId, ot_date: otDate, start_time: startTime, end_time: endTime, ot_hours: hours, branch_id: branchId || null, reason, status: 'pending',
    });
    if (!error) { onClose(); onCreated(); setReason(''); }
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="ขอ OT" size="sm">
      <div className="space-y-4">
        <Input label="วันที่" type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="เวลาเริ่ม" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="เวลาสิ้นสุด" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        {branches.length > 0 && (
          <Select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <Textarea label="เหตุผล" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">ส่งคำขอ</Button>
      </div>
    </Modal>
  );
}

// ============ PERSONAL DAY-OFF MODAL ============
function DayOffModal({ open, onClose, profileId, dayOffs, onCreated }: { open: boolean; onClose: () => void; profileId?: string; dayOffs: PersonalDayOff[]; onCreated: () => void }) {
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function addDayOff() {
    if (!profileId) return;
    setLoading(true);
    const { error } = await supabase.from('personal_day_offs').insert({
      profile_id: profileId,
      day_of_week: Number(dayOfWeek),
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
      note: note || null,
    });
    if (!error) { setNote(''); setEffectiveTo(''); onCreated(); }
    setLoading(false);
  }

  async function deleteDayOff(id: string) {
    await supabase.from('personal_day_offs').delete().eq('id', id);
    onCreated();
  }

  async function endDayOff(id: string) {
    await supabase.from('personal_day_offs').update({ effective_to: todayISO() }).eq('id', id);
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="ตั้งวันหยุดประจำสัปดาห์" size="md">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-success-50 text-xs text-success-700">
          วันหยุดประจำตัวไม่ต้องขออนุมัติ — ตั้งเองได้เลย แต่ละคนตั้งไม่จำเป็นต้องตรงกัน ปรับเปลี่ยนได้ตามช่วงเวลา
        </div>

        {dayOffs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-700">วันหยุดที่ตั้งไว้</p>
            {dayOffs.map((doff) => (
              <div key={doff.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-success-600" />
                  <div>
                    <p className="text-sm font-medium text-surface-900">
                      หยุด{DAY_NAMES[doff.day_of_week]}
                    </p>
                    <p className="text-xs text-surface-400">
                      ตั้งแต่ {formatDate(doff.effective_from)}
                      {doff.effective_to ? ` ถึง ${formatDate(doff.effective_to)}` : ' ถึงปัจจุบัน'}
                    </p>
                    {doff.note && <p className="text-xs text-surface-400">{doff.note}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!doff.effective_to && (
                    <button onClick={() => endDayOff(doff.id)} className="p-1.5 rounded-lg hover:bg-warning-100 text-warning-600 transition-colors" title="หยุดใช้งาน">
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteDayOff(doff.id)} className="p-1.5 rounded-lg hover:bg-error-100 text-error-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-surface-200">
          <p className="text-sm font-medium text-surface-700">เพิ่มวันหยุดใหม่</p>
          <Select label="วันในสัปดาห์" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="เริ่มตั้งแต่" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            <Input label="ถึง (ไม่ระบุ = ต่อเนื่อง)" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </div>
          <Input label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น หยุดชั่วคราวเปลี่ยนเป็นวันพุธ" />
          <Button onClick={addDayOff} loading={loading} className="w-full" size="sm">
            <Plus className="w-4 h-4" /> เพิ่มวันหยุด
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ HISTORY EDIT MODAL (Super Admin only, with shift-range validation) ============
function HistoryEditModal({ record, actorProfileId, onClose, onSaved }: {
  record: AttendanceRecord;
  actorProfileId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftInfo, setShiftInfo] = useState<{ name: string; start_time: string; end_time: string } | null>(null);

  useEffect(() => {
    if (!record) return;
    setCheckIn(record.check_in_time ? toLocalDateTimeInputAtt(record.check_in_time) : '');
    setCheckOut(record.check_out_time ? toLocalDateTimeInputAtt(record.check_out_time) : '');
    setNote('');
    setError(null);
    // Fetch shift assignment for this day to get shift range
    (async () => {
      if (!record.check_in_time) return;
      const dateStr = record.check_in_time.split('T')[0];
      const { data } = await supabase
        .from('shift_assignments')
        .select('shifts(name, start_time, end_time)')
        .eq('profile_id', record.profile_id)
        .eq('assignment_date', dateStr)
        .maybeSingle();
      if (data?.shifts) {
        setShiftInfo({ name: data.shifts.name, start_time: data.shifts.start_time, end_time: data.shifts.end_time });
      }
    })();
  }, [record]);

  if (!record) return null;

  const prevCheckIn = record.check_in_time;
  const prevCheckOut = record.check_out_time;
  const prevWorkHours = record.work_hours;

  function validateShiftRange(timeStr: string, type: 'in' | 'out'): string | null {
    if (!shiftInfo || !timeStr) return null;
    const d = new Date(timeStr);
    const dateStr = (record.check_in_time ?? new Date().toISOString()).split('T')[0];

    // Parse shift start/end as full datetime on the same date
    const [sh, sm] = shiftInfo.start_time.split(':').map(Number);
    const [eh, em] = shiftInfo.end_time.split(':').map(Number);
    const shiftStart = new Date(dateStr + 'T00:00:00');
    shiftStart.setHours(sh, sm, 0, 0);
    const shiftEnd = new Date(dateStr + 'T00:00:00');
    shiftEnd.setHours(eh, em, 0, 0);

    // Handle overnight shifts (end < start means next day)
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const inputTime = new Date(timeStr);
    // Allow a 1-hour grace window outside shift for flexibility
    const graceMs = 60 * 60 * 1000;
    const minAllowed = type === 'in' ? shiftStart.getTime() - graceMs : shiftStart.getTime() - graceMs;
    const maxAllowed = type === 'in' ? shiftEnd.getTime() + graceMs : shiftEnd.getTime() + graceMs;

    if (inputTime.getTime() < minAllowed || inputTime.getTime() > maxAllowed) {
      return `เวลา${type === 'in' ? 'เข้า' : 'ออก'}อยู่นอกช่วงกะ "${shiftInfo.name}" (${shiftInfo.start_time}-${shiftInfo.end_time}) กรุณาแก้ไขให้อยู่ในช่วงกะ`;
    }
    return null;
  }

  async function save() {
    setError(null);
    if (!record) return;

    // Validate shift range
    if (checkIn) {
      const err = validateShiftRange(checkIn, 'in');
      if (err) { setError(err); return; }
    }
    if (checkOut) {
      const err = validateShiftRange(checkOut, 'out');
      if (err) { setError(err); return; }
    }

    setLoading(true);
    try {
      const newCheckIn = checkIn ? new Date(checkIn).toISOString() : null;
      const newCheckOut = checkOut ? new Date(checkOut).toISOString() : null;

      let newWorkHours: number | null = null;
      if (newCheckIn && newCheckOut) {
        const diff = (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) / (1000 * 60 * 60);
        newWorkHours = Math.round(diff * 100) / 100;
      }

      const action = newCheckIn !== prevCheckIn && newCheckOut !== prevCheckOut ? 'edit_both'
        : newCheckIn !== prevCheckIn ? 'edit_checkin'
        : 'edit_checkout';

      const { error: updateError } = await supabase.from('attendance').update({
        check_in_time: newCheckIn,
        check_out_time: newCheckOut,
        work_hours: newWorkHours,
        status: 'present',
      }).eq('id', record.id);

      if (updateError) throw new Error(updateError.message);

      await supabase.from('attendance_audit_logs').insert({
        attendance_id: record.id,
        profile_id: record.profile_id,
        actor_profile_id: actorProfileId ?? null,
        action,
        previous_check_in: prevCheckIn,
        previous_check_out: prevCheckOut,
        new_check_in: newCheckIn,
        new_check_out: newCheckOut,
        previous_work_hours: prevWorkHours,
        new_work_hours: newWorkHours,
        note: note || null,
      });

      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'แก้ไขไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="แก้ไขเวลาเช็คอิน/เช็คเอาต์ (ประวัติ)" size="md">
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-200 flex items-center gap-2 text-sm text-error-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="p-3 rounded-xl bg-warning-50 border border-warning-200">
          <p className="text-xs text-warning-700">สิทธิ์นี้สำหรับผู้ดูแลระบบเท่านั้น — การแก้ไขจะถูกบันทึกในประวัติการแก้ไข</p>
          {shiftInfo && (
            <p className="text-xs text-surface-500 mt-1">กะ: {shiftInfo.name} ({shiftInfo.start_time}-{shiftInfo.end_time}) — เวลาต้องอยู่ในช่วงกะนี้</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เวลาเช็คอิน</label>
            <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เวลาเช็คเอาต์</label>
            <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input-base" />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-50">
          <p className="text-sm text-surface-500">เวลาเดิม: {prevCheckIn ? fmtTimeDisplayAtt(prevCheckIn) : '-'} → {prevCheckOut ? fmtTimeDisplayAtt(prevCheckOut) : '-'}</p>
          {checkIn && checkOut && (
            <p className="text-sm mt-1">ชั่วโมงทำงานใหม่: <span className="font-bold text-primary-600">{((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} ชม.</span></p>
          )}
        </div>
        <Textarea label="เหตุผลในการแก้ไข" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น พนักงานลืมเช็คอิน, เช็คอินผิดเวลา..." />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ HISTORY DELETE MODAL (Hard Delete with confirmation) ============
function HistoryDeleteModal({ record, actorProfileId, onClose, onSaved }: {
  record: AttendanceRecord;
  actorProfileId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!record) return null;

  async function confirmDelete() {
    setLoading(true);
    try {
      // Log the deletion first (before the row is gone)
      const { error: auditError } = await supabase.from('attendance_audit_logs').insert({
        attendance_id: record.id,
        profile_id: record.profile_id,
        actor_profile_id: actorProfileId ?? null,
        action: 'delete',
        previous_check_in: record.check_in_time,
        previous_check_out: record.check_out_time,
        previous_work_hours: record.work_hours,
        new_check_in: null,
        new_check_out: null,
        new_work_hours: null,
        note: 'Hard delete from history tab',
      });

      if (auditError) {
        alert('บันทึก audit log ไม่สำเร็จ: ' + auditError.message);
        return;
      }

      const { error: deleteError, count } = await supabase
        .from('attendance')
        .delete()
        .eq('id', record.id);

      if (deleteError) {
        alert('ลบไม่สำเร็จ: ' + deleteError.message);
        return;
      }

      if (count === 0) {
        alert('ลบไม่สำเร็จ: ไม่มีสิทธิ์ลบรายการนี้ (อาจเป็นปัญหานโยบาย RLS)');
        return;
      }

      onSaved();
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + (err.message ?? 'unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirmDelete}
      title="ยืนยันการลบ"
      confirmLabel="ลบถาวร"
      loading={loading}
    >
      <p>จะลบรายการเช็คอินวันที่ <span className="font-medium">{record.check_in_time ? formatDate(record.check_in_time) : '-'}</span>
        {record.profiles && <span> ของ <span className="font-medium">{record.profiles.display_name ?? record.profiles.first_name ?? record.profiles.email}</span></span>}
        {' '}ออกจากระบบอย่างถาวร (ไม่สามารถกู้คืนได้)
      </p>
      <p className="text-xs text-surface-400">การลบจะถูกบันทึกใน audit log เพื่อตรวจสอบย้อนหลัง</p>
    </ConfirmDialog>
  );
}

function toLocalDateTimeInputAtt(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fmtTimeDisplayAtt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
