import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Package, Boxes, Activity, Users, Clock, Wallet, Timer, Calendar, BarChart3, AlertTriangle, UserPlus, Repeat, Megaphone, Tag, FileText, DollarSign, ShoppingCart, Receipt, Calculator, Undo2, Target } from 'lucide-react';
import type { KpiCard, TrendPoint } from './types';
import { formatMoney, formatNumber, formatThaiDate } from './helpers';

// ===== Animated count-up hook =====
function useCountUp(target: number, duration = 800): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (target - from) * eased;
      setDisplay(val);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

const ICON_MAP: Record<string, typeof TrendingUp> = {
  'trending-up': TrendingUp, 'trending-down': TrendingDown, 'package': Package, 'boxes': Boxes,
  'activity': Activity, 'users': Users, 'clock': Clock, 'wallet': Wallet,
  'timer': Timer, 'calendar': Calendar, 'bar-chart': BarChart3, 'alert-triangle': AlertTriangle,
  'user-plus': UserPlus, 'repeat': Repeat, 'megaphone': Megaphone, 'tag': Tag,
  'file-text': FileText, 'dollar-sign': DollarSign, 'shopping-cart': ShoppingCart,
  'receipt': Receipt, 'calculator': Calculator, 'undo-2': Undo2, 'target': Target,
};

function formatValue(value: number, format: KpiCard['format']): string {
  if (format === 'currency') return formatMoney(value);
  if (format === 'percent') return `${value}%`;
  return formatNumber(value);
}

export function KpiCardItem({ kpi }: { kpi: KpiCard }) {
  const Icon = ICON_MAP[kpi.icon] ?? TrendingUp;
  const change = kpi.changePct;
  const sparkData = kpi.sparkline.length > 0 ? kpi.sparkline.map((v, i) => ({ idx: i, value: v })) : [];
  const animatedValue = useCountUp(kpi.value, 900);

  const formatAnimated = (v: number, format: KpiCard['format']): string => {
    if (format === 'currency') return formatMoney(Math.round(v));
    if (format === 'percent') return `${v.toFixed(1)}%`;
    return formatNumber(Math.round(v));
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-surface-100 bg-white p-5 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-surface-200/40 hover:-translate-y-1 hover:border-primary-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-surface-500">{kpi.label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-surface-900 tabular-nums">{formatAnimated(animatedValue, kpi.format)}</p>
          {kpi.subtitle && (
            <p className="mt-0.5 text-xs text-surface-400">{kpi.subtitle}</p>
          )}
          {change !== null && (
            <div className="mt-1.5 flex items-center gap-1 transition-opacity duration-300">
              {change >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-success-600 transition-transform duration-300 group-hover:scale-110" />
              ) : change < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-error-600 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-surface-400" />
              )}
              <span className={`text-xs font-medium transition-colors duration-300 ${change >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                {change >= 0 ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-surface-400">จากช่วงก่อนหน้า</span>
            </div>
          )}
        </div>
        <div className="rounded-xl p-2.5 transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-3" style={{ backgroundColor: `${kpi.color}14`, color: kpi.color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sparkData.length > 1 && (
        <div className="mt-auto h-10 pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.icon}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={kpi.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={kpi.color} strokeWidth={2} fill={`url(#spark-${kpi.icon})`} animationDuration={800} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="animate-slide-up h-full" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}>
          <KpiCardItem kpi={kpi} />
        </div>
      ))}
    </div>
  );
}

