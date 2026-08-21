import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle, Building2, Users, ArrowRight, Globe, DatabaseBackup, Eraser, Download, Archive, HardDrive, Clock, FileSpreadsheet, AlertTriangle, ShieldCheck, FileDown, FileUp } from 'lucide-react';
import { Card, Button, Input, Badge, Spinner } from '@/components/ui';
import { cn, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, type Role } from '@/types/permissions';
import { ExportCenterTab, ImportCenterTab } from '@/components/ExportCenter';

type PlatformSetting = {
  id?: string;
  platform: string;
  margin_percent: number;
  platform_fee_percent: number;
  low_cost_margin_percent: number;
  low_cost_fee_percent: number;
  low_cost_threshold: number;
  is_connected: boolean;
};

type BackupRecord = {
  id: string;
  backup_type: string;
  file_name: string | null;
  record_count: number;
  created_at: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok Shop',
  shopee: 'Shopee',
  lazada: 'Lazada',
  line: 'LINE MyShop',
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-surface-900 text-white',
  shopee: 'bg-error-500 text-white',
  lazada: 'bg-primary-500 text-white',
  line: 'bg-success-500 text-white',
};

const competitors = [
  { platform: 'tiktok', label: 'TikTok Shop' },
  { platform: 'shopee', label: 'Shopee' },
  { platform: 'lazada', label: 'Lazada' },
  { platform: 'line', label: 'LINE MyShop' },
];

type SettingsTab = 'platforms' | 'export' | 'import' | 'backup' | 'clearstock';

