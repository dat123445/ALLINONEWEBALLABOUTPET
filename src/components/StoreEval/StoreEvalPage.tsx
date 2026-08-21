import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Store, History, LayoutDashboard, Filter, ChevronDown, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Select, Tabs, EmptyState, Spinner, ConfirmDialog, StatCard } from '@/components/ui';
import { formatNumber, formatDate, cn } from '@/lib/format';

// ============ TYPES ============
type Criteria = {
  id: string;
  code: string;
  platform: string;
  category: string;
  name: string;
  condition: string;
  target_value: number;
  unit: string;
  sort_order: number;
};

type Store = {
  id: string;
  name: string;
  brand: string;
};

type StorePlatform = {
  id: string;
  store_id: string;
  platform: string;
};

type EvalRecord = {
  id: string;
  store_id: string;
  platform: string;
  evaluation_date: string;
  criteria_code: string;
  actual_value: number;
  passed: boolean;
  created_at: string;
};

type StoreWithPlatforms = Store & {
  platforms: StorePlatform[];
};

const PLATFORM_LABELS: Record<string, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok',
};

const BRAND_LABELS: Record<string, string> = {
  buddy: 'บัดดี้',
  allabout: 'ออลอะเบาท์',
};

const CONDITION_LABELS: Record<string, string> = {
  '<': 'น้อยกว่า',
  '<=': 'น้อยกว่าหรือเท่ากับ',
  '>': 'มากกว่า',
  '>=': 'มากกว่าหรือเท่ากับ',
  '=': 'เท่ากับ',
};

function evaluatePass(condition: string, target: number, actual: number): boolean {
  switch (condition) {
    case '<': return actual < target;
    case '<=': return actual <= target;
    case '>': return actual > target;
    case '>=': return actual >= target;
    case '=': return actual === target;
    default: return false;
  }
}

