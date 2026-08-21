import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, RotateCcw, Wrench, Phone, MessageSquareWarning, Star, PhoneCall, FileText, CheckCircle, Package, Filter, Image as ImageIcon, Trash2, Undo2, BarChart3, TrendingUp, Store as StoreIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner, Avatar, ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatDate, formatNumber, formatDateTime, cn } from '@/lib/format';
import { StoreEvalPage } from '@/components/StoreEval/StoreEvalPage';

type CSReturn = {
  id: string;
  customer_name: string | null;
  platform: string | null;
  product_name: string | null;
  amount: number;
  reason: string | null;
  status: string;
  created_at: string;
};

type CSClaim = {
  id: string;
  customer_name: string | null;
  product_name: string | null;
  issue_description: string;
  status: string;
  created_at: string;
};

type CSComplaint = {
  id: string;
  customer_name: string | null;
  severity: string;
  description: string;
  status: string;
  is_escalated: boolean;
  created_at: string;
};

type CSFollowup = {
  id: string;
  customer_name: string | null;
  followup_date: string | null;
  status: string;
  note: string | null;
};

type CSReview = {
  id: string;
  platform: string | null;
  customer_name: string | null;
  rating: number;
  review_text: string | null;
  sentiment: string | null;
  is_negative: boolean;
  status: string;
  created_at: string;
};

type CSPendingBill = {
  id: string;
  bill_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_name: string | null;
  status: string;
  created_at: string;
  billed_at: string | null;
  paid_at: string | null;
  withdrawn_at: string | null;
  lot_label: string | null;
  products: { name: string; sku: string; image_url: string | null; brand: string | null } | null;
  branches: { name: string } | null;
};

type DeleteTarget = { id: string; table: string; label: string };

const TABLE_MAP: Record<string, string> = {
  returns: 'cs_returns',
  claims: 'cs_claims',
  complaints: 'cs_complaints',
  followups: 'cs_followups',
  reviews: 'cs_reviews',
  bills: 'cs_pending_bills',
};

