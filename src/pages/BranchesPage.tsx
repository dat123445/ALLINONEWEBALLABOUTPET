import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Modal, Card, Badge, ConfirmDialog } from '@/components/ui';
import { Building2, Plus, Pencil, Trash2, MapPin, CheckCircle2, AlertCircle, Star, Power } from 'lucide-react';
import { cn } from '@/lib/format';

type Branch = {
  id: string;
  name: string;
  short_code: string | null;
  address: string | null;
  is_active: boolean;
};

export function BranchesPage() {
  const { profile, setActiveBranch, refreshProfile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('branches').select('*').order('name');
    setLoading(false);
    if (error) { setToast({ type: 'error', msg: `โหลดข้อมูลไม่สำเร็จ: ${error.message}` }); return; }
    setBranches((data as Branch[]) ?? []);
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  async function handleSelectBranch(branchId: string) {
    await setActiveBranch(branchId);
    await refreshProfile();
    setToast({ type: 'success', msg: 'สลับสาขาสำเร็จ' });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('branches').update({ is_active: false }).eq('id', deleteTarget.id);
    if (error) { setToast({ type: 'error', msg: `ปิดใช้งานไม่สำเร็จ: ${error.message}` }); return; }
    if (profile?.active_branch_id === deleteTarget.id) await setActiveBranch(null);
    setDeleteTarget(null);
    setToast({ type: 'success', msg: 'ปิดใช้งานสาขาสำเร็จ (สาขานี้จะไม่ปรากฏในระบบอีก)' });
    loadBranches();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">จัดการสาขา</h1>
          <p className="text-sm text-surface-500 mt-1">เพิ่ม แก้ไข และสลับสาขาที่ใช้งาน</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingBranch(null); setShowEdit(true); }}>
            <Plus className="w-4 h-4" /> เพิ่มสาขาใหม่
          </Button>
        </div>
      </div>

      {toast && (
        <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : branches.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500">ยังไม่มีสาขา กด "เพิ่มสาขาใหม่" เพื่อเริ่ม</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => {
            const isActive = profile?.active_branch_id === b.id;
            return (
              <Card key={b.id} className={cn('p-5 transition-all', isActive ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-md')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isActive ? 'bg-primary-100' : 'bg-surface-100')}>
                      <Building2 className={cn('w-6 h-6', isActive ? 'text-primary-600' : 'text-surface-400')} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">{b.name}</h3>
                      <div className="flex items-center gap-1.5">
                        {b.short_code && <Badge variant="default">{b.short_code}</Badge>}
                        {!b.is_active && <Badge variant="error">ปิดใช้งาน</Badge>}
                      </div>
                    </div>
                  </div>
                  {isActive && <span className="flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full"><Star className="w-3 h-3 fill-current" /> กำลังใช้</span>}
                </div>
                {b.address && (
                  <div className="flex items-start gap-2 text-sm text-surface-500 mb-4">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{b.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-surface-100">
                  {!isActive && b.is_active && (
                    <Button size="sm" variant="secondary" onClick={() => handleSelectBranch(b.id)} className="flex-1">เลือกใช้งาน</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditingBranch(b); setShowEdit(true); }}>
                    <Pencil className="w-3.5 h-3.5" /> แก้ไข
                  </Button>
                  <button onClick={() => setDeleteTarget(b)} className={cn('p-2 rounded-lg transition-colors', b.is_active ? 'text-surface-400 hover:text-error-600 hover:bg-error-50' : 'text-success-500 hover:text-success-600 hover:bg-success-50')} title={b.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                    {b.is_active ? <Trash2 className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showEdit && (
        <BranchEditModal branch={editingBranch} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadBranches(); }} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="ยืนยันปิดใช้งานสาขา"
        confirmLabel="ปิดใช้งาน"
      >
        <p>คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งานสาขา <span className="font-semibold">{deleteTarget?.name}</span>?</p>
        <p className="text-sm text-surface-400 mt-1">สาขาที่ปิดใช้งานจะไม่ปรากฏในระบบอีก แต่ข้อมูลประวัติยังคงอยู่ สามารถเปิดใช้งานใหม่ได้จากการแก้ไข</p>
      </ConfirmDialog>
    </div>
  );
}

function BranchEditModal({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);

  function generateCode(name: string): string {
    if (!name.trim()) return '';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words.map((w) => w[0]).join('').toUpperCase();
  }

  useEffect(() => {
    if (branch) { setName(branch.name); setShortCode(branch.short_code ?? ''); setAddress(branch.address ?? ''); setIsActive(branch.is_active); setCodeTouched(true); }
    else { setName(''); setShortCode(''); setAddress(''); setIsActive(true); setCodeTouched(false); }
  }, [branch]);

  async function save() {
    if (!name.trim()) { setError('กรุณากรอกชื่อสาขา'); return; }
    const finalCode = shortCode.trim() || generateCode(name);
    setLoading(true); setError('');
    if (branch) {
      const { error } = await supabase.from('branches').update({ name, code: finalCode, short_code: shortCode || null, address: address || null, is_active: isActive }).eq('id', branch.id);
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.from('branches').insert({ name, code: finalCode, short_code: shortCode || null, address: address || null, is_active: isActive });
      if (error) { setError(error.message); setLoading(false); return; }
    }
    setLoading(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={branch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'} size="md">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-error-50 text-error-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
        <Input label="ชื่อสาขา" value={name} onChange={(e) => { setName(e.target.value); if (!codeTouched) setShortCode(generateCode(e.target.value)); }} placeholder="สาขาสยาม" />
        <Input label="รหัสย่อ (ไม่บังคับ)" value={shortCode} onChange={(e) => { setShortCode(e.target.value); setCodeTouched(true); }} placeholder="สร้างอัตโนมัติ หรือพิมพ์เอง" />
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">ที่อยู่</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="input-base" placeholder="123 ถ.สยาม แขวงปทุมวัน กรุงเทพฯ 10330" />
        </div>
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
          เปิดใช้งานสาขานี้
        </label>
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}