export function SettingsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const canAccessDanger = isAdmin(roles);
  const [tab, setTab] = useState<SettingsTab>('platforms');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-surface-700 to-surface-900 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">ตั้งค่าระบบ</h2>
            <p className="text-sm text-white/70">ตั้งค่าแพลตฟอร์ม ส่งออกข้อมูล สำรองข้อมูล ล้างสต็อก</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-surface-100 rounded-lg w-fit">
        <button onClick={() => setTab('platforms')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === 'platforms' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
          <Globe className="w-4 h-4" /> แพลตฟอร์ม
        </button>
        <button onClick={() => setTab('export')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === 'export' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
          <FileDown className="w-4 h-4" /> ส่งออกข้อมูล
        </button>
        <button onClick={() => setTab('import')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === 'import' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
          <FileUp className="w-4 h-4" /> นำเข้าข้อมูล
        </button>
        {canAccessDanger && (
          <>
            <button onClick={() => setTab('backup')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === 'backup' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
              <DatabaseBackup className="w-4 h-4" /> สำรองข้อมูล
            </button>
            <button onClick={() => setTab('clearstock')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === 'clearstock' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
              <Eraser className="w-4 h-4" /> ล้างสต็อก
            </button>
          </>
        )}
      </div>

      {tab === 'platforms' && <PlatformSettingsTab onNavigate={onNavigate} />}
      {tab === 'export' && <ExportCenterTab />}
      {tab === 'import' && <ImportCenterTab />}
      {tab === 'backup' && canAccessDanger && <BackupTab profile={profile} />}
      {tab === 'clearstock' && canAccessDanger && <ClearStockTab />}
    </div>
  );
}

function PlatformSettingsTab({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { margin: string; fee: string; lowMargin: string; lowFee: string; threshold: string; isConnected: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('online_platform_settings').select('*');
    const list = (data ?? []) as PlatformSetting[];
    setSettings(list);
    const init: Record<string, { margin: string; fee: string; lowMargin: string; lowFee: string; threshold: string; isConnected: boolean }> = {};
    competitors.forEach((c) => {
      const s = list.find((x) => x.platform === c.platform);
      init[c.platform] = {
        margin: String(s?.margin_percent ?? 20),
        fee: String(s?.platform_fee_percent ?? 10),
        lowMargin: String(s?.low_cost_margin_percent ?? 30),
        lowFee: String(s?.low_cost_fee_percent ?? 10),
        threshold: String(s?.low_cost_threshold ?? 100),
        isConnected: s?.is_connected ?? false,
      };
    });
    setEditValues(init);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  async function savePlatform(platform: string) {
    setSaving(true);
    const ev = editValues[platform];
    if (!ev) return;
    const existing = settings.find((s) => s.platform === platform);
    const payload = {
      platform,
      margin_percent: Number(ev.margin) || 0,
      platform_fee_percent: Number(ev.fee) || 0,
      low_cost_margin_percent: Number(ev.lowMargin) || 0,
      low_cost_fee_percent: Number(ev.lowFee) || 0,
      low_cost_threshold: Number(ev.threshold) || 0,
      is_connected: ev.isConnected,
    };
    try {
      if (existing) {
        const { error } = await supabase.from('online_platform_settings').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('online_platform_settings').insert(payload);
        if (error) throw error;
      }
      setToast({ type: 'success', msg: `บันทึกการตั้งค่า${PLATFORM_LABELS[platform]}สำเร็จ` });
      load();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const c of competitors) {
        const ev = editValues[c.platform];
        if (!ev) continue;
        const existing = settings.find((s) => s.platform === c.platform);
        const payload = {
          platform: c.platform,
          margin_percent: Number(ev.margin) || 0,
          platform_fee_percent: Number(ev.fee) || 0,
          low_cost_margin_percent: Number(ev.lowMargin) || 0,
          low_cost_fee_percent: Number(ev.lowFee) || 0,
          low_cost_threshold: Number(ev.threshold) || 0,
          is_connected: ev.isConnected,
        };
        if (existing) {
          const { error } = await supabase.from('online_platform_settings').update(payload).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('online_platform_settings').insert(payload);
          if (error) throw error;
        }
      }
      setToast({ type: 'success', msg: 'บันทึกการตั้งค่าทั้งหมดสำเร็จ' });
      load();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <>
      {toast && (
        <div className={cn('p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 animate-slide-up', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card hover className="p-5 cursor-pointer" onClick={() => onNavigate?.('branches')}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary-100 text-primary-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900">จัดการสาขา</h3>
              <p className="text-sm text-surface-500">เพิ่ม แก้ไข ลบสาขา</p>
            </div>
            <ArrowRight className="w-5 h-5 text-surface-400" />
          </div>
        </Card>
        <Card hover className="p-5 cursor-pointer" onClick={() => onNavigate?.('users')}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary-100 text-primary-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900">จัดการผู้ใช้</h3>
              <p className="text-sm text-surface-500">เพิ่ม แก้ไข อนุมัติผู้ใช้</p>
            </div>
            <ArrowRight className="w-5 h-5 text-surface-400" />
          </div>
        </Card>
      </div>

      {/* Platform Settings */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-surface-900">ตั้งค่าแพลตฟอร์มออนไลน์</h3>
        </div>
        <p className="text-sm text-surface-500 mb-5">ค่าเหล่านี้จะถูกใช้ในการคำนวณราคาขายแนะนำในหน้า "สต๊อกสินค้า" และเครื่องคิดเลขโดยอัตโนมัติ</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {competitors.map((c) => {
            const setting = settings.find((s) => s.platform === c.platform);
            const ev = editValues[c.platform];
            if (!ev) return null;
            return (
              <div key={c.platform} className="p-5 rounded-2xl border border-surface-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('px-3 py-2 rounded-lg text-xs font-bold', PLATFORM_COLORS[c.platform])}>{c.label}</div>
                    <Badge variant={setting?.is_connected ? 'success' : 'default'}>
                      {setting?.is_connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Margin ขั้นต่ำ (%)"
                    type="number"
                    value={ev.margin}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], margin: e.target.value } }))}
                  />
                  <Input
                    label="ค่าธรรมเนียมแพลตฟอร์ม (%)"
                    type="number"
                    value={ev.fee}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], fee: e.target.value } }))}
                  />
                  <Input
                    label="Margin สินค้าต้นทุนต่ำ (%)"
                    type="number"
                    value={ev.lowMargin}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], lowMargin: e.target.value } }))}
                  />
                  <Input
                    label="ค่าธรรมเนียมทุนต่ำ (%)"
                    type="number"
                    value={ev.lowFee}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], lowFee: e.target.value } }))}
                  />
                  <Input
                    label="เกณฑ์ทุนต่ำ (฿)"
                    type="number"
                    value={ev.threshold}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], threshold: e.target.value } }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ev.isConnected}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [c.platform]: { ...prev[c.platform], isConnected: e.target.checked } }))}
                    className="w-4 h-4 rounded"
                  />
                  เชื่อมต่อกับ {c.label}
                </label>
                <Button size="sm" variant="secondary" onClick={() => savePlatform(c.platform)} loading={saving} className="w-full">
                  <Save className="w-4 h-4" /> บันทึก{c.label}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-5 pt-5 border-t border-surface-100">
          <Button onClick={saveAll} loading={saving}>
            <Save className="w-4 h-4" /> บันทึกการตั้งค่าทั้งหมด
          </Button>
        </div>
      </Card>
    </>
  );
}

