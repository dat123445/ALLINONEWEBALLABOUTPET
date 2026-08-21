import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck, CheckCircle, XCircle, Clock, Package, FileText, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/format';

type PurchaseRequest = {
  id: string;
  items: any[];
  total_amount: number;
  supplier_name: string | null;
  status: string;
  expected_delivery: string | null;
  note: string | null;
  created_at: string;
  branches: { name: string } | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string | null;
  supplier_name: string;
  total_amount: number;
  status: string;
  ordered_date: string | null;
  expected_date: string | null;
  created_at: string;
};

export function PurchasingPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, ordRes, brRes] = await Promise.all([
      supabase.from('purchase_requests').select('*, branches(name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('branches').select('id, name').eq('is_active', true),
    ]);
    setRequests(reqRes.data as PurchaseRequest[] ?? []);
    setOrders(ordRes.data as PurchaseOrder[] ?? []);
    setBranches(brRes.data as { id: string; name: string }[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const totalValue = requests.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="คำขอซื้อ" value={requests.length} icon={<FileText className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="รออนุมัติ" value={pendingCount} icon={<Clock className="w-5 h-5" />} color="warning" delay="animate-delay-200" />
        <StatCard label="อนุมัติแล้ว" value={approvedCount} icon={<CheckCircle className="w-5 h-5" />} color="success" delay="animate-delay-300" />
        <StatCard label="มูลค่ารวม" value={formatCurrency(totalValue)} icon={<Truck className="w-5 h-5" />} color="accent" delay="animate-delay-400" />
      </div>

      <Tabs
        tabs={[
          { key: 'requests', label: 'คำขอซื้อ', count: pendingCount > 0 ? pendingCount : undefined },
          { key: 'orders', label: 'ใบสั่งซื้อ (PO)' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="flex gap-2">
        {tab === 'requests' && <Button onClick={() => setShowRequest(true)} size="sm"><Plus className="w-4 h-4" /> ขอซื้อสินค้า</Button>}
      </div>

      {tab === 'requests' && (
        requests.length === 0 ? (
          <EmptyState icon={<FileText className="w-8 h-8" />} title="ไม่มีคำขอซื้อ" description="สร้างคำขอซื้อสินค้าเพื่อเริ่มกระบวนการจัดซื้อ" />
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <Card key={req.id} className={cn('p-5 animate-slide-up')}>
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-surface-900">{req.supplier_name ?? 'ไม่ระบุซัพพลายเออร์'}</p>
                      <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : req.status === 'ordered' ? 'info' : 'warning'}>
                        {req.status === 'pending' ? 'รออนุมัติ' : req.status === 'approved' ? 'อนุมัติ' : req.status === 'rejected' ? 'ปฏิเสธ' : 'สั่งซื้อแล้ว'}
                      </Badge>
                    </div>
                    <p className="text-sm text-surface-500">{formatDate(req.created_at)} · {req.branches?.name ?? '-'}</p>
                    <p className="text-sm text-surface-400 mt-1">{Array.isArray(req.items) ? `${req.items.length} รายการ` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-surface-900">{formatCurrency(req.total_amount)}</p>
                    {req.expected_delivery && <p className="text-xs text-surface-400">ส่งมอบ: {formatDate(req.expected_delivery)}</p>}
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 ml-3">
                      <Button size="sm" variant="primary" onClick={() => updateStatus(req.id, 'approved')}><CheckCircle className="w-3.5 h-3.5" /> อนุมัติ</Button>
                      <Button size="sm" variant="danger" onClick={() => updateStatus(req.id, 'rejected')}><XCircle className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <Button size="sm" variant="secondary" className="ml-3" onClick={() => createPO(req)}>สร้าง PO</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'orders' && (
        orders.length === 0 ? (
          <EmptyState icon={<Package className="w-8 h-8" />} title="ไม่มีใบสั่งซื้อ" description="PO ที่สร้างจากคำขอซื้อที่อนุมัติแล้วจะแสดงที่นี่" />
        ) : (
          <div className="space-y-3">
            {orders.map((ord, i) => (
              <Card key={ord.id} className={cn('p-5 animate-slide-up')}>
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-surface-900">{ord.po_number ?? 'PO'}</p>
                      <Badge variant={ord.status === 'received' ? 'success' : ord.status === 'sent' ? 'info' : ord.status === 'cancelled' ? 'error' : 'warning'}>
                        {ord.status === 'pending' ? 'รอสั่ง' : ord.status === 'sent' ? 'ส่งแล้ว' : ord.status === 'partial' ? 'รับบางส่วน' : ord.status === 'received' ? 'รับครบ' : 'ยกเลิก'}
                      </Badge>
                    </div>
                    <p className="text-sm text-surface-500">{ord.supplier_name}</p>
                    {ord.expected_date && <p className="text-xs text-surface-400">กำหนดส่ง: {formatDate(ord.expected_date)}</p>}
                  </div>
                  <p className="text-lg font-bold text-surface-900">{formatCurrency(ord.total_amount)}</p>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <RequestModal open={showRequest} onClose={() => setShowRequest(false)} branchId={profile?.active_branch_id ?? undefined} branchName={branches.find((b) => b.id === profile?.active_branch_id)?.name} profileId={profile?.id} onCreated={load} />
    </div>
  );

  async function updateStatus(id: string, status: string) {
    await supabase.from('purchase_requests').update({ status, approved_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function createPO(req: PurchaseRequest) {
    const poNum = `PO-${Date.now().toString().slice(-8)}`;
    await supabase.from('purchase_orders').insert({
      po_number: poNum, purchase_request_id: req.id, supplier_name: req.supplier_name ?? 'Unknown',
      items: req.items, total_amount: req.total_amount, status: 'pending',
      ordered_date: new Date().toISOString().split('T')[0],
    });
    await supabase.from('purchase_requests').update({ status: 'ordered' }).eq('id', req.id);
    load();
  }

}

function RequestModal({ open, onClose, branchId, branchName, profileId, onCreated }: { open: boolean; onClose: () => void; branchId?: string; branchName?: string; profileId?: string; onCreated: () => void }) {
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState<{ name: string; qty: number; price: number }[]>([{ name: '', qty: 1, price: 0 }]);
  const [expectedDate, setExpectedDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  function updateItem(idx: number, field: string, value: any) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  function addItem() { setItems(prev => [...prev, { name: '', qty: 1, price: 0 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  async function submit() {
    setLoading(true);
    await supabase.from('purchase_requests').insert({
      branch_id: branchId ?? null, items, total_amount: total, supplier_name: supplier,
      expected_delivery: expectedDate || null, note, status: 'pending', created_by: profileId,
    });
    setLoading(false);
    onClose(); onCreated();
    setSupplier(''); setItems([{ name: '', qty: 1, price: 0 }]); setExpectedDate(''); setNote('');
  }

  return (
    <Modal open={open} onClose={onClose} title="ขอซื้อสินค้า" size="lg">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary-600 shrink-0" />
          <span className="text-sm text-primary-700 font-medium">สาขาที่ทำรายการ: {branchName ?? 'ทุกสาขา'}</span>
          <span className="text-xs text-primary-500 ml-auto">(อ้างอิงจากสาขาที่เลือกไว้ด้านบน)</span>
        </div>
        <Input label="ซัพพลายเออร์" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-surface-700">รายการสินค้า</label>
            <Button size="sm" variant="ghost" onClick={addItem}><Plus className="w-4 h-4" /> เพิ่ม</Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <input className="input-base flex-1" placeholder="ชื่อสินค้า" value={it.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
                <input className="input-base w-20" type="number" placeholder="จำนวน" value={it.qty} onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))} />
                <input className="input-base w-24" type="number" placeholder="ราคา" value={it.price} onChange={(e) => updateItem(idx, 'price', Number(e.target.value))} />
                <button onClick={() => removeItem(idx)} className="p-3 rounded-xl text-error-500 hover:bg-error-50"><XCircle className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-1">
            <span className="text-sm text-surface-500">มูลค่ารวม</span>
            <span className="font-bold text-surface-900">{formatCurrency(total)}</span>
          </div>
        </div>
        <Input label="กำหนดส่งมอบ" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        <Textarea label="หมายเหตุ" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">ส่งคำขอซื้อ</Button>
      </div>
    </Modal>
  );
}
