import type { DateRange, DashboardTab, TrendPoint } from './types';

export const TAB_HASHES: Record<DashboardTab, string> = {
  overview: 'dashboard-overview',
  sales: 'dashboard-sales',
  stock: 'dashboard-stock',
  workforce: 'dashboard-workforce',
  customers: 'dashboard-customers',
  marketing: 'dashboard-marketing',
  finance: 'dashboard-finance',
  settings: 'dashboard-settings',
};

export function tabFromHash(hash: string): DashboardTab {
  const match = (Object.entries(TAB_HASHES) as [DashboardTab, string][]).find(([, value]) => value === hash.replace(/^#/, ''));
  return match?.[0] ?? 'overview';
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function defaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: localDate(start), end: localDate(end) };
}

export function dateRangeFromPreset(preset: 'today' | '7d' | '30d'): DateRange {
  const end = new Date();
  if (preset === 'today') return { start: localDate(end), end: localDate(end) };
  const start = new Date(end);
  start.setDate(start.getDate() - (preset === '7d' ? 6 : 29));
  return { start: localDate(start), end: localDate(end) };
}

export function formatThaiDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function formatThaiDateFull(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMoney(value: number): string {
  return `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH').format(value);
}

export function dateRangeDays(range: DateRange): string[] {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const result: string[] = [];
  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    result.push(localDate(current));
  }
  return result;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function linearForecast(trend: TrendPoint[], key: string, numDays: number): { date: string; label: string; actual: number; predicted: number }[] {
  const values = trend.map((p) => Number(p[key]));
  const n = values.length;
  if (n < 2) return [];

  const xs = Array.from({ length: n }, (_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const result: { date: string; label: string; actual: number; predicted: number }[] = [];
  const lastDate = new Date(`${trend[n - 1].date}T00:00:00`);
  for (let i = 1; i <= numDays; i++) {
    const predicted = Math.max(0, Math.round(slope * (n - 1 + i) + intercept));
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    const dateStr = localDate(d);
    result.push({ date: dateStr, label: formatThaiDate(dateStr), actual: 0, predicted });
  }
  return result;
}
