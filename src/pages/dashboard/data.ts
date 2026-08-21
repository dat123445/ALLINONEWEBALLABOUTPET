import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dateRangeDays, formatThaiDate } from './helpers';
import { pctChange, linearForecast } from './helpers';
import type { DateRange, DashboardData, TrendPoint, KpiCard, Branch, OverviewData, OverviewAlert, SalesData, StockData, WorkforceData, CustomersData, MarketingData, FinanceData } from './types';

const PRIMARY_COLOR = '#3D7BF5';
const CHANNEL_COLORS: Record<string, string> = {
  store: '#3D7BF5', tiktok: '#ec4899', shopee: '#f97316', lazada: '#0ea5e9', line: '#16a34a', manual: '#f59e0b', other: '#64748b',
};
const CHANNEL_LABELS: Record<string, string> = {
  store: 'หน้าร้าน', tiktok: 'TikTok', shopee: 'Shopee', lazada: 'Lazada', line: 'LINE OA', manual: 'เบิกออกมือ', other: 'อื่นๆ',
};

// type_config values that represent real sales (have monetary value)
const SALE_TYPE_CONFIGS = new Set([
  // ขายราคาปกติ
  'ขายไลน์แอด',
  // ขายออนไลน์
  'Tiktok', 'Lazada', 'Shopee', 'ส่งด่วน_SPX', 'ส่งด่วน_FOOD',
  // ขายรอวางบิล
  'ขายบัดดี้รอวางบิล', 'ขายNikeรอวางบิล',
  // ขายราคาทุน
  'โอนไปสาขาอื่น', 'รพส.ลาดพร้าว', 'ขายพม่า', 'หมอปรมะ', 'รพส.ศรีวรา',
]);

// type_config values that are zero-value (not real sales)
const ZERO_VALUE_TYPES = new Set([
  'ปรับสต๊อก', 'ส่งเคลม', 'เติมหน้าร้าน', 'ออกบู๊ท', 'ของแถม',
]);

// type_config values for returns (receive movements that represent customer returns)
const RETURN_TYPE_CONFIGS = new Set([
  'ของตีกลับ', 'ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า',
]);

function isSaleMovement(movementType: string, typeConfig: string | null): boolean {
  if (movementType !== 'withdraw' && movementType !== 'transfer_out') return false;
  // Explicitly exclude zero-value types
  if (typeConfig && ZERO_VALUE_TYPES.has(typeConfig)) return false;
  // Include known sale types
  if (typeConfig && SALE_TYPE_CONFIGS.has(typeConfig)) return true;
  // For null or unknown type_config, treat withdraw/transfer_out as sale by default (backward compat)
  return true;
}

function isCostSale(typeConfig: string | null): boolean {
  if (!typeConfig) return false;
  return ['โอนไปสาขาอื่น', 'รพส.ลาดพร้าว', 'ขายพม่า', 'หมอปรมะ', 'รพส.ศรีวรา'].includes(typeConfig);
}

function channelFromTypeConfig(typeConfig: string | null): string {
  if (!typeConfig) return 'store';
  const tc = typeConfig.toLowerCase();
  if (tc.includes('tiktok')) return 'tiktok';
  if (tc.includes('shopee')) return 'shopee';
  if (tc.includes('lazada')) return 'lazada';
  if (tc.includes('line') || tc.includes('ไลน์')) return 'line';
  if (tc.includes('ส่งด่วน')) return 'manual';
  // ขายไลน์แอด, ขายบัดดี้, ขายNike, โอนไปสาขาอื่น, รพส., ขายพม่า, หมอ → หน้าร้าน
  return 'store';
}

function channelFromNote(note: string | null, typeConfig: string | null): string {
  const combined = `${note ?? ''} ${typeConfig ?? ''}`.toLowerCase();
  if (combined.includes('tiktok')) return 'tiktok';
  if (combined.includes('shopee')) return 'shopee';
  if (combined.includes('lazada')) return 'lazada';
  if (combined.includes('line') || combined.includes('ไลน์')) return 'line';
  if (combined.includes('front') || combined.includes('หน้าร้าน') || combined.includes('store')) return 'store';
  return channelFromTypeConfig(typeConfig);
}

function applyBranch(query: any, branchId: string | null): any {
  return branchId ? query.eq('branch_id', branchId) : query;
}

function previousRange(range: DateRange): DateRange {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(prevStart), end: iso(prevEnd) };
}

function makeKpi(label: string, value: number, previous: number, format: KpiCard['format'], sparkline: number[], icon: string, color: string, subtitle?: string): KpiCard {
  return { label, value, previous, format, sparkline, icon, color, subtitle, changePct: pctChange(value, previous) };
}

function buildTrendPoints(days: string[], dataMap: Map<string, Record<string, number>>, keys: string[]): TrendPoint[] {
  return days.map((day) => {
    const vals = dataMap.get(day) ?? {};
    const point: TrendPoint = { date: day, label: formatThaiDate(day) };
    keys.forEach((k) => { point[k] = vals[k] ?? 0; });
    return point;
  });
}

function emptyData(): DashboardData {
  const emptyKpis: KpiCard[] = [];
  const emptyTrend: TrendPoint[] = [];
  return {
    overview: { kpis: emptyKpis, salesTrend: emptyTrend, profitTrend: emptyTrend, salesByBranch: [], topProducts: [], salesByChannel: [], salesByCategory: [], targetProgress: [], forecast: [], alerts: [], insight: '' },
    sales: { kpis: emptyKpis, dailyTrend: emptyTrend, branchComparison: emptyTrend, channelBreakdown: [], topProducts: [], recentMovements: [], targetInfo: { targetAmount: 0, actualAmount: 0, percent: 0, remaining: 0, type: 'monthly' }, hourlyPattern: [], returns: 0, billCount: 0, avgPerBill: 0, normalSales: 0, costSales: 0, frontStoreSales: 0 },
    stock: { kpis: emptyKpis, movementTrend: emptyTrend, movementByType: [], topMovedProducts: [], lowStockAlerts: [], branchStockValue: [], recentMovements: [] },
    workforce: { kpis: emptyKpis, attendanceTrend: emptyTrend, employeesByBranch: [], employeeList: [], shiftDistribution: [], attendanceStatus: { onTime: 0, late: 0, leave: 0, absent: 0 }, taskCompletion: [] },
    customers: { kpis: emptyKpis, customerTrend: emptyTrend, topCustomers: [], customerByChannels: [], newVsReturning: [], reviewSummary: [], csIssues: [] },
    marketing: { kpis: emptyKpis, campaignPerformance: [], promotionPerformance: [], contentPipeline: [], platformSettings: [], socialPostsTrend: emptyTrend },
    finance: { kpis: emptyKpis, revenueTrend: emptyTrend, revenueByChannel: [], profitByCategory: [], salaryOverview: { totalSalaries: 0, employeeCount: 0, advances: 0, loans: 0, netPay: 0 }, purchaseSummary: { totalRequests: 0, pendingCount: 0, approvedCount: 0, totalAmount: 0 }, billingSummary: { billedTotal: 0, pendingTotal: 0, pendingCount: 0, paidTotal: 0 }, expenseBreakdown: [] },
    branches: [],
    brands: [],
    categories: [],
  };
}

