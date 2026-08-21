import { useEffect, useState, useCallback, useRef } from 'react';
import { Globe, ShoppingCart, TrendingUp, Package, MessageSquare, Plus, Pencil, Trash2, Save, CheckCircle2, AlertCircle, X, Search, Users, ScanLine, Minus, UserPlus, ArrowRight, Phone, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner, ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/format';

type Order = {
  id: string;
  platform: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_info: string | null;
  amount: number;
  platform_fee: number;
  shipping_fee: number;
  net_profit: number;
  status: string;
  shipping_provider: string | null;
  tracking_number: string | null;
  address: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  total_spent: number;
  order_count: number;
  last_order_at: string | null;
  created_at: string;
};

type ShootLineItem = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit: string;
  unit_multiplier: number;
  unit_price: string;
  lot_id: string;
  discount_value: string;
  discount_mode: 'baht' | 'percent';
};

const PLATFORM_LABELS: Record<string, string> = { tiktok: 'TikTok Shop', shopee: 'Shopee', lazada: 'Lazada', line: 'LINE MyShop' };
const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-surface-900 text-white',
  shopee: 'bg-error-500 text-white',
  lazada: 'bg-primary-500 text-white',
  line: 'bg-success-500 text-white',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ', to_ship: 'รอจัดส่ง', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก', returned: 'คืนสินค้า',
};

