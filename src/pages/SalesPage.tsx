import { useEffect, useState, useCallback } from 'react';
import { Plus, TrendingUp, Receipt, RotateCcw, AlertCircle, Lock, DollarSign, CreditCard, Banknote, QrCode, Target, CheckCircle2, LayoutGrid, List, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner, ProgressBar, ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatNumber, formatDate, todayISO, cn } from '@/lib/format';

type SalesRecord = {
  id: string;
  record_date: string;
  total_amount: number;
  bill_count: number;
  channel_front: number;
  channel_line_branch: number;
  channel_line_oa: number;
  is_closed: boolean;
  target_amount: number;
  branches: { id: string; name: string } | null;
};

type SalesReturn = {
  id: string;
  product_name: string | null;
  amount: number;
  reason: string | null;
  created_at: string;
};

type SalesIssue = {
  id: string;
  description: string;
  status: string;
  is_escalated: boolean;
  created_at: string;
};

const VIEW_PREF_KEY = 'sales-view-mode';

export function SalesPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('records');
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [issues, setIssues] = useState<SalesIssue[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecord, setShowRecord] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [summary, setSummary] = useState({ total: 0, bills: 0, avg: 0, returns: 0, ach: 0, frontTotal: 0, targetTotal: 0 });
  const [targets, setTargets] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => (localStorage.getItem(VIEW_PREF_KEY) as 'card' | 'table') || 'card');
  const [deleteTarget, setDeleteTarget] = useState<SalesRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  function changeViewMode(mode: 'card' | 'table') {
    setViewMode(mode);
    localStorage.setItem(VIEW_PREF_KEY, mode);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [recRes, retRes, issRes, brRes, tgtRes] = await Promise.all([
      supabase.from('sales_records').select('*, branches(id, name)').order('record_date', { ascending: false }).limit(30),
      supabase.from('sales_returns').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('sales_issues').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('sales_targets').select('*, branches(id, name)').eq('is_active', true).order('effective_date', { ascending: false }),
    ]);
    setRecords(recRes.data as SalesRecord[] ?? []);
    setReturns(retRes.data as SalesReturn[] ?? []);
    setIssues(issRes.data as SalesIssue[] ?? []);
    setBranches(brRes.data as { id: string; name: string }[] ?? []);
    setTargets(tgtRes.data ?? []);

    const total = (recRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const bills = (recRes.data ?? []).reduce((s: number, r: any) => s + Number(r.bill_count || 0), 0);
    const retTotal = (retRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const frontTotal = (recRes.data ?? []).reduce((s: number, r: any) => s + Number(r.channel_front || 0), 0);
    const targetTotal = (recRes.data ?? []).reduce((s: number, r: any) => s + Number(r.target_amount || 0), 0);
    const ach = targetTotal > 0 ? (frontTotal / targetTotal) * 100 : 0;
    setSummary({ total, bills, avg: bills > 0 ? total / bills : 0, returns: retTotal, ach, frontTotal, targetTotal });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function closeDay(id: string) {
    await supabase.from('sales_records').update({ is_closed: true, closed_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('sales_audit_logs').insert({
      record_id: deleteTarget.id,
      action: 'delete',
      actor_profile_id: profile?.id ?? null,
      actor_name: profile?.display_name ?? profile?.email ?? null,
      snapshot: deleteTarget as any,
      note: 'ลบยอดขายถาวร',
    });
    await supabase.from('sales_records').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  function openEdit(rec: SalesRecord) {
    setEditingRecord(rec);
    setShowRecord(true);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="ยอดขายรวม" value={formatCurrency(summary.total)} icon={<DollarSign className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="จำนวนบิล" value={formatNumber(summary.bills)} icon={<Receipt className="w-5 h-5" />} color="success" delay="animate-delay-200" />
        <StatCard label="ยอดเฉลี่ย/บิล" value={formatCurrency(summary.avg)} icon={<TrendingUp className="w-5 h-5" />} color="accent" delay="animate-delay-300" />
        <StatCard label="คืนสินค้า" value={formatCurrency(summary.returns)} icon={<RotateCcw className="w-5 h-5" />} color="error" delay="animate-delay-400" />
        <StatCard label="Ach% (หน้าร้าน)" value={`${summary.ach.toFixed(1)}%`} icon={<Target className="w-5 h-5" />} color={summary.ach >= 100 ? 'success' : 'warning'} delay="animate-delay-500" />
      </div>

      <Tabs
        tabs={[
          { key: 'records', label: 'บันทึกยอดขาย' },
          { key: 'targets', label: 'เป้าหมาย', count: targets.length },
          { key: 'returns', label: 'คืนสินค้า', count: returns.length },
          { key: 'issues', label: 'ปัญหา', count: issues.filter((i) => i.status === 'open').length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {tab === 'records' && <Button onClick={() => { setEditingRecord(null); setShowRecord(true); }} size="sm"><Plus className="w-4 h-4" /> บันทึกยอด</Button>}
          {tab === 'returns' && <Button onClick={() => setShowReturn(true)} size="sm"><Plus className="w-4 h-4" /> บันทึกคืนสินค้า</Button>}
          {tab === 'issues' && <Button onClick={() => setShowIssue(true)} size="sm"><Plus className="w-4 h-4" /> แจ้งปัญหา</Button>}
        </div>
        {tab === 'records' && records.length > 0 && (
          <div className="flex p-1 bg-surface-100 rounded-lg">
            <button onClick={() => changeViewMode('card')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'card' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')} title="มุมมองการ์ด">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => changeViewMode('table')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'table' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')} title="มุมมองตาราง">
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {tab === 'records' && (
        records.length === 0 ? (
          <EmptyState icon={<Receipt className="w-8 h-8" />} title="ยังไม่มีบันทึกยอดขาย" description="บันทึกยอดขายประจำวันจะแสดงที่นี่" />
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((rec, i) => (
              <Card key={rec.id} hover className={cn('p-5 animate-slide-up')}>
                <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-surface-900">{rec.branches?.name ?? '-'}</p>
                      <p className="text-xs text-surface-400">{formatDate(rec.record_date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rec.is_closed ? 'success' : 'warning'}>
                        {rec.is_closed ? 'ปิดยอดแล้ว' : 'ยังไม่ปิดยอด'}
                      </Badge>
                      <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="แก้ไข">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(rec)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors" title="ลบ">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-surface-900 mb-2">{formatCurrency(rec.total_amount)}</p>
                  <div className="flex items-center justify-between text-sm text-surface-500">
                    <span>{rec.bill_count} บิล</span>
                    <span>เฉลี่ย {formatCurrency(rec.bill_count > 0 ? rec.total_amount / rec.bill_count : 0)}</span>
                  </div>
                  {Number(rec.target_amount) > 0 && (
                    <div className="mt-2">
                      <ProgressBar value={Number(rec.channel_front) || 0} max={Number(rec.target_amount)} color={Number(rec.channel_front) >= Number(rec.target_amount) ? 'success' : 'warning'} label={`Ach ${((Number(rec.channel_front) / Number(rec.target_amount)) * 100).toFixed(0)}%`} />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-surface-100">
                    <ChannelMini label="หน้าร้าน" value={rec.channel_front} />
                    <ChannelMini label="LINE สาขา" value={rec.channel_line_branch} />
                    <ChannelMini label="LINE OA" value={rec.channel_line_oa} />
                  </div>
                  {!rec.is_closed && (
                    <Button size="sm" variant="secondary" className="w-full mt-3" onClick={() => closeDay(rec.id)}>
                      <Lock className="w-3.5 h-3.5" /> ปิดยอดวัน
                    </Button>
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
                    <th className="text-left px-4 py-3 font-medium">สาขา</th>
                    <th className="text-left px-4 py-3 font-medium">วันที่</th>
                    <th className="text-right px-4 py-3 font-medium">ยอดรวม</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">บิล</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">หน้าร้าน</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">LINE สาขา</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">LINE OA</th>
                    <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Ach%</th>
                    <th className="text-center px-4 py-3 font-medium">สถานะ</th>
                    <th className="text-center px-4 py-3 font-medium">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {records.map((rec) => {
                    const ach = Number(rec.target_amount) > 0 ? (Number(rec.channel_front) / Number(rec.target_amount)) * 100 : 0;
                    return (
                      <tr key={rec.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-surface-900">{rec.branches?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{formatDate(rec.record_date)}</td>
                        <td className="px-4 py-3 text-right font-bold text-surface-900">{formatCurrency(rec.total_amount)}</td>
                        <td className="px-4 py-3 text-right text-surface-500 hidden md:table-cell">{rec.bill_count}</td>
                        <td className="px-4 py-3 text-right text-surface-600 hidden md:table-cell">{formatCurrency(rec.channel_front)}</td>
                        <td className="px-4 py-3 text-right text-surface-600 hidden lg:table-cell">{formatCurrency(rec.channel_line_branch)}</td>
                        <td className="px-4 py-3 text-right text-surface-600 hidden lg:table-cell">{formatCurrency(rec.channel_line_oa)}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {Number(rec.target_amount) > 0 ? (
                            <Badge variant={ach >= 100 ? 'success' : 'warning'}>{ach.toFixed(0)}%</Badge>
                          ) : <span className="text-surface-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={rec.is_closed ? 'success' : 'warning'}>
                            {rec.is_closed ? 'ปิดแล้ว' : 'ยังไม่ปิด'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="แก้ไข">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(rec)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors" title="ลบ">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'targets' && <SalesTargets targets={targets} records={records} branches={branches} onCreated={load} />}

      {tab === 'returns' && (
        returns.length === 0 ? (
          <EmptyState icon={<RotateCcw className="w-8 h-8" />} title="ไม่มีการคืนสินค้า" />
        ) : (
          <div className="space-y-3">
            {returns.map((ret, i) => (
              <Card key={ret.id} className={cn('p-4 flex items-center justify-between animate-slide-up')}>
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}>
                  <p className="font-medium text-surface-900">{ret.product_name ?? 'สินค้าไม่ระบุ'}</p>
                  <p className="text-sm text-surface-500">{ret.reason ?? '-'}</p>
                  <p className="text-xs text-surface-400 mt-1">{formatDate(ret.created_at)}</p>
                </div>
                <span className="font-bold text-error-600">-{formatCurrency(ret.amount)}</span>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'issues' && (
        issues.length === 0 ? (
          <EmptyState icon={<AlertCircle className="w-8 h-8" />} title="ไม่มีปัญหาที่บันทึก" />
        ) : (
          <div className="space-y-3">
            {issues.map((iss, i) => (
              <Card key={iss.id} className={cn('p-4 animate-slide-up')}>
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-surface-700">{iss.description}</p>
                    <p className="text-xs text-surface-400 mt-1">{formatDate(iss.created_at)}</p>
                  </div>
                  <Badge variant={iss.status === 'resolved' ? 'success' : iss.is_escalated ? 'error' : 'warning'}>
                    {iss.status === 'open' ? 'เปิด' : iss.status === 'resolved' ? 'แก้แล้ว' : 'เร่งด่วน'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <RecordSalesModal open={showRecord} onClose={() => { setShowRecord(false); setEditingRecord(null); }} branches={branches} profileId={profile?.id} onCreated={load} editingRecord={editingRecord} />
      <ReturnModal open={showReturn} onClose={() => setShowReturn(false)} branches={branches} onCreated={load} />
      <IssueModal open={showIssue} onClose={() => setShowIssue(false)} branches={branches} profileId={profile?.id} onCreated={load} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบ"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">ยอดขาย {deleteTarget?.branches?.name ?? '-'} · {formatDate(deleteTarget?.record_date)}</p>
        <p>การลบนี้เป็นการลบถาวร ไม่สามารถกู้คืนได้ กรุณายืนยันหากต้องการลบจริง</p>
      </ConfirmDialog>
    </div>
  );
}

function ChannelMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-surface-400">{label}</p>
      <p className="text-xs font-semibold text-surface-700">{formatCurrency(value)}</p>
    </div>
  );
}

function RecordSalesModal({ open, onClose, branches, profileId, onCreated, editingRecord }: {
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string }[];
  profileId?: string;
  onCreated: () => void;
  editingRecord: SalesRecord | null;
}) {
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [target, setTarget] = useState('');
  const [front, setFront] = useState('');
  const [lineBranch, setLineBranch] = useState('');
  const [lineOA, setLineOA] = useState('');
  const [bills, setBills] = useState('');
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (open && editingRecord) {
      setBranchId(editingRecord.branches?.id ?? '');
      setDate(editingRecord.record_date?.split('T')[0] ?? todayISO());
      setTarget(String(editingRecord.target_amount ?? ''));
      setFront(String(editingRecord.channel_front ?? ''));
      setLineBranch(String(editingRecord.channel_line_branch ?? ''));
      setLineOA(String(editingRecord.channel_line_oa ?? ''));
      setBills(String(editingRecord.bill_count ?? ''));
    } else if (open && !editingRecord) {
      setBranchId(branches[0]?.id ?? '');
      setDate(todayISO());
      setTarget(''); setFront(''); setLineBranch(''); setLineOA(''); setBills('');
    }
  }, [open, editingRecord, branches]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => {
    if (open && !editingRecord && branchId && date) {
      supabase.from('sales_records').select('target_amount').eq('branch_id', branchId).order('record_date', { ascending: false }).limit(1).maybeSingle().then(({ data }: any) => {
        if (data?.target_amount && Number(data.target_amount) > 0) setTarget(String(data.target_amount));
      });
    }
  }, [open, branchId, date, editingRecord]);

  const frontNum = Number(front) || 0;
  const lineBranchNum = Number(lineBranch) || 0;
  const lineOANum = Number(lineOA) || 0;
  const billsNum = Number(bills) || 0;
  const totalSales = frontNum + lineBranchNum + lineOANum;
  const avgPerBill = billsNum > 0 ? totalSales / billsNum : 0;
  const targetNum = Number(target) || 0;
  const achPercent = targetNum > 0 ? (frontNum / targetNum) * 100 : 0;

  async function submit() {
    if (!branchId || !date || frontNum <= 0) {
      setToast({ type: 'error', msg: 'กรุณากรอกสาขา, วันที่ และยอดขายหน้าร้าน' });
      return;
    }
    setLoading(true);

    if (editingRecord) {
      const { error } = await supabase.from('sales_records').update({
        branch_id: branchId,
        record_date: date,
        total_amount: totalSales,
        bill_count: billsNum,
        channel_front: frontNum,
        channel_line_branch: lineBranchNum,
        channel_line_oa: lineOANum,
        pay_cash: Number(cash) || 0,
        pay_transfer: Number(transfer) || 0,
        target_amount: targetNum || null,
      }).eq('id', editingRecord.id);

      if (!error) {
        await supabase.from('sales_audit_logs').insert({
          record_id: editingRecord.id,
          action: 'edit',
          actor_profile_id: profileId ?? null,
          actor_name: null,
          snapshot: editingRecord as any,
          note: 'แก้ไขยอดขาย',
        });
      }
    } else {
      const { error } = await supabase.from('sales_records').insert({
        branch_id: branchId, profile_id: profileId, record_date: date,
        total_amount: totalSales, bill_count: billsNum,
        channel_front: frontNum, channel_line_branch: lineBranchNum, channel_line_oa: lineOANum,
        pay_cash: Number(cash) || 0, pay_transfer: Number(transfer) || 0,
        target_amount: targetNum || null,
      });
      if (error) {
        setToast({ type: 'error', msg: `บันทึกไม่สำเร็จ: ${error.message}` });
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setToast({ type: 'success', msg: editingRecord ? `แก้ไขสำเร็จ — Ach ${achPercent.toFixed(1)}%` : `บันทึกยอดขายสำเร็จ — Ach ${achPercent.toFixed(1)}%` });
    setTimeout(() => { onClose(); onCreated(); reset(); }, 1500);
  }

  function reset() {
    setFront(''); setLineBranch(''); setLineOA(''); setBills(''); setCash(''); setTransfer('');
  }

  return (
    <Modal open={open} onClose={onClose} title={editingRecord ? "แก้ไขยอดขาย" : "บันทึกยอดขายประจำวัน"} size="lg">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="สาขา *" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">เลือกสาขา...</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input label="วันที่ *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="p-3 rounded-xl bg-accent-50 border border-accent-200">
          <Input label="เป้าหมาย (Target) — บาท" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" />
          <p className="text-xs text-accent-600 mt-1.5">กรอกครั้งเดียวต่อรอบ — ระบบจะจำค่าเดิมไว้ให้ครั้งต่อไป</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="ยอดขายหน้าร้าน *" type="number" value={front} onChange={(e) => setFront(e.target.value)} placeholder="0" />
          <Input label="ไลน์สาขา" type="number" value={lineBranch} onChange={(e) => setLineBranch(e.target.value)} placeholder="0" />
          <Input label="ไลน์ OA" type="number" value={lineOA} onChange={(e) => setLineOA(e.target.value)} placeholder="0" />
        </div>

        <Input label="จำนวนบิล" type="number" value={bills} onChange={(e) => setBills(e.target.value)} placeholder="0" />

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-primary-50 text-center">
            <p className="text-xs text-surface-500 mb-1">ค่าเฉลี่ย / บิล</p>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(avgPerBill)}</p>
          </div>
          <div className="p-4 rounded-xl bg-success-50 text-center">
            <p className="text-xs text-surface-500 mb-1">Total ยอดขายจริง (หน้าร้าน)</p>
            <p className="text-2xl font-bold text-success-600">{formatCurrency(frontNum)}</p>
            {targetNum > 0 && <p className={cn('text-xs mt-1 font-medium', achPercent >= 100 ? 'text-success-600' : 'text-warning-600')}>Ach {achPercent.toFixed(1)}%</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 text-white font-medium text-sm transition-all duration-200 hover:bg-pink-600 active:scale-[0.98] disabled:opacity-50"
          >
            {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกยอดขาย'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnModal({ open, onClose, branches, onCreated }: { open: boolean; onClose: () => void; branches: { id: string; name: string }[]; onCreated: () => void }) {
  const [branchId, setBranchId] = useState('');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (branches.length > 0 && !branchId) setBranchId(branches[0].id); }, [branches, branchId]);

  async function submit() {
    setLoading(true);
    await supabase.from('sales_returns').insert({
      branch_id: branchId, product_name: product, amount: Number(amount) || 0, reason,
    });
    setLoading(false);
    onClose(); onCreated();
    setProduct(''); setAmount(''); setReason('');
  }

  return (
    <Modal open={open} onClose={onClose} title="บันทึกคืนสินค้า" size="sm">
      <div className="space-y-4">
        <Select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input label="สินค้า" value={product} onChange={(e) => setProduct(e.target.value)} />
        <Input label="จำนวนเงิน" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Textarea label="เหตุผล" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">บันทึก</Button>
      </div>
    </Modal>
  );
}

function IssueModal({ open, onClose, branches, profileId, onCreated }: { open: boolean; onClose: () => void; branches: { id: string; name: string }[]; profileId?: string; onCreated: () => void }) {
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState('other');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (branches.length > 0 && !branchId) setBranchId(branches[0].id); }, [branches, branchId]);

  async function submit() {
    setLoading(true);
    await supabase.from('sales_issues').insert({
      branch_id: branchId, profile_id: profileId, issue_type: type, description: desc, status: 'open',
    });
    setLoading(false);
    onClose(); onCreated();
    setDesc('');
  }

  return (
    <Modal open={open} onClose={onClose} title="แจ้งปัญหา" size="sm">
      <div className="space-y-4">
        <Select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select label="ประเภทปัญหา" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="pos">POS/เครื่องบิล</option>
          <option value="payment">การชำระเงิน</option>
          <option value="staff">พนักงาน</option>
          <option value="customer">ลูกค้า</option>
          <option value="other">อื่นๆ</option>
        </Select>
        <Textarea label="รายละเอียด" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">แจ้งปัญหา</Button>
      </div>
    </Modal>
  );
}

function SalesTargets({ targets, records, branches, onCreated }: { targets: any[]; records: SalesRecord[]; branches: { id: string; name: string }[]; onCreated: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  const dailyTargets = targets.filter((t) => t.target_type === 'daily');
  const monthlyTargets = targets.filter((t) => t.target_type === 'monthly');

  const todaySales = records
    .filter((r) => r.record_date?.startsWith(todayStr))
    .reduce((s, r) => s + Number(r.total_amount), 0);

  const monthSales = records
    .filter((r) => r.record_date?.startsWith(todayStr.substring(0, 7)))
    .reduce((s, r) => s + Number(r.total_amount), 0);

  function TargetCard({ target, actual }: { target: any; actual: number }) {
    const pct = target.target_amount > 0 ? Math.min(100, (actual / Number(target.target_amount)) * 100) : 0;
    const remaining = Number(target.target_amount) - actual;
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-semibold text-surface-900">
                {target.branches?.name ?? 'ทุกสาขา'} · {target.target_type === 'daily' ? 'รายวัน' : 'รายเดือน'}
              </p>
              <p className="text-xs text-surface-400">ตั้งแต่ {formatDate(target.effective_date)}</p>
            </div>
          </div>
          <Badge variant={pct >= 100 ? 'success' : pct >= 75 ? 'warning' : 'default'}>
            {pct.toFixed(0)}%
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
          <div>
            <p className="text-xs text-surface-400">เป้าหมาย</p>
            <p className="font-bold text-surface-900">{formatCurrency(Number(target.target_amount))}</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">ทำได้</p>
            <p className="font-bold text-primary-600">{formatCurrency(actual)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">ขาดอีก</p>
            <p className={cn('font-bold', remaining > 0 ? 'text-warning-600' : 'text-success-600')}>
              {remaining > 0 ? formatCurrency(remaining) : 'ครบแล้ว!'}
            </p>
          </div>
        </div>
        <ProgressBar value={actual} max={Number(target.target_amount)} color={pct >= 100 ? 'success' : pct >= 75 ? 'warning' : 'primary'} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> ตั้งเป้าหมาย</Button>
      </div>

      {dailyTargets.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-700 mb-3">เป้าหมายรายวัน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyTargets.map((t) => <TargetCard key={t.id} target={t} actual={todaySales} />)}
          </div>
        </div>
      )}

      {monthlyTargets.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-700 mb-3">เป้าหมายรายเดือน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthlyTargets.map((t) => <TargetCard key={t.id} target={t} actual={monthSales} />)}
          </div>
        </div>
      )}

      {targets.length === 0 && (
        <EmptyState icon={<Target className="w-8 h-8" />} title="ยังไม่มีเป้าหมาย" description="ตั้งเป้าหมายยอดขายรายวันหรือรายเดือนเพื่อติดตามผล" />
      )}

      <CreateTargetModal open={showCreate} onClose={() => setShowCreate(false)} branches={branches} onCreated={onCreated} />
    </div>
  );
}

function CreateTargetModal({ open, onClose, branches, onCreated }: { open: boolean; onClose: () => void; branches: { id: string; name: string }[]; onCreated: () => void }) {
  const [type, setType] = useState('daily');
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await supabase.from('sales_targets').insert({
      target_type: type,
      target_amount: Number(amount) || 0,
      effective_date: date,
      branch_id: branchId || null,
      is_active: true,
    });
    setLoading(false);
    onClose(); onCreated();
    setAmount('');
  }

  return (
    <Modal open={open} onClose={onClose} title="ตั้งเป้าหมายยอดขาย" size="sm">
      <div className="space-y-4">
        <Select label="ประเภท" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="daily">รายวัน</option>
          <option value="monthly">รายเดือน</option>
        </Select>
        <Select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">ทุกสาขา</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input label="ยอดเป้าหมาย (บาท)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        <Input label="วันที่เริ่มต้น" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">ตั้งเป้าหมาย</Button>
      </div>
    </Modal>
  );
}
