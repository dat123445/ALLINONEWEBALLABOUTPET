import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, Input, Button, Badge, Avatar, Spinner } from '@/components/ui';
import { ROLE_LABELS, type Role, isAdmin, canManageSalary } from '@/types/permissions';
import { formatCurrency, formatDate, cn } from '@/lib/format';
import { CheckCircle2, AlertCircle, Mail, Phone, Calendar, Building2, Shield, ShieldCheck, ShieldAlert, Clock, UserCheck, X, Briefcase, Plus, Check, Wallet } from 'lucide-react';

type ProfileWithBranches = {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: Role[];
  employment_type: string;
  is_active: boolean;
  profile_completed: boolean;
  start_date: string | null;
  position: string | null;
  created_at: string;
  branch_members: { id: string; branch_id: string; is_primary: boolean; branches: { id: string; name: string } | null }[];
};

type BranchOption = { id: string; name: string };

export function UserDetailPanel({ user, open, onClose, onUpdated }: {
  user: ProfileWithBranches | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { profile: currentUser } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editRoles, setEditRoles] = useState<Role[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [savingBranches, setSavingBranches] = useState(false);

  // Salary settings
  const [salarySettings, setSalarySettings] = useState<{ profile_id: string; employment_type: string; monthly_salary: number; daily_wage: number; hourly_rate: number; ot_rate: number } | null>(null);
  const [editEmploymentType, setEditEmploymentType] = useState('daily');
  const [editMonthlySalary, setEditMonthlySalary] = useState('');
  const [editDailyWage, setEditDailyWage] = useState('');
  const [editOtRate, setEditOtRate] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
    setAllBranches(data as BranchOption[] ?? []);
  }, []);

  useEffect(() => {
    if (user) {
      setEditDisplayName(user.display_name ?? '');
      setEditPhone(user.phone ?? '');
      setEditPosition(user.position ?? '');
      setEditRoles(user.roles ?? []);
      setEditIsActive(user.is_active);
      setSelectedBranchIds(user.branch_members?.map((bm) => bm.branch_id).filter(Boolean) ?? []);
    }
    setEditMode(false);
    setToast(null);
  }, [user, open]);

  useEffect(() => { if (open) loadBranches(); }, [open, loadBranches]);

  const loadSalarySettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('salary_settings').select('*').eq('profile_id', user.id).maybeSingle();
    setSalarySettings(data as any);
    if (data) {
      setEditEmploymentType((data as any).employment_type ?? 'daily');
      setEditMonthlySalary(String((data as any).monthly_salary ?? ''));
      setEditDailyWage(String((data as any).daily_wage ?? ''));
      setEditOtRate(String((data as any).ot_rate ?? ''));
    }
  }, [user]);

  useEffect(() => { if (open) loadSalarySettings(); }, [open, loadSalarySettings]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  async function handleSaveSalary() {
    if (!user) return;
    setSavingSalary(true);
    const payload = {
      profile_id: user.id,
      employment_type: editEmploymentType,
      monthly_salary: Number(editMonthlySalary) || 0,
      daily_wage: Number(editDailyWage) || 0,
      hourly_rate: editEmploymentType === 'daily' && Number(editDailyWage) > 0 ? Number(editDailyWage) / 9 : 0,
      ot_rate: Number(editOtRate) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('salary_settings').upsert(payload, { onConflict: 'profile_id' });
    setSavingSalary(false);
    if (error) {
      setToast({ type: 'error', msg: `บันทึกไม่สำเร็จ: ${error.message}` });
    } else {
      setToast({ type: 'success', msg: 'บันทึกการตั้งค่าเงินเดือนสำเร็จ' });
      loadSalarySettings();
    }
  }

  if (!user) return null;

  const canManage = currentUser ? isAdmin((currentUser.roles ?? []) as Role[]) : false;
  const canViewSalary = currentUser ? canManageSalary((currentUser.roles ?? []) as Role[]) : false;
  const branchNames = user.branch_members?.map((bm) => bm.branches?.name).filter(Boolean) ?? [];
  const isPending = user.roles.length === 0;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: editDisplayName || null,
      phone: editPhone || null,
      position: editPosition || null,
      roles: editRoles,
      is_active: editIsActive,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
    if (error) {
      setToast({ type: 'error', msg: `บันทึกไม่สำเร็จ: ${error.message}` });
    } else {
      setToast({ type: 'success', msg: 'แก้ไขข้อมูลผู้ใช้สำเร็จ' });
      setEditMode(false);
      onUpdated();
    }
  }

  async function handleSaveBranches() {
    if (!user) return;
    setSavingBranches(true);
    const existing = user.branch_members ?? [];
    const toAdd = selectedBranchIds.filter((id) => !existing.some((bm) => bm.branch_id === id));
    const toRemove = existing.filter((bm) => !selectedBranchIds.includes(bm.branch_id)).map((bm) => bm.id);

    let hadError = false;
    if (toRemove.length > 0) {
      const { error } = await supabase.from('branch_members').delete().in('id', toRemove);
      if (error) hadError = true;
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map((branchId) => ({ profile_id: user.id, branch_id: branchId, is_primary: false }));
      const { error } = await supabase.from('branch_members').insert(rows);
      if (error) hadError = true;
    }
    setSavingBranches(false);
    if (hadError) {
      setToast({ type: 'error', msg: 'บันทึกสาขาไม่สำเร็จ กรุณาลองอีกครั้ง' });
    } else {
      setToast({ type: 'success', msg: 'แก้ไขสาขาที่สังกัดสำเร็จ' });
      onUpdated();
    }
  }

  function toggleRole(role: Role) {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((prev) => prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]);
  }

  return (
    <Modal open={open} onClose={onClose} title="รายละเอียดผู้ใช้" size="lg">
      <div className="space-y-5">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar name={user.display_name ?? user.email} src={user.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-surface-900">{user.display_name ?? 'ไม่ระบุชื่อ'}</h3>
            <p className="text-sm text-surface-400 truncate">{user.email}</p>
            {/* Current roles — only show roles the user actually has */}
            <div className="flex flex-wrap gap-2 mt-2">
              {isPending ? (
                <Badge variant="warning"><Clock className="w-3 h-3" /> รออนุมัติ</Badge>
              ) : (
                user.roles.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap',
                      isAdmin([r]) ? 'bg-error-100 text-error-700' : 'bg-primary-100 text-primary-700'
                    )}
                  >
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))
              )}
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap',
                user.is_active ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-500')}>
                {user.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
              </span>
            </div>
          </div>
          {canManage && !editMode && (
            <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>แก้ไข</Button>
          )}
        </div>

        {/* View mode */}
        {!editMode ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="อีเมล" value={user.email} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="เบอร์โทร" value={user.phone ?? '-'} />
              <InfoRow icon={<Briefcase className="w-4 h-4" />} label="ตำแหน่ง" value={user.position ?? '-'} />
              <InfoRow icon={<Building2 className="w-4 h-4" />} label="สาขา" value={branchNames.length > 0 ? branchNames.join(', ') : 'ไม่สังกัดสาขา'} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="วันที่เริ่มงาน" value={user.start_date ? formatDate(user.start_date) : '-'} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="วันที่สร้างบัญชี" value={formatDate(user.created_at)} />
            </div>

            {/* All roles section — show all available roles, highlight ones the user has */}
            <div className="p-4 rounded-xl bg-surface-50">
              <p className="text-xs font-medium text-surface-400 mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> สิทธิ์ทั้งหมด
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                  const hasRole = user.roles.includes(r);
                  return (
                    <span
                      key={r}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                        hasRole
                          ? (isAdmin([r])
                              ? 'bg-error-600 text-white shadow-sm'
                              : 'bg-primary-600 text-white shadow-sm')
                          : 'bg-surface-100 text-surface-400'
                      )}
                    >
                      {hasRole && <Check className="w-3.5 h-3.5 shrink-0" />}
                      {ROLE_LABELS[r]}
                    </span>
                  );
                })}
                {user.roles.length === 0 && (
                  <span className="text-sm text-surface-400">ยังไม่ได้กำหนดสิทธิ์</span>
                )}
              </div>
            </div>

            {/* Branch assignment section */}
            {canManage && (
              <div className="p-4 rounded-xl bg-surface-50">
                <p className="text-xs font-medium text-surface-400 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> สาขาที่สังกัด
                </p>
                <div className="flex flex-wrap gap-2">
                  {branchNames.length > 0 ? branchNames.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-100 text-primary-700 whitespace-nowrap">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      {name}
                    </span>
                  )) : <span className="text-sm text-surface-400">ไม่สังกัดสาขา</span>}
                </div>
              </div>
            )}

            {/* Salary settings section — hidden from super_admin */}
            {canManage && canViewSalary && (
              <div className="p-4 rounded-xl bg-surface-50">
                <p className="text-xs font-medium text-surface-400 mb-3 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> การตั้งค่าเงินเดือน
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">ประเภทค่าจ้าง</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditEmploymentType('daily')}
                        className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all', editEmploymentType === 'daily' ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500')}
                      >
                        รายวัน
                      </button>
                      <button
                        onClick={() => setEditEmploymentType('monthly')}
                        className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all', editEmploymentType === 'monthly' ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500')}
                      >
                        ประจำ (รายเดือน)
                      </button>
                    </div>
                  </div>
                  {editEmploymentType === 'daily' ? (
                    <Input label="ค่าจ้างต่อวัน (บาท)" type="number" value={editDailyWage} onChange={(e) => setEditDailyWage(e.target.value)} placeholder="400" />
                  ) : (
                    <Input label="เงินเดือนฐาน (บาท/เดือน)" type="number" value={editMonthlySalary} onChange={(e) => setEditMonthlySalary(e.target.value)} placeholder="15000" />
                  )}
                  <Input label="ค่า OT ต่อชั่วโมง (บาท)" type="number" value={editOtRate} onChange={(e) => setEditOtRate(e.target.value)} placeholder="50" />
                  <Button size="sm" variant="secondary" onClick={handleSaveSalary} loading={savingSalary}>
                    บันทึกการตั้งค่าเงินเดือน
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-surface-50">
              <p className="text-xs font-medium text-surface-400 mb-2">สถานะโปรไฟล์</p>
              <div className="flex items-center gap-2">
                <Badge variant={user.profile_completed ? 'success' : 'warning'}>
                  {user.profile_completed ? 'กรอกข้อมูลแล้ว' : 'ยังไม่กรอกข้อมูล'}
                </Badge>
                <Badge variant={user.employment_type === 'monthly' ? 'primary' : 'default'}>
                  {user.employment_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                </Badge>
              </div>
            </div>
          </>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <Input label="ชื่อที่แสดง" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="เบอร์โทร" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <Input label="ตำแหน่ง" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
            </div>

            {/* Role badges — wrap with consistent gap, highlight active roles */}
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">สิทธิ์ (Roles)</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                  const hasRole = editRoles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRole(r)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                        hasRole
                          ? (isAdmin([r])
                              ? 'bg-error-600 text-white shadow-sm'
                              : 'bg-primary-600 text-white shadow-sm')
                          : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                      )}
                    >
                      {hasRole && <Check className="w-3.5 h-3.5 shrink-0" />}
                      {ROLE_LABELS[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Branch assignment editor */}
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">สาขาที่สังกัด (เลือกได้หลายสาขา)</p>
              <div className="flex flex-wrap gap-2">
                {allBranches.map((b) => {
                  const isSelected = selectedBranchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBranch(b.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                        isSelected
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                      )}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Plus className="w-3.5 h-3.5 shrink-0" />}
                      {b.name}
                    </button>
                  );
                })}
                {allBranches.length === 0 && <span className="text-sm text-surface-400">ยังไม่มีสาขาในระบบ</span>}
              </div>
              <Button size="sm" variant="secondary" onClick={handleSaveBranches} loading={savingBranches} className="mt-3">
                บันทึกสาขาที่สังกัด
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">สถานะ</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditIsActive(true)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap', editIsActive ? 'bg-success-600 text-white' : 'bg-surface-100 text-surface-500')}
                >
                  <ShieldCheck className="w-4 h-4" /> ใช้งานอยู่
                </button>
                <button
                  onClick={() => setEditIsActive(false)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap', !editIsActive ? 'bg-error-600 text-white' : 'bg-surface-100 text-surface-500')}
                >
                  <ShieldAlert className="w-4 h-4" /> ปิดใช้งาน
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditMode(false)} className="flex-1">ยกเลิก</Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">บันทึก</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-surface-50">
      <div className="flex items-center gap-2 text-xs text-surface-400 mb-1">{icon} {label}</div>
      <p className="text-sm font-medium text-surface-700">{value}</p>
    </div>
  );
}