function BackupTab({ profile }: { profile: any }) {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveMonths, setArchiveMonths] = useState(6);
  const [archiveCount, setArchiveCount] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('backup_history').select('*').order('created_at', { ascending: false }).limit(20);
    setHistory((data as BackupRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    supabase.from('stock_movements').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setArchiveCount(count ?? 0);
    });
  }, [archiveMonths]);

  async function exportToExcel() {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const { data: products } = await supabase.from('products').select('*');
      const { data: lots } = await supabase.from('stock_lots').select('*');
      const { data: movements } = await supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(5000);
      const { data: branches } = await supabase.from('branches').select('*');
      const { data: profiles } = await supabase.from('profiles').select('id, email, display_name, first_name, last_name, phone, roles');

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products ?? []), 'Products');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lots ?? []), 'Stock Lots');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movements ?? []), 'Movements');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(branches ?? []), 'Branches');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profiles ?? []), 'Profiles');

      const fileName = `backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      await supabase.from('backup_history').insert({
        backup_type: 'excel',
        file_name: fileName,
        record_count: (products?.length ?? 0) + (lots?.length ?? 0) + (movements?.length ?? 0),
        created_by: profile?.id,
      });

      setToast({ type: 'success', msg: 'ดาวน์โหลด Backup สำเร็จ' });
      loadHistory();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'ส่งออกไม่สำเร็จ' });
    } finally {
      setExporting(false);
    }
  }

  async function archiveOldRecords() {
    setArchiving(true);
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - archiveMonths);
      const cutoffStr = cutoff.toISOString();

      const { data: oldMovements } = await supabase.from('stock_movements')
        .select('*')
        .lt('created_at', cutoffStr)
        .order('created_at', { ascending: true })
        .limit(10000);

      if (oldMovements && oldMovements.length > 0) {
        const { error: archiveErr } = await supabase.from('archived_stock_movements').insert(oldMovements);
        if (archiveErr) throw archiveErr;
        const ids = oldMovements.map((m: any) => m.id);
        const { error: delErr } = await supabase.from('stock_movements').delete().in('id', ids);
        if (delErr) throw delErr;
        setToast({ type: 'success', msg: `ย้าย ${oldMovements.length} รายการเก่าไปยังคลังเก็บถาวรแล้ว` });
      } else {
        setToast({ type: 'success', msg: 'ไม่มีรายการที่เก่ากว่ากำหนด' });
      }
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'เก็บถาวรไม่สำเร็จ' });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      {toast && (
        <div className={cn('p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 animate-slide-up', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Download Backup */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary-100 text-primary-600 shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-surface-900">ดาวน์โหลด Backup</h3>
            <p className="text-sm text-surface-500 mt-1">ส่งออกข้อมูลทั้งหมดเป็นไฟล์ Excel (สินค้า, ล็อต, ประวัติ, สาขา, ผู้ใช้)</p>
          </div>
          <Button onClick={exportToExcel} loading={exporting}>
            <Download className="w-4 h-4" /> ดาวน์โหลด
          </Button>
        </div>
      </Card>

      {/* Backup History */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-surface-400" />
          <h3 className="font-semibold text-surface-900">ประวัติ Backup</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-6">ยังไม่มีประวัติการสำรองข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                <FileSpreadsheet className="w-5 h-5 text-success-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-700 truncate">{h.file_name ?? h.backup_type}</p>
                  <p className="text-xs text-surface-400">{formatDateTime(h.created_at)} · {h.record_count} รายการ</p>
                </div>
                <Badge variant="default">{h.backup_type}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Archive Old Records */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-warning-100 text-warning-600 shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-surface-900">เก็บถาวรรายการเก่า</h3>
            <p className="text-sm text-surface-500 mt-1">ย้ายประวัติรับเข้า-เบิกออกที่เก่ากว่า {archiveMonths} เดือน ไปยังคลังเก็บถาวร (เพื่อเพิ่มความเร็วระบบ)</p>
            <p className="text-xs text-surface-400 mt-1">พบ {archiveCount} รายการในระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <select value={archiveMonths} onChange={(e) => setArchiveMonths(Number(e.target.value))} className="input-base">
            <option value={3}>3 เดือน</option>
            <option value={6}>6 เดือน</option>
            <option value={12}>12 เดือน</option>
            <option value={24}>24 เดือน</option>
          </select>
          <Button variant="secondary" onClick={archiveOldRecords} loading={archiving}>
            <Archive className="w-4 h-4" /> เก็บถาวร
          </Button>
        </div>
      </Card>

      {/* Storage Info */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-5 h-5 text-surface-400" />
          <h3 className="font-semibold text-surface-900">ข้อมูลระบบจัดเก็บ</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-surface-50">
            <p className="text-xs text-surface-400">ตารางหลัก</p>
            <p className="text-lg font-bold text-surface-700">stock_movements</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <p className="text-xs text-surface-400">ตารางเก็บถาวร</p>
            <p className="text-lg font-bold text-surface-700">archived_stock_movements</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <p className="text-xs text-surface-400">ประวัติ Backup</p>
            <p className="text-lg font-bold text-surface-700">{history.length} ครั้ง</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <p className="text-xs text-surface-400">ระบบจัดเก็บ</p>
            <p className="text-lg font-bold text-surface-700">Supabase</p>
          </div>
        </div>
      </Card>
    </>
  );
}

function ClearStockTab() {
  const { profile } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [scope, setScope] = useState<'all' | 'branch'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [productCount, setProductCount] = useState<number>(0);
  const [confirmText, setConfirmText] = useState('');
  const [fetchingCount, setFetchingCount] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id, name').eq('is_active', true).then(({ data }) => {
      setBranches((data as { id: string; name: string }[]) ?? []);
    });
  }, []);

  useEffect(() => {
    setFetchingCount(true);
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).then(({ count }) => {
      setProductCount(count ?? 0);
      setFetchingCount(false);
    });
  }, []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); } }, [toast]);

  const expectedConfirmText = String(productCount);
  const canConfirm = confirmText.trim() === expectedConfirmText;

  async function doClear() {
    setLoading(true);
    setProgress([]);
    const actorName = profile?.display_name ?? profile?.email ?? 'ผู้ดูแลระบบ';
    const scopeLabel = scope === 'all' ? 'ทุกสาขา' : `สาขา ${branches.find((b) => b.id === selectedBranchId)?.name ?? selectedBranchId}`;
    try {
      if (scope === 'all') {
        setProgress(['กำลังตั้งยอดคงเหลือสินค้าทุกสาขาเป็น 0...']);
        const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (lotErr) throw new Error(`stock_lots: ${lotErr.message}`);

        setProgress((p) => [...p, 'กำลังตั้งยอดคงเหลือตัวเลือกย่อยเป็น 0...']);
        const { error: vlpErr } = await supabase.from('variant_lot_prices').update({ quantity: 0 }).neq('product_barcode_id', '00000000-0000-0000-0000-000000000000');
        if (vlpErr) throw new Error(`variant_lot_prices: ${vlpErr.message}`);

        setProgress((p) => [...p, 'กำลังตั้งยอดคงเหลือสาขาของตัวเลือกย่อยเป็น 0...']);
        const { error: vbsErr } = await supabase.from('variant_branch_stock').update({ quantity: 0 }).neq('variant_id', '00000000-0000-0000-0000-000000000000');
        if (vbsErr) throw new Error(`variant_branch_stock: ${vbsErr.message}`);
      } else {
        if (!selectedBranchId) throw new Error('กรุณาเลือกสาขา');
        setProgress(['กำลังตั้งยอดคงเหลือสินค้าในสาขาที่เลือกเป็น 0...']);
        const { error: lotErr } = await supabase.from('stock_lots').update({ quantity: 0 }).eq('branch_id', selectedBranchId).neq('id', '00000000-0000-0000-0000-000000000000');
        if (lotErr) throw new Error(`stock_lots: ${lotErr.message}`);

        setProgress((p) => [...p, 'กำลังตั้งยอดคงเหลือตัวเลือกย่อยในสาขาเป็น 0...']);
        const { error: vbsErr } = await supabase.from('variant_branch_stock').update({ quantity: 0 }).eq('branch_id', selectedBranchId).neq('variant_id', '00000000-0000-0000-0000-000000000000');
        if (vbsErr) throw new Error(`variant_branch_stock: ${vbsErr.message}`);
      }

      setProgress((p) => [...p, 'บันทึกประวัติการล้างสต็อก...']);
      await supabase.from('product_audit_logs').insert({
        action: 'clear_stock',
        actor_profile_id: profile?.id ?? null,
        actor_name: actorName,
        new_value: { scope: scopeLabel, product_count: productCount },
        note: `ล้างคงเหลือสินค้าเป็น 0 — ขอบเขต: ${scopeLabel} — จำนวนสินค้าที่ได้รับผลกระทบ: ${productCount}`,
      });

      setProgress((p) => [...p, 'เสร็จสิ้น!']);
      setToast({ type: 'success', msg: `ล้างคงเหลือสำเร็จ — ตั้งยอดสินค้า ${productCount} รายการเป็น 0 (${scopeLabel})` });
      setShowConfirm(false);
      setConfirmText('');
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'เกิดข้อผิดพลาดในการล้างคงเหลือ' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {toast && (
        <div className={cn('p-3 rounded-xl text-sm font-medium flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <Card className="p-6 border-2 border-error-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-error-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-error-600" />
          </div>
          <div>
            <h3 className="font-semibold text-error-600">ล้างคงเหลือสินค้าทั้งหมด</h3>
            <p className="text-sm text-surface-500">ตั้งจำนวนคงเหลือของสินค้าทุกรายการเป็น 0 — ไม่ลบตัวสินค้า</p>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          <div className="p-4 rounded-xl bg-error-50 border border-error-200">
            <p className="text-sm font-medium text-error-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              การกระทำนี้จะตั้งจำนวนคงเหลือของสินค้าทุกรายการเป็น 0 ไม่สามารถย้อนกลับได้ทันที
            </p>
            <p className="text-sm text-error-600 mt-2">
              จำนวนสินค้าที่จะถูกกระทบ: <span className="font-bold">{fetchingCount ? 'กำลังนับ...' : productCount}</span> รายการ
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">ขอบเขตการล้าง:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setScope('all')}
                className={cn('px-4 py-2.5 rounded-xl text-sm font-medium transition-all', scope === 'all' ? 'bg-error-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
              >
                ล้างทั้งหมดทุกสาขา
              </button>
              <button
                onClick={() => setScope('branch')}
                className={cn('px-4 py-2.5 rounded-xl text-sm font-medium transition-all', scope === 'branch' ? 'bg-error-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
              >
                เลือกเฉพาะสาขา
              </button>
            </div>
          </div>

          {scope === 'branch' && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">เลือกสาขาที่ต้องการล้างคงเหลือ</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="input-base"
              >
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">สิ่งที่จะถูกตั้งเป็น 0:</p>
            <ul className="space-y-1.5 ml-5">
              {['จำนวนคงเหลือในล็อตสินค้า (stock_lots)', 'จำนวนคงเหลือในตัวเลือกย่อย (variant_lot_prices)', 'จำนวนคงเหลือตามสาขาของตัวเลือกย่อย (variant_branch_stock)'].map((item, i) => (
                <li key={i} className="text-sm text-error-600 flex items-center gap-2">
                  <Eraser className="w-3.5 h-3.5" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">สิ่งที่ยังคงอยู่ (ไม่ถูกลบ):</p>
            <ul className="space-y-1.5 ml-5">
              {['ข้อมูลสินค้า (ชื่อ, SKU, ราคา, รูปภาพ)', 'ประวัติรับเข้า-เบิกออก (stock_movements)', 'ข้อมูลสาขาและผู้ใช้'].map((item, i) => (
                <li key={i} className="text-sm text-success-600 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {progress.length > 0 && (
          <div className="p-4 rounded-xl bg-surface-50 mb-5">
            <div className="space-y-1">
              {progress.map((p, i) => (
                <p key={i} className="text-sm text-surface-600 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success-500" /> {p}
                </p>
              ))}
            </div>
          </div>
        )}

        <Button variant="danger" onClick={() => setShowConfirm(true)} disabled={loading || (scope === 'branch' && !selectedBranchId)}>
          <Eraser className="w-4 h-4" /> ล้างคงเหลือสินค้าทั้งหมด
        </Button>
      </Card>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-surface-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-error-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-error-600" />
                </div>
                <h3 className="font-bold text-surface-900">ยืนยันล้างคงเหลือสินค้า</h3>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-error-600 font-medium">
                การกระทำนี้จะตั้งจำนวนคงเหลือของสินค้า {productCount} รายการเป็น 0
                {scope === 'all' ? ' ในทุกสาขา' : ` ในสาขา ${branches.find((b) => b.id === selectedBranchId)?.name ?? ''}`}
                ไม่สามารถย้อนกลับได้
              </p>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  พิมพ์ <span className="font-bold text-error-600">{expectedConfirmText}</span> เพื่อยืนยัน
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`พิมพ์ ${expectedConfirmText}`}
                  className="input-base"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => { setShowConfirm(false); setConfirmText(''); }} className="flex-1">ยกเลิก</Button>
                <Button variant="danger" onClick={doClear} loading={loading} disabled={!canConfirm} className="flex-1">
                  ยืนยันล้างคงเหลือ
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
