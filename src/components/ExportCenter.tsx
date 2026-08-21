import { useState, useCallback } from 'react';
import { ShoppingCart, Users, Package, Boxes, Truck, Clock, Wallet, Globe, Building2, Megaphone, Download, FileSpreadsheet, Upload, FileDown, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calendar, Layers, ArrowRightLeft } from 'lucide-react';
import { Card, Button, Badge, ErrorBoundary } from '@/components/ui';
import { cn, formatCurrency, formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { exportToExcel, type ExportConfig } from '@/lib/excelExport';
import { useAuth } from '@/contexts/AuthContext';
import { canManageSalary, type Role } from '@/types/permissions';
import { GenericImportModal } from '@/components/GenericImportModal';
import { ImportProductsModal } from '@/components/ImportProductsModal';
import { IMPORT_CONFIGS, IMPORT_LABELS, setMovementImportContext, type ImportableModule } from '@/lib/importConfigs';

type Preset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom' | 'all';

const PRESET_LABELS: Record<Preset, string> = {
  today: 'วันนี้', yesterday: 'เมื่อวาน', this_week: 'อาทิตย์นี้', last_week: 'อาทิตย์ที่แล้ว',
  this_month: 'เดือนนี้', last_month: 'เดือนที่แล้ว', this_year: 'ปีนี้', last_year: 'ปีที่แล้ว',
  custom: 'กำหนดเอง', all: 'ทั้งหมด',
};

function getDateRange(preset: Preset, customStart: string, customEnd: string): { start: string; end: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  switch (preset) {
    case 'today': return { start: fmt(today), end: fmt(today) };
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: fmt(y), end: fmt(y) }; }
    case 'this_week': { const s = new Date(today); s.setDate(s.getDate() - s.getDay()); return { start: fmt(s), end: fmt(today) }; }
    case 'last_week': { const s = new Date(today); s.setDate(s.getDate() - s.getDay() - 7); const e = new Date(s); e.setDate(e.getDate() + 6); return { start: fmt(s), end: fmt(e) }; }
    case 'this_month': return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(today) };
    case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: fmt(s), end: fmt(e) }; }
    case 'this_year': return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: fmt(today) };
    case 'last_year': return { start: fmt(new Date(now.getFullYear() - 1, 0, 1)), end: fmt(new Date(now.getFullYear() - 1, 11, 31)) };
    case 'custom': { if (!customStart || !customEnd) return null; return { start: customStart, end: customEnd }; }
    default: return null;
  }
}

function dateFilter(range: { start: string; end: string } | null, column: string) {
  if (!range) return {};
  return { gte: `${column}T00:00:00`, lte: `${column}T23:59:59.999Z` };
}

type ExportItem = {
  id: string;
  label: string;
  icon: any;
  color: string;
  needsSalaryAccess?: boolean;
  importable?: ImportableModule;
  importableProducts?: boolean;
  exportFn: (range: { start: string; end: string } | null) => Promise<void>;
};