export function StoreEvalPage() {
  const [tab, setTab] = useState('new');
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [stores, setStores] = useState<StoreWithPlatforms[]>([]);
  const [records, setRecords] = useState<EvalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [critRes, storeRes, spRes, recRes] = await Promise.all([
      supabase.from('store_eval_criteria').select('*').order('sort_order'),
      supabase.from('store_eval_stores').select('*').order('name'),
      supabase.from('store_eval_store_platforms').select('*'),
      supabase.from('store_eval_records').select('*').order('evaluation_date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    setCriteria(critRes.data as Criteria[] ?? []);
    const storeList = (storeRes.data as Store[] ?? []);
    const spList = (spRes.data as StorePlatform[] ?? []);
    setStores(storeList.map(s => ({ ...s, platforms: spList.filter(sp => sp.store_id === s.id) })));
    setRecords(recRes.data as EvalRecord[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-surface-900">ระบบประเมินเกณฑ์ร้านค้าแนะนำ</h2>
          <p className="text-sm text-surface-500">ติดตามและประเมินผลตัวชี้วัดร้านค้าแนะนำ Shopee / Lazada / TikTok</p>
        </div>
        <Tabs
          tabs={[
            { key: 'new', label: 'กรอกผลรอบใหม่', icon: 'plus' },
            { key: 'history', label: 'ประวัติ', count: records.length > 0 ? records.length : undefined },
            { key: 'dashboard', label: 'แดชบอร์ด' },
          ] as any}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'new' && <NewEvaluationTab criteria={criteria} stores={stores} onSaved={load} />}
      {tab === 'history' && <HistoryTab records={records} stores={stores} criteria={criteria} onSaved={load} />}
      {tab === 'dashboard' && <DashboardTab records={records} stores={stores} criteria={criteria} />}
    </div>
  );
}

// ============ NEW EVALUATION TAB ============
function NewEvaluationTab({ criteria, stores, onSaved }: {
  criteria: Criteria[];
  stores: StoreWithPlatforms[];
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [evalDate, setEvalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generated, setGenerated] = useState(false);
  const [actualValues, setActualValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [saveResult, setSaveResult] = useState<{ passed: number; failed: number } | null>(null);

  const filteredStores = useMemo(() => {
    if (brandFilter === 'all') return stores;
    return stores.filter(s => s.brand === brandFilter);
  }, [stores, brandFilter]);

  // Build store+platform options
  const storePlatformOptions = useMemo(() => {
    const options: { storeId: string; platform: string; label: string }[] = [];
    filteredStores.forEach(s => {
      s.platforms.forEach(sp => {
        options.push({
          storeId: s.id,
          platform: sp.platform,
          label: `${s.name} (${PLATFORM_LABELS[sp.platform] ?? sp.platform})`,
        });
      });
    });
    return options;
  }, [filteredStores]);

  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const platformCriteria = useMemo(() => {
    if (!selectedPlatform) return [];
    return criteria.filter(c => c.platform === selectedPlatform).sort((a, b) => a.sort_order - b.sort_order);
  }, [criteria, selectedPlatform]);

  function handleGenerate() {
    setGenerated(true);
    setActualValues({});
    setSaveResult(null);
  }

  function handleReset() {
    setGenerated(false);
    setActualValues({});
    setSaveResult(null);
    setSelectedStoreId('');
    setSelectedPlatform('');
  }

  function handleSelectOption(value: string) {
    const parts = value.split('||');
    if (parts.length === 2) {
      setSelectedStoreId(parts[0]);
      setSelectedPlatform(parts[1]);
      setGenerated(false);
      setActualValues({});
      setSaveResult(null);
    }
  }

  const selectedOption = selectedStoreId && selectedPlatform ? `${selectedStoreId}||${selectedPlatform}` : '';

  async function handleSave() {
    if (!selectedStoreId || !selectedPlatform || !evalDate) return;
    setSaving(true);
    const rows: { criteria_code: string; actual_value: number; passed: boolean }[] = [];
    for (const crit of platformCriteria) {
      const valStr = actualValues[crit.code];
      if (valStr == null || valStr === '') continue;
      const val = Number(valStr);
      if (isNaN(val)) continue;
      const passed = evaluatePass(crit.condition, crit.target_value, val);
      rows.push({ criteria_code: crit.code, actual_value: val, passed });
    }
    if (rows.length === 0) {
      setSaving(false);
      return;
    }
    const insertData = rows.map(r => ({
      store_id: selectedStoreId,
      platform: selectedPlatform,
      evaluation_date: evalDate,
      criteria_code: r.criteria_code,
      actual_value: r.actual_value,
      passed: r.passed,
    }));
    const { error } = await supabase.from('store_eval_records').insert(insertData);
    setSaving(false);
    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    const passedCount = rows.filter(r => r.passed).length;
    const failedCount = rows.length - passedCount;
    setSaveResult({ passed: passedCount, failed: failedCount });
    onSaved();
  }

  const filledCount = Object.values(actualValues).filter(v => v !== '').length;
  const passCount = platformCriteria.filter(c => {
    const v = actualValues[c.code];
    if (!v) return false;
    return evaluatePass(c.condition, c.target_value, Number(v));
  }).length;
  const failCount = filledCount - passCount;

  return (
    <div className="space-y-4">
      {/* Store management button */}
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setShowStoreModal(true)}>
          <Store className="w-4 h-4" /> จัดการร้านค้า
        </Button>
      </div>

      {/* Step 1: Select store + platform + date */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-surface-900 mb-4">เลือกร้านค้าและรอบประเมิน</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="แบรนด์" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setSelectedStoreId(''); setSelectedPlatform(''); setGenerated(false); }}>
            <option value="all">ทั้งหมด</option>
            <option value="buddy">บัดดี้</option>
            <option value="allabout">ออลอะเบาท์</option>
          </Select>
          <Select label="ร้านค้า (แพลตฟอร์ม)" value={selectedOption} onChange={(e) => handleSelectOption(e.target.value)}>
            <option value="">— เลือกร้านค้า —</option>
            {storePlatformOptions.map((opt) => (
              <option key={`${opt.storeId}-${opt.platform}`} value={`${opt.storeId}||${opt.platform}`}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Input label="วันที่รอบประเมิน" type="date" value={evalDate} onChange={(e) => setEvalDate(e.target.value)} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleGenerate} disabled={!selectedStoreId || !selectedPlatform || !evalDate}>
            <Plus className="w-4 h-4" /> สร้างรายการตัวชี้วัด
          </Button>
          {generated && (
            <Button variant="ghost" onClick={handleReset}>เริ่มใหม่</Button>
          )}
        </div>
      </Card>

      {/* Step 2: Criteria table */}
      {generated && platformCriteria.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-surface-900">
                ตัวชี้วัด {PLATFORM_LABELS[selectedPlatform] ?? selectedPlatform}
              </h3>
              <p className="text-xs text-surface-500">
                {selectedStore?.name} · รอบประเมิน {formatDate(evalDate)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-500">กรอกแล้ว {filledCount}/{platformCriteria.length}</span>
              {filledCount > 0 && (
                <>
                  <Badge variant="success">ผ่าน {passCount}</Badge>
                  {failCount > 0 && <Badge variant="error">ไม่ผ่าน {failCount}</Badge>}
                </>
              )}
            </div>
          </div>

          {/* Save result banner */}
          {saveResult && (
            <div className={cn('mb-4 p-4 rounded-xl flex items-center gap-3 animate-slide-up',
              saveResult.failed === 0 ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700')}>
              {saveResult.failed === 0
                ? <CheckCircle className="w-5 h-5" />
                : <AlertTriangle className="w-5 h-5" />}
              <div>
                <p className="font-medium">
                  บันทึกสำเร็จ — ผ่าน {saveResult.passed} ข้อ{saveResult.failed > 0 ? `, ไม่ผ่าน ${saveResult.failed} ข้อ` : ''}
                </p>
                <p className="text-xs mt-0.5">สามารถดูผลรวมได้ที่แดชบอร์ด</p>
              </div>
            </div>
          )}

          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                  <th className="pb-2 pr-3 font-medium w-20">รหัส</th>
                  <th className="pb-2 pr-3 font-medium">ชื่อตัวชี้วัด</th>
                  <th className="pb-2 pr-3 font-medium w-28">หมวดหมู่</th>
                  <th className="pb-2 pr-3 font-medium w-24 text-center">เงื่อนไข</th>
                  <th className="pb-2 pr-3 font-medium w-20 text-right">เป้าหมาย</th>
                  <th className="pb-2 pr-3 font-medium w-32">ค่าที่วัดได้</th>
                  <th className="pb-2 font-medium w-20 text-center">ผล</th>
                </tr>
              </thead>
              <tbody>
                {platformCriteria.map((c) => {
                  const valStr = actualValues[c.code] ?? '';
                  const hasVal = valStr !== '';
                  const val = hasVal ? Number(valStr) : NaN;
                  const passed = hasVal && !isNaN(val) ? evaluatePass(c.condition, c.target_value, val) : null;
                  return (
                    <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                      <td className="py-2.5 pr-3 font-mono text-xs text-surface-500">{c.code}</td>
                      <td className="py-2.5 pr-3 text-surface-900">{c.name}</td>
                      <td className="py-2.5 pr-3 text-xs text-surface-500">{c.category}</td>
                      <td className="py-2.5 pr-3 text-center text-surface-500">
                        <span className="font-mono">{c.condition}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-surface-700">
                        {formatNumber(c.target_value)} <span className="text-xs text-surface-400">{c.unit}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          step="any"
                          value={valStr}
                          onChange={(e) => setActualValues(prev => ({ ...prev, [c.code]: e.target.value }))}
                          placeholder="กรอกค่า"
                          className={cn('input-base !py-1.5 !text-sm', hasVal && passed === true && '!border-success-400 !bg-success-50', hasVal && passed === false && '!border-error-400 !bg-error-50')}
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        {passed === true && <span className="inline-flex items-center gap-1 text-success-600 text-xs font-medium"><CheckCircle className="w-4 h-4" /> ผ่าน</span>}
                        {passed === false && <span className="inline-flex items-center gap-1 text-error-600 text-xs font-medium"><XCircle className="w-4 h-4" /> ไม่ผ่าน</span>}
                        {passed === null && <span className="text-surface-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleReset}>ยกเลิก</Button>
            <Button onClick={handleSave} loading={saving} disabled={filledCount === 0}>
              บันทึก ({filledCount} ตัวชี้วัด)
            </Button>
          </div>
        </Card>
      )}

      {generated && platformCriteria.length === 0 && (
        <EmptyState icon={<AlertTriangle className="w-8 h-8" />} title="ไม่พบตัวชี้วัดสำหรับแพลตฟอร์มนี้" />
      )}

      {/* Store management modal */}
      {showStoreModal && (
        <StoreManagementModal
          stores={stores}
          onClose={() => setShowStoreModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ============ HISTORY TAB ============
function HistoryTab({ records, stores, criteria, onSaved }: {
  records: EvalRecord[];
  stores: StoreWithPlatforms[];
  criteria: Criteria[];
  onSaved: () => void;
}) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingRecord, setEditingRecord] = useState<EvalRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group records by store+platform+date
  const grouped = useMemo(() => {
    const groups: { key: string; storeId: string; platform: string; date: string; records: EvalRecord[]; passedCount: number; failedCount: number }[] = [];
    const map = new Map<string, EvalRecord[]>();
    for (const r of records) {
      const key = `${r.store_id}|${r.platform}|${r.evaluation_date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const [key, recs] of map) {
      const [storeId, platform, date] = key.split('|');
      const store = stores.find(s => s.id === storeId);
      if (brandFilter !== 'all' && store?.brand !== brandFilter) continue;
      if (platformFilter !== 'all' && platform !== platformFilter) continue;
      if (storeFilter !== 'all' && storeId !== storeFilter) continue;
      if (dateFrom && date < dateFrom) continue;
      if (dateTo && date > dateTo) continue;
      const passedCount = recs.filter(r => r.passed).length;
      const failedCount = recs.length - passedCount;
      if (statusFilter === 'pass' && failedCount > 0) continue;
      if (statusFilter === 'fail' && failedCount === 0) continue;
      groups.push({ key, storeId, platform, date, records: recs, passedCount, failedCount });
    }
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [records, stores, brandFilter, platformFilter, storeFilter, dateFrom, dateTo, statusFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete all records in the same group
    const { error } = await supabase.from('store_eval_records')
      .delete()
      .eq('store_id', deleteTarget.store_id)
      .eq('platform', deleteTarget.platform)
      .eq('evaluation_date', deleteTarget.evaluation_date);
    setDeleting(false);
    if (!error) { setDeleteTarget(null); onSaved(); }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-surface-400" />
          <span className="text-sm font-medium text-surface-700">ตัวกรอง</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">ทุกแบรนด์</option>
            <option value="buddy">บัดดี้</option>
            <option value="allabout">ออลอะเบาท์</option>
          </Select>
          <Select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="all">ทุกแพลตฟอร์ม</option>
            <option value="shopee">Shopee</option>
            <option value="lazada">Lazada</option>
            <option value="tiktok">TikTok</option>
          </Select>
          <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="all">ทุกร้านค้า</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="pass">ผ่านทั้งหมด</option>
            <option value="fail">มีไม่ผ่าน</option>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="จากวันที่" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="ถึงวันที่" />
        </div>
      </Card>

      {grouped.length === 0 ? (
        <EmptyState icon={<History className="w-8 h-8" />} title="ไม่มีประวัติการประเมิน" description="เริ่มบันทึกผลรอบใหม่ได้ที่แท็บ 'กรอกผลรอบใหม่'" />
      ) : (
        <div className="space-y-3">
          {grouped.map((g, i) => {
            const store = stores.find(s => s.id === g.storeId);
            const allPass = g.failedCount === 0;
            return (
              <Card key={g.key} className={cn('p-4 animate-slide-up')}>
                <div style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2.5 rounded-xl', allPass ? 'bg-success-100 text-success-600' : 'bg-error-100 text-error-600')}>
                        {allPass ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-surface-900">{store?.name ?? 'ไม่ระบุ'}</p>
                          <Badge variant="primary">{PLATFORM_LABELS[g.platform] ?? g.platform}</Badge>
                          {store && <Badge variant="default">{BRAND_LABELS[store.brand] ?? store.brand}</Badge>}
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5">รอบประเมิน {formatDate(g.date)} · {g.records.length} ตัวชี้วัด</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={allPass ? 'success' : 'error'}>
                        {allPass ? `ผ่านทั้งหมด (${g.passedCount})` : `ผ่าน ${g.passedCount} / ไม่ผ่าน ${g.failedCount}`}
                      </Badge>
                      <button
                        onClick={() => setDeleteTarget(g.records[0])}
                        className="p-2 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors"
                        title="ลบรอบนี้ทั้งหมด"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <RecordDetailTable records={g.records} criteria={criteria} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบรอบประเมิน"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p>การลบนี้จะลบรายการตัวชี้วัดทั้งหมดในรอบนี้ ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </div>
  );
}

function RecordDetailTable({ records, criteria }: { records: EvalRecord[]; criteria: Criteria[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...records].sort((a, b) => {
    const ca = criteria.find(c => c.code === a.criteria_code);
    const cb = criteria.find(c => c.code === b.criteria_code);
    return (ca?.sort_order ?? 999) - (cb?.sort_order ?? 999);
  });
  const failedOnly = sorted.filter(r => !r.passed);
  const shown = expanded ? sorted : failedOnly.length > 0 ? failedOnly.slice(0, 3) : sorted.slice(0, 3);

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-surface-400 border-b border-surface-100">
            <th className="pb-1.5 pr-2 font-medium w-16">รหัส</th>
            <th className="pb-1.5 pr-2 font-medium">ตัวชี้วัด</th>
            <th className="pb-1.5 pr-2 font-medium w-20 text-right">เป้าหมาย</th>
            <th className="pb-1.5 pr-2 font-medium w-20 text-right">ค่าจริง</th>
            <th className="pb-1.5 font-medium w-16 text-center">ผล</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(r => {
            const c = criteria.find(c => c.code === r.criteria_code);
            return (
              <tr key={r.id} className="border-b border-surface-50">
                <td className="py-1.5 pr-2 font-mono text-surface-400">{r.criteria_code}</td>
                <td className="py-1.5 pr-2 text-surface-700">{c?.name ?? r.criteria_code}</td>
                <td className="py-1.5 pr-2 text-right text-surface-500">
                  {c ? `${c.condition} ${formatNumber(c.target_value)}` : '-'}
                </td>
                <td className="py-1.5 pr-2 text-right font-medium text-surface-900">
                  {formatNumber(r.actual_value)} {c?.unit && <span className="text-surface-400">{c.unit}</span>}
                </td>
                <td className="py-1.5 text-center">
                  {r.passed
                    ? <CheckCircle className="w-4 h-4 text-success-500 inline" />
                    : <XCircle className="w-4 h-4 text-error-500 inline" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          {expanded ? <><ChevronDown className="w-3 h-3" /> ย่อ</> : <><ChevronRight className="w-3 h-3" /> ดูทั้งหมด ({sorted.length})</>}
        </button>
      )}
    </div>
  );
}

// ============ DASHBOARD TAB ============
function DashboardTab({ records, stores, criteria }: {
  records: EvalRecord[];
  stores: StoreWithPlatforms[];
  criteria: Criteria[];
}) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Get available dates for the selected store+platform
  const availableDates = useMemo(() => {
    if (!selectedStoreId || !selectedPlatform) return [];
    const dates = new Set(records
      .filter(r => r.store_id === selectedStoreId && r.platform === selectedPlatform)
      .map(r => r.evaluation_date));
    return [...dates].sort().reverse();
  }, [records, selectedStoreId, selectedPlatform]);

  // Auto-select latest date
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
    }
    if (availableDates.length === 0 && selectedDate) {
      setSelectedDate('');
    }
  }, [availableDates, selectedDate]);

  const filteredStores = useMemo(() => {
    if (brandFilter === 'all') return stores;
    return stores.filter(s => s.brand === brandFilter);
  }, [stores, brandFilter]);

  const storePlatformOptions = useMemo(() => {
    const options: { storeId: string; platform: string; label: string }[] = [];
    filteredStores.forEach(s => {
      s.platforms.forEach(sp => {
        options.push({
          storeId: s.id,
          platform: sp.platform,
          label: `${s.name} (${PLATFORM_LABELS[sp.platform] ?? sp.platform})`,
        });
      });
    });
    return options;
  }, [filteredStores]);

  const selectedOption = selectedStoreId && selectedPlatform ? `${selectedStoreId}||${selectedPlatform}` : '';

  function handleSelectOption(value: string) {
    const parts = value.split('||');
    if (parts.length === 2) {
      setSelectedStoreId(parts[0]);
      setSelectedPlatform(parts[1]);
      setSelectedDate('');
    }
  }

  // Current round records
  const currentRecords = useMemo(() => {
    if (!selectedStoreId || !selectedPlatform || !selectedDate) return [];
    return records.filter(r => r.store_id === selectedStoreId && r.platform === selectedPlatform && r.evaluation_date === selectedDate);
  }, [records, selectedStoreId, selectedPlatform, selectedDate]);

  const passedCount = currentRecords.filter(r => r.passed).length;
  const failedCount = currentRecords.length - passedCount;
  const allPass = currentRecords.length > 0 && failedCount === 0;

  const failedRecords = currentRecords.filter(r => !r.passed);

  // History comparison
  const historyByDate = useMemo(() => {
    if (!selectedStoreId || !selectedPlatform) return [];
    const map = new Map<string, EvalRecord[]>();
    for (const r of records) {
      if (r.store_id !== selectedStoreId || r.platform !== selectedPlatform) continue;
      if (!map.has(r.evaluation_date)) map.set(r.evaluation_date, []);
      map.get(r.evaluation_date)!.push(r);
    }
    return [...map.entries()]
      .map(([date, recs]) => ({
        date,
        total: recs.length,
        passed: recs.filter(r => r.passed).length,
        failed: recs.filter(r => !r.passed).length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, selectedStoreId, selectedPlatform]);

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select label="แบรนด์" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setSelectedStoreId(''); setSelectedPlatform(''); setSelectedDate(''); }}>
            <option value="all">ทั้งหมด</option>
            <option value="buddy">บัดดี้</option>
            <option value="allabout">ออลอะเบาท์</option>
          </Select>
          <Select label="ร้านค้า (แพลตฟอร์ม)" value={selectedOption} onChange={(e) => handleSelectOption(e.target.value)}>
            <option value="">— เลือกร้านค้า —</option>
            {storePlatformOptions.map(opt => (
              <option key={`${opt.storeId}-${opt.platform}`} value={`${opt.storeId}||${opt.platform}`}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select label="รอบประเมิน" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={availableDates.length === 0}>
            <option value="">{availableDates.length === 0 ? 'ไม่มีข้อมูล' : '— เลือกรอบ —'}</option>
            {availableDates.map(d => <option key={d} value={d}>{formatDate(d)}</option>)}
          </Select>
        </div>
      </Card>

      {!selectedStoreId || !selectedPlatform || !selectedDate ? (
        <EmptyState icon={<LayoutDashboard className="w-8 h-8" />} title="เลือกร้านค้าและรอบประเมิน" description="เพื่อดูสรุปผลการประเมิน" />
      ) : currentRecords.length === 0 ? (
        <EmptyState icon={<History className="w-8 h-8" />} title="ไม่มีข้อมูลรอบนี้" />
      ) : (
        <>
          {/* Summary badge + KPI cards */}
          <div className={cn('p-5 rounded-2xl flex items-center gap-4 animate-slide-up',
            allPass ? 'bg-gradient-to-r from-success-500/10 to-success-500/5' : 'bg-gradient-to-r from-error-500/10 to-error-500/5')}>
            <div className={cn('p-4 rounded-2xl', allPass ? 'bg-success-100 text-success-600' : 'bg-error-100 text-error-600')}>
              {allPass ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-lg font-bold text-surface-900">
                {allPass ? 'ผ่านเกณฑ์ร้านค้าแนะนำ' : `ไม่ผ่านเกณฑ์ (${failedCount} ข้อ)`}
              </p>
              <p className="text-sm text-surface-500">
                {selectedStore?.name} · {PLATFORM_LABELS[selectedPlatform]} · รอบ {formatDate(selectedDate)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard label="ตัวชี้วัดทั้งหมด" value={currentRecords.length} color="primary" icon={<TrendingUp className="w-5 h-5" />} />
            <StatCard label="ผ่าน" value={passedCount} color="success" icon={<CheckCircle className="w-5 h-5" />} />
            <StatCard label="ไม่ผ่าน" value={failedCount} color="error" icon={<XCircle className="w-5 h-5" />} />
          </div>

          {/* Failed details */}
          {failedRecords.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-error-500" />
                ตัวชี้วัดที่ไม่ผ่าน
              </h3>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                      <th className="pb-2 pr-3 font-medium w-20">รหัส</th>
                      <th className="pb-2 pr-3 font-medium">ตัวชี้วัด</th>
                      <th className="pb-2 pr-3 font-medium w-28 text-center">เงื่อนไข</th>
                      <th className="pb-2 pr-3 font-medium w-24 text-right">เป้าหมาย</th>
                      <th className="pb-2 pr-3 font-medium w-24 text-right">ค่าจริง</th>
                      <th className="pb-2 font-medium w-20 text-center">ผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedRecords.map(r => {
                      const c = criteria.find(c => c.code === r.criteria_code);
                      return (
                        <tr key={r.id} className="border-b border-surface-100 bg-error-50/30">
                          <td className="py-2.5 pr-3 font-mono text-xs text-surface-500">{r.criteria_code}</td>
                          <td className="py-2.5 pr-3 text-surface-900">{c?.name ?? r.criteria_code}</td>
                          <td className="py-2.5 pr-3 text-center font-mono text-surface-500">{c?.condition}</td>
                          <td className="py-2.5 pr-3 text-right text-surface-700">
                            {c ? formatNumber(c.target_value) : '-'} <span className="text-xs text-surface-400">{c?.unit}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-bold text-error-600">
                            {formatNumber(r.actual_value)} <span className="text-xs text-surface-400">{c?.unit}</span>
                          </td>
                          <td className="py-2.5 text-center">
                            <XCircle className="w-4 h-4 text-error-500 inline" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* History comparison */}
          {historyByDate.length > 1 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                เปรียบเทียบผลย้อนหลัง
              </h3>
              <div className="space-y-2">
                {historyByDate.map(h => {
                  const pct = h.total > 0 ? (h.passed / h.total) * 100 : 0;
                  const isCurrent = h.date === selectedDate;
                  return (
                    <div key={h.date} className={cn('flex items-center gap-3 p-3 rounded-xl', isCurrent ? 'bg-primary-50 ring-1 ring-primary-200' : 'bg-surface-50')}>
                      <div className="w-28 text-sm text-surface-700 shrink-0">{formatDate(h.date)}</div>
                      <div className="flex-1">
                        <div className="h-2.5 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-success-500' : pct >= 70 ? 'bg-warning-500' : 'bg-error-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium text-surface-700 shrink-0 w-20 text-right">
                        {h.passed}/{h.total}
                      </div>
                      <div className="shrink-0 w-12 text-right">
                        <span className={cn('text-xs font-bold', pct === 100 ? 'text-success-600' : pct >= 70 ? 'text-warning-600' : 'text-error-600')}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============ STORE MANAGEMENT MODAL ============
function StoreManagementModal({ stores, onClose, onSaved }: {
  stores: StoreWithPlatforms[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('buddy');
  const [newPlatforms, setNewPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function togglePlatform(p: string) {
    setNewPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function addStore() {
    if (!newName.trim() || newPlatforms.length === 0) return;
    setSaving(true);
    const { data, error } = await supabase.from('store_eval_stores').insert({
      name: newName.trim(),
      brand: newBrand,
    }).select('id').single();
    if (!error && data) {
      const inserts = newPlatforms.map(p => ({ store_id: data.id, platform: p }));
      await supabase.from('store_eval_store_platforms').insert(inserts);
    }
    setSaving(false);
    if (!error) {
      setNewName('');
      setNewPlatforms([]);
      onSaved();
    }
  }

  async function confirmDeleteStore() {
    if (!deleteStoreId) return;
    setDeleting(true);
    await supabase.from('store_eval_stores').delete().eq('id', deleteStoreId);
    setDeleting(false);
    setDeleteStoreId(null);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="จัดการร้านค้า" size="lg">
      <div className="space-y-5">
        {/* Add new store */}
        <div className="space-y-3 p-4 rounded-xl bg-surface-50">
          <h4 className="text-sm font-semibold text-surface-900">เพิ่มร้านค้าใหม่</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="ชื่อร้านค้า" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น Pantang" />
            <Select label="แบรนด์" value={newBrand} onChange={(e) => setNewBrand(e.target.value)}>
              <option value="buddy">บัดดี้</option>
              <option value="allabout">ออลอะเบาท์</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">แพลตฟอร์มที่ขาย</label>
            <div className="flex gap-2 flex-wrap">
              {['shopee', 'lazada', 'tiktok'].map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    newPlatforms.includes(p) ? 'bg-primary-600 text-white' : 'bg-white text-surface-600 border border-surface-200 hover:border-primary-300')}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={addStore} loading={saving} disabled={!newName.trim() || newPlatforms.length === 0} size="sm">
            <Plus className="w-4 h-4" /> เพิ่มร้านค้า
          </Button>
        </div>

        {/* Existing stores */}
        <div>
          <h4 className="text-sm font-semibold text-surface-900 mb-3">ร้านค้าที่มี ({stores.length})</h4>
          {stores.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">ยังไม่มีร้านค้า</p>
          ) : (
            <div className="space-y-2">
              {stores.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
                  <div className="flex items-center gap-3">
                    <Store className="w-4 h-4 text-surface-400" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{s.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="default">{BRAND_LABELS[s.brand] ?? s.brand}</Badge>
                        {s.platforms.map(sp => (
                          <Badge key={sp.id} variant="info">{PLATFORM_LABELS[sp.platform] ?? sp.platform}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteStoreId(s.id)}
                    className="p-2 rounded-lg text-surface-400 hover:text-error-600 hover:bg-error-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteStoreId}
        onClose={() => setDeleteStoreId(null)}
        onConfirm={confirmDeleteStore}
        title="ยืนยันการลบร้านค้า"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p>การลบร้านค้าจะลบประวัติการประเมินทั้งหมดของร้านนี้ด้วย ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </Modal>
  );
}