type RawMovement = {
  id: string; movement_type: string; type_config: string | null; quantity: number | null;
  unit_price: number | null; discount_amount: number | null; reference_note: string | null; created_at: string;
  product_id: string; branch_id: string | null; profile_id: string | null;
  products: { id: string; name: string; sku: string | null; category: string | null; brand: string | null; min_stock: number | null; cost_price: number | null; retail_price: number | null } | null;
  profiles: { display_name: string | null; first_name: string | null } | null;
  branches: { name: string } | null;
};
type RawBarcode = { product_id: string; barcode: string | null; stock_qty: number | null; stock: number | null; price: number | null; is_active: boolean | null; cost_price: number | null };
type RawSalesRecord = { id: string; record_date: string; total_amount: number | null; bill_count: number | null; branch_id: string | null; branches: { name: string } | null; channel_front: number | null; channel_line_branch: number | null; channel_line_oa: number | null; target_amount: number | null };
type RawProfile = { id: string; display_name: string | null; first_name: string | null; employment_type: string; is_active: boolean; position: string | null; active_branch_id: string | null };
type RawBranchMember = { profile_id: string; branch_id: string; is_primary: boolean; branches: { name: string } | null };
type RawCustomerOrder = { id: string; customer_id: string; channel: string | null; total: number | null; created_at: string; branch_id: string | null; customers: { id: string; name: string; created_at: string } | null; items: unknown };
type RawCampaign = { id: string; name: string; platform: string; budget: number | null; actual_spend: number | null; reach: number | null; engagement: number | null; sales_generated: number | null; roi: number | null; status: string };
type RawPromotion = { id: string; name: string; code: string; discount_type: string; discount_value: number | null; usage_count: number | null; total_sales: number | null; is_active: boolean };
type RawContentPlan = { id: string; title: string; platform: string; content_type: string; publish_date: string; status: string; assigned_to: string | null };
type RawReview = { id: string; platform: string; rating: number | null; is_negative: boolean | null; status: string };
type RawClaim = { id: string; platform: string; status: string };
type RawComplaint = { id: string; channel: string; status: string; is_escalated: boolean | null };
type RawReturn = { id: string; platform: string; status: string };
type RawPlatformSetting = { id: string; platform: string; margin_percent: number | null; platform_fee_percent: number | null; is_connected: boolean | null; low_cost_fee_percent: number | null; low_cost_threshold: number | null };
type RawShiftAssignment = { id: string; profile_id: string; branch_id: string | null; assignment_date: string; status: string; actual_check_in_time: string | null; actual_check_out_time: string | null; actual_work_hours: number | null; shifts: { name: string; start_time: string; end_time: string } | null };
type RawAttendance = { id: string; profile_id: string; branch_id: string | null; check_in_time: string | null; work_hours: number | null; late_minutes: number | null; status: string | null; created_at: string };
type RawTask = { id: string; status: string; branch_id: string | null; created_at: string; completed_at: string | null };
type RawPurchaseRequest = { id: string; branch_id: string | null; total_amount: number | null; status: string };
type RawBill = { id: string; status: string; total_amount: number | null; branch_id: string | null; created_at: string };
type RawSalarySetting = { id: string; profile_id: string; employment_type: string; monthly_salary: number | null; daily_wage: number | null };
type RawSalaryAdvance = { id: string; amount: number | null; status: string };
type RawEmployeeLoan = { id: string; loan_amount: number | null; remaining_balance: number | null; status: string };
type RawTarget = { id: string; branch_id: string | null; target_type: string; target_amount: number | null; effective_date: string; is_active: boolean };
type RawVariantBranchStock = { variant_id: string; branch_id: string; quantity: number | null; product_barcodes: { price: number | null; cost_price: number | null; products: { name: string; category: string | null; min_stock: number | null } | null } | null; branches: { name: string } | null };

