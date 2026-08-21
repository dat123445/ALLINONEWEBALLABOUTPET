// ===== Dashboard v2 — Business Intelligence Types =====

export type DashboardTab = 'overview' | 'sales' | 'stock' | 'workforce' | 'customers' | 'marketing' | 'finance' | 'settings';

export type DateRange = { start: string; end: string };
export type DatePreset = 'today' | '7d' | '30d' | 'custom';

export type Branch = { id: string; name: string; code: string | null; is_active: boolean };

// ===== Shared chart types =====
export type TrendPoint = {
  date: string;
  label: string;
  [key: string]: string | number;
};

export type MultiSeries = {
  key: string;
  name: string;
  color: string;
};

// ===== KPI Card =====
export type KpiCard = {
  label: string;
  value: number;
  format: 'currency' | 'number' | 'percent';
  previous: number;
  changePct: number | null;
  sparkline: number[];
  icon: string;
  color: string;
  subtitle?: string;
};

// ===== Overview Tab =====
export type OverviewAlert = {
  type: 'urgent' | 'low' | 'expiry' | 'slow';
  productName: string;
  detail: string;
};
export type OverviewData = {
  kpis: KpiCard[];
  salesTrend: TrendPoint[];
  profitTrend: TrendPoint[];
  salesByBranch: { branch: string; sales: number; units: number }[];
  topProducts: { productId: string; name: string; quantity: number; salesValue: number; category: string }[];
  salesByChannel: { channel: string; sales: number; units: number; color: string }[];
  salesByCategory: { category: string; sales: number; color: string }[];
  targetProgress: { branch: string; target: number; actual: number; percent: number }[];
  forecast: { date: string; label: string; actual: number; predicted: number }[];
  alerts: OverviewAlert[];
  insight: string;
};

// ===== Sales Tab =====
export type SalesData = {
  kpis: KpiCard[];
  dailyTrend: TrendPoint[];
  branchComparison: TrendPoint[];
  channelBreakdown: { channel: string; sales: number; units: number; color: string }[];
  topProducts: { productId: string; name: string; quantity: number; salesValue: number; category: string; branch: string }[];
  recentMovements: { id: string; product: string; productId: string; quantity: number; unitPrice: number; channel: string; date: string; branch: string }[];
  targetInfo: { targetAmount: number; actualAmount: number; percent: number; remaining: number; type: string };
  hourlyPattern: { hour: string; count: number }[];
  returns: number;
  billCount: number;
  avgPerBill: number;
  normalSales: number;
  costSales: number;
  frontStoreSales: number;
};

// ===== Stock Tab =====
export type StockData = {
  kpis: KpiCard[];
  movementTrend: TrendPoint[];
  movementByType: { type: string; count: number; quantity: number; color: string }[];
  topMovedProducts: { productId: string; name: string; sku: string; category: string; movedQty: number; stockQty: number; stockValue: number }[];
  lowStockAlerts: { productId: string; name: string; sku: string; category: string; stockQty: number; minStock: number; branch: string }[];
  branchStockValue: { branch: string; stockValue: number; productCount: number }[];
  recentMovements: { id: string; product: string; type: string; quantity: number; date: string; user: string; branch: string; note: string }[];
};

// ===== Workforce Tab =====
export type WorkforceData = {
  kpis: KpiCard[];
  attendanceTrend: TrendPoint[];
  employeesByBranch: { branch: string; count: number; dailyCount: number; monthlyCount: number }[];
  employeeList: { id: string; name: string; type: string; branch: string; active: boolean; position: string | null }[];
  shiftDistribution: { shift: string; count: number; color: string }[];
  attendanceStatus: { onTime: number; late: number; leave: number; absent: number };
  taskCompletion: { date: string; label: string; completed: number; total: number }[];
};

// ===== Customers Tab =====
export type CustomersData = {
  kpis: KpiCard[];
  customerTrend: TrendPoint[];
  topCustomers: { id: string; name: string; orderCount: number; totalSpent: number; topProduct: string; lastOrder: string }[];
  customerByChannels: { channel: string; count: number; totalSpent: number; color: string }[];
  newVsReturning: { date: string; label: string; newCount: number; returningCount: number }[];
  reviewSummary: { platform: string; avgRating: number; count: number; negativeCount: number }[];
  csIssues: { type: string; count: number; openCount: number }[];
};

// ===== Marketing Tab =====
export type MarketingData = {
  kpis: KpiCard[];
  campaignPerformance: { name: string; platform: string; budget: number; spend: number; reach: number; sales: number; roi: number; status: string }[];
  promotionPerformance: { name: string; code: string; usageCount: number; totalSales: number; discountType: string; discountValue: number }[];
  contentPipeline: { title: string; platform: string; type: string; date: string; status: string; assignee: string }[];
  platformSettings: { platform: string; margin: number; fee: number; connected: boolean }[];
  socialPostsTrend: TrendPoint[];
};

// ===== Finance Tab =====
export type FinanceData = {
  kpis: KpiCard[];
  revenueTrend: TrendPoint[];
  revenueByChannel: { channel: string; revenue: number; color: string }[];
  profitByCategory: { category: string; profit: number; color: string }[];
  salaryOverview: { totalSalaries: number; employeeCount: number; advances: number; loans: number; netPay: number };
  purchaseSummary: { totalRequests: number; pendingCount: number; approvedCount: number; totalAmount: number };
  billingSummary: { billedTotal: number; pendingTotal: number; pendingCount: number; paidTotal: number };
  expenseBreakdown: { category: string; amount: number; color: string }[];
};

// ===== Full Dashboard Data =====
export type DashboardData = {
  overview: OverviewData;
  sales: SalesData;
  stock: StockData;
  workforce: WorkforceData;
  customers: CustomersData;
  marketing: MarketingData;
  finance: FinanceData;
  branches: Branch[];
  brands: string[];
  categories: string[];
};