export function CSPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('returns');
  const [returns, setReturns] = useState<CSReturn[]>([]);
  const [claims, setClaims] = useState<CSClaim[]>([]);
  const [complaints, setComplaints] = useState<CSComplaint[]>([]);
  const [followups, setFollowups] = useState<CSFollowup[]>([]);
  const [reviews, setReviews] = useState<CSReview[]>([]);
  const [pendingBills, setPendingBills] = useState<CSPendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'return' | 'claim' | 'complaint' | 'followup'>('return');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [retRes, claRes, comRes, folRes, revRes, billRes] = await Promise.all([
      supabase.from('cs_returns').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cs_claims').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cs_complaints').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cs_followups').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cs_reviews').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cs_pending_bills').select('*, products(name, sku, image_url, brand), branches(name)').order('created_at', { ascending: false }).limit(100),
    ]);
    setReturns(retRes.data as CSReturn[] ?? []);
    setClaims(claRes.data as CSClaim[] ?? []);
    setComplaints(comRes.data as CSComplaint[] ?? []);
    setFollowups(folRes.data as CSFollowup[] ?? []);
    setReviews(revRes.data as CSReview[] ?? []);
    setPendingBills(billRes.data as CSPendingBill[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const tableName = TABLE_MAP[deleteTarget.table];
    if (tableName) {
      await supabase.from(tableName).delete().eq('id', deleteTarget.id);
    }
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  async function undoBillStatus(bill: CSPendingBill) {
    const prevStatus = bill.status;
    await supabase.from('cs_pending_bills').update({ status: 'pending', billed_at: null, paid_at: null }).eq('id', bill.id);
    await supabase.from('cs_bill_audit_logs').insert({
      bill_id: bill.id,
      action: 'unbilled',
      previous_status: prevStatus,
      new_status: 'pending',
      actor_profile_id: profile?.id ?? null,
      actor_name: profile?.display_name ?? profile?.email ?? null,
      note: 'ย้อนสถานะกลับเป็นรอวางบิล',
    });
    load();
  }

  // Derive brand from bill_type for dashboard
  const brands = useMemo(() => {
    const allBillTypes = new Set(pendingBills.map((b) => b.bill_type));
    const list: { key: string; label: string }[] = [{ key: 'all', label: 'ทั้งหมด' }];
    allBillTypes.forEach((bt) => {
      list.push({ key: bt, label: bt === 'buddy' ? 'บัดดี้' : bt === 'nike' ? 'Nike' : bt.charAt(0).toUpperCase() + bt.slice(1) });
    });
    return list;
  }, [pendingBills]);

  // Filter data by brand for dashboard
  const filteredBills = brandFilter === 'all' ? pendingBills : pendingBills.filter((b) => b.bill_type === brandFilter);

  const openReturns = returns.filter((r) => r.status !== 'refunded' && r.status !== 'rejected').length;
  const openClaims = claims.filter((c) => c.status === 'open' || c.status === 'in_progress').length;
  const openComplaints = complaints.filter((c) => c.status === 'open').length;
  const pendingFollowups = followups.filter((f) => f.status === 'pending').length;
  const negativeReviews = reviews.filter((r) => r.is_negative).length;
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const pendingBillsCount = pendingBills.filter((b) => b.status === 'pending').length;
  const billedCount = pendingBills.filter((b) => b.status === 'billed' || b.status === 'paid').length;

  const RETURN_STATUS_LABEL: Record<string, string> = { pending: 'รอ', reviewing: 'ตรวจสอบ', approved: 'อนุมัติ', refunded: 'คืนเงิน', rejected: 'ปฏิเสธ' };
  const CLAIM_STATUS_LABEL: Record<string, string> = { open: 'เปิด', in_progress: 'ดำเนินการ', resolved: 'แก้แล้ว', rejected: 'ปฏิเสธ' };
  const COMPLAINT_STATUS_LABEL: Record<string, string> = { open: 'เปิด', resolved: 'แก้แล้ว', escalated: 'เร่งด่วน' };
  const FOLLOWUP_STATUS_LABEL: Record<string, string> = { pending: 'รอ', done: 'เสร็จ', skipped: 'ข้าม' };
  const REVIEW_STATUS_LABEL: Record<string, string> = { new: 'ใหม่', responded: 'ตอบแล้ว', ignored: 'ไม่สนใจ' };
  const BILL_STATUS_LABEL: Record<string, string> = { pending: 'รอวางบิล', billed: 'วางบิลแล้ว', paid: 'ชำระแล้ว' };
  const SEVERITY_LABEL: Record<string, string> = { high: 'สูง', medium: 'กลาง', low: 'ต่ำ' };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Brand filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="w-4 h-4 text-surface-400" />
        <span className="text-sm text-surface-500">แดชบอร์ดแบรนด์:</span>
        <div className="flex p-1 bg-surface-100 rounded-lg">
          {brands.map((b) => (
            <button
              key={b.key}
              onClick={() => setBrandFilter(b.key)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', brandFilter === b.key ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brand dashboard (single, no duplicate) */}
      <BrandDashboard bills={filteredBills} returns={returns} claims={claims} complaints={complaints} reviews={reviews} brandFilter={brandFilter} />

      <Tabs
        tabs={[
          { key: 'returns', label: 'คืนสินค้า', count: openReturns },
          { key: 'claims', label: 'เคลม', count: openClaims },
          { key: 'complaints', label: 'ร้องเรียน', count: openComplaints },
          { key: 'followups', label: 'Follow-up', count: pendingFollowups },
          { key: 'reviews', label: 'รีวิว', count: negativeReviews > 0 ? negativeReviews : undefined },
          { key: 'bills', label: 'รอวางบิล', count: pendingBillsCount },
          { key: 'billed', label: 'วางบิลแล้ว', count: billedCount },
          { key: 'storeeval', label: 'ประเมินร้านค้า' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="flex flex-wrap gap-2">
        {tab === 'returns' && <Button size="sm" onClick={() => { setModalType('return'); setShowModal(true); }}><Plus className="w-4 h-4" /> บันทึกการคืน</Button>}
        {tab === 'claims' && <Button size="sm" onClick={() => { setModalType('claim'); setShowModal(true); }}><Plus className="w-4 h-4" /> บันทึกเคลม</Button>}
        {tab === 'complaints' && <Button size="sm" onClick={() => { setModalType('complaint'); setShowModal(true); }}><Plus className="w-4 h-4" /> บันทึกร้องเรียน</Button>}
        {tab === 'followups' && <Button size="sm" onClick={() => { setModalType('followup'); setShowModal(true); }}><Plus className="w-4 h-4" /> นัด Follow-up</Button>}
      </div>

      {tab === 'returns' && (
        returns.length === 0 ? <EmptyState icon={<RotateCcw className="w-8 h-8" />} title="ไม่มีการคืนสินค้า" /> :
        <div className="space-y-3">
          {returns.map((r, i) => (
            <Card key={r.id} className={cn('p-4 flex items-center gap-4 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-error-100 text-error-600"><RotateCcw className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="font-medium text-surface-900">{r.product_name ?? 'ไม่ระบุ'}</p>
                  <p className="text-sm text-surface-500">{r.customer_name ?? '-'} · {r.platform ?? '-'}</p>
                  <p className="text-xs text-surface-400">{formatDate(r.created_at)}{r.reason && ` · ${r.reason}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-error-600">{formatCurrency(r.amount)}</p>
                </div>
                <Badge variant={r.status === 'refunded' ? 'success' : r.status === 'rejected' ? 'error' : 'warning'}>
                  {r.status === 'pending' ? 'รอ' : r.status === 'reviewing' ? 'ตรวจสอบ' : r.status === 'approved' ? 'อนุมัติ' : r.status === 'refunded' ? 'คืนเงิน' : 'ปฏิเสธ'}
                </Badge>
              </div>
              <DeleteButton onClick={() => setDeleteTarget({ id: r.id, table: 'returns', label: r.product_name ?? 'การคืนสินค้า' })} />
            </Card>
          ))}
        </div>
      )}

      {tab === 'claims' && (
        claims.length === 0 ? <EmptyState icon={<Wrench className="w-8 h-8" />} title="ไม่มีเคลมสินค้า" /> :
        <div className="space-y-3">
          {claims.map((c, i) => (
            <Card key={c.id} className={cn('p-4 flex items-center gap-4 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-warning-100 text-warning-600"><Wrench className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="font-medium text-surface-900">{c.product_name ?? 'ไม่ระบุ'}</p>
                  <p className="text-sm text-surface-500">{c.customer_name ?? '-'}</p>
                  <p className="text-xs text-surface-400">{c.issue_description}</p>
                </div>
                <Badge variant={c.status === 'resolved' ? 'success' : c.status === 'rejected' ? 'error' : 'warning'}>
                  {c.status === 'open' ? 'เปิด' : c.status === 'in_progress' ? 'ดำเนินการ' : c.status === 'resolved' ? 'แก้แล้ว' : 'ปฏิเสธ'}
                </Badge>
              </div>
              <DeleteButton onClick={() => setDeleteTarget({ id: c.id, table: 'claims', label: c.product_name ?? 'เคลม' })} />
            </Card>
          ))}
        </div>
      )}

      {tab === 'complaints' && (
        complaints.length === 0 ? <EmptyState icon={<MessageSquareWarning className="w-8 h-8" />} title="ไม่มีเรื่องร้องเรียน" /> :
        <div className="space-y-3">
          {complaints.map((c, i) => (
            <Card key={c.id} className={cn('p-4 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn('p-2.5 rounded-xl', c.severity === 'high' ? 'bg-error-100 text-error-600' : c.severity === 'medium' ? 'bg-warning-100 text-warning-600' : 'bg-surface-100 text-surface-500')}>
                    <MessageSquareWarning className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-700">{c.description}</p>
                    <p className="text-xs text-surface-400 mt-1">{c.customer_name ?? '-'} · {formatDate(c.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.is_escalated && <Badge variant="error">เร่งด่วน</Badge>}
                  <Badge variant={c.status === 'resolved' ? 'success' : 'warning'}>
                    {c.status === 'open' ? 'เปิด' : c.status === 'resolved' ? 'แก้แล้ว' : 'เร่งด่วน'}
                  </Badge>
                  <DeleteButton onClick={() => setDeleteTarget({ id: c.id, table: 'complaints', label: c.description?.slice(0, 30) ?? 'ร้องเรียน' })} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'followups' && (
        followups.length === 0 ? <EmptyState icon={<PhoneCall className="w-8 h-8" />} title="ไม่มี Follow-up" /> :
        <div className="space-y-3">
          {followups.map((f, i) => (
            <Card key={f.id} className={cn('p-4 flex items-center gap-4 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600"><PhoneCall className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="font-medium text-surface-900">{f.customer_name ?? '-'}</p>
                  <p className="text-sm text-surface-500">{f.followup_date ? formatDate(f.followup_date) : '-'}</p>
                  {f.note && <p className="text-xs text-surface-400 mt-1">{f.note}</p>}
                </div>
                <Badge variant={f.status === 'done' ? 'success' : f.status === 'skipped' ? 'default' : 'warning'}>
                  {f.status === 'pending' ? 'รอ' : f.status === 'done' ? 'เสร็จ' : 'ข้าม'}
                </Badge>
              </div>
              <DeleteButton onClick={() => setDeleteTarget({ id: f.id, table: 'followups', label: `Follow-up: ${f.customer_name ?? '-'}` })} />
            </Card>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        reviews.length === 0 ? <EmptyState icon={<Star className="w-8 h-8" />} title="ยังไม่มีรีวิว" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((r, i) => (
            <Card key={r.id} className={cn('p-5 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.customer_name ?? '?'} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{r.customer_name ?? '-'}</p>
                      <p className="text-xs text-surface-400">{r.platform ?? '-'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={cn('w-4 h-4', n <= r.rating ? 'fill-warning-400 text-warning-400' : 'text-surface-200')} />
                    ))}
                  </div>
                </div>
                {r.review_text && <p className="text-sm text-surface-600">{r.review_text}</p>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {r.is_negative && <Badge variant="error">รีวิวลบ</Badge>}
                    <Badge variant={r.status === 'responded' ? 'success' : 'default'}>
                      {r.status === 'new' ? 'ใหม่' : r.status === 'responded' ? 'ตอบแล้ว' : 'ไม่สนใจ'}
                    </Badge>
                  </div>
                  <DeleteButton onClick={() => setDeleteTarget({ id: r.id, table: 'reviews', label: `รีวิว: ${r.customer_name ?? '-'}` })} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'bills' && (
        <PendingBillsTab bills={pendingBills.filter((b) => b.status === 'pending')} onAction={load} onDelete={(bill) => setDeleteTarget({ id: bill.id, table: 'bills', label: bill.products?.name ?? 'รายการบิล' })} />
      )}

      {tab === 'billed' && (
        <PendingBillsTab bills={pendingBills.filter((b) => b.status === 'billed' || b.status === 'paid')} onAction={load} showBilled onUndo={undoBillStatus} onDelete={(bill) => setDeleteTarget({ id: bill.id, table: 'bills', label: bill.products?.name ?? 'รายการบิล' })} />
      )}

      {tab === 'storeeval' && <StoreEvalPage />}

      <CSModal type={modalType} open={showModal} onClose={() => setShowModal(false)} onCreated={load} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบ"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">{deleteTarget?.label}</p>
        <p>การลบนี้เป็นการลบถาวร ไม่สามารถกู้คืนได้ กรุณายืนยันหากต้องการลบจริง</p>
      </ConfirmDialog>
    </div>
  );
}

// ============ DELETE BUTTON ============
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors shrink-0"
      title="ลบรายการนี้"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

// ============ BRAND DASHBOARD ============
function BrandDashboard({ bills, returns, claims, complaints, reviews, brandFilter }: {
  bills: CSPendingBill[];
  returns: CSReturn[];
  claims: CSClaim[];
  complaints: CSComplaint[];
  reviews: CSReview[];
  brandFilter: string;
}) {
  const pendingAmount = bills.filter((b) => b.status === 'pending').reduce((s, b) => s + Number(b.total_amount), 0);
  const billedAmount = bills.filter((b) => b.status === 'billed' || b.status === 'paid').reduce((s, b) => s + Number(b.total_amount), 0);
  const pendingCount = bills.filter((b) => b.status === 'pending').length;
  const billedCount = bills.filter((b) => b.status === 'billed' || b.status === 'paid').length;

  // For returns/claims/complaints/reviews we don't have brand info directly,
  // but we show the totals. The dashboard focuses on bill data per brand.
  const brandLabel = brandFilter === 'all' ? 'ทุกแบรนด์' : brandFilter === 'buddy' ? 'บัดดี้' : brandFilter === 'nike' ? 'Nike' : brandFilter;

  const stats = [
    { label: 'จำนวนคืนสินค้า', value: returns.length, icon: RotateCcw, color: 'text-error-600 bg-error-100' },
    { label: 'จำนวนเคลม', value: claims.length, icon: Wrench, color: 'text-warning-600 bg-warning-100' },
    { label: 'จำนวนร้องเรียน', value: complaints.length, icon: MessageSquareWarning, color: 'text-error-600 bg-error-100' },
    { label: 'คะแนนรีวิวเฉลี่ย', value: reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '-', icon: Star, color: 'text-success-600 bg-success-100' },
    { label: 'ยอดรอวางบิล', value: formatCurrency(pendingAmount), subValue: `${pendingCount} รายการ`, icon: FileText, color: 'text-primary-600 bg-primary-100' },
    { label: 'ยอดวางบิลแล้ว', value: formatCurrency(billedAmount), subValue: `${billedCount} รายการ`, icon: TrendingUp, color: 'text-success-600 bg-success-100' },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-surface-900">แดชบอร์ด{brandLabel}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="p-3 rounded-xl bg-surface-50">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs text-surface-400 mb-0.5">{s.label}</p>
              <p className="text-lg font-bold text-surface-900">{s.value}</p>
              {s.subValue && <p className="text-xs text-surface-400">{s.subValue}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============ CS MODAL ============
function CSModal({ type, open, onClose, onCreated }: { type: 'return' | 'claim' | 'complaint' | 'followup'; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [platform, setPlatform] = useState('shopee');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState('low');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  const titles: Record<string, string> = { return: 'บันทึกการคืนสินค้า', claim: 'บันทึกเคลม', complaint: 'บันทึกร้องเรียน', followup: 'นัด Follow-up' };

  async function submit() {
    setLoading(true);
    if (type === 'return') {
      await supabase.from('cs_returns').insert({ customer_name: customer, customer_phone: phone, platform, product_name: product, amount: Number(amount) || 0, reason: desc, status: 'pending' });
    } else if (type === 'claim') {
      await supabase.from('cs_claims').insert({ customer_name: customer, customer_phone: phone, platform, product_name: product, issue_description: desc, status: 'open' });
    } else if (type === 'complaint') {
      await supabase.from('cs_complaints').insert({ customer_name: customer, customer_phone: phone, severity, description: desc, status: 'open' });
    } else {
      await supabase.from('cs_followups').insert({ customer_name: customer, customer_phone: phone, followup_date: date || null, note: desc, status: 'pending' });
    }
    setLoading(false);
    onClose(); onCreated();
    setCustomer(''); setPhone(''); setProduct(''); setAmount(''); setDesc(''); setDate('');
  }

  return (
    <Modal open={open} onClose={onClose} title={titles[type]} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="ชื่อลูกค้า" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Input label="เบอร์" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {(type === 'return' || type === 'claim') && (
          <>
            <Select label="แพลตฟอร์ม" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="shopee">Shopee</option>
              <option value="tiktok">TikTok</option>
              <option value="lazada">Lazada</option>
              <option value="line">LINE</option>
              <option value="store">หน้าร้าน</option>
            </Select>
            <Input label="สินค้า" value={product} onChange={(e) => setProduct(e.target.value)} />
          </>
        )}
        {type === 'return' && <Input label="จำนวนเงิน" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        {type === 'complaint' && (
          <Select label="ระดับความรุนแรง" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">ต่ำ</option>
            <option value="medium">ปานกลาง</option>
            <option value="high">สูง</option>
          </Select>
        )}
        {type === 'followup' && <Input label="วันที่นัด" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        <Textarea label="รายละเอียด" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">บันทึก</Button>
      </div>
    </Modal>
  );
}

// ============ PENDING BILLS TAB ============
function PendingBillsTab({ bills, onAction, showBilled, onUndo, onDelete }: {
  bills: CSPendingBill[];
  onAction: () => void;
  showBilled?: boolean;
  onUndo?: (bill: CSPendingBill) => void;
  onDelete: (bill: CSPendingBill) => void;
}) {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [partnerFilter, setPartnerFilter] = useState<'all' | 'buddy' | 'nike'>('all');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = bills.filter((b) => {
    const billDate = new Date(b.withdrawn_at ?? b.created_at);
    if (timeFilter === 'today' && billDate < startOfToday) return false;
    if (timeFilter === 'week' && billDate < startOfWeek) return false;
    if (timeFilter === 'month' && billDate < startOfMonth) return false;
    if (partnerFilter !== 'all' && b.bill_type !== partnerFilter) return false;
    return true;
  });

  const totalAmount = filtered.reduce((sum, b) => sum + Number(b.total_amount), 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-surface-400" />
          <div className="flex p-1 bg-surface-100 rounded-lg">
            {([['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['week', 'สัปดาห์'], ['month', 'เดือน']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTimeFilter(key)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', timeFilter === key ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex p-1 bg-surface-100 rounded-lg">
            {([['all', 'ทั้งหมด'], ['buddy', 'บัดดี้'], ['nike', 'Nike']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPartnerFilter(key)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', partnerFilter === key ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-surface-500">
          รวม {filtered.length} รายการ · <span className="font-bold text-surface-900">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="w-8 h-8" />} title={showBilled ? "ไม่มีรายการวางบิลแล้ว" : "ไม่มีรายการรอวางบิล"} description="รายการขายบัดดี้/Nike จะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <Card key={b.id} className={cn('p-4 animate-slide-up')}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4">
                {/* Product image */}
                <div className="w-14 h-14 rounded-xl bg-surface-100 flex items-center justify-center overflow-hidden shrink-0">
                  {b.products?.image_url ? (
                    <img src={b.products.image_url} alt={b.products?.name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-surface-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-surface-900 truncate">{b.products?.name ?? 'ไม่ระบุสินค้า'}</p>
                    <Badge variant={b.bill_type === 'buddy' ? 'primary' : 'default'}>{b.bill_type === 'buddy' ? 'บัดดี้' : 'Nike'}</Badge>
                    {b.lot_label && (
                      <Badge variant={b.lot_label === 'old' ? 'warning' : 'success'}>
                        {b.lot_label === 'old' ? 'ทุนเก่า' : 'ทุนใหม่'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-surface-500 mt-0.5">
                    {formatNumber(b.quantity)} ชิ้น · {formatCurrency(b.unit_price)}/ชิ้น
                    {b.branches && ` · ${b.branches.name}`}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    ยิงออก: {formatDateTime(b.withdrawn_at ?? b.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-surface-900">{formatCurrency(b.total_amount)}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    {!showBilled && b.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await supabase.from('cs_pending_bills').update({ status: 'billed', billed_at: new Date().toISOString() }).eq('id', b.id);
                          onAction();
                        }}
                      >
                        <CheckCircle className="w-4 h-4" /> วางบิลแล้ว
                      </Button>
                    )}
                    {showBilled && (
                      <>
                        <Badge variant={b.status === 'paid' ? 'success' : 'info'}>
                          {b.status === 'paid' ? 'ได้เงินแล้ว' : 'วางบิลแล้ว'}
                        </Badge>
                        {onUndo && (
                          <button
                            onClick={() => onUndo(b)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-warning-600 hover:bg-warning-50 transition-colors"
                            title="ย้อนสถานะกลับเป็นรอวางบิล"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => onDelete(b)}
                      className="p-1.5 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors"
                      title="ลบรายการนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