export function OnlinePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [showShoot, setShowShoot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ordRes, setRes, custRes] = await Promise.all([
      supabase.from('online_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('online_platform_settings').select('*'),
      supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setOrders(ordRes.data as Order[] ?? []);
    setSettings(setRes.data ?? []);
    setCustomers(custRes.data as Customer[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = platformFilter === 'all' ? orders : orders.filter((o) => o.platform === platformFilter);
  const totalSales = filtered.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.amount), 0);
  const totalProfit = filtered.reduce((s, o) => s + Number(o.net_profit), 0);
  const pendingShip = filtered.filter((o) => o.status === 'pending' || o.status === 'to_ship').length;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('online_order_audit_logs').insert({
      order_id: deleteTarget.id,
      action: 'delete',
      actor_profile_id: profile?.id ?? null,
      actor_name: profile?.display_name ?? profile?.email ?? null,
      previous_value: deleteTarget as any,
      note: 'ลบออเดอร์ถาวร',
    });
    await supabase.from('online_orders').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Platform tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        <button onClick={() => setPlatformFilter('all')} className={cn('px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all', platformFilter === 'all' ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600')}>
          ทั้งหมด
        </button>
        {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setPlatformFilter(key)} className={cn('px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all', platformFilter === key ? PLATFORM_COLORS[key] : 'bg-surface-100 text-surface-600')}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ยอดขาย" value={formatCurrency(totalSales)} icon={<TrendingUp className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="ออเดอร์" value={formatNumber(filtered.length)} icon={<ShoppingCart className="w-5 h-5" />} color="success" delay="animate-delay-200" />
        <StatCard label="กำไรสุทธิ" value={formatCurrency(totalProfit)} icon={<Globe className="w-5 h-5" />} color="accent" delay="animate-delay-300" />
        <StatCard label="รอจัดส่ง" value={pendingShip} icon={<Package className="w-5 h-5" />} color="warning" delay="animate-delay-400" />
      </div>

      <Tabs
        tabs={[
          { key: 'orders', label: 'ออเดอร์' },
          { key: 'customers', label: 'ลูกค้า' },
          { key: 'chat', label: 'แชทลูกค้า' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'orders' && (
        <>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowShoot(true)}><ScanLine className="w-4 h-4" /> ยิงออก</Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> เพิ่มออเดอร์</Button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="w-8 h-8" />} title="ไม่มีออเดอร์" description="ออเดอร์จากแพลตฟอร์มต่างๆ จะแสดงที่นี่" />
          ) : (
            <div className="space-y-3">
              {filtered.map((ord, i) => (
                <Card key={ord.id} className={cn('p-4 animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all')} >
                  <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4" onClick={() => setDetailOrder(ord)}>
                    <div className={cn('px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap', PLATFORM_COLORS[ord.platform])}>
                      {PLATFORM_LABELS[ord.platform]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 truncate">{ord.order_number}</p>
                      <p className="text-sm text-surface-500 truncate">{ord.customer_name ?? '-'}</p>
                      <p className="text-xs text-surface-400">{formatDateTime(ord.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-surface-900">{formatCurrency(ord.amount)}</p>
                      {ord.net_profit > 0 && <p className="text-xs text-success-600">กำไร {formatCurrency(ord.net_profit)}</p>}
                    </div>
                    <Badge variant={ord.status === 'completed' ? 'success' : ord.status === 'cancelled' || ord.status === 'returned' ? 'error' : ord.status === 'shipped' ? 'info' : 'warning'}>
                      {STATUS_LABELS[ord.status] ?? ord.status}
                    </Badge>
                  </div>
                  {ord.tracking_number && (
                    <div className="mt-2 pt-2 border-t border-surface-100 text-xs text-surface-400">
                      ขนส่ง: {ord.shipping_provider ?? '-'} · เลข: {ord.tracking_number}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'chat' && (
        <EmptyState icon={<MessageSquare className="w-8 h-8" />} title="แชทลูกค้า" description="ฟีเจอร์รวมแชทจากทุกแพลตฟอร์มกำลังพัฒนา" />
      )}

      {tab === 'customers' && (
        <CustomersTab customers={customers} loading={loading} onAdd={() => setShowAddCustomer(true)} onSelect={(c) => setDetailCustomer(c)} />
      )}

      <ShootOrderModal open={showShoot} onClose={() => setShowShoot(false)} onCreated={load} profileId={profile?.id} profileName={profile?.display_name ?? profile?.email} />
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} onCreated={() => { setShowAddCustomer(false); load(); }} />
      <CustomerDetailModal customer={detailCustomer} onClose={() => setDetailCustomer(null)} onSaved={load} />

      <AddOrderModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} platformSettings={settings} />
      <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} profileId={profile?.id} profileName={profile?.display_name ?? profile?.email} onSaved={load} onDelete={(ord) => { setDetailOrder(null); setDeleteTarget(ord); }} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบ"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">ออเดอร์ {deleteTarget?.order_number ?? '-'}</p>
        <p>การลบนี้เป็นการลบถาวร ไม่สามารถกู้คืนได้ กรุณายืนยันหากต้องการลบจริง</p>
      </ConfirmDialog>
    </div>
  );
}

// ============ ADD ORDER MODAL (with product selection + auto-price) ============
function AddOrderModal({ open, onClose, onCreated, platformSettings }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  platformSettings: any[];
}) {
  const [platform, setPlatform] = useState('tiktok');
  const [orderNum, setOrderNum] = useState('');
  const [customer, setCustomer] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [shipping, setShipping] = useState('');
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformPrices, setPlatformPrices] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from('products').select('id, name, sku, cost_price, retail_price, is_active').eq('is_active', true).order('name').then(({ data }) => {
        setProducts(data ?? []);
      });
      supabase.from('product_platform_prices').select('product_id, lot_label, platform, price').then(({ data }) => {
        setPlatformPrices(data ?? []);
      });
    }
  }, [open]);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Try to get saved platform price
    const savedPrice = platformPrices.find((pp) => pp.product_id === productId && pp.platform === platform);
    if (savedPrice && Number(savedPrice.price) > 0) {
      setAmount(String(savedPrice.price));
    } else {
      // Calculate from retail + platform margin
      const setting = platformSettings.find((s) => s.platform === platform);
      const margin = setting ? Number(setting.margin_percent) : 20;
      const retail = Number(product.retail_price) || 0;
      setAmount(String(Math.round(retail * (1 + margin / 100))));
    }

    // Auto-fill fee from platform settings
    const setting = platformSettings.find((s) => s.platform === platform);
    if (setting) {
      const price = Number(savedPrice?.price ?? (Number(product.retail_price) || 0) * (1 + (Number(setting.margin_percent) || 20) / 100));
      setFee(String(Math.round(price * (Number(setting.platform_fee_percent) || 10) / 100)));
    }
  }

  function changePlatform(newPlatform: string) {
    setPlatform(newPlatform);
    if (selectedProductId) {
      // Re-fetch price for new platform
      const savedPrice = platformPrices.find((pp) => pp.product_id === selectedProductId && pp.platform === newPlatform);
      const product = products.find((p) => p.id === selectedProductId);
      const setting = platformSettings.find((s) => s.platform === newPlatform);
      if (savedPrice && Number(savedPrice.price) > 0) {
        setAmount(String(savedPrice.price));
      } else {
        const margin = setting ? Number(setting.margin_percent) : 20;
        const retail = Number(product?.retail_price) || 0;
        setAmount(String(Math.round(retail * (1 + margin / 100))));
      }
      if (setting) {
        const price = Number(savedPrice?.price ?? (Number(product?.retail_price) || 0) * (1 + (Number(setting.margin_percent) || 20) / 100));
        setFee(String(Math.round(price * (Number(setting.platform_fee_percent) || 10) / 100)));
      }
    }
  }

  async function submit() {
    setLoading(true);
    const amt = Number(amount) || 0;
    const f = Number(fee) || 0;
    const ship = Number(shipping) || 0;
    const product = products.find((p) => p.id === selectedProductId);
    const productInfo = product ? `${product.name} (${product.sku ?? '-'})` : null;
    const { error } = await supabase.from('online_orders').insert({
      platform, order_number: orderNum, customer_name: customer,
      product_info: productInfo,
      amount: amt, platform_fee: f, shipping_fee: ship, net_profit: amt - f - ship, status,
    });
    setLoading(false);
    if (error) {
      alert('เพิ่มออเดอร์ไม่สำเร็จ: ' + error.message);
      return;
    }
    onClose(); onCreated();
    setOrderNum(''); setCustomer(''); setAmount(''); setFee(''); setShipping(''); setSelectedProductId(''); setSearchQuery('');
  }

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มออเดอร์" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="แพลตฟอร์ม" value={platform} onChange={(e) => changePlatform(e.target.value)}>
            {Object.entries(PLATFORM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">รอดำเนินการ</option>
            <option value="to_ship">รอจัดส่ง</option>
            <option value="shipped">จัดส่งแล้ว</option>
            <option value="completed">สำเร็จ</option>
            <option value="cancelled">ยกเลิก</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">เลือกสินค้า</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาด้วยชื่อหรือ SKU..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-50 border border-surface-200 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-surface-200">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p.id)}
                className={cn('w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors border-b border-surface-100 last:border-0', selectedProductId === p.id && 'bg-primary-50')}
              >
                <span className="font-medium text-surface-900">{p.name}</span>
                <span className="text-xs text-surface-400 ml-2">{p.sku}</span>
              </button>
            ))}
            {filteredProducts.length === 0 && <p className="text-center text-sm text-surface-400 py-4">ไม่พบสินค้า</p>}
          </div>
        </div>

        <Input label="เลขออเดอร์" value={orderNum} onChange={(e) => setOrderNum(e.target.value)} />
        <Input label="ชื่อลูกค้า" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="ยอด" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="ค่าธรรมเนียม" type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
          <Input label="ค่าส่ง" type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} />
        </div>
        <div className="p-3 rounded-xl bg-success-50 flex items-center justify-between">
          <span className="text-sm text-surface-500">กำไรสุทธิ</span>
          <span className="font-bold text-success-600">
            {formatCurrency((Number(amount) || 0) - (Number(fee) || 0) - (Number(shipping) || 0))}
          </span>
        </div>
        <Button onClick={submit} loading={loading} className="w-full">เพิ่มออเดอร์</Button>
      </div>
    </Modal>
  );
}

