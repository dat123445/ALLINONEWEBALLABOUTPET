import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, Input, Button, Avatar, Badge } from '@/components/ui';
import { ROLE_LABELS, type Role } from '@/types/permissions';
import { formatDate, cn } from '@/lib/format';
import { Camera, Lock, Mail, Phone, Building2, Calendar, Briefcase, CheckCircle2, AlertCircle, X, Landmark, QrCode } from 'lucide-react';

type Branch = { id: string; name: string; short_code: string | null };

export function MyProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '');
      setLastName(profile.last_name ?? '');
      setDisplayName(profile.display_name ?? '');
      setPhone(profile.phone ?? '');
      setPosition(profile.position ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setSelectedBranch(profile.active_branch_id ?? null);
      setBankName(profile.bank_name ?? '');
      setBankAccount(profile.bank_account ?? '');
      setBankAccountName(profile.bank_account_name ?? '');
      setQrCodeUrl(profile.qr_code_url ?? '');
    }
  }, [profile, open]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('branches').select('id, name, short_code').eq('is_active', true).order('name');
      if (data) setBranches(data as Branch[]);
    })();
  }, []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  if (!profile) return null;

  const roles = (profile.roles ?? []) as Role[];
  const branchNames = (profile as any).branch_members?.map((bm: any) => bm.branches?.name).filter(Boolean) ?? [];

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: displayName || null,
      phone: phone || null,
      position: position || null,
      avatar_url: avatarUrl || null,
      active_branch_id: selectedBranch,
      bank_name: bankName || null,
      bank_account: bankAccount || null,
      bank_account_name: bankAccountName || null,
      qr_code_url: qrCodeUrl || null,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      setToast({ type: 'error', msg: `บันทึกไม่สำเร็จ: ${error.message}` });
    } else {
      setToast({ type: 'success', msg: 'บันทึกโปรไฟล์สำเร็จ' });
      await refreshProfile();
      setTimeout(() => onClose(), 1200);
    }
  }

  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const ext = file.name.split('.').pop();
    const path = `avatars/${profile.user_id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setToast({ type: 'error', msg: `อัปโหลดไม่สำเร็จ: ${upErr.message}` }); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl);
  }

  async function handleUploadQrCode(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const ext = file.name.split('.').pop();
    const path = `qr-codes/${profile.user_id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setToast({ type: 'error', msg: `อัปโหลดไม่สำเร็จ: ${upErr.message}` }); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    setQrCodeUrl(urlData.publicUrl);
  }

  return (
    <Modal open={open} onClose={onClose} title="โปรไฟล์ของฉัน" size="lg">
      <div className="space-y-5">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* Avatar section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={displayName || profile.email} src={avatarUrl} size="lg" />
            <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary-600 text-white cursor-pointer hover:bg-primary-700 transition-colors">
              <Camera className="w-3.5 h-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-surface-700">รูปโปรไฟล์</p>
            <p className="text-xs text-surface-400">คลิกที่กล้องเพื่ออัปโหลดรูปใหม่</p>
          </div>
        </div>

        {/* Read-only info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="flex items-center gap-2 text-xs text-surface-400 mb-1"><Mail className="w-3.5 h-3.5" /> อีเมล</div>
            <p className="text-sm font-medium text-surface-700">{profile.email}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="flex items-center gap-2 text-xs text-surface-400 mb-1"><Briefcase className="w-3.5 h-3.5" /> ตำแหน่ง/บทบาท</div>
            <div className="flex flex-wrap gap-1">
              {roles.length > 0 ? roles.map((r) => (
                <Badge key={r} variant="info">{ROLE_LABELS[r] ?? r}</Badge>
              )) : <Badge variant="warning">รออนุมัติ</Badge>}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="flex items-center gap-2 text-xs text-surface-400 mb-1"><Building2 className="w-3.5 h-3.5" /> สาขา</div>
            <p className="text-sm font-medium text-surface-700">{branchNames.length > 0 ? branchNames.join(', ') : 'ไม่สังกัดสาขา'}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="flex items-center gap-2 text-xs text-surface-400 mb-1"><Calendar className="w-3.5 h-3.5" /> วันที่เริ่มงาน</div>
            <p className="text-sm font-medium text-surface-700">{profile.start_date ? formatDate(profile.start_date) : '-'}</p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="ชื่อ" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="สมชาย" />
          <Input label="นามสกุล" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ใจดี" />
        </div>
        <Input label="ชื่อที่แสดง" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="สมชาย ใจดี" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
          <Input label="ตำแหน่งงาน" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="พนักงานขาย" />
        </div>

        {/* Branch selector */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> สาขาที่ทำงาน</label>
          <select value={selectedBranch ?? ''} onChange={(e) => setSelectedBranch(e.target.value || null)} className="input-base cursor-pointer">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.short_code ? ` (${b.short_code})` : ''}</option>
            ))}
          </select>
          <p className="text-xs text-surface-400 mt-1">เลือกสาขาที่คุณต้องการทำงานอยู่</p>
        </div>

        {/* Bank info */}
        <div className="pt-2 border-t border-surface-200">
          <p className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
            <Landmark className="w-4 h-4" /> ข้อมูลธนาคาร / พร้อมเพย์
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="ชื่อธนาคาร" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="กสิกรไทย" />
            <Input label="เลขบัญชี / เลขพร้อมเพย์" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="0xx-x-xxxxx-x" />
          </div>
          <Input label="ชื่อบัญชี" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="สมชาย ใจดี" />
          <div className="mt-3">
            <label className="block text-sm font-medium text-surface-700 mb-1.5 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> QR Code พร้อมเพย์
            </label>
            <div className="flex items-center gap-4">
              {qrCodeUrl ? (
                <div className="relative">
                  <img src={qrCodeUrl} alt="QR PromptPay" className="w-24 h-24 rounded-xl border border-surface-200 object-contain" />
                  <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary-600 text-white cursor-pointer hover:bg-primary-700 transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadQrCode} />
                  </label>
                </div>
              ) : (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-surface-300 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors">
                  <QrCode className="w-8 h-8 text-surface-300" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadQrCode} />
                </label>
              )}
              <p className="text-xs text-surface-400">อัปโหลดรูป QR Code พร้อมเพย์ เพื่อให้หัวหน้าสแกนจ่ายเงินได้สะดวก</p>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="pt-2 border-t border-surface-200">
          {showPassword ? (
            <ChangePasswordForm onCancel={() => setShowPassword(false)} onSuccess={() => { setShowPassword(false); setToast({ type: 'success', msg: 'เปลี่ยนรหัสผ่านสำเร็จ' }); }} />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowPassword(true)}>
              <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">บันทึกโปรไฟล์</Button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePasswordForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (newPassword.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (newPassword !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onSuccess();
  }

  return (
    <div className="space-y-3 p-4 rounded-xl bg-surface-50">
      <p className="text-sm font-medium text-surface-700 flex items-center gap-2"><Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน</p>
      <Input label="รหัสผ่านใหม่" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
      <Input label="ยืนยันรหัสผ่านใหม่" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="ยืนยันรหัสผ่าน" />
      {error && <p className="text-xs text-error-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>ยกเลิก</Button>
        <Button size="sm" onClick={submit} loading={loading} className="flex-1">เปลี่ยนรหัสผ่าน</Button>
      </div>
    </div>
  );
}