export function ExportCenterTab() {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const canSalary = canManageSalary(roles);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [exportAllProgress, setExportAllProgress] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState<ImportableModule | 'products-full' | null>(null);

  const range = getDateRange(preset, customStart, customEnd);

  const runExport = useCallback(async (item: ExportItem) => {
    if (item.needsSalaryAccess && !canSalary) return;
    setExporting(item.id);
    try {
      await item.exportFn(range);
      setToast({ type: 'success', msg: `ส่งออก${item.label}สำเร็จ` });
    } catch (err: any) {
      setToast({ type: 'error', msg: `ส่งออกไม่สำเร็จ: ${err.message ?? 'เกิดข้อผิดพลาด'}` });
    } finally {
      setExporting(null);
    }
  }, [range, canSalary]);

  const exportAll = useCallback(async () => {
    setExporting('all');
    setExportAllProgress([]);
    const items = exportItems.filter((i) => !i.needsSalaryAccess || canSalary);
    for (const item of items) {
      setExportAllProgress((p) => [...p, `กำลังส่งออก${item.label}...`]);
      try { await item.exportFn(range); } catch { /* skip individual errors */ }
    }
    setExportAllProgress((p) => [...p, 'เสร็จสิ้น! ดาวน์โหลดไฟล์ทั้งหมดแล้ว']);
    setToast({ type: 'success', msg: 'ส่งออกข้อมูลทั้งหมดสำเร็จ' });
    setExporting(null);
  }, [range, canSalary]);

  const exportItems: ExportItem[] = [
    {
      id: 'sales', label: 'ยอดขาย', icon: ShoppingCart, color: 'bg-primary-100 text-primary-600',
      importable: 'sales',
      exportFn: async (r) => {
        let q = supabase.from('sales_records').select('*, branches(name)').order('record_date', { ascending: false });
        if (r) q = q.gte('record_date', r.start).lte('record_date', r.end);
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานยอดขาย', dateRange: r ?? undefined,
          columns: [
            { key: 'branch', label: 'สาขา', width: 16 },
            { key: 'record_date', label: 'วันที่', format: 'date', width: 14 },
            { key: 'total_amount', label: 'ยอดรวม', format: 'currency', width: 14 },
            { key: 'bill_count', label: 'จำนวนบิล', format: 'number', width: 10 },
            { key: 'channel_front', label: 'หน้าร้าน', format: 'currency', width: 14 },
            { key: 'channel_line_branch', label: 'LINE สาขา', format: 'currency', width: 14 },
            { key: 'channel_line_oa', label: 'LINE OA', format: 'currency', width: 14 },
            { key: 'target_amount', label: 'เป้าหมาย', format: 'currency', width: 14 },
            { key: 'status', label: 'สถานะ', width: 12 },
          ],
          data: (data ?? []).map((r: any) => ({
            branch: r.branches?.name ?? '-', record_date: r.record_date, total_amount: Number(r.total_amount),
            bill_count: Number(r.bill_count), channel_front: Number(r.channel_front),
            channel_line_branch: Number(r.channel_line_branch), channel_line_oa: Number(r.channel_line_oa),
            target_amount: Number(r.target_amount), status: r.is_closed ? 'ปิดยอดแล้ว' : 'ยังไม่ปิดยอด',
          })),
          summary: [
            { label: 'ยอดขายรวม', columnKey: 'total_amount', value: (data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount), 0), format: 'currency' },
            { label: 'จำนวนบิลรวม', columnKey: 'bill_count', value: (data ?? []).reduce((s: number, r: any) => s + Number(r.bill_count), 0), format: 'number' },
          ],
        });
      },
    },
    {
      id: 'users', label: 'ผู้ใช้', icon: Users, color: 'bg-accent-100 text-accent-600',
      importable: 'users',
      exportFn: async () => {
        const { data } = await supabase.from('profiles').select('*').order('display_name');
        exportToExcel({
          reportName: 'รายงานผู้ใช้',
          columns: [
            { key: 'display_name', label: 'ชื่อ', width: 20 },
            { key: 'email', label: 'อีเมล', width: 28 },
            { key: 'position', label: 'ตำแหน่ง', width: 16 },
            { key: 'phone', label: 'เบอร์โทร', width: 14 },
            { key: 'employment_type', label: 'ประเภทจ้าง', width: 12 },
            { key: 'is_active', label: 'สถานะ', width: 10 },
          ],
          data: (data ?? []).map((u: any) => ({
            display_name: u.display_name ?? '-', email: u.email ?? '-', position: u.position ?? '-',
            phone: u.phone ?? '-', employment_type: u.employment_type ?? '-', is_active: u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน',
          })),
          summary: [{ label: 'จำนวนผู้ใช้', columnKey: 'display_name', value: (data ?? []).length, format: 'number' }],
        });
      },
    },
    {
      id: 'products', label: 'สินค้า', icon: Package, color: 'bg-success-100 text-success-600',
      importableProducts: true,
      exportFn: async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        exportToExcel({
          reportName: 'รายงานสินค้า',
          columns: [
            { key: 'name', label: 'ชื่อสินค้า', width: 24 },
            { key: 'sku', label: 'SKU', width: 14 },
            { key: 'category', label: 'หมวดหมู่', width: 14 },
            { key: 'unit', label: 'หน่วย', width: 8 },
            { key: 'cost_price', label: 'ต้นทุน', format: 'currency', width: 12 },
            { key: 'retail_price', label: 'ราคาขาย', format: 'currency', width: 12 },
            { key: 'barcode', label: 'บาร์โค้ด', width: 14 },
          ],
          data: (data ?? []).map((p: any) => ({
            name: p.name ?? '-', sku: p.sku ?? '-', category: p.category ?? '-', unit: p.unit ?? '-',
            cost_price: Number(p.cost_price), retail_price: Number(p.retail_price), barcode: p.barcode ?? '-',
          })),
          summary: [{ label: 'จำนวนสินค้า', columnKey: 'name', value: (data ?? []).length, format: 'number' }],
        });
      },
    },
    {
      id: 'stock', label: 'สต๊อก', icon: Boxes, color: 'bg-warning-100 text-warning-600',
      importable: 'stock',
      exportFn: async () => {
        const { data } = await supabase.from('stock_lots').select('*, products(name, sku, unit), branches(name)').order('created_at', { ascending: false });
        exportToExcel({
          reportName: 'รายงานสต๊อกสินค้า',
          columns: [
            { key: 'product_name', label: 'สินค้า', width: 24 },
            { key: 'sku', label: 'SKU', width: 14 },
            { key: 'branch', label: 'สาขา', width: 16 },
            { key: 'lot_label', label: 'เลขล็อต', width: 14 },
            { key: 'quantity', label: 'จำนวนคงเหลือ', format: 'number', width: 14 },
            { key: 'unit_price', label: 'ราคา/หน่วย', format: 'currency', width: 12 },
            { key: 'expiry_date', label: 'วันหมดอายุ', format: 'date', width: 14 },
          ],
          data: (data ?? []).map((l: any) => ({
            product_name: l.products?.name ?? '-', sku: l.products?.sku ?? '-', branch: l.branches?.name ?? '-',
            lot_label: l.lot_label ?? '-', quantity: Number(l.quantity), unit_price: Number(l.unit_price),
            expiry_date: l.expiry_date ?? '-',
          })),
          summary: [{ label: 'จำนวนล็อต', columnKey: 'product_name', value: (data ?? []).length, format: 'number' }],
          rowHighlight: (row) => Number(row.quantity) <= 0 ? 'error' : Number(row.quantity) <= 10 ? 'warning' : null,
        });
      },
    },
    {
      id: 'purchasing', label: 'จัดซื้อ', icon: Truck, color: 'bg-primary-100 text-primary-600',
      importable: 'purchasing',
      exportFn: async (r) => {
        let q = supabase.from('purchase_requests').select('*, branches(name)').order('created_at', { ascending: false });
        if (r) q = q.gte('created_at', r.start).lte('created_at', r.end + 'T23:59:59');
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานการจัดซื้อ', dateRange: r ?? undefined,
          columns: [
            { key: 'supplier_name', label: 'ซัพพลายเออร์', width: 20 },
            { key: 'status', label: 'สถานะ', width: 12 },
            { key: 'created_at', label: 'วันที่ขอ', format: 'date', width: 14 },
            { key: 'branch', label: 'สาขา', width: 16 },
            { key: 'total_amount', label: 'ยอดรวม', format: 'currency', width: 14 },
          ],
          data: (data ?? []).map((p: any) => ({
            supplier_name: p.supplier_name ?? '-', status: p.status ?? '-',
            created_at: p.created_at, branch: p.branches?.name ?? '-', total_amount: Number(p.total_amount ?? 0),
          })),
          summary: [{ label: 'ยอดจัดซื้อรวม', columnKey: 'total_amount', value: (data ?? []).reduce((s: number, p: any) => s + Number(p.total_amount ?? 0), 0), format: 'currency' }],
          rowHighlight: (row) => row.status === 'rejected' || row.status === 'cancelled' ? 'error' : row.status === 'pending' ? 'warning' : null,
        });
      },
    },
    {
      id: 'attendance', label: 'เวลาเข้างาน', icon: Clock, color: 'bg-accent-100 text-accent-600',
      importable: 'attendance',
      exportFn: async (r) => {
        let q = supabase.from('attendance_records').select('*, profiles(display_name), branches(name)').order('date', { ascending: false });
        if (r) q = q.gte('date', r.start).lte('date', r.end);
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานเวลาทำงาน', dateRange: r ?? undefined,
          columns: [
            { key: 'employee', label: 'พนักงาน', width: 20 },
            { key: 'date', label: 'วันที่', format: 'date', width: 14 },
            { key: 'check_in', label: 'เข้างาน', width: 12 },
            { key: 'check_out', label: 'ออกงาน', width: 12 },
            { key: 'work_hours', label: 'ชั่วโมง', format: 'number', width: 10 },
            { key: 'branch', label: 'สาขา', width: 16 },
            { key: 'status', label: 'สถานะ', width: 10 },
          ],
          data: (data ?? []).map((a: any) => ({
            employee: a.profiles?.display_name ?? '-', date: a.date,
            check_in: a.check_in_time ?? '-', check_out: a.check_out_time ?? '-',
            work_hours: Number(a.work_hours ?? 0), branch: a.branches?.name ?? '-',
            status: a.status === 'present' ? 'มา' : a.status === 'late' ? 'สาย' : a.status === 'absent' ? 'ขาด' : a.status ?? '-',
          })),
          summary: [
            { label: 'จำนวนบันทึก', columnKey: 'employee', value: (data ?? []).length, format: 'number' },
            { label: 'ชั่วโมงรวม', columnKey: 'work_hours', value: (data ?? []).reduce((s: number, a: any) => s + Number(a.work_hours ?? 0), 0), format: 'number' },
          ],
          rowHighlight: (row) => row.status === 'ขาด' ? 'error' : row.status === 'สาย' ? 'warning' : null,
        });
      },
    },
    {
      id: 'salary', label: 'เงินเดือน', icon: Wallet, color: 'bg-error-100 text-error-600',
      needsSalaryAccess: true,
      importable: 'salary',
      exportFn: async (r) => {
        let q = supabase.from('salary_records').select('*, profiles(display_name, position)').order('period_month', { ascending: false });
        if (r) q = q.gte('period_month', r.start.slice(0, 7)).lte('period_month', r.end.slice(0, 7));
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานเงินเดือน', dateRange: r ?? undefined,
          columns: [
            { key: 'employee', label: 'พนักงาน', width: 20 },
            { key: 'position', label: 'ตำแหน่ง', width: 16 },
            { key: 'period', label: 'งวด', width: 10 },
            { key: 'work_hours', label: 'ชั่วโมง', format: 'number', width: 10 },
            { key: 'base_pay', label: 'ค่าจ้างพื้นฐาน', format: 'currency', width: 14 },
            { key: 'ot_pay', label: 'ค่า OT', format: 'currency', width: 12 },
            { key: 'deductions', label: 'รายการหัก', format: 'currency', width: 12 },
            { key: 'total_pay', label: 'ยอดจ่ายสุทธิ', format: 'currency', width: 14 },
          ],
          data: (data ?? []).map((s: any) => ({
            employee: s.profiles?.display_name ?? '-', position: s.profiles?.position ?? '-',
            period: s.period_month ?? '-', work_hours: Number(s.work_hours ?? 0),
            base_pay: Number(s.base_pay ?? 0), ot_pay: Number(s.ot_pay ?? 0),
            deductions: Number(s.advance_deductions ?? 0) + Number(s.loan_installment ?? 0),
            total_pay: Number(s.total_pay ?? 0),
          })),
          summary: [{ label: 'ยอดจ่ายรวม', columnKey: 'total_pay', value: (data ?? []).reduce((s: number, r: any) => s + Number(r.total_pay ?? 0), 0), format: 'currency' }],
          rowHighlight: (row) => Number(row.total_pay) === 0 ? 'error' : null,
        });
      },
    },
    {
      id: 'customers', label: 'ลูกค้า', icon: Globe, color: 'bg-primary-100 text-primary-600',
      importable: 'customers',
      exportFn: async (r) => {
        let q = supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (r) q = q.gte('created_at', r.start + 'T00:00:00').lte('created_at', r.end + 'T23:59:59');
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานลูกค้า', dateRange: r ?? undefined,
          columns: [
            { key: 'name', label: 'ชื่อลูกค้า', width: 20 },
            { key: 'phone', label: 'เบอร์โทร', width: 14 },
            { key: 'platform', label: 'แพลตฟอร์ม', width: 12 },
            { key: 'order_count', label: 'จำนวนออเดอร์', format: 'number', width: 12 },
            { key: 'total_spent', label: 'ยอดซื้อรวม', format: 'currency', width: 14 },
            { key: 'created_at', label: 'วันที่สมัคร', format: 'date', width: 14 },
          ],
          data: (data ?? []).map((c: any) => ({
            name: c.name ?? '-', phone: c.phone ?? '-', platform: c.platform ?? '-',
            order_count: Number(c.order_count ?? 0), total_spent: Number(c.total_spent ?? 0),
            created_at: c.created_at,
          })),
          summary: [{ label: 'จำนวนลูกค้า', columnKey: 'name', value: (data ?? []).length, format: 'number' }],
        });
      },
    },
    {
      id: 'branches', label: 'สาขา', icon: Building2, color: 'bg-surface-200 text-surface-700',
      importable: 'branches',
      exportFn: async () => {
        const { data } = await supabase.from('branches').select('*').order('name');
        exportToExcel({
          reportName: 'รายงานสาขา',
          columns: [
            { key: 'name', label: 'ชื่อสาขา', width: 20 },
            { key: 'short_code', label: 'รหัสย่อ', width: 10 },
            { key: 'address', label: 'ที่อยู่', width: 40 },
            { key: 'phone', label: 'เบอร์โทร', width: 14 },
            { key: 'is_active', label: 'สถานะ', width: 10 },
          ],
          data: (data ?? []).map((b: any) => ({
            name: b.name, short_code: b.short_code ?? '-', address: b.address ?? '-',
            phone: b.phone ?? '-', is_active: b.is_active ? 'ใช้งาน' : 'ปิดใช้งาน',
          })),
          summary: [{ label: 'จำนวนสาขา', columnKey: 'name', value: (data ?? []).length, format: 'number' }],
        });
      },
    },
    {
      id: 'marketing', label: 'การตลาด', icon: Megaphone, color: 'bg-accent-100 text-accent-600',
      importable: 'marketing',
      exportFn: async (r) => {
        let q = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (r) q = q.gte('start_date', r.start).lte('start_date', r.end);
        const { data } = await q;
        exportToExcel({
          reportName: 'รายงานการตลาด', dateRange: r ?? undefined,
          columns: [
            { key: 'name', label: 'ชื่อแคมเปญ', width: 20 },
            { key: 'platform', label: 'แพลตฟอร์ม', width: 12 },
            { key: 'budget', label: 'งบประมาณ', format: 'currency', width: 12 },
            { key: 'actual_spend', label: 'ใช้จ่ายจริง', format: 'currency', width: 12 },
            { key: 'sales_generated', label: 'ยอดขายที่เกิดขึ้น', format: 'currency', width: 14 },
            { key: 'roi', label: 'ROI', format: 'number', width: 8 },
            { key: 'status', label: 'สถานะ', width: 10 },
            { key: 'start_date', label: 'วันเริ่ม', format: 'date', width: 12 },
            { key: 'end_date', label: 'วันจบ', format: 'date', width: 12 },
          ],
          data: (data ?? []).map((c: any) => ({
            name: c.name ?? '-', platform: c.platform ?? '-', budget: Number(c.budget ?? 0),
            actual_spend: Number(c.actual_spend ?? 0), sales_generated: Number(c.sales_generated ?? 0),
            roi: Number(c.roi ?? 0), status: c.status ?? '-',
            start_date: c.start_date ?? '-', end_date: c.end_date ?? '-',
          })),
          summary: [
            { label: 'งบประมาณรวม', columnKey: 'budget', value: (data ?? []).reduce((s: number, c: any) => s + Number(c.budget ?? 0), 0), format: 'currency' },
            { label: 'ยอดขายรวม', columnKey: 'sales_generated', value: (data ?? []).reduce((s: number, c: any) => s + Number(c.sales_generated ?? 0), 0), format: 'currency' },
          ],
          rowHighlight: (row) => Number(row.roi) < 1 ? 'error' : Number(row.roi) > 2 ? 'success' : null,
        });
      },
    },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn('p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 animate-slide-up', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Global Filter Bar */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-surface-900">ตัวกรองช่วงข้อมูล</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', preset === p ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-surface-600">จากวันที่</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-base !py-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-surface-600">ถึงวันที่</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-base !py-1.5" />
            </div>
          </div>
        )}
        {range && (
          <p className="text-sm text-surface-500 mt-3">
            ช่วงข้อมูล: <span className="font-medium text-surface-700">{range.start} ถึง {range.end}</span>
          </p>
        )}
        {preset === 'all' && <p className="text-sm text-surface-500 mt-3">ส่งออกข้อมูลทั้งหมด (ไม่จำกัดช่วงเวลา)</p>}
      </Card>

      {/* Export All */}
      <Card className="p-5 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary-600 text-white">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">ส่งออกข้อมูลทั้งหมด</h3>
              <p className="text-sm text-surface-500">ดาวน์โหลดไฟล์ Excel แยกตามประเภทข้อมูล ({exportItems.filter((i) => !i.needsSalaryAccess || canSalary).length} ไฟล์)</p>
            </div>
          </div>
          <Button onClick={exportAll} loading={exporting === 'all'} disabled={preset === 'custom' && (!customStart || !customEnd)}>
            <Download className="w-4 h-4" /> ส่งออกทั้งหมด
          </Button>
        </div>
        {exportAllProgress.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-white/50 space-y-1">
            {exportAllProgress.map((p, i) => (
              <p key={i} className="text-sm text-surface-600 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success-500" /> {p}
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportItems.map((item) => {
          const isLocked = item.needsSalaryAccess && !canSalary;
          const isExpanded = expanded === item.id;
          return (
            <Card key={item.id} className={cn('p-5 transition-all', isLocked && 'opacity-50')}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">{item.label}</h3>
                    <p className="text-xs text-surface-400">ส่งออกข้อมูล{item.label}</p>
                  </div>
                </div>
                {isLocked && <Badge variant="default">ไม่มีสิทธิ์</Badge>}
              </div>

              <button
                onClick={() => setExpanded(isExpanded ? null : item.id)}
                className="text-xs text-surface-500 flex items-center gap-1 mb-3 hover:text-primary-600 transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
              </button>

              {isExpanded && (
                <div className="mb-4 p-3 rounded-xl bg-surface-50 text-xs text-surface-500 space-y-1">
                  <p><span className="font-medium text-surface-600">ช่วงเวลา:</span> {range ? `${range.start} ถึง ${range.end}` : 'ทั้งหมด'}</p>
                  <p><span className="font-medium text-surface-600">รูปแบบ:</span> Excel (.xlsx)</p>
                  <p><span className="font-medium text-surface-600">ไฟล์:</span> {item.label}_YYYY-MM-DD.xlsx</p>
                </div>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={() => runExport(item)}
                loading={exporting === item.id}
                disabled={isLocked || (preset === 'custom' && (!customStart || !customEnd))}
              >
                <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const IMPORT_CARD_META: { module: ImportableModule; label: string; icon: any; color: string; needsSalaryAccess?: boolean; description: string }[] = [
  { module: 'products', label: 'สินค้า', icon: Package, color: 'bg-success-100 text-success-600', description: 'นำเข้าข้อมูลสินค้า (ชื่อ, SKU, ราคา)' },
  { module: 'stock', label: 'สต๊อก', icon: Boxes, color: 'bg-warning-100 text-warning-600', description: 'นำเข้าจำนวนสต๊อกคงเหลือ' },
  { module: 'sales', label: 'ยอดขาย', icon: ShoppingCart, color: 'bg-primary-100 text-primary-600', description: 'นำเข้ายอดขายรายวัน' },
  { module: 'users', label: 'ผู้ใช้', icon: Users, color: 'bg-accent-100 text-accent-600', description: 'นำเข้าข้อมูลพนักงาน' },
  { module: 'purchasing', label: 'จัดซื้อ', icon: Truck, color: 'bg-primary-100 text-primary-600', description: 'นำเข้าคำสั่งซื้อ' },
  { module: 'attendance', label: 'เวลาเข้างาน', icon: Clock, color: 'bg-accent-100 text-accent-600', description: 'นำเข้าบันทึกเวลาทำงาน' },
  { module: 'salary', label: 'เงินเดือน', icon: Wallet, color: 'bg-error-100 text-error-600', needsSalaryAccess: true, description: 'นำเข้าบันทึกเงินเดือน' },
  { module: 'customers', label: 'ลูกค้า', icon: Globe, color: 'bg-primary-100 text-primary-600', description: 'นำเข้าข้อมูลลูกค้า' },
  { module: 'branches', label: 'สาขา', icon: Building2, color: 'bg-surface-200 text-surface-700', description: 'นำเข้าข้อมูลสาขา' },
  { module: 'marketing', label: 'การตลาด', icon: Megaphone, color: 'bg-accent-100 text-accent-600', description: 'นำเข้าแคมเปญการตลาด' },
  { module: 'movementHistory', label: 'เบิก-รับสินค้า', icon: ArrowRightLeft, color: 'bg-primary-100 text-primary-600', description: 'นำเข้าประวัติเบิกออก/รับเข้าสินค้า (ไม่กระทบสต๊อกจริง)' },
];

export function ImportCenterTab() {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const canSalary = canManageSalary(roles);
  const [importOpen, setImportOpen] = useState<ImportableModule | null>(null);

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <Card className="p-5 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-primary-600 text-white shrink-0">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-900">นำเข้าข้อมูลจาก Excel</h3>
            <p className="text-sm text-surface-600 mt-1">
              ดาวน์โหลดแม่แบบ กรอกข้อมูล แล้วอัปโหลดกลับเข้าระบบได้เลย — โครงสร้างคอลัมน์ตรงกับไฟล์ที่ส่งออก
              ระบบจะตรวจสอบข้อมูลก่อนนำเข้าจริง และให้เลือกว่าจะเพิ่มใหม่หรืออัปเดตข้อมูลเดิม
            </p>
          </div>
        </div>
      </Card>

      {/* Import cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {IMPORT_CARD_META.map((item) => {
          const isLocked = item.needsSalaryAccess && !canSalary;
          return (
            <Card key={item.module} className={cn('p-5 transition-all', isLocked && 'opacity-50')}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">{item.label}</h3>
                    <p className="text-xs text-surface-400">{item.description}</p>
                  </div>
                </div>
                {isLocked && <Badge variant="default">ไม่มีสิทธิ์</Badge>}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => { if (item.module === 'movementHistory') setMovementImportContext({ profileId: profile?.id }); setImportOpen(item.module); }}
                  disabled={isLocked}
                >
                  <Upload className="w-4 h-4" /> นำเข้าข้อมูล
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Import modal */}
      {importOpen && (
        <GenericImportModal
          open={true}
          config={IMPORT_CONFIGS[importOpen]}
          onClose={() => setImportOpen(null)}
        />
      )}
    </div>
  );
}