function OrderDetailModal({ order, onClose, profileId, profileName, onSaved, onDelete }: {
  order: Order | null;
  onClose: () => void;
  profileId?: string;
  profileName?: string;
  onSaved: () => void;
  onDelete: (ord: Order) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [platform, setPlatform] = useState('');
  const [orderNum, setOrderNum] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [productInfo, setProductInfo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [status, setStatus] = useState('');
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!order) return;
    setEditing(false);
    setPlatform(order.platform ?? '');
    setOrderNum(order.order_number ?? '');
    setCustomer(order.customer_name ?? '');
    setPhone(order.customer_phone ?? '');
    setProductInfo(order.product_info ?? '');
    setAmount(String(order.amount ?? ''));
    setFee(String(order.platform_fee ?? ''));
    setShippingFee(String(order.shipping_fee ?? ''));
    setStatus(order.status ?? 'pending');
    setShippingProvider(order.shipping_provider ?? '');
    setTrackingNumber(order.tracking_number ?? '');
    setAddress(order.address ?? '');
  }, [order]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  if (!order) return null;

  const amt = Number(amount) || 0;
  const f = Number(fee) || 0;
  const ship = Number(shippingFee) || 0;
  const profit = amt - f - ship;

  async function save() {
    if (!order) return;
    setLoading(true);
    const snapshot = { ...order } as any;

    const { error } = await supabase.from('online_orders').update({
      platform,
      order_number: orderNum,
      customer_name: customer || null,
      customer_phone: phone || null,
      product_info: productInfo || null,
      amount: amt,
      platform_fee: f,
      shipping_fee: ship,
      net_profit: profit,
      status,
      shipping_provider: shippingProvider || null,
      tracking_number: trackingNumber || null,
      address: address || null,
    }).eq('id', order.id);

    if (!error) {
      await supabase.from('online_order_audit_logs').insert({
        order_id: order.id,
        action: 'edit',
        actor_profile_id: profileId ?? null,
        actor_name: profileName ?? null,
        previous_value: snapshot,
        new_value: { platform, order_number: orderNum, amount: amt, platform_fee: f, shipping_fee: ship, net_profit: profit, status },
        note: 'แก้ไขออเดอร์',
      });
    }

    setLoading(false);
    setToast({ type: 'success', msg: 'บันทึกสำเร็จ — กำไรคำนวณใหม่อัตโนมัติ' });
    onSaved();
    setTimeout(() => setEditing(false), 1000);
  }

  return (
    <Modal open={!!order} onClose={onClose} title="รายละเอียดออเดอร์" size="lg">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('px-3 py-2 rounded-lg text-xs font-bold', PLATFORM_COLORS[platform])}>
              {PLATFORM_LABELS[platform] ?? platform}
            </div>
            <div>
              <p className="font-semibold text-surface-900">{orderNum}</p>
              <p className="text-xs text-surface-400">{formatDateTime(order.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5" /> แก้ไข
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(order)}>
                  <Trash2 className="w-3.5 h-3.5" /> ลบ
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5" /> ยกเลิกแก้ไข
              </Button>
            )}
          </div>
        </div>

        {/* Status badge (read mode) */}
        {!editing && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-400">สถานะ:</span>
            <Badge variant={status === 'completed' ? 'success' : status === 'cancelled' || status === 'returned' ? 'error' : status === 'shipped' ? 'info' : 'warning'}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
        )}

        {/* Fields */}
        {editing ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select label="แพลตฟอร์ม" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {Object.entries(PLATFORM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
              <Select label="สถานะจัดส่ง" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">รอดำเนินการ</option>
                <option value="to_ship">รอจัดส่ง</option>
                <option value="shipped">จัดส่งแล้ว</option>
                <option value="completed">สำเร็จ</option>
                <option value="cancelled">ยกเลิก</option>
                <option value="returned">คืนสินค้า</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="เลขออเดอร์" value={orderNum} onChange={(e) => setOrderNum(e.target.value)} />
              <Input label="ชื่อลูกค้า" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="เบอร์ลูกค้า" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input label="ขนส่ง" value={shippingProvider} onChange={(e) => setShippingProvider(e.target.value)} />
            </div>
            <Input label="เลขพัสดุ" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
            <Textarea label="รายการสินค้าในออเดอร์" rows={2} value={productInfo} onChange={(e) => setProductInfo(e.target.value)} />
            <Textarea label="ที่อยู่จัดส่ง" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="ราคาขาย" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input label="ค่าธรรมเนียม" type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
              <Input label="ค่าส่ง" type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
            </div>
            {/* Live profit calc */}
            <div className="p-4 rounded-xl bg-success-50 flex items-center justify-between">
              <span className="text-sm text-surface-500">กำไรสุทธิ (คำนวณอัตโนมัติ)</span>
              <span className={cn('text-xl font-bold', profit > 0 ? 'text-success-600' : 'text-error-600')}>
                {formatCurrency(profit)}
              </span>
            </div>
            <Button onClick={save} loading={loading} className="w-full">
              <Save className="w-4 h-4" /> บันทึกการแก้ไข
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="ชื่อลูกค้า" value={customer} />
              <DetailField label="เบอร์ลูกค้า" value={phone} />
              <DetailField label="ขนส่ง" value={shippingProvider} />
              <DetailField label="เลขพัสดุ" value={trackingNumber} />
            </div>
            {productInfo && (
              <div>
                <p className="text-xs text-surface-400 mb-1">รายการสินค้า</p>
                <p className="text-sm text-surface-700">{productInfo}</p>
              </div>
            )}
            {address && (
              <div>
                <p className="text-xs text-surface-400 mb-1">ที่อยู่จัดส่ง</p>
                <p className="text-sm text-surface-700">{address}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-100">
              <div>
                <p className="text-xs text-surface-400">ราคาขาย</p>
                <p className="text-lg font-bold text-surface-900">{formatCurrency(amt)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">ค่าธรรมเนียม + ค่าส่ง</p>
                <p className="text-lg font-bold text-error-600">{formatCurrency(f + ship)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">กำไรสุทธิ</p>
                <p className={cn('text-lg font-bold', profit > 0 ? 'text-success-600' : 'text-error-600')}>{formatCurrency(profit)}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-sm text-surface-700">{value || '-'}</p>
    </div>
  );
}

// ============ CUSTOMERS TAB ============
function CustomersTab({ customers, loading, onAdd, onSelect }: {
  customers: Customer[];
  loading: boolean;
  onAdd: () => void;
  onSelect: (c: Customer) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  if (loading && customers.length === 0) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input-base pl-11"
            placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={onAdd}><UserPlus className="w-4 h-4" /> เพิ่มลูกค้าใหม่</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="ไม่มีลูกค้า" description="เพิ่มลูกค้าใหม่เพื่อเริ่มบันทึกประวัติการสั่งซื้อ" action={<Button size="sm" onClick={onAdd}><UserPlus className="w-4 h-4" /> เพิ่มลูกค้าใหม่</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c, i) => (
            <Card key={c.id} hover className="p-4 cursor-pointer animate-slide-up" onClick={() => onSelect(c)}>
              <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900">{c.name}</p>
                      <p className="text-xs text-surface-400 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-100">
                  <div>
                    <p className="text-xs text-surface-400">ซื้อสะสม</p>
                    <p className="text-sm font-bold text-surface-900">{formatCurrency(c.total_spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">สั่งซื้อ</p>
                    <p className="text-sm font-bold text-surface-900">{c.order_count} ครั้ง</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">ล่าสุด</p>
                    <p className="text-sm font-medium text-surface-600">{c.last_order_at ? formatDateTime(c.last_order_at) : '-'}</p>
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

// ============ ADD CUSTOMER MODAL ============
function AddCustomerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setPhone(''); setNote(''); setError(''); }
  }, [open]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { setError('กรุณากรอกชื่อและเบอร์โทร'); return; }
    setLoading(true); setError('');
    const { error: insErr } = await supabase.from('customers').insert({
      name: name.trim(), phone: phone.trim(), note: note.trim() || null,
    });
    setLoading(false);
    if (insErr) { setError(insErr.message); return; }
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มลูกค้าใหม่" size="sm">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-error-50 text-sm text-error-600 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <Input label="ชื่อลูกค้า *" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-สกุล" autoFocus />
        <Input label="เบอร์โทร *" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxx" />
        <Textarea label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ข้อมูลเพิ่มเติม (ถ้ามี)" rows={2} />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>ยกเลิก</Button>
          <Button className="flex-1" loading={loading} onClick={submit}><Save className="w-4 h-4" /> บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ CUSTOMER DETAIL MODAL ============
function CustomerDetailModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name); setPhone(customer.phone); setNote(customer.note ?? '');
    setEditing(false);
    setLoadingOrders(true);
    supabase.from('customer_orders').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setOrders(data ?? []); setLoadingOrders(false); });
  }, [customer]);

  if (!customer) return null;

  const allItems: Record<string, number> = {};
  for (const ord of orders) {
    const items = Array.isArray(ord.items) ? ord.items : [];
    for (const it of items) {
      const key = it.product_name ?? it.sku ?? 'unknown';
      allItems[key] = (allItems[key] ?? 0) + (Number(it.quantity) || 0);
    }
  }
  const topProduct = Object.entries(allItems).sort((a, b) => b[1] - a[1])[0];

  async function saveEdit() {
    if (!customer) return;
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    await supabase.from('customers').update({ name: name.trim(), phone: phone.trim(), note: note.trim() || null }).eq('id', customer.id);
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  return (
    <Modal open={!!customer} onClose={onClose} title="รายละเอียดลูกค้า" size="lg">
      <div className="space-y-5">
        {/* Contact info */}
        <div className="p-4 rounded-xl bg-surface-50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <input className="input-base text-sm py-1" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="input-base text-sm py-1 w-32" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร" />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-surface-900">{name}</p>
                    <p className="text-sm text-surface-400 flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</p>
                  </>
                )}
              </div>
            </div>
            {editing ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>ยกเลิก</Button>
                <Button size="sm" loading={saving} onClick={saveEdit}><Save className="w-3.5 h-3.5" /> บันทึก</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" /> แก้ไข</Button>
            )}
          </div>
          {editing && (
            <Textarea label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="หมายเหตุเกี่ยวกับลูกค้า" />
          )}
          {!editing && note && <p className="text-xs text-surface-500 pt-2 border-t border-surface-100">{note}</p>}
        </div>

        {/* Mini dashboard */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-primary-50 text-center">
            <p className="text-xs text-surface-400">ยอดซื้อสะสม</p>
            <p className="text-lg font-bold text-primary-600">{formatCurrency(customer.total_spent)}</p>
          </div>
          <div className="p-3 rounded-xl bg-success-50 text-center">
            <p className="text-xs text-surface-400">จำนวนครั้งสั่งซื้อ</p>
            <p className="text-lg font-bold text-success-600">{customer.order_count}</p>
          </div>
          <div className="p-3 rounded-xl bg-accent-50 text-center">
            <p className="text-xs text-surface-400">สั่งบ่อยสุด</p>
            <p className="text-sm font-bold text-accent-600 truncate" title={topProduct?.[0]}>{topProduct ? `${topProduct[0]} (${topProduct[1]})` : '-'}</p>
          </div>
        </div>

        {/* Order history */}
        <div>
          <p className="text-sm font-semibold text-surface-700 mb-2">ประวัติการสั่งซื้อ ({orders.length})</p>
          {loadingOrders ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-8">ยังไม่มีประวัติการสั่งซื้อ</p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {orders.map((ord) => {
                const items = Array.isArray(ord.items) ? ord.items : [];
                const totalDiscount = Number(ord.discount_amount) + (items.reduce((s: number, it: any) => s + (Number(it.discount_amount) || 0), 0) as number);
                return (
                  <div key={ord.id} className="p-3 rounded-xl border border-surface-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{ord.channel === 'line' ? 'ไลน์แอด' : ord.channel}</Badge>
                        <p className="text-xs text-surface-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(ord.created_at)}</p>
                      </div>
                      <p className="font-bold text-surface-900">{formatCurrency(ord.total)}</p>
                    </div>
                    <div className="space-y-1">
                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-surface-600">
                          <span>{it.product_name} × {it.quantity}{it.unit ? ` ${it.unit}` : ''}</span>
                          <span>{formatCurrency(Number(it.unit_price) * Number(it.quantity))}{Number(it.discount_amount) > 0 ? ` (-${formatCurrency(it.discount_amount)})` : ''}</span>
                        </div>
                      ))}
                    </div>
                    {totalDiscount > 0 && (
                      <p className="text-xs text-error-600 text-right">ส่วนลดรวม: -{formatCurrency(totalDiscount)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============ SHOOT ORDER MODAL (ยิงออก) ============
function ShootOrderModal({ open, onClose, onCreated, profileId, profileName }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  profileId?: string;
  profileName?: string;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCust, setShowAddCust] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [lines, setLines] = useState<ShootLineItem[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [billDiscountValue, setBillDiscountValue] = useState('0');
  const [billDiscountMode, setBillDiscountMode] = useState<'baht' | 'percent'>('baht');
  const [purchaseHistory, setPurchaseHistory] = useState<{ product_id: string; product_name: string; sku: string; unit_price: number; count: number; last_ordered_at: string }[]>([]);

  useEffect(() => {
    if (open) {
      setCustomerSearch(''); setSelectedCustomer(null); setScanInput(''); setLines([]);
      setNote(''); setToast(null); setBillDiscountValue('0'); setBillDiscountMode('baht');
      supabase.from('customers').select('*').order('name').limit(200).then(({ data }) => setCustomers(data as Customer[] ?? []));
      supabase.from('products').select('*, stock_lots(id, quantity, lot_label, cost_price, retail_price, branch_id, expiry_date), product_barcodes(id, barcode, unit, unit_multiplier)').eq('is_active', true).then(({ data }) => setProducts(data ?? []));
    }
  }, [open]);

  useEffect(() => {
    if (!selectedCustomer) { setPurchaseHistory([]); return; }
    supabase.from('customer_orders').select('items, created_at').eq('customer_id', selectedCustomer.id).order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      const freq = new Map<string, { product_id: string; product_name: string; sku: string; unit_price: number; count: number; last_ordered_at: string }>();
      for (const order of data ?? []) {
        const items = (order.items as any[]) ?? [];
        for (const item of items) {
          if (!item.product_id) continue;
          const key = String(item.product_id);
          const existing = freq.get(key);
          if (existing) {
            existing.count += 1;
            if (new Date(order.created_at) > new Date(existing.last_ordered_at)) {
              existing.last_ordered_at = order.created_at;
              existing.unit_price = Number(item.unit_price) || existing.unit_price;
            }
          } else {
            freq.set(key, {
              product_id: key,
              product_name: item.product_name ?? '',
              sku: item.sku ?? '',
              unit_price: Number(item.unit_price) || 0,
              count: 1,
              last_ordered_at: order.created_at,
            });
          }
        }
      }
      const sorted = [...freq.values()].sort((a, b) => b.count - a.count || new Date(b.last_ordered_at).getTime() - new Date(a.last_ordered_at).getTime());
      setPurchaseHistory(sorted);
    });
  }, [selectedCustomer]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  function findProductByScan(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    for (const p of products) {
      const bc = (p.product_barcodes ?? []).find((b: any) => b.barcode.toLowerCase() === q);
      if (bc) return { product: p, scannedUnit: bc.unit, multiplier: Number(bc.unit_multiplier) || 1 };
    }
    const bySku = products.find((p) => p.sku.toLowerCase() === q);
    if (bySku) return { product: bySku, scannedUnit: bySku.unit ?? 'ชิ้น', multiplier: 1 };
    const byName = products.find((p) => p.name.toLowerCase().includes(q));
    if (byName) return { product: byName, scannedUnit: byName.unit ?? 'ชิ้น', multiplier: 1 };
    return undefined;
  }

  function triggerFlash(idx: number) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashIdx(idx);
    flashTimer.current = setTimeout(() => setFlashIdx(null), 1000);
  }

  function addLine(product: any, opts?: { scannedUnit?: string; multiplier?: number }) {
    const scannedUnit = opts?.scannedUnit ?? product.unit ?? 'ชิ้น';
    const multiplier = opts?.multiplier ?? 1;
    const lot = (product.stock_lots ?? [])[0];
    const price = String(product.retail_price ?? 0);
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.product_id === product.id && l.unit === scannedUnit);
      if (existingIdx >= 0) {
        const newQty = (Number(prev[existingIdx].quantity) || 0) + 1;
        triggerFlash(existingIdx);
        return prev.map((l, i) => i === existingIdx ? { ...l, quantity: String(newQty) } : l);
      }
      const newIdx = prev.length;
      triggerFlash(newIdx);
      return [...prev, {
        product_id: product.id,
        product_name: multiplier > 1 ? `${product.name} (หน่วย: ${scannedUnit})` : product.name,
        sku: product.sku,
        quantity: '1',
        unit: scannedUnit,
        unit_multiplier: multiplier,
        unit_price: price,
        lot_id: lot?.id ?? '',
        discount_value: '0',
        discount_mode: 'baht',
      }];
    });
  }

  function handleScan() {
    if (!scanInput.trim()) return;
    const match = findProductByScan(scanInput);
    if (match) {
      addLine(match.product, { scannedUnit: match.scannedUnit, multiplier: match.multiplier });
      setScanInput('');
    } else {
      setToast({ type: 'error', msg: `ไม่พบสินค้าที่ตรงกับ "${scanInput}"` });
    }
  }

  function adjustQty(idx: number, delta: number) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, quantity: String(Math.max(1, (Number(l.quantity) || 0) + delta)) };
    }));
  }

  function updateLine(idx: number, patch: Partial<ShootLineItem>) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lines.reduce((s, l) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unit_price) || 0;
    const disc = l.discount_mode === 'percent' ? price * (Number(l.discount_value) / 100) : Number(l.discount_value);
    return s + (price - disc) * qty;
  }, 0);

  const billDiscount = billDiscountMode === 'percent' ? subtotal * (Number(billDiscountValue) / 100) : Number(billDiscountValue);
  const total = Math.max(0, subtotal - billDiscount);

  async function submit() {
    if (!selectedCustomer) { setToast({ type: 'error', msg: 'กรุณาเลือกลูกค้า' }); return; }
    if (lines.length === 0) { setToast({ type: 'error', msg: 'กรุณาเพิ่มอย่างน้อย 1 รายการ' }); return; }
    setLoading(true);
    try {
      const orderNumber = `LINE-${Date.now().toString(36).toUpperCase()}`;
      const itemsJson = lines.map((l) => {
        const qty = Number(l.quantity) || 0;
        const price = Number(l.unit_price) || 0;
        const discVal = Number(l.discount_value) || 0;
        const discAmount = l.discount_mode === 'percent' ? price * (discVal / 100) : discVal;
        return {
          product_id: l.product_id,
          product_name: l.product_name,
          sku: l.sku,
          quantity: qty,
          unit: l.unit,
          unit_price: price,
          discount_amount: discAmount,
          discount_percent: l.discount_mode === 'percent' ? discVal : 0,
        };
      });

      // 1. Insert online_order
      const { data: ordData, error: ordErr } = await supabase.from('online_orders').insert({
        platform: 'line',
        order_number: orderNumber,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        product_info: lines.map((l) => `${l.product_name} x${l.quantity}`).join(', '),
        amount: total,
        platform_fee: 0,
        shipping_fee: 0,
        net_profit: total - lines.reduce((s, l) => {
          const lot = products.find((p) => p.id === l.product_id)?.stock_lots?.find((lot: any) => lot.id === l.lot_id);
          return s + (Number(lot?.cost_price ?? 0) * (Number(l.quantity) || 0) * (l.unit_multiplier || 1));
        }, 0),
        status: 'completed',
      }).select('id').single();
      if (ordErr) throw new Error(ordErr.message);

      // 2. Insert customer_order (links to online_order + triggers stats update)
      const { error: coErr } = await supabase.from('customer_orders').insert({
        customer_id: selectedCustomer.id,
        online_order_id: ordData.id,
        channel: 'line',
        items: itemsJson,
        subtotal,
        discount_amount: billDiscountMode === 'baht' ? Number(billDiscountValue) : 0,
        discount_percent: billDiscountMode === 'percent' ? Number(billDiscountValue) : 0,
        total,
        note: note.trim() || null,
      });
      if (coErr) throw new Error(coErr.message);

      // 3. Deduct stock: insert stock_movements (withdraw) + update stock_lots
      for (const line of lines) {
        const qty = Number(line.quantity) || 0;
        if (qty <= 0) continue;
        const baseQty = qty * (line.unit_multiplier || 1);
        const unitPrice = Number(line.unit_price) || 0;
        const discVal = Number(line.discount_value) || 0;
        const discountAmount = line.discount_mode === 'percent' ? unitPrice * (discVal / 100) : discVal;

        const { data: movementData, error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: line.product_id,
          branch_id: null,
          movement_type: 'withdraw',
          type_config: 'ขายไลน์แอด',
          quantity: baseQty,
          lot_id: line.lot_id || null,
          lot_label: null,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          discount_percent: line.discount_mode === 'percent' ? discVal : 0,
          reference_note: `ยิงออก: ${orderNumber} (${selectedCustomer.name})`,
          profile_id: profileId ?? null,
        }).select('id').single();
        if (moveErr) throw new Error(`ตัดสต็อกไม่สำเร็จ ${line.product_name}: ${moveErr.message}`);

        if (line.lot_id) {
          const { data: lotData } = await supabase.from('stock_lots').select('quantity').eq('id', line.lot_id).maybeSingle();
          const currentQty = Number(lotData?.quantity ?? 0);
          const newQty = Math.max(0, currentQty - baseQty);
          const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: newQty }).eq('id', line.lot_id);
          if (lotErr) throw new Error(`ตัดสต็อกไม่สำเร็จ ${line.product_name}: ${lotErr.message}`);
        }
      }

      setToast({ type: 'success', msg: `บันทึกออเดอร์ ${orderNumber} สำเร็จ` });
      setTimeout(() => { onCreated(); onClose(); }, 1200);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="ยิงออก (ไลน์แอด)" size="xl">
        <div className="space-y-5">
          {toast && (
            <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {toast.msg}
            </div>
          )}

          {/* Customer selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">เลือกลูกค้า</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50 border border-primary-200">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">{selectedCustomer.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="font-medium text-surface-900">{selectedCustomer.name}</p>
                    <p className="text-xs text-surface-400">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(null)}>เปลี่ยน</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input className="input-base pl-11" placeholder="พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} autoFocus />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setShowAddCust(true)}><UserPlus className="w-4 h-4" /> เพิ่มใหม่</Button>
                </div>
                {customerSearch && filteredCustomers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-surface-200 divide-y divide-surface-100">
                    {filteredCustomers.slice(0, 20).map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="w-full flex items-center gap-3 p-3 hover:bg-surface-50 text-left transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">{c.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-surface-900">{c.name}</p>
                          <p className="text-xs text-surface-400">{c.phone} · ซื้อ {c.order_count} ครั้ง</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-surface-400" />
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch && filteredCustomers.length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-3">ไม่พบลูกค้า — กด "เพิ่มใหม่" เพื่อสร้าง</p>
                )}
              </div>
            )}
          </div>

          {/* Purchase history quick-pick */}
          {selectedCustomer && purchaseHistory.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">สินค้าที่เคยซื้อ</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {purchaseHistory.slice(0, 30).map((item) => {
                  const product = products.find((p) => p.id === item.product_id);
                  if (!product) return null;
                  return (
                    <button
                      key={item.product_id}
                      onClick={() => addLine(product)}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-700 truncate max-w-[140px]">{item.product_name}</p>
                        <p className="text-[10px] text-surface-400">฿{formatCurrency(item.unit_price)} · ซื้อ {item.count}ครั้ง</p>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scan / add products */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">สแกน/กรอกสินค้า</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input className="input-base pl-11" placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..." value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }} />
              </div>
              <Button variant="secondary" size="sm" onClick={handleScan}><Plus className="w-4 h-4" /> เพิ่ม</Button>
            </div>
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {lines.map((line, idx) => (
                <div key={idx} className={cn('p-3 rounded-xl bg-surface-50 border space-y-2 transition-colors', flashIdx === idx ? 'border-success-400' : 'border-surface-200')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-surface-900 truncate">{line.product_name}</p>
                      <p className="text-xs text-surface-400">{line.sku}</p>
                    </div>
                    <button onClick={() => removeLine(idx)} className="p-1 rounded-lg hover:bg-error-100 text-surface-400 hover:text-error-600 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="text-xs text-surface-500">จำนวน</label>
                      <div className="flex items-center gap-1">
                        <button onClick={() => adjustQty(idx, -1)} className="shrink-0 w-8 h-8 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors flex items-center justify-center">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input className="input-base text-sm py-1.5 text-center min-w-0 flex-1" type="number" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                        <button onClick={() => adjustQty(idx, 1)} className="shrink-0 w-8 h-8 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">ราคา/หน่วย</label>
                      <input className="input-base text-sm py-1.5" type="number" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">ส่วนลด</label>
                      <input className="input-base text-sm py-1.5" type="number" value={line.discount_value} onChange={(e) => updateLine(idx, { discount_value: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">ประเภท</label>
                      <select className="input-base text-sm py-1.5 cursor-pointer" value={line.discount_mode} onChange={(e) => updateLine(idx, { discount_mode: e.target.value as 'baht' | 'percent' })}>
                        <option value="baht">บาท</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bill-level discount + total */}
          {lines.length > 0 && (
            <div className="space-y-3 border-t border-surface-200 pt-4">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="text-xs text-surface-500">ส่วนลดทั้งบิล</label>
                  <input className="input-base text-sm py-1.5" type="number" value={billDiscountValue} onChange={(e) => setBillDiscountValue(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-surface-500">ประเภท</label>
                  <select className="input-base text-sm py-1.5 cursor-pointer" value={billDiscountMode} onChange={(e) => setBillDiscountMode(e.target.value as 'baht' | 'percent')}>
                    <option value="baht">บาท</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
                <span className="text-sm text-surface-600">ยอดก่อนส่วนลด: {formatCurrency(subtotal)}</span>
                {billDiscount > 0 && <span className="text-sm text-error-600">- {formatCurrency(billDiscount)}</span>}
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary-50">
                <span className="text-sm font-medium text-surface-700">ยอดรวมสุทธิ</span>
                <span className="text-2xl font-bold text-primary-600">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <Input label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />

          <Button onClick={submit} loading={loading} disabled={!selectedCustomer || lines.length === 0} className="w-full">
            ยืนยันออเดอร์ ({lines.length} รายการ)
          </Button>
        </div>
      </Modal>

      <AddCustomerModal open={showAddCust} onClose={() => setShowAddCust(false)} onCreated={async () => {
        setShowAddCust(false);
        const { data } = await supabase.from('customers').select('*').order('name').limit(200);
        setCustomers(data as Customer[] ?? []);
      }} />
    </>
  );
}
