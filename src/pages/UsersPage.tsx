import { useEffect, useState, useCallback, useRef } from 'react';
import { UserPlus, Trash2, Search, CheckCircle, XCircle, Users as UsersIcon, ShieldCheck, ShieldAlert, Clock, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Select, Tabs, StatCard, EmptyState, Spinner, Avatar } from '@/components/ui';
import { ROLE_LABELS, type Role, isAdmin } from '@/types/permissions';
import { cn } from '@/lib/format';
import { UserDetailPanel } from '@/components/UserDetailPanel';

type ProfileWithBranches = Profile & {
  branch_members: { branches: { id: string; name: string } | null }[];
};

type BulkUser = {
  id: string;
  email: string;
  password: string;
  display_name: string;
  roles: Role[];
  employment_type: string;
  position: string;
  phone: string;
};

let _uidCounter = 0;
function nextId() { _uidCounter += 1; return `bu-${_uidCounter}`; }
function emptyUser(): BulkUser {
  return { id: nextId(), email: '', password: '', display_name: '', roles: ['employee'], employment_type: 'daily', position: '', phone: '' };
}

type CreationResult = {
  email: string;
  success: boolean;
  error?: string;
};

export function UsersPage() {
  const { profile, session } = useAuth();
  const [users, setUsers] = useState<ProfileWithBranches[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active');
  const [showBulk, setShowBulk] = useState(false);
  const [results, setResults] = useState<CreationResult[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ProfileWithBranches | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const roles = (profile?.roles ?? []) as Role[];
  const canManage = isAdmin(roles);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, branch_members(branches(id, name))')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data as ProfileWithBranches[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingUsers = users.filter((u) => u.roles.length === 0);
  const activeUsers = users.filter((u) => u.roles.length > 0);

  const tabFiltered = tab === 'pending' ? pendingUsers : activeUsers;

  const filtered = tabFiltered.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.position ?? '').toLowerCase().includes(q) ||
      u.roles.some((r) => ROLE_LABELS[r]?.toLowerCase().includes(q));
  });

  const activeCount = activeUsers.filter((u) => u.is_active).length;
  const adminCount = activeUsers.filter((u) => isAdmin((u.roles ?? []) as Role[])).length;
  const pendingCount = pendingUsers.length;

  async function toggleActive(user: Profile) {
    setUpdatingId(user.id);
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    await load();
    setUpdatingId(null);
  }

  async function updateRoles(user: Profile, newRoles: Role[]) {
    setUpdatingId(user.id);
    await supabase.from('profiles').update({ roles: newRoles }).eq('id', user.id);
    await load();
    setUpdatingId(null);
  }

  async function approveUser(user: Profile, role: Role) {
    setUpdatingId(user.id);
    await supabase.from('profiles').update({ roles: [role] }).eq('id', user.id);
    await load();
    setUpdatingId(null);
  }

  async function createUsers(usersToCreate: BulkUser[]) {
    if (!session?.access_token) return;
    setShowBulk(false);
    setLoading(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-users`;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ users: usersToCreate }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResults([{ email: '-', success: false, error: data.error ?? 'เกิดข้อผิดพลาด' }]);
      } else {
        setResults(data.results ?? []);
      }
      setShowResults(true);
      await load();
    } catch {
      setResults([{ email: '-', success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }]);
      setShowResults(true);
    }
    setLoading(false);
  }

  if (loading && users.length === 0) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={users.length} icon={<UsersIcon className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="ใช้งานอยู่" value={activeCount} icon={<CheckCircle className="w-5 h-5" />} color="success" delay="animate-delay-200" />
        <StatCard label="รออนุมัติ" value={pendingCount} icon={<Clock className="w-5 h-5" />} color="warning" delay="animate-delay-300" />
        <StatCard label="แอดมิน" value={adminCount} icon={<ShieldCheck className="w-5 h-5" />} color="error" delay="animate-delay-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs
          tabs={[
            { key: 'active', label: 'ผู้ใช้ที่ใช้งาน', count: activeUsers.length },
            { key: 'pending', label: 'รออนุมัติ', count: pendingCount },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={() => setShowBulk(true)} size="sm">
              <UserPlus className="w-4 h-4" /> สร้างบัญชีล่วงหน้า
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          className="input-base pl-11"
          placeholder="ค้นหาด้วยชื่อ, อีเมล, ตำแหน่ง..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tab === 'pending' && pendingCount > 0 && (
        <div className="p-4 rounded-xl bg-warning-50 border border-warning-200">
          <p className="text-sm text-warning-700">
            มี {pendingCount} บัญชีรอการอนุมัติ เลือกตำแหน่งให้ผู้ใช้เพื่อเปิดใช้งาน
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? <Clock className="w-8 h-8" /> : <UsersIcon className="w-8 h-8" />}
          title={tab === 'pending' ? 'ไม่มีบัญชีรออนุมัติ' : 'ไม่พบผู้ใช้'}
          description={tab === 'pending' ? 'ผู้สมัครใหม่ที่ยังไม่ได้กำหนดสิทธิ์จะแสดงที่นี่' : 'ลองเปลี่ยนคำค้นหา'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">ตำแหน่ง</th>
                  <th className="text-left px-4 py-3 font-medium">สิทธิ์</th>
                  <th className="text-center px-4 py-3 font-medium">สถานะ</th>
                  {canManage && <th className="text-center px-4 py-3 font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map((u) => (
                  <tr key={u.id} className={cn('hover:bg-surface-50 transition-colors cursor-pointer', u.roles.length === 0 && 'bg-warning-50/50')} onClick={() => { setSelectedUser(u); setShowDetail(true); }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.display_name ?? u.email} src={u.avatar_url} size="sm" />
                        <div>
                          <p className="font-medium text-surface-900">{u.display_name ?? 'ไม่ระบุ'}</p>
                          <p className="text-xs text-surface-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-500 hidden md:table-cell">{u.position ?? '-'}</td>
                    <td className="px-4 py-3">
                      {u.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} variant={isAdmin([r]) ? 'error' : 'info'}>
                              {ROLE_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="warning"><Clock className="w-3 h-3" /> รออนุมัติ</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={u.is_active ? 'success' : 'default'}>
                        {u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        {u.roles.length === 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <select
                              className="text-xs rounded-lg border border-surface-200 bg-surface-50 px-2 py-1.5 text-surface-700 cursor-pointer"
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (e.target.value) approveUser(u, e.target.value as Role);
                              }}
                              disabled={updatingId === u.id}
                            >
                              <option value="">เลือกตำแหน่ง...</option>
                              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            <UserCheck className="w-4 h-4 text-surface-400" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <select
                              className="text-xs rounded-lg border border-surface-200 bg-surface-50 px-2 py-1 text-surface-700 cursor-pointer"
                              value={u.roles[0]}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateRoles(u, [e.target.value as Role])}
                              disabled={updatingId === u.id}
                            >
                              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
                              disabled={updatingId === u.id}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                u.is_active
                                  ? 'text-error-500 hover:bg-error-50'
                                  : 'text-success-500 hover:bg-success-50'
                              )}
                              title={u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            >
                              {u.is_active ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <BulkCreateModal open={showBulk} onClose={() => setShowBulk(false)} onSubmit={createUsers} />
      <ResultsModal open={showResults} onClose={() => setShowResults(false)} results={results ?? []} />
      <UserDetailPanel user={selectedUser} open={showDetail} onClose={() => setShowDetail(false)} onUpdated={load} />
    </div>
  );
}

function BulkCreateModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (users: BulkUser[]) => void }) {
  const [users, setUsers] = useState<BulkUser[]>([emptyUser()]);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function updateUser(idx: number, field: keyof BulkUser, value: any) {
    setUsers((prev) => prev.map((u, i) => (i === idx ? { ...u, [field]: value } : u)));
  }
  function addUser() {
    setUsers((prev) => [...prev, emptyUser()]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }
  function removeUser(idx: number) {
    setUsers((prev) => prev.filter((_, i) => i !== idx));
  }
  function handleSubmit() {
    const valid = users.filter((u) => u.email.trim() && u.password.trim() && u.display_name.trim());
    if (valid.length > 0) {
      onSubmit(valid);
      setUsers([emptyUser()]);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="สร้างบัญชีผู้ใช้ล่วงหน้าแบบ Bulk" size="xl">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
          <p className="text-sm text-primary-700">
            สร้างบัญชีพนักงานหลายคนพร้อมกัน ระบบจะสร้างบัญชีพร้อมอีเมลยืนยันอัตโนมัติ พนักงานสามารถเข้าสู่ระบบได้ทันที
          </p>
        </div>

        <div ref={listRef} className="space-y-3 max-h-[50vh] overflow-y-auto">
          {users.map((u, idx) => (
            <div key={u.id} className="p-4 rounded-xl border border-surface-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-400">ผู้ใช้ #{idx + 1}</span>
                {users.length > 1 && (
                  <button onClick={() => removeUser(idx)} className="p-1.5 rounded-lg text-error-500 hover:bg-error-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="ชื่อ-นามสกุล" value={u.display_name} onChange={(e) => updateUser(idx, 'display_name', e.target.value)} placeholder="สมชาย ใจดี" />
                <Input label="อีเมล" type="email" value={u.email} onChange={(e) => updateUser(idx, 'email', e.target.value)} placeholder="name@example.com" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="รหัสผ่าน" type="text" value={u.password} onChange={(e) => updateUser(idx, 'password', e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
                <Input label="เบอร์โทร" value={u.phone} onChange={(e) => updateUser(idx, 'phone', e.target.value)} placeholder="08x-xxx-xxxx" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select label="ตำแหน่ง/บทบาท" value={u.roles[0]} onChange={(e) => updateUser(idx, 'roles', [e.target.value as Role])}>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
                <Select label="ประเภทจ้าง" value={u.employment_type} onChange={(e) => updateUser(idx, 'employment_type', e.target.value)}>
                  <option value="daily">รายวัน</option>
                  <option value="monthly">รายเดือน</option>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" onClick={addUser} className="w-full">
          <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้อีกคน
        </Button>
        <div ref={bottomRef} />

        <div className="flex gap-2 pt-2 border-t border-surface-200">
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSubmit} className="flex-1">
            สร้าง {users.filter((u) => u.email.trim() && u.password.trim() && u.display_name.trim()).length} บัญชี
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResultsModal({ open, onClose, results }: { open: boolean; onClose: () => void; results: CreationResult[] }) {
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return (
    <Modal open={open} onClose={onClose} title="ผลการสร้างบัญชี" size="md">
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 p-4 rounded-xl bg-success-50 border border-success-200 text-center">
            <p className="text-2xl font-bold text-success-600">{succeeded}</p>
            <p className="text-sm text-success-700">สำเร็จ</p>
          </div>
          <div className="flex-1 p-4 rounded-xl bg-error-50 border border-error-200 text-center">
            <p className="text-2xl font-bold text-error-600">{failed}</p>
            <p className="text-sm text-error-700">ล้มเหลว</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              r.success ? 'bg-success-50' : 'bg-error-50'
            )}>
              {r.success ? <CheckCircle className="w-5 h-5 text-success-600" /> : <XCircle className="w-5 h-5 text-error-600" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">{r.email}</p>
                {r.error && <p className="text-xs text-error-600">{r.error}</p>}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full">เสร็จสิ้น</Button>
      </div>
    </Modal>
  );
}