export function useDashboardData(range: DateRange, branchId: string | null, filters?: { brand?: string | null; category?: string | null }) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const prev = previousRange(range);
    const startISO = `${range.start}T00:00:00`;
    const endISO = `${range.end}T23:59:59.999`;
    const prevStartISO = `${prev.start}T00:00:00`;
    const prevEndISO = `${prev.end}T23:59:59.999`;
    const days = dateRangeDays(range);

    const queries = await Promise.all([
      // 0: branches
      supabase.from('branches').select('id,name,code,is_active').eq('is_active', true).order('name'),
      // 1: stock movements (current range)
      applyBranch(supabase.from('stock_movements').select('id,movement_type,type_config,quantity,unit_price,discount_amount,reference_note,created_at,product_id,branch_id,profile_id,products(id,name,sku,category,brand,min_stock,cost_price,retail_price),profiles(display_name,first_name),branches!stock_movements_branch_id_fkey(name)'), branchId).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }).limit(5000),
      // 2: stock movements (previous range for comparison)
      applyBranch(supabase.from('stock_movements').select('movement_type,type_config,quantity,unit_price,discount_amount,created_at,branch_id'), branchId).gte('created_at', prevStartISO).lte('created_at', prevEndISO),
      // 3: stock movements all (for stock value — no date filter)
      applyBranch(supabase.from('stock_movements').select('movement_type,quantity,created_at,product_id,branch_id'), branchId),
      // 4: product barcodes (stock info)
      supabase.from('product_barcodes').select('product_id,barcode,stock_qty,stock,price,is_active,cost_price'),
      // 5: sales records (current)
      applyBranch(supabase.from('sales_records').select('id,record_date,total_amount,bill_count,branch_id,branches(name),channel_front,channel_line_branch,channel_line_oa,target_amount'), branchId).gte('record_date', range.start).lte('record_date', range.end),
      // 6: sales records (previous)
      applyBranch(supabase.from('sales_records').select('total_amount,bill_count,record_date,branch_id'), branchId).gte('record_date', prev.start).lte('record_date', prev.end),
      // 7: profiles
      supabase.from('profiles').select('id,display_name,first_name,employment_type,is_active,position,active_branch_id').eq('is_active', true),
      // 8: branch members
      supabase.from('branch_members').select('profile_id,branch_id,is_primary,branches(name)'),
      // 9: customer orders (current)
      applyBranch(supabase.from('customer_orders').select('id,customer_id,channel,total,created_at,branch_id,customers(id,name,created_at),items'), branchId).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }).limit(2000),
      // 10: customer orders (previous)
      applyBranch(supabase.from('customer_orders').select('total,created_at,customer_id'), branchId).gte('created_at', prevStartISO).lte('created_at', prevEndISO),
      // 11: campaigns
      supabase.from('campaigns').select('id,name,platform,budget,actual_spend,reach,engagement,sales_generated,roi,status'),
      // 12: promotions
      supabase.from('promotions').select('id,name,code,discount_type,discount_value,usage_count,total_sales,is_active'),
      // 13: content plans
      supabase.from('content_plans').select('id,title,platform,content_type,publish_date,status,assigned_to'),
      // 14: cs reviews
      supabase.from('cs_reviews').select('id,platform,rating,is_negative,status'),
      // 15: cs claims
      supabase.from('cs_claims').select('id,platform,status'),
      // 16: cs complaints
      supabase.from('cs_complaints').select('id,channel,status,is_escalated'),
      // 17: cs returns
      supabase.from('cs_returns').select('id,platform,status'),
      // 18: online platform settings
      supabase.from('online_platform_settings').select('id,platform,margin_percent,platform_fee_percent,is_connected,low_cost_fee_percent,low_cost_threshold'),
      // 19: shift assignments (fetch all — branch_id is often null, filter by profile branch instead)
      supabase.from('shift_assignments').select('id,profile_id,branch_id,assignment_date,status,actual_check_in_time,actual_check_out_time,actual_work_hours,shifts(name,start_time,end_time)').gte('assignment_date', range.start).lte('assignment_date', range.end),
      // 20: attendance
      applyBranch(supabase.from('attendance').select('id,profile_id,branch_id,check_in_time,work_hours,late_minutes,status,created_at'), branchId).gte('created_at', startISO).lte('created_at', endISO),
      // 21: tasks
      applyBranch(supabase.from('tasks').select('id,status,branch_id,created_at,completed_at'), branchId).gte('created_at', startISO).lte('created_at', endISO),
      // 22: purchase requests
      applyBranch(supabase.from('purchase_requests').select('id,branch_id,total_amount,status'), branchId),
      // 23: cs pending bills
      applyBranch(supabase.from('cs_pending_bills').select('id,status,total_amount,branch_id,created_at'), branchId),
      // 24: salary settings
      supabase.from('salary_settings').select('id,profile_id,employment_type,monthly_salary,daily_wage'),
      // 25: salary advances
      supabase.from('salary_advances').select('id,amount,status'),
      // 26: employee loans
      supabase.from('employee_loans').select('id,loan_amount,remaining_balance,status'),
      // 27: sales targets
      applyBranch(supabase.from('sales_targets').select('id,branch_id,target_type,target_amount,effective_date,is_active'), branchId).eq('is_active', true),
      // 28: variant branch stock (for stock value by branch)
      applyBranch(supabase.from('variant_branch_stock').select('variant_id,branch_id,quantity,product_barcodes(price,cost_price,products(name,category,min_stock)),branches(name)'), branchId),
      // 29: social posts
      supabase.from('social_posts').select('id,platform,post_date,status,created_at'),
    ]);

    const firstError = queries.find((q) => q.error)?.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }

    // ===== Extract typed data =====
    const branches = (queries[0].data ?? []) as Branch[];
    const movements = (queries[1].data ?? []) as unknown as RawMovement[];
    const prevMovements = (queries[2].data ?? []) as unknown as { movement_type: string; type_config: string | null; quantity: number | null; unit_price: number | null; discount_amount: number | null; created_at: string; branch_id: string | null }[];
    const barcodes = (queries[4].data ?? []) as unknown as RawBarcode[];
    const salesRecords = (queries[5].data ?? []) as unknown as RawSalesRecord[];
    const prevSalesRecords = (queries[6].data ?? []) as unknown as RawSalesRecord[];
    const profiles = (queries[7].data ?? []) as unknown as RawProfile[];
    const branchMembers = (queries[8].data ?? []) as unknown as RawBranchMember[];
    const customerOrders = (queries[9].data ?? []) as unknown as RawCustomerOrder[];
    const prevCustomerOrders = (queries[10].data ?? []) as unknown as RawCustomerOrder[];
    const campaigns = (queries[11].data ?? []) as unknown as RawCampaign[];
    const promotions = (queries[12].data ?? []) as unknown as RawPromotion[];
    const contentPlans = (queries[13].data ?? []) as unknown as RawContentPlan[];
    const reviews = (queries[14].data ?? []) as unknown as RawReview[];
    const claims = (queries[15].data ?? []) as unknown as RawClaim[];
    const complaints = (queries[16].data ?? []) as unknown as RawComplaint[];
    const returns = (queries[17].data ?? []) as unknown as RawReturn[];
    const platformSettings = (queries[18].data ?? []) as unknown as RawPlatformSetting[];
    const shiftAssignments = (queries[19].data ?? []) as unknown as RawShiftAssignment[];
    const attendance = (queries[20].data ?? []) as unknown as RawAttendance[];
    const tasks = (queries[21].data ?? []) as unknown as RawTask[];
    const purchaseRequests = (queries[22].data ?? []) as unknown as RawPurchaseRequest[];
    const bills = (queries[23].data ?? []) as unknown as RawBill[];
    const salarySettings = (queries[24].data ?? []) as unknown as RawSalarySetting[];
    const salaryAdvances = (queries[25].data ?? []) as unknown as RawSalaryAdvance[];
    const employeeLoans = (queries[26].data ?? []) as unknown as RawEmployeeLoan[];
    const salesTargets = (queries[27].data ?? []) as unknown as RawTarget[];
    const variantBranchStock = (queries[28].data ?? []) as unknown as RawVariantBranchStock[];
    const socialPosts = (queries[29].data ?? []) as unknown as { id: string; platform: string; post_date: string; status: string; created_at: string }[];

    // ===== Build profile → branch map (fixes the branch filter bug) =====
    const profileBranchMap = new Map<string, string>();
    const profileBranchIdMap = new Map<string, string>();
    branchMembers.forEach((bm) => {
      if (bm.is_primary || !profileBranchMap.has(bm.profile_id)) {
        profileBranchMap.set(bm.profile_id, bm.branches?.name ?? 'ไม่ระบุสาขา');
        profileBranchIdMap.set(bm.profile_id, bm.branch_id);
      }
    });
    // Also use active_branch_id as fallback
    profiles.forEach((p) => {
      if (!profileBranchMap.has(p.id) && p.active_branch_id) {
        const branch = branches.find((b) => b.id === p.active_branch_id);
        if (branch) {
          profileBranchMap.set(p.id, branch.name);
          profileBranchIdMap.set(p.id, p.active_branch_id);
        }
      }
    });

    // ===== Filter shift assignments by branch (via profile branch, since branch_id is often null) =====
    const filteredShiftAssignments = branchId
      ? shiftAssignments.filter((sa) => {
          const saBranchId = sa.branch_id ?? profileBranchIdMap.get(sa.profile_id);
          return saBranchId === branchId;
        })
      : shiftAssignments;

    // ===== Build stock map from barcodes =====
    // Prefer barcodes with non-zero price, then highest stock qty
    const stockMap = new Map<string, { stockQty: number; price: number; costPrice: number; barcode: string }>();
    barcodes.forEach((b) => {
      if (b.is_active === false) return;
      const qty = Number(b.stock_qty ?? b.stock ?? 0);
      const price = Number(b.price ?? 0);
      const costPrice = Number(b.cost_price ?? 0);
      const existing = stockMap.get(b.product_id);
      if (!existing) {
        stockMap.set(b.product_id, { stockQty: qty, price, costPrice, barcode: b.barcode ?? '' });
      } else if ((existing.price === 0 && price > 0) || (existing.price > 0 && price > 0 && qty > existing.stockQty)) {
        stockMap.set(b.product_id, { stockQty: qty, price, costPrice, barcode: b.barcode ?? '' });
      }
    });

    // ===== Build brand/category filter lists =====
    const brandSet = new Set<string>();
    const categorySet = new Set<string>();
    movements.forEach((m) => {
      if (m.products?.brand) brandSet.add(m.products.brand);
      if (m.products?.category) categorySet.add(m.products.category);
    });
    const allBrands = Array.from(brandSet).sort();
    const allCategories = Array.from(categorySet).sort();

    // ===== Apply brand/category filters to movements =====
    const filteredMovements = (filters?.brand && filters.brand !== 'all') || (filters?.category && filters.category !== 'all')
      ? movements.filter((m) => {
          if (filters?.brand && filters.brand !== 'all' && m.products?.brand !== filters.brand) return false;
          if (filters?.category && filters.category !== 'all' && m.products?.category !== filters.category) return false;
          return true;
        })
      : movements;

    // ===== Calculate sales from movements (only real sales — exclude zero-value types) =====
    const dailySalesMap = new Map<string, { sales: number; units: number }>();
    const channelMap = new Map<string, { sales: number; units: number }>();
    const productSalesMap = new Map<string, { name: string; quantity: number; salesValue: number; category: string; branch: string }>();
    const branchSalesMap = new Map<string, { sales: number; units: number }>();
    let totalSales = 0;
    let totalUnits = 0;
    let totalReturns = 0;
    let normalSalesTotal = 0;
    let costSalesTotal = 0;
    let billCount = 0;
    const recentMovements: SalesData['recentMovements'] = [];
    const hourlyMap = new Map<string, number>();

    filteredMovements.forEach((m) => {
      const product = m.products;
      if (!product) return;

      // Returns: receive movements with return type_config
      if (m.movement_type === 'receive' && m.type_config && RETURN_TYPE_CONFIGS.has(m.type_config)) {
        const qty = Number(m.quantity ?? 0);
        const retPrice = (Number(m.unit_price ?? 0) || stockMap.get(m.product_id)?.price) ?? Number(product.retail_price ?? 0);
        totalReturns += qty * retPrice;
        return;
      }

      if (!isSaleMovement(m.movement_type, m.type_config)) return;

      const qty = Number(m.quantity ?? 0);
      const stockInfo = stockMap.get(m.product_id);
      // Use actual unit_price from the movement (what was actually charged), fall back to barcode price
      const rawPrice = Number(m.unit_price ?? 0);
      const price = rawPrice > 0 ? rawPrice : (stockInfo?.price ?? Number(product.retail_price ?? 0));
      const discount = Number(m.discount_amount ?? 0);
      const salesValue = qty * price - discount;
      const ch = channelFromNote(m.reference_note, m.type_config);
      const dt = m.created_at.slice(0, 10);
      const branchName = m.branches?.name ?? (branchId ? 'เลือกสาขา' : 'ไม่ระบุสาขา');

      totalSales += salesValue;
      totalUnits += qty;
      billCount += 1;

      if (isCostSale(m.type_config)) costSalesTotal += salesValue;
      else normalSalesTotal += salesValue;

      // Daily trend
      const dayEntry = dailySalesMap.get(dt) ?? { sales: 0, units: 0 };
      dayEntry.sales += salesValue;
      dayEntry.units += qty;
      dailySalesMap.set(dt, dayEntry);

      // Branch comparison
      if (!branchId) {
        const branchEntry = branchSalesMap.get(branchName) ?? { sales: 0, units: 0 };
        branchEntry.sales += salesValue;
        branchEntry.units += qty;
        branchSalesMap.set(branchName, branchEntry);
      }

      // Channel breakdown
      const chEntry = channelMap.get(ch) ?? { sales: 0, units: 0 };
      chEntry.sales += salesValue;
      chEntry.units += qty;
      channelMap.set(ch, chEntry);

      // Product sales
      const prodEntry = productSalesMap.get(m.product_id) ?? { productId: m.product_id, name: product.name, quantity: 0, salesValue: 0, category: product.category ?? 'ไม่ระบุ', branch: branchName };
      prodEntry.quantity += qty;
      prodEntry.salesValue += salesValue;
      productSalesMap.set(m.product_id, prodEntry);

      // Recent movements
      recentMovements.push({ id: m.id, product: product.name, productId: m.product_id, quantity: qty, unitPrice: price, channel: ch, date: m.created_at, branch: branchName });

      // Hourly pattern
      const hour = m.created_at.length > 10 ? m.created_at.slice(11, 13) : '00';
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
    });

    // Also add sales_records data
    salesRecords.forEach((sr) => {
      const amount = Number(sr.total_amount ?? 0);
      const bills = Number(sr.bill_count ?? 0);
      totalSales += amount;
      totalUnits += bills;
      billCount += bills > 0 ? bills : 1;
      const dt = sr.record_date;
      const dayEntry = dailySalesMap.get(dt) ?? { sales: 0, units: 0 };
      dayEntry.sales += amount;
      dayEntry.units += bills;
      dailySalesMap.set(dt, dayEntry);
      const branchName = sr.branches?.name ?? 'ไม่ระบุสาขา';
      if (!branchId) {
        const branchEntry = branchSalesMap.get(branchName) ?? { sales: 0, units: 0 };
        branchEntry.sales += amount;
        branchEntry.units += bills;
        branchSalesMap.set(branchName, branchEntry);
      }
      // Feed channel breakdown from sales_records channel data
      const frontAmt = Number(sr.channel_front ?? 0);
      const lineBranchAmt = Number(sr.channel_line_branch ?? 0);
      const lineOaAmt = Number(sr.channel_line_oa ?? 0);
      if (frontAmt > 0) {
        const chEntry = channelMap.get('store') ?? { sales: 0, units: 0 };
        chEntry.sales += frontAmt; chEntry.units += bills;
        channelMap.set('store', chEntry);
      }
      if (lineBranchAmt > 0 || lineOaAmt > 0) {
        const chEntry = channelMap.get('line') ?? { sales: 0, units: 0 };
        chEntry.sales += lineBranchAmt + lineOaAmt;
        channelMap.set('line', chEntry);
      }
    });

    // Also add customer_orders data
    customerOrders.forEach((co) => {
      const amount = Number(co.total ?? 0);
      totalSales += amount;
      billCount += 1;
      const dt = co.created_at.slice(0, 10);
      const dayEntry = dailySalesMap.get(dt) ?? { sales: 0, units: 0 };
      dayEntry.sales += amount;
      dayEntry.units += 1;
      dailySalesMap.set(dt, dayEntry);
      const ch = co.channel === 'line' ? 'line' : 'store';
      const chEntry = channelMap.get(ch) ?? { sales: 0, units: 0 };
      chEntry.sales += amount;
      chEntry.units += 1;
      channelMap.set(ch, chEntry);
      // Feed product sales from order items
      const items = (Array.isArray(co.items) ? co.items : []) as { product_name?: string; quantity?: number; product_id?: string }[];
      items.forEach((item) => {
        const pid = item.product_id ?? `co_${co.id}_${item.product_name ?? 'unknown'}`;
        const prodEntry = productSalesMap.get(pid) ?? { productId: pid, name: item.product_name ?? 'ไม่ระบุ', quantity: 0, salesValue: 0, category: 'ไม่ระบุ', branch: co.channel === 'line' ? 'LINE' : 'หน้าร้าน' };
        prodEntry.quantity += Number(item.quantity ?? 0);
        prodEntry.salesValue += 0; // individual item prices not available, total already counted above
        productSalesMap.set(pid, prodEntry);
      });
      // Hourly pattern
      const hour = co.created_at.length > 10 ? co.created_at.slice(11, 13) : '00';
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
    });

    // ===== Previous period sales =====
    let prevTotalSales = 0;
    let prevTotalUnits = 0;
    prevMovements.forEach((m) => {
      if (!isSaleMovement(m.movement_type, m.type_config)) return;
      const qty = Number(m.quantity ?? 0);
      const rawPrice = Number(m.unit_price ?? 0);
      const discount = Number(m.discount_amount ?? 0);
      prevTotalSales += qty * rawPrice - discount;
      prevTotalUnits += qty;
    });
    prevSalesRecords.forEach((sr) => { prevTotalSales += Number(sr.total_amount ?? 0); prevTotalUnits += Number(sr.bill_count ?? 0); });
    prevCustomerOrders.forEach((co) => { prevTotalSales += Number(co.total ?? 0); prevTotalUnits += 1; });

    // ===== Build trend points =====
    const salesTrend = buildTrendPoints(days, new Map(Array.from(dailySalesMap.entries()).map(([k, v]) => [k, { sales: v.sales, units: v.units }])), ['sales', 'units']);
    const sparklineSales = salesTrend.map((p) => Number(p.sales));

    // ===== Branch comparison trend (multi-line) =====
    const branchComparison: TrendPoint[] = branchId ? [] : (() => {
      const branchNames = Array.from(branchSalesMap.keys()).sort();
      const branchDailyMap = new Map<string, Record<string, number>>();
      movements.filter((m) => isSaleMovement(m.movement_type, m.type_config)).forEach((m) => {
        const bn = m.branches?.name ?? 'ไม่ระบุสาขา';
        const dt = m.created_at.slice(0, 10);
        const stockInfo = stockMap.get(m.product_id);
        const price = stockInfo?.price ?? Number(m.products?.retail_price ?? 0);
        const val = Number(m.quantity ?? 0) * price;
        const entry = branchDailyMap.get(dt) ?? {};
        entry[bn] = (entry[bn] ?? 0) + val;
        branchDailyMap.set(dt, entry);
      });
      salesRecords.forEach((sr) => {
        const bn = sr.branches?.name ?? 'ไม่ระบุสาขา';
        const entry = branchDailyMap.get(sr.record_date) ?? {};
        entry[bn] = (entry[bn] ?? 0) + Number(sr.total_amount ?? 0);
        branchDailyMap.set(sr.record_date, entry);
      });
      return days.map((day) => {
        const vals = branchDailyMap.get(day) ?? {};
        const point: TrendPoint = { date: day, label: formatThaiDate(day) };
        branchNames.forEach((bn) => { point[bn] = vals[bn] ?? 0; });
        return point;
      });
    })();

    // ===== Forecast (linear regression on sales trend) =====
    const forecastDays = Math.min(7, days.length);
    const forecast = linearForecast(salesTrend, 'sales', forecastDays);

    // ===== Channel breakdown =====
    const salesByChannel = Array.from(channelMap.entries()).map(([ch, v]) => ({
      channel: CHANNEL_LABELS[ch] ?? ch, sales: v.sales, units: v.units, color: CHANNEL_COLORS[ch] ?? '#64748b',
    })).sort((a, b) => b.sales - a.sales);

    // ===== Top products =====
    const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.salesValue - a.salesValue).slice(0, 15);

    // ===== Sales target =====
    const matchingTarget = salesTargets.find((t) => {
      const effective = new Date(t.effective_date);
      const rangeEnd = new Date(range.end);
      return effective <= rangeEnd;
    });
    let targetAmount = 0;
    let targetType = 'monthly';
    if (matchingTarget) {
      targetType = matchingTarget.target_type;
      const base = Number(matchingTarget.target_amount ?? 0);
      targetAmount = targetType === 'daily' ? base * days.length : base;
    }
    const targetInfo = {
      targetAmount, actualAmount: totalSales,
      percent: targetAmount > 0 ? Math.min(100, Math.round((totalSales / targetAmount) * 100)) : 0,
      remaining: Math.max(0, targetAmount - totalSales), type: targetType,
    };

    // ===== Target progress by branch =====
    const targetProgress = branchId ? [{ branch: branches.find((b) => b.id === branchId)?.name ?? 'สาขา', target: targetAmount, actual: totalSales, percent: targetInfo.percent }] :
      branches.map((b) => {
        const bSales = branchSalesMap.get(b.name)?.sales ?? 0;
        const bTarget = salesTargets.find((t) => t.branch_id === b.id);
        const bTargetAmt = bTarget ? (bTarget.target_type === 'daily' ? Number(bTarget.target_amount) * days.length : Number(bTarget.target_amount)) : 0;
        return { branch: b.name, target: bTargetAmt, actual: bSales, percent: bTargetAmt > 0 ? Math.min(100, Math.round((bSales / bTargetAmt) * 100)) : 0 };
      });

    // ===== Overview KPIs =====
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = movements.filter((m) => m.created_at.slice(0, 10) === todayStr && isSaleMovement(m.movement_type, m.type_config))
      .reduce((s, m) => s + Number(m.quantity ?? 0) * (Number(m.unit_price ?? 0) || stockMap.get(m.product_id)?.price || Number(m.products?.retail_price ?? 0)) - Number(m.discount_amount ?? 0), 0)
      + salesRecords.filter((sr) => sr.record_date === todayStr).reduce((s, sr) => s + Number(sr.total_amount ?? 0), 0)
      + customerOrders.filter((co) => co.created_at.slice(0, 10) === todayStr).reduce((s, co) => s + Number(co.total ?? 0), 0);
    const monthStr = todayStr.slice(0, 7);
    const monthSales = movements.filter((m) => m.created_at.slice(0, 7) === monthStr && isSaleMovement(m.movement_type, m.type_config))
      .reduce((s, m) => s + Number(m.quantity ?? 0) * (Number(m.unit_price ?? 0) || stockMap.get(m.product_id)?.price || Number(m.products?.retail_price ?? 0)) - Number(m.discount_amount ?? 0), 0)
      + salesRecords.filter((sr) => sr.record_date.slice(0, 7) === monthStr).reduce((s, sr) => s + Number(sr.total_amount ?? 0), 0)
      + customerOrders.filter((co) => co.created_at.slice(0, 7) === monthStr).reduce((s, co) => s + Number(co.total ?? 0), 0);

    const dailyProfitMap = new Map<string, { profit: number; sales: number }>();
    movements.filter((m) => isSaleMovement(m.movement_type, m.type_config)).forEach((m) => {
      const qty = Number(m.quantity ?? 0);
      const stockInfo = stockMap.get(m.product_id);
      const price = Number(m.unit_price ?? 0) > 0 ? Number(m.unit_price ?? 0) : (stockInfo?.price ?? Number(m.products?.retail_price ?? 0));
      const cost = stockInfo?.costPrice ?? Number(m.products?.cost_price ?? 0);
      const discount = Number(m.discount_amount ?? 0);
      const salesVal = qty * price - discount;
      const profitVal = salesVal - qty * cost;
      const dt = m.created_at.slice(0, 10);
      const entry = dailyProfitMap.get(dt) ?? { profit: 0, sales: 0 };
      entry.profit += profitVal;
      entry.sales += salesVal;
      dailyProfitMap.set(dt, entry);
    });
    const profitTrend = buildTrendPoints(days, new Map(Array.from(dailyProfitMap.entries()).map(([k, v]) => [k, { profit: Math.round(v.profit), sales: Math.round(v.sales) }])), ['profit', 'sales']);
    const totalProfit = profitTrend.reduce((s, p) => s + Number(p.profit), 0);
    const todayProfit = Math.round(dailyProfitMap.get(todayStr)?.profit ?? 0);

    const categoryMap = new Map<string, number>();
    productSalesMap.forEach((p) => { categoryMap.set(p.category, (categoryMap.get(p.category) ?? 0) + p.salesValue); });
    const categoryColors = ['#3D7BF5', '#16a34a', '#f59e0b', '#ec4899', '#0ea5e9', '#f97316', '#8b5cf6', '#64748b'];
    const salesByCategory = Array.from(categoryMap.entries()).map(([category, sales], i) => ({ category, sales, color: categoryColors[i % categoryColors.length] })).sort((a, b) => b.sales - a.sales);

    const overviewAlerts: OverviewAlert[] = [];
    stockMap.forEach((s, pid) => {
      const movement = movements.find((m) => m.product_id === pid);
      const minStock = movement?.products?.min_stock ?? 0;
      if (minStock > 0 && s.stockQty <= minStock) {
        overviewAlerts.push({ type: s.stockQty === 0 ? 'urgent' : 'low', productName: movement?.products?.name ?? 'ไม่ระบุ', detail: `สต็อกเหลือ ${s.stockQty} (ขั้นต่ำ ${minStock})` });
      }
    });
    const soldProductIds = new Set(productSalesMap.keys());
    stockMap.forEach((s, pid) => {
      if (!soldProductIds.has(pid) && s.stockQty > 0) {
        const movement = movements.find((m) => m.product_id === pid);
        if (movement?.products?.name) overviewAlerts.push({ type: 'slow', productName: movement.products.name, detail: `ไม่มีการขายในช่วงนี้ (สต็อก ${s.stockQty})` });
      }
    });

    const stockValueOverview = computeStockValue(variantBranchStock);
    const lowStockCount = overviewAlerts.filter((a) => a.type === 'low').length;
    const outOfStockCount = overviewAlerts.filter((a) => a.type === 'urgent').length;

    const overviewKpis: KpiCard[] = [
      makeKpi('ยอดขายวันนี้', todaySales, 0, 'currency', [], 'trending-up', PRIMARY_COLOR, 'ยอดขายรวมจากการเบิกออกวันนี้'),
      makeKpi('ยอดขายเดือนนี้', monthSales, 0, 'currency', [], 'calendar', '#0ea5e9', 'ยอดขายสะสมในเดือนปัจจุบัน'),
      makeKpi('กำไรขั้นต้นวันนี้', todayProfit, 0, 'currency', [], 'dollar-sign', '#16a34a', 'ยอดขายลบต้นทุนสินค้าวันนี้'),
      makeKpi('กำไรขั้นต้น (ช่วง)', totalProfit, 0, 'currency', profitTrend.map((p) => Number(p.profit)), 'wallet', '#f59e0b', 'กำไรสะสมตลอดช่วงที่เลือก'),
      makeKpi('มูลค่าสต็อก', stockValueOverview, 0, 'currency', [], 'boxes', '#0ea5e9', 'มูลค่าสินค้าคงคลังทั้งหมด'),
      makeKpi('สินค้าใกล้หมด', lowStockCount, 0, 'number', [], 'alert-triangle', '#f59e0b', 'สินค้าที่เหลือน้อยกว่าระดับขั้นต่ำ'),
      makeKpi('สินค้าหมด', outOfStockCount, 0, 'number', [], 'package', '#ef4444', 'สินค้าที่สต็อกเป็น 0'),
      makeKpi('จำนวนบิล', billCount, 0, 'number', [], 'receipt', '#8b5cf6', 'จำนวนใบเสร็จ/บิลขายในช่วงที่เลือก'),
    ];

    const salesChange = pctChange(totalSales, prevTotalSales);
    const insight = salesChange === null ? `ยอดขายรวม ${formatCurrency(totalSales)} ในช่วงที่เลือก` :
      salesChange >= 0 ? `ยอดขายเพิ่มขึ้น ${salesChange}% จากช่วงก่อนหน้า ยอดขายรวม ${formatCurrency(totalSales)}` :
      `ยอดขายลดลง ${Math.abs(salesChange)}% จากช่วงก่อนหน้า ยอดขายรวม ${formatCurrency(totalSales)}`;

    const overview: OverviewData = {
      kpis: overviewKpis,
      salesTrend,
      profitTrend,
      salesByBranch: Array.from(branchSalesMap.entries()).map(([branch, v]) => ({ branch, sales: v.sales, units: v.units })).sort((a, b) => b.sales - a.sales),
      topProducts: topProducts.slice(0, 8),
      salesByChannel,
      salesByCategory,
      targetProgress,
      forecast,
      alerts: overviewAlerts.slice(0, 20),
      insight,
    };

    // ===== Sales Tab =====
    const frontStoreSales = channelMap.get('store')?.sales ?? 0;
    const avgPerBill = billCount > 0 ? Math.round(totalSales / billCount) : 0;
    const frontStoreTarget = matchingTarget ? Number(matchingTarget.target_amount ?? 0) : 0;
    const frontStoreAchPct = frontStoreTarget > 0 ? Math.round((frontStoreSales / frontStoreTarget) * 1000) / 10 : 0;
    const salesKpis: KpiCard[] = [
      makeKpi('ยอดขายรวม', totalSales, prevTotalSales, 'currency', sparklineSales, 'trending-up', PRIMARY_COLOR, 'ยอดขายจากการเบิกออก (ไม่นับราคาทุน)'),
      makeKpi('จำนวนบิล', billCount, 0, 'number', [], 'receipt', '#16a34a', 'จำนวนรายการขายในช่วงที่เลือก'),
      makeKpi('ยอดเฉลี่ย/บิล', avgPerBill, 0, 'currency', [], 'calculator', '#0ea5e9', 'ยอดขายรวมหารด้วยจำนวนบิล'),
      makeKpi('คืนสินค้า', totalReturns, 0, 'currency', [], 'undo-2', '#ef4444', 'มูลค่าสินค้าที่ลูกค้าตีกลับ/คืน'),
      makeKpi('Ach% (หน้าร้าน)', frontStoreAchPct, 0, 'percent', [], 'target', '#8b5cf6', 'เปอร์เซ็นต์ยอดขายหน้าร้านเทียบเป้าหมาย'),
    ];
    const hourlyPattern = Array.from(hourlyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([hour, count]) => ({
      hour: `${hour}:00`, count,
    }));

    const sales: SalesData = {
      kpis: salesKpis,
      dailyTrend: salesTrend,
      branchComparison,
      channelBreakdown: salesByChannel,
      topProducts,
      recentMovements: recentMovements.slice(0, 50),
      targetInfo,
      hourlyPattern,
      returns: totalReturns,
      billCount,
      avgPerBill,
      normalSales: normalSalesTotal,
      costSales: costSalesTotal,
      frontStoreSales,
    };

    // ===== Stock Tab =====
    const movementTypeMap = new Map<string, { count: number; quantity: number }>();
    const movementDailyMap = new Map<string, { received: number; withdrawn: number; transferred: number }>();
    filteredMovements.forEach((m) => {
      const qty = Number(m.quantity ?? 0);
      const dt = m.created_at.slice(0, 10);
      const typeEntry = movementTypeMap.get(m.movement_type) ?? { count: 0, quantity: 0 };
      typeEntry.count += 1;
      typeEntry.quantity += qty;
      movementTypeMap.set(m.movement_type, typeEntry);
      const dayEntry = movementDailyMap.get(dt) ?? { received: 0, withdrawn: 0, transferred: 0 };
      if (m.movement_type === 'receive' || m.movement_type === 'transfer_in') dayEntry.received += Math.abs(qty);
      else if (m.movement_type === 'withdraw' || m.movement_type === 'transfer_out') dayEntry.withdrawn += Math.abs(qty);
      else dayEntry.transferred += Math.abs(qty);
      movementDailyMap.set(dt, dayEntry);
    });
    const movementTrend = buildTrendPoints(days, new Map(Array.from(movementDailyMap.entries()).map(([k, v]) => [k, v])), ['received', 'withdrawn', 'transferred']);
    const movementTypeColors: Record<string, string> = { receive: '#16a34a', withdraw: '#ef4444', transfer_in: '#0ea5e9', transfer_out: '#f97316', adjust: '#f59e0b' };
    const movementByType = Array.from(movementTypeMap.entries()).map(([type, v]) => ({
      type: type === 'receive' ? 'รับเข้า' : type === 'withdraw' ? 'เบิกออก' : type === 'transfer_in' ? 'รับโอน' : type === 'transfer_out' ? 'ส่งโอน' : 'ปรับปรุง',
      count: v.count, quantity: v.quantity, color: movementTypeColors[type] ?? '#64748b',
    })).sort((a, b) => b.quantity - a.quantity);

    // ===== Top moved products (ALL movements, not just sales) =====
    const productMovementMap = new Map<string, { name: string; category: string; movedQty: number }>();
    filteredMovements.forEach((m) => {
      const product = m.products;
      if (!product) return;
      const qty = Math.abs(Number(m.quantity ?? 0));
      const entry = productMovementMap.get(m.product_id) ?? { name: product.name, category: product.category ?? 'ไม่ระบุ', movedQty: 0 };
      entry.movedQty += qty;
      productMovementMap.set(m.product_id, entry);
    });
    const topMovedProducts = Array.from(productMovementMap.entries()).map(([id, p]) => {
      const stock = stockMap.get(id);
      return { productId: id, name: p.name, sku: stock?.barcode ?? '-', category: p.category, movedQty: p.movedQty, stockQty: stock?.stockQty ?? 0, stockValue: (stock?.stockQty ?? 0) * (stock?.costPrice ?? 0) };
    }).sort((a, b) => b.movedQty - a.movedQty).slice(0, 20);

    // Low stock alerts
    const lowStockAlerts: StockData['lowStockAlerts'] = [];
    stockMap.forEach((s, pid) => {
      // We need min_stock from products — check movements for product info
      const movement = movements.find((m) => m.product_id === pid);
      const minStock = movement?.products?.min_stock ?? 0;
      if (minStock > 0 && s.stockQty <= minStock) {
        lowStockAlerts.push({ productId: pid, name: movement?.products?.name ?? 'ไม่ระบุ', sku: s.barcode, category: movement?.products?.category ?? 'ไม่ระบุ', stockQty: s.stockQty, minStock, branch: branchId ? (branches.find((b) => b.id === branchId)?.name ?? 'สาขา') : 'ทุกสาขา' });
      }
    });

    // Branch stock value
    const branchStockMap = new Map<string, { stockValue: number; productCount: number }>();
    variantBranchStock.forEach((vbs) => {
      const bn = vbs.branches?.name ?? 'ไม่ระบุสาขา';
      const qty = Number(vbs.quantity ?? 0);
      const cost = Number(vbs.product_barcodes?.cost_price ?? 0);
      const entry = branchStockMap.get(bn) ?? { stockValue: 0, productCount: 0 };
      entry.stockValue += qty * cost;
      entry.productCount += 1;
      branchStockMap.set(bn, entry);
    });

    const stockRecentMovements: StockData['recentMovements'] = filteredMovements.slice(0, 50).map((m) => ({
      id: m.id, product: m.products?.name ?? 'ไม่ระบุ', type: m.movement_type, quantity: Number(m.quantity ?? 0), date: m.created_at,
      user: m.profiles?.display_name ?? m.profiles?.first_name ?? 'ไม่ระบุ',
      branch: m.branches?.name ?? 'ไม่ระบุสาขา', note: m.reference_note ?? '',
    }));

    const stockValue = computeStockValue(variantBranchStock);
    const prevStockMovements = prevMovements.length;
    const stockKpis: KpiCard[] = [
      makeKpi('มูลค่าสต๊อก', stockValue, 0, 'currency', [], 'boxes', PRIMARY_COLOR, 'มูลค่าสินค้าคงคลังรวมทุกสาขา'),
      makeKpi('รายการเคลื่อนไหว', filteredMovements.length, prevStockMovements, 'number', movementTrend.map((p) => Number(p.withdrawn) + Number(p.received) + Number(p.transferred)), 'activity', '#16a34a', 'จำนวนรายการรับ/เบิก/โอนในช่วงที่เลือก'),
      makeKpi('สินค้าในระบบ', stockMap.size, 0, 'number', [], 'package', '#0ea5e9', 'จำนวนรายการสินค้าทั้งหมด'),
      makeKpi('สินค้าสต๊อกต่ำ', lowStockAlerts.length, 0, 'number', [], 'alert-triangle', '#ef4444', 'สินค้าที่สต็อกต่ำกว่าระดับขั้นต่ำ'),
    ];

    const stock: StockData = {
      kpis: stockKpis,
      movementTrend,
      movementByType,
      topMovedProducts,
      lowStockAlerts,
      branchStockValue: Array.from(branchStockMap.entries()).map(([branch, v]) => ({ branch, stockValue: v.stockValue, productCount: v.productCount })).sort((a, b) => b.stockValue - a.stockValue),
      recentMovements: stockRecentMovements,
    };

    // ===== Workforce Tab =====
    const employeesByBranchMap = new Map<string, { count: number; dailyCount: number; monthlyCount: number }>();
    profiles.forEach((p) => {
      const bn = profileBranchMap.get(p.id) ?? 'ไม่ระบุสาขา';
      const entry = employeesByBranchMap.get(bn) ?? { count: 0, dailyCount: 0, monthlyCount: 0 };
      entry.count += 1;
      if (p.employment_type === 'daily') entry.dailyCount += 1;
      else entry.monthlyCount += 1;
      employeesByBranchMap.set(bn, entry);
    });

    const employeeList = profiles.map((p) => ({
      id: p.id, name: p.display_name ?? p.first_name ?? 'ไม่ระบุ', type: p.employment_type,
      branch: profileBranchMap.get(p.id) ?? 'ไม่ระบุสาขา', active: p.is_active, position: p.position,
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Shift distribution
    const shiftMap = new Map<string, number>();
    filteredShiftAssignments.forEach((sa) => {
      const sn = sa.shifts?.name ?? 'ไม่ระบุกะ';
      shiftMap.set(sn, (shiftMap.get(sn) ?? 0) + 1);
    });
    const shiftColors = ['#3D7BF5', '#16a34a', '#f59e0b', '#ec4899', '#0ea5e9', '#f97316'];
    const shiftDistribution = Array.from(shiftMap.entries()).map(([shift, count], i) => ({ shift, count, color: shiftColors[i % shiftColors.length] }));

    // Attendance status
    const attendanceStatus = { onTime: 0, late: 0, leave: 0, absent: 0 };
    filteredShiftAssignments.forEach((sa) => {
      if (sa.status === 'work' || sa.status === 'confirmed') {
        if (sa.actual_check_in_time && sa.shifts) {
          const shiftStart = new Date(`${sa.assignment_date}T${sa.shifts.start_time}+07:00`);
          const actualIn = new Date(sa.actual_check_in_time);
          if (actualIn.getTime() > shiftStart.getTime()) attendanceStatus.late += 1;
          else attendanceStatus.onTime += 1;
        } else if (sa.actual_check_in_time) attendanceStatus.onTime += 1;
        else attendanceStatus.absent += 1;
      } else if (['sick', 'personal', 'vacation'].includes(sa.status)) attendanceStatus.leave += 1;
    });

    // Helper: compute scheduled hours from shift start/end times
    const scheduledHoursFor = (sa: RawShiftAssignment): number => {
      if (!sa.shifts) return 0;
      const [sh, sm] = sa.shifts.start_time.split(':').map(Number);
      const [eh, em] = sa.shifts.end_time.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      return mins > 0 ? Math.round((mins / 60) * 10) / 10 : 0;
    };

    // Attendance trend — built from shift_assignments (scheduled + actual)
    const attendanceDailyMap = new Map<string, { scheduled: number; present: number; scheduledHours: number; actualHours: number }>();
    filteredShiftAssignments.forEach((sa) => {
      if (sa.status === 'sick' || sa.status === 'personal' || sa.status === 'vacation') return;
      const dt = sa.assignment_date;
      const entry = attendanceDailyMap.get(dt) ?? { scheduled: 0, present: 0, scheduledHours: 0, actualHours: 0 };
      entry.scheduled += 1;
      entry.scheduledHours += scheduledHoursFor(sa);
      if (sa.actual_check_in_time) {
        entry.present += 1;
        let actualHrs = Number(sa.actual_work_hours);
        if (sa.actual_work_hours == null && sa.actual_check_out_time) {
          const inMs = new Date(sa.actual_check_in_time).getTime();
          const outMs = new Date(sa.actual_check_out_time).getTime();
          actualHrs = Math.max(0, Math.round(((outMs - inMs) / (1000 * 60 * 60)) * 10) / 10);
        }
        entry.actualHours += actualHrs || 0;
      }
      attendanceDailyMap.set(dt, entry);
    });
    attendance.forEach((a) => {
      const dt = a.created_at.slice(0, 10);
      const entry = attendanceDailyMap.get(dt) ?? { scheduled: 0, present: 0, scheduledHours: 0, actualHours: 0 };
      entry.present += 1;
      entry.actualHours += Number(a.work_hours ?? 0);
      attendanceDailyMap.set(dt, entry);
    });
    const attendanceTrend = buildTrendPoints(
      days,
      new Map(Array.from(attendanceDailyMap.entries()).map(([k, v]) => [k, {
        scheduled: v.scheduled,
        present: v.present,
        scheduledHours: Math.round(v.scheduledHours * 10) / 10,
        hours: Math.round(v.actualHours * 10) / 10,
      }])),
      ['scheduled', 'present', 'scheduledHours', 'hours'],
    );

    // Totals for KPI
    const totalScheduledHours = Math.round(Array.from(attendanceDailyMap.values()).reduce((s, v) => s + v.scheduledHours, 0) * 10) / 10;
    const totalActualHours = Math.round(Array.from(attendanceDailyMap.values()).reduce((s, v) => s + v.actualHours, 0) * 10) / 10;

    // Task completion
    const taskDailyMap = new Map<string, { completed: number; total: number }>();
    tasks.forEach((t) => {
      const dt = t.created_at.slice(0, 10);
      const entry = taskDailyMap.get(dt) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (t.status === 'done') entry.completed += 1;
      taskDailyMap.set(dt, entry);
    });
    const taskCompletion = days.map((day) => {
      const e = taskDailyMap.get(day) ?? { completed: 0, total: 0 };
      return { date: day, label: formatThaiDate(day), completed: e.completed, total: e.total };
    });

    const workforceKpis: KpiCard[] = [
      makeKpi('พนักงานทั้งหมด', profiles.length, 0, 'number', [], 'users', PRIMARY_COLOR, 'พนักงานที่ยังใช้งานอยู่ทั้งหมด'),
      makeKpi('พนักงานรายวัน', Array.from(employeesByBranchMap.values()).reduce((s, e) => s + e.dailyCount, 0), 0, 'number', [], 'clock', '#16a34a', 'พนักงานที่รับจ้างรายวัน'),
      makeKpi('พนักงานรายเดือน', Array.from(employeesByBranchMap.values()).reduce((s, e) => s + e.monthlyCount, 0), 0, 'number', [], 'wallet', '#0ea5e9', 'พนักงานที่รับเงินเดือนรายเดือน'),
      makeKpi('ชั่วโมงตามตารางกะ', totalScheduledHours, 0, 'number', attendanceTrend.map((p) => Number(p.scheduledHours)), 'calendar', '#0ea5e9', 'ชั่วโมงที่กะไว้ตามตาราง'),
      makeKpi('ชั่วโมงทำงานจริง', totalActualHours, 0, 'number', attendanceTrend.map((p) => Number(p.hours)), 'timer', '#f59e0b', 'ชั่วโมงทำงานจริงจากการลงเวลา'),
    ];

    const workforce: WorkforceData = {
      kpis: workforceKpis,
      attendanceTrend,
      employeesByBranch: Array.from(employeesByBranchMap.entries()).map(([branch, v]) => ({ branch, ...v })).sort((a, b) => b.count - a.count),
      employeeList,
      shiftDistribution,
      attendanceStatus,
      taskCompletion,
    };

    // ===== Customers Tab =====
    const customerOrderMap = new Map<string, { id: string; name: string; orderCount: number; totalSpent: number; products: Map<string, number>; lastOrder: string }>();
    const seenCustomers = new Set<string>();
    const sortedOrders = [...customerOrders].sort((a, b) => a.created_at.localeCompare(b.created_at));
    sortedOrders.forEach((co) => {
      const cust = co.customers;
      const id = co.customer_id;
      const name = cust?.name ?? 'ไม่ระบุ';
      const existing = customerOrderMap.get(id) ?? { id, name, orderCount: 0, totalSpent: 0, products: new Map<string, number>(), lastOrder: co.created_at };
      existing.orderCount += 1;
      existing.totalSpent += Number(co.total ?? 0);
      if (co.created_at > existing.lastOrder) existing.lastOrder = co.created_at;
      const items = (Array.isArray(co.items) ? co.items : []) as { product_name?: string; quantity?: number }[];
      items.forEach((item) => {
        const pn = item.product_name ?? 'ไม่ระบุ';
        existing.products.set(pn, (existing.products.get(pn) ?? 0) + Number(item.quantity ?? 0));
      });
      customerOrderMap.set(id, existing);
    });

    const topCustomers = Array.from(customerOrderMap.values()).map((c) => {
      const tp = Array.from(c.products.entries()).sort((a, b) => b[1] - a[1])[0];
      return { id: c.id, name: c.name, orderCount: c.orderCount, totalSpent: c.totalSpent, topProduct: tp?.[0] ?? '-', lastOrder: c.lastOrder };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    // New vs returning
    const newVsReturningMap = new Map<string, { newCount: number; returningCount: number }>();
    sortedOrders.forEach((co) => {
      const dt = co.created_at.slice(0, 10);
      const entry = newVsReturningMap.get(dt) ?? { newCount: 0, returningCount: 0 };
      if (seenCustomers.has(co.customer_id)) entry.returningCount += 1;
      else entry.newCount += 1;
      seenCustomers.add(co.customer_id);
      newVsReturningMap.set(dt, entry);
    });
    const newVsReturning = days.map((day) => {
      const e = newVsReturningMap.get(day) ?? { newCount: 0, returningCount: 0 };
      return { date: day, label: formatThaiDate(day), newCount: e.newCount, returningCount: e.returningCount };
    });

    // Customer by channel
    const customerChannelMap = new Map<string, { count: number; totalSpent: number }>();
    customerOrders.forEach((co) => {
      const ch = co.channel ?? 'store';
      const entry = customerChannelMap.get(ch) ?? { count: 0, totalSpent: 0 };
      entry.count += 1;
      entry.totalSpent += Number(co.total ?? 0);
      customerChannelMap.set(ch, entry);
    });
    const customerByChannels = Array.from(customerChannelMap.entries()).map(([ch, v]) => ({
      channel: CHANNEL_LABELS[ch] ?? ch, count: v.count, totalSpent: v.totalSpent, color: CHANNEL_COLORS[ch] ?? '#64748b',
    }));

    // Review summary
    const reviewMap = new Map<string, { totalRating: number; count: number; negativeCount: number }>();
    reviews.forEach((r) => {
      const entry = reviewMap.get(r.platform) ?? { totalRating: 0, count: 0, negativeCount: 0 };
      entry.totalRating += Number(r.rating ?? 0);
      entry.count += 1;
      if (r.is_negative) entry.negativeCount += 1;
      reviewMap.set(r.platform, entry);
    });
    const reviewSummary = Array.from(reviewMap.entries()).map(([platform, v]) => ({
      platform, avgRating: v.count ? v.totalRating / v.count : 0, count: v.count, negativeCount: v.negativeCount,
    }));

    // CS issues
    const allCsItems = [
      ...claims.map((c) => ({ type: 'เคลม', status: c.status })),
      ...complaints.map((c) => ({ type: 'ร้องเรียน', status: c.status })),
      ...returns.map((c) => ({ type: 'คืนสินค้า', status: c.status })),
    ];
    const csIssueMap = new Map<string, { count: number; openCount: number }>();
    allCsItems.forEach((item) => {
      const entry = csIssueMap.get(item.type) ?? { count: 0, openCount: 0 };
      entry.count += 1;
      if (item.status !== 'resolved' && item.status !== 'closed') entry.openCount += 1;
      csIssueMap.set(item.type, entry);
    });
    const csIssues = Array.from(csIssueMap.entries()).map(([type, v]) => ({ type, count: v.count, openCount: v.openCount }));

    const prevCustomerCount = new Set(prevCustomerOrders.map((c) => c.customer_id)).size;
    const customerKpis: KpiCard[] = [
      makeKpi('ลูกค้าทั้งหมด', topCustomers.length, prevCustomerCount, 'number', newVsReturning.map((p) => Number(p.newCount) + Number(p.returningCount)), 'users', PRIMARY_COLOR, 'จำนวนลูกค้าทั้งหมดในระบบ'),
      makeKpi('ลูกค้าใหม่', Array.from(newVsReturningMap.values()).reduce((s, e) => s + e.newCount, 0), 0, 'number', newVsReturning.map((p) => Number(p.newCount)), 'user-plus', '#16a34a', 'ลูกค้าที่สมัครในช่วงที่เลือก'),
      makeKpi('ลูกค้าซื้อซ้ำ', Array.from(newVsReturningMap.values()).reduce((s, e) => s + e.returningCount, 0), 0, 'number', newVsReturning.map((p) => Number(p.returningCount)), 'repeat', '#0ea5e9', 'ลูกค้าที่เคยซื้อแล้วกลับมาซื้ออีก'),
      makeKpi('ยอดซื้อเฉลี่ย/ลูกค้า', topCustomers.length > 0 ? Math.round(topCustomers.reduce((s, c) => s + c.totalSpent, 0) / topCustomers.length) : 0, 0, 'currency', [], 'wallet', '#f59e0b', 'มูลค่าซื้อเฉลี่ยต่อลูกค้า'),
    ];

    const customers: CustomersData = {
      kpis: customerKpis,
      customerTrend: newVsReturning.map((p) => ({ date: p.date, label: p.label, newCount: p.newCount, returningCount: p.returningCount })),
      topCustomers,
      customerByChannels,
      newVsReturning,
      reviewSummary,
      csIssues,
    };

    // ===== Marketing Tab =====
    const campaignPerformance = campaigns.map((c) => ({
      name: c.name, platform: c.platform, budget: Number(c.budget ?? 0), spend: Number(c.actual_spend ?? 0),
      reach: Number(c.reach ?? 0), sales: Number(c.sales_generated ?? 0), roi: Number(c.roi ?? 0), status: c.status,
    }));
    const promotionPerformance = promotions.map((p) => ({
      name: p.name, code: p.code, usageCount: Number(p.usage_count ?? 0), totalSales: Number(p.total_sales ?? 0),
      discountType: p.discount_type, discountValue: Number(p.discount_value ?? 0),
    }));
    const contentPipeline = contentPlans.map((c) => ({
      title: c.title, platform: c.platform, type: c.content_type, date: c.publish_date, status: c.status, assignee: c.assigned_to ?? 'ไม่ได้มอบหมาย',
    }));
    const platformSettingsData = platformSettings.map((p) => ({
      platform: p.platform, margin: Number(p.margin_percent ?? 0), fee: Number(p.platform_fee_percent ?? 0), connected: p.is_connected ?? false,
    }));

    const socialPostsTrend = buildTrendPoints(days, (() => {
      const map = new Map<string, Record<string, number>>();
      socialPosts.forEach((sp) => {
        const dt = sp.post_date.slice(0, 10);
        const entry = map.get(dt) ?? { posts: 0 };
        entry.posts += 1;
        map.set(dt, entry);
      });
      return map;
    })(), ['posts']);

    const marketingKpis: KpiCard[] = [
      makeKpi('แคมเปญทั้งหมด', campaigns.length, 0, 'number', [], 'megaphone', PRIMARY_COLOR),
      makeKpi('โปรโมชั่นที่ใช้งาน', promotions.filter((p) => p.is_active).length, 0, 'number', [], 'tag', '#16a34a'),
      makeKpi('คอนเทนต์ใน Pipeline', contentPlans.length, 0, 'number', [], 'file-text', '#0ea5e9'),
      makeKpi('ROI เฉลี่ย', campaigns.length > 0 ? Math.round(campaigns.reduce((s, c) => s + Number(c.roi ?? 0), 0) / campaigns.length) : 0, 0, 'percent', [], 'trending-up', '#f59e0b'),
    ];

    const marketing: MarketingData = {
      kpis: marketingKpis,
      campaignPerformance,
      promotionPerformance,
      contentPipeline,
      platformSettings: platformSettingsData,
      socialPostsTrend,
    };

    // ===== Finance Tab =====
    const totalSalaries = salarySettings.reduce((s, ss) => s + (ss.employment_type === 'monthly' ? Number(ss.monthly_salary ?? 0) : Number(ss.daily_wage ?? 0) * 30), 0);
    const totalAdvances = salaryAdvances.filter((a) => a.status === 'approved').reduce((s, a) => s + Number(a.amount ?? 0), 0);
    const totalLoans = employeeLoans.filter((l) => l.status === 'active').reduce((s, l) => s + Number(l.remaining_balance ?? 0), 0);

    const pendingPurchaseCount = purchaseRequests.filter((p) => p.status === 'pending').length;
    const approvedPurchaseCount = purchaseRequests.filter((p) => p.status === 'approved').length;
    const totalPurchaseAmount = purchaseRequests.reduce((s, p) => s + Number(p.total_amount ?? 0), 0);

    const billedTotal = bills.filter((b) => b.status === 'billed' || b.status === 'paid').reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
    const pendingTotal = bills.filter((b) => b.status === 'pending').reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
    const paidTotal = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

    const revenueByChannel = salesByChannel.map((c) => ({ channel: c.channel, revenue: c.sales, color: c.color }));
    const expenseBreakdown = [
      { category: 'เงินเดือนพนักงาน', amount: totalSalaries, color: '#3D7BF5' },
      { category: 'เบิกล่วงหน้า', amount: totalAdvances, color: '#f59e0b' },
      { category: 'เงินกู้พนักงาน', amount: totalLoans, color: '#ef4444' },
      { category: 'จัดซื้อสินค้า', amount: totalPurchaseAmount, color: '#0ea5e9' },
    ].filter((e) => e.amount > 0);

    const financeKpis: KpiCard[] = [
      makeKpi('รายได้รวม', totalSales, prevTotalSales, 'currency', sparklineSales, 'trending-up', PRIMARY_COLOR, 'ยอดขายรวมในช่วงที่เลือก'),
      makeKpi('เงินเดือนรวม', totalSalaries, 0, 'currency', [], 'wallet', '#16a34a', 'เงินเดือนรวมของพนักงานทั้งหมด'),
      makeKpi('ค่าใช้จ่ายจัดซื้อ', totalPurchaseAmount, 0, 'currency', [], 'shopping-cart', '#f59e0b', 'มูลค่าการจัดซื้อสินค้าทั้งหมด'),
      makeKpi('กำไรสุทธิ (ประมาณ)', totalSales - totalSalaries - totalPurchaseAmount, 0, 'currency', [], 'dollar-sign', '#0ea5e9', 'รายได้ลบเงินเดือนและค่าจัดซื้อ'),
    ];

    // Profit by category (reuse profitTrend data — compute per-category profit from movements)
    const profitByCategoryMap = new Map<string, number>();
    filteredMovements.filter((m) => isSaleMovement(m.movement_type, m.type_config)).forEach((m) => {
      const qty = Number(m.quantity ?? 0);
      const stockInfo = stockMap.get(m.product_id);
      const price = Number(m.unit_price ?? 0) > 0 ? Number(m.unit_price ?? 0) : (stockInfo?.price ?? Number(m.products?.retail_price ?? 0));
      const cost = stockInfo?.costPrice ?? Number(m.products?.cost_price ?? 0);
      const discount = Number(m.discount_amount ?? 0);
      const profit = qty * price - discount - qty * cost;
      const cat = m.products?.category ?? 'ไม่ระบุ';
      profitByCategoryMap.set(cat, (profitByCategoryMap.get(cat) ?? 0) + profit);
    });
    const financeCategoryColors = ['#3D7BF5', '#16a34a', '#f59e0b', '#ec4899', '#0ea5e9', '#f97316', '#8b5cf6', '#64748b'];
    const profitByCategory = Array.from(profitByCategoryMap.entries()).map(([category, profit], i) => ({
      category, profit: Math.round(profit), color: financeCategoryColors[i % financeCategoryColors.length],
    })).filter((p) => p.profit !== 0).sort((a, b) => b.profit - a.profit);

    const finance: FinanceData = {
      kpis: financeKpis,
      revenueTrend: salesTrend,
      revenueByChannel,
      profitByCategory,
      salaryOverview: { totalSalaries, employeeCount: salarySettings.length, advances: totalAdvances, loans: totalLoans, netPay: totalSalaries - totalAdvances },
      purchaseSummary: { totalRequests: purchaseRequests.length, pendingCount: pendingPurchaseCount, approvedCount: approvedPurchaseCount, totalAmount: totalPurchaseAmount },
      billingSummary: { billedTotal, pendingTotal, pendingCount: bills.filter((b) => b.status === 'pending').length, paidTotal },
      expenseBreakdown,
    };

    setData({ overview, sales, stock, workforce, customers, marketing, finance, branches, brands: allBrands, categories: allCategories });
    setLoading(false);
  }, [range, branchId, filters?.brand, filters?.category]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

function computeStockValue(variantBranchStock: RawVariantBranchStock[]): number {
  return variantBranchStock.reduce((sum, vbs) => sum + Number(vbs.quantity ?? 0) * Number(vbs.product_barcodes?.cost_price ?? 0), 0);
}

function formatCurrency(v: number): string {
  return `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(v)}`;
}


