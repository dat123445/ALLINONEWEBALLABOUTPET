import { useEffect, useState, useCallback } from 'react';
import { Plus, Megaphone, Tag, Calendar, TrendingUp, Image, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, StatCard, EmptyState, Spinner, ProgressBar } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/format';

type Promotion = {
  id: string;
  name: string;
  code: string | null;
  discount_type: string;
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  usage_count: number;
  total_sales: number;
  is_active: boolean;
};

type Campaign = {
  id: string;
  name: string;
  platform: string | null;
  budget: number;
  actual_spend: number;
  sales_generated: number;
  roi: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type ContentPlan = {
  id: string;
  title: string;
  platform: string | null;
  content_type: string | null;
  publish_date: string | null;
  status: string;
  notes: string | null;
};

export function MarketingPage() {
  const [tab, setTab] = useState('promotions');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contents, setContents] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromo, setShowPromo] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [promoRes, campRes, contRes] = await Promise.all([
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('content_plans').select('*').order('publish_date', { ascending: true }),
    ]);
    setPromotions(promoRes.data as Promotion[] ?? []);
    setCampaigns(campRes.data as Campaign[] ?? []);
    setContents(contRes.data as ContentPlan[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePromos = promotions.filter((p) => p.is_active).length;
  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget), 0);
  const totalSpend = campaigns.reduce((s, c) => s + Number(c.actual_spend), 0);
  const totalSales = campaigns.reduce((s, c) => s + Number(c.sales_generated), 0);
  const overallROI = totalSpend > 0 ? ((totalSales - totalSpend) / totalSpend) * 100 : 0;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="โปรโมชั่นใช้งาน" value={activePromos} icon={<Tag className="w-5 h-5" />} color="primary" delay="animate-delay-100" />
        <StatCard label="งบแคมเปญ" value={formatCurrency(totalBudget)} icon={<Target className="w-5 h-5" />} color="accent" delay="animate-delay-200" />
        <StatCard label="ใช้จ่ายแล้ว" value={formatCurrency(totalSpend)} icon={<TrendingUp className="w-5 h-5" />} color="warning" delay="animate-delay-300" />
        <StatCard label="ROI รวม" value={`${overallROI.toFixed(1)}%`} icon={<Megaphone className="w-5 h-5" />} color={overallROI >= 0 ? 'success' : 'error'} delay="animate-delay-400" />
      </div>

      <Tabs
        tabs={[
          { key: 'promotions', label: 'โปรโมชั่น' },
          { key: 'campaigns', label: 'แคมเปญ' },
          { key: 'content', label: 'Content Plan' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'promotions' && (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowPromo(true)}><Plus className="w-4 h-4" /> สร้างโปรโมชั่น</Button>
          </div>
          {promotions.length === 0 ? (
            <EmptyState icon={<Tag className="w-8 h-8" />} title="ไม่มีโปรโมชั่น" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map((p, i) => (
                <Card key={p.id} hover className={cn('p-5 animate-slide-up')}>
                  <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-surface-900">{p.name}</p>
                        {p.code && <p className="text-xs text-primary-600 font-mono mt-0.5">{p.code}</p>}
                      </div>
                      <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? 'ใช้งาน' : 'หยุด'}</Badge>
                    </div>
                    <p className="text-2xl font-bold text-primary-600">
                      {p.discount_type === 'percent' ? `${p.discount_value}%` : formatCurrency(p.discount_value)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-surface-400 mt-3 pt-3 border-t border-surface-100">
                      <span>ใช้แล้ว {p.usage_count} ครั้ง</span>
                      <span>ยอดขาย {formatCurrency(p.total_sales)}</span>
                    </div>
                    {p.start_date && p.end_date && (
                      <p className="text-xs text-surface-400 mt-2">{formatDate(p.start_date)} - {formatDate(p.end_date)}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'campaigns' && (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowCampaign(true)}><Plus className="w-4 h-4" /> สร้างแคมเปญ</Button>
          </div>
          {campaigns.length === 0 ? (
            <EmptyState icon={<Target className="w-8 h-8" />} title="ไม่มีแคมเปญ" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((c, i) => {
                const spendPct = c.budget > 0 ? (c.actual_spend / c.budget) * 100 : 0;
                const roi = c.actual_spend > 0 ? ((c.sales_generated - c.actual_spend) / c.actual_spend) * 100 : 0;
                return (
                  <Card key={c.id} hover className={cn('p-5 animate-slide-up')}>
                    <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-surface-900">{c.name}</p>
                          <p className="text-xs text-surface-400">{c.platform ?? '-'} · {formatDate(c.start_date)} - {formatDate(c.end_date)}</p>
                        </div>
                        <Badge variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'info' : c.status === 'cancelled' ? 'error' : 'warning'}>
                          {c.status === 'planned' ? 'วางแผน' : c.status === 'active' ? 'กำลังทำ' : c.status === 'completed' ? 'เสร็จ' : 'ยกเลิก'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div><p className="text-xs text-surface-400">งบประมาณ</p><p className="font-bold text-surface-900">{formatCurrency(c.budget)}</p></div>
                        <div><p className="text-xs text-surface-400">ใช้จ่าย</p><p className="font-bold text-warning-600">{formatCurrency(c.actual_spend)}</p></div>
                        <div><p className="text-xs text-surface-400">ยอดขาย</p><p className="font-bold text-success-600">{formatCurrency(c.sales_generated)}</p></div>
                      </div>
                      <ProgressBar value={c.actual_spend} max={c.budget} color={spendPct > 90 ? 'error' : 'warning'} label="งบที่ใช้" />
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-surface-100">
                        <span className="text-sm text-surface-500">ROI</span>
                        <span className={cn('font-bold', roi >= 0 ? 'text-success-600' : 'text-error-600')}>{roi.toFixed(1)}%</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'content' && (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowContent(true)}><Plus className="w-4 h-4" /> วางแผนคอนเทนต์</Button>
          </div>
          {contents.length === 0 ? (
            <EmptyState icon={<Calendar className="w-8 h-8" />} title="ไม่มีแผนคอนเทนต์" />
          ) : (
            <div className="space-y-3">
              {contents.map((c, i) => (
                <Card key={c.id} className={cn('p-4 flex items-center gap-4 animate-slide-up')}>
                  <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }} className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                      <Image className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-surface-900">{c.title}</p>
                      <p className="text-sm text-surface-500">{c.platform ?? '-'} · {c.content_type ?? '-'}</p>
                      {c.publish_date && <p className="text-xs text-surface-400">{formatDate(c.publish_date)}</p>}
                    </div>
                    <Badge variant={c.status === 'published' ? 'success' : c.status === 'in_progress' ? 'info' : c.status === 'cancelled' ? 'error' : 'default'}>
                      {c.status === 'planned' ? 'วางแผน' : c.status === 'in_progress' ? 'กำลังทำ' : c.status === 'published' ? 'เผยแพร่' : 'ยกเลิก'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <PromoModal open={showPromo} onClose={() => setShowPromo(false)} onCreated={load} />
      <CampaignModal open={showCampaign} onClose={() => setShowCampaign(false)} onCreated={load} />
      <ContentModal open={showContent} onClose={() => setShowContent(false)} onCreated={load} />
    </div>
  );
}

function PromoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await supabase.from('promotions').insert({
      name, code: code || null, discount_type: type, discount_value: Number(value) || 0,
      start_date: start || null, end_date: end || null, is_active: true,
    });
    setLoading(false);
    onClose(); onCreated();
    setName(''); setCode(''); setValue(''); setStart(''); setEnd('');
  }

  return (
    <Modal open={open} onClose={onClose} title="สร้างโปรโมชั่น" size="sm">
      <div className="space-y-4">
        <Input label="ชื่อโปรโมชั่น" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="รหัส" value={code} onChange={(e) => setCode(e.target.value)} placeholder="NEWPET20" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="ประเภท" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="percent">เปอร์เซ็นต์</option>
            <option value="fixed">จำนวนเงิน</option>
          </Select>
          <Input label="มูลค่า" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="เริ่ม" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="สิ้นสุด" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button onClick={submit} loading={loading} className="w-full">สร้าง</Button>
      </div>
    </Modal>
  );
}

function CampaignModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [budget, setBudget] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await supabase.from('campaigns').insert({
      name, platform, budget: Number(budget) || 0, status: 'planned',
      start_date: start || null, end_date: end || null,
    });
    setLoading(false);
    onClose(); onCreated();
    setName(''); setBudget(''); setStart(''); setEnd('');
  }

  return (
    <Modal open={open} onClose={onClose} title="สร้างแคมเปญ" size="sm">
      <div className="space-y-4">
        <Input label="ชื่อแคมเปญ" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="แพลตฟอร์ม" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="tiktok">TikTok</option>
          <option value="shopee">Shopee</option>
          <option value="lazada">Lazada</option>
          <option value="line">LINE</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </Select>
        <Input label="งบประมาณ" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="เริ่ม" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="สิ้นสุด" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button onClick={submit} loading={loading} className="w-full">สร้าง</Button>
      </div>
    </Modal>
  );
}

function ContentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [type, setType] = useState('video');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await supabase.from('content_plans').insert({
      title, platform, content_type: type, publish_date: date || null, notes, status: 'planned',
    });
    setLoading(false);
    onClose(); onCreated();
    setTitle(''); setNotes(''); setDate('');
  }

  return (
    <Modal open={open} onClose={onClose} title="วางแผนคอนเทนต์" size="sm">
      <div className="space-y-4">
        <Input label="ชื่อคอนเทนต์" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="แพลตฟอร์ม" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="shopee">Shopee</option>
            <option value="lazada">Lazada</option>
            <option value="line">LINE</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </Select>
          <Select label="ประเภท" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="live">Live</option>
            <option value="story">Story</option>
            <option value="reel">Reel</option>
          </Select>
        </div>
        <Input label="วันที่เผยแพร่" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Textarea label="บันทึก" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button onClick={submit} loading={loading} className="w-full">สร้าง</Button>
      </div>
    </Modal>
  );
}