// ===== Multi-line chart with toggle + tooltip + crosshair =====
export function MultiLineChart({ data, series, height = 320, yFormatter }: {
  data: TrendPoint[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggleLine = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fmtY = yFormatter ?? ((v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {series.map((s) => {
          const isHidden = hidden.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleLine(s.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isHidden ? 'bg-surface-50 text-surface-400 opacity-50' : 'bg-surface-50 text-surface-700 hover:bg-surface-100'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full transition-opacity" style={{ backgroundColor: s.color, opacity: isHidden ? 0.3 : 1 }} />
              {s.name}
            </button>
          );
        })}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip
              cursor={{ stroke: '#3D7BF5', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="rounded-xl border border-surface-200 bg-white p-3 shadow-lg" style={{ fontSize: 12 }}>
                    <p className="mb-2 font-semibold text-surface-700">{label}</p>
                    {payload.filter((p) => !hidden.has(p.dataKey as string)).map((p) => (
                      <div key={p.dataKey as string} className="flex items-center gap-2 text-surface-600">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{p.name}:</span>
                        <span className="font-semibold text-surface-800">{formatMoney(Number(p.value))}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series.filter((s) => !hidden.has(s.key)).map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ===== Bar chart =====
export function SimpleBarChart({ data, dataKey, name, color, height = 280, xKey = 'label', yFormatter }: {
  data: Record<string, unknown>[];
  dataKey: string; name: string; color: string; height?: number; xKey?: string;
  yFormatter?: (v: number) => string;
}) {
  const fmtY = yFormatter ?? ((v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id={`bar-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf1" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={50} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-surface-200 bg-white p-2.5 shadow-lg" style={{ fontSize: 12 }}>
                  <p className="font-semibold text-surface-700">{label}</p>
                  <p className="text-surface-600">{name}: <span className="font-semibold text-surface-800">{typeof payload[0].value === 'number' && payload[0].value > 1000 ? formatMoney(Number(payload[0].value)) : formatNumber(Number(payload[0].value))}</span></p>
                </div>
              );
            }}
          />
          <Bar dataKey={dataKey} name={name} fill={`url(#bar-${dataKey})`} radius={[5, 5, 0, 0]} animationDuration={800} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Pie chart =====
export function SimplePieChart({ data, height = 280 }: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={Math.min(height / 2 - 20, 100)} innerRadius={Math.min(height / 2 - 20, 100) * 0.55} paddingAngle={2} animationDuration={600}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-surface-200 bg-white p-2.5 shadow-lg" style={{ fontSize: 12 }}>
                  <p className="font-semibold text-surface-700">{payload[0].name}</p>
                  <p className="text-surface-600"><span className="font-semibold text-surface-800">{formatMoney(Number(payload[0].value))}</span></p>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Area chart (single) =====
export function SimpleAreaChart({ data, dataKey, name, color, height = 280, yFormatter }: {
  data: Record<string, unknown>[];
  dataKey: string; name: string; color: string; height?: number;
  yFormatter?: (v: number) => string;
}) {
  const fmtY = yFormatter ?? ((v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={50} />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-surface-200 bg-white p-2.5 shadow-lg" style={{ fontSize: 12 }}>
                  <p className="font-semibold text-surface-700">{label}</p>
                  <p className="text-surface-600">{name}: <span className="font-semibold text-surface-800">{formatMoney(Number(payload[0].value))}</span></p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} fill={`url(#area-${dataKey})`} dot={false} activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }} animationDuration={900} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Progress ring =====
export function ProgressRing({ percent, label, color = '#3D7BF5', size = 120 }: {
  percent: number; label: string; color?: string; size?: number;
}) {
  const data = [{ name: label, value: percent, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} data={data} startAngle={90} endAngle={90 - (percent / 100) * 360}>
            <RadialBar background dataKey="value" cornerRadius={10} animationDuration={700} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-[calc(50%+12px)] flex flex-col items-center" style={{ marginTop: -size / 2 - 4 }}>
        <span className="text-2xl font-bold text-surface-900">{percent}%</span>
        <span className="text-xs text-surface-500">{label}</span>
      </div>
    </div>
  );
}

// ===== Section card =====
export function SectionCard({ title, subtitle, icon, action, children, className = '' }: {
  title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-surface-100 bg-white p-6 transition-all duration-300 ease-out hover:shadow-md hover:shadow-surface-200/30 hover:border-surface-200 animate-slide-up ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-base font-semibold text-surface-900">{title}</h2>
            {subtitle && <p className="text-xs text-surface-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ===== Insight banner =====
export function InsightBanner({ text, color = '#3D7BF5' }: { text: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: `${color}20`, backgroundColor: `${color}08` }}>
      <div className="rounded-lg p-2" style={{ backgroundColor: `${color}14`, color }}>
        <TrendingUp className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-surface-700">{text}</p>
    </div>
  );
}

// ===== Stacked bar chart (revenue vs cost vs profit) =====
export function StackedProfitChart({ data, height = 300 }: {
  data: { label: string; revenue: number; cost: number; profit: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="profit-bar-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3D7BF5" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#3D7BF5" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="profit-bar-cost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="profit-bar-profit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={50} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-surface-200 bg-white p-3 shadow-lg" style={{ fontSize: 12 }}>
                  <p className="mb-2 font-semibold text-surface-700">{label}</p>
                  {payload.map((p) => (
                    <div key={p.dataKey as string} className="flex items-center gap-2 text-surface-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span>{p.name}:</span>
                      <span className="font-semibold text-surface-800">{formatMoney(Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="ยอดขาย" stackId="a" fill="url(#profit-bar-revenue)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="cost" name="ต้นทุน" stackId="a" fill="url(#profit-bar-cost)" radius={[0, 0, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          <Bar dataKey="profit" name="กำไร" stackId="a" fill="url(#profit-bar-profit)" radius={[5, 5, 0, 0]} animationDuration={800} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Empty state =====
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-surface-50 p-4">
        <Minus className="h-8 w-8 text-surface-300" />
      </div>
      <p className="mt-3 text-sm text-surface-400">{message}</p>
    </div>
  );
}
