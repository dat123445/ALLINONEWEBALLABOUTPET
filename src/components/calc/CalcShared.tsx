import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/format';

export const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const STORAGE_PREFIX = 'calc-draft:';

export function usePersistentState(key: string, initial: string) {
  const storageKey = STORAGE_PREFIX + key;
  const [value, setValue] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // ignore quota / privacy mode errors
    }
  }, [storageKey, value]);

  const reset = useCallback(() => {
    setValue(initial);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey, initial]);

  return [value, setValue, reset] as const;
}

export function CalcInput({
  label, value, onChange, placeholder, unit, min,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; unit?: string; min?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-surface-700 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="input-base w-full pr-10"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">{unit}</span>
        )}
      </div>
    </div>
  );
}

export function ResultRow({
  label, value, sub, highlight,
}: {
  label: string; value: string; sub?: string; highlight?: 'primary' | 'success' | 'error' | 'warning';
}) {
  const colors = {
    primary: 'bg-primary-100',
    success: 'bg-success-100',
    error: 'bg-error-100',
    warning: 'bg-warning-100',
  };
  const textColors = {
    primary: 'text-primary-700',
    success: 'text-success-700',
    error: 'text-error-700',
    warning: 'text-warning-700',
  };
  return (
    <div className={cn('p-3 rounded-xl', highlight ? colors[highlight] : 'bg-surface-50')}>
      <p className="text-xs text-surface-500">{label}</p>
      <p className={cn('text-lg font-bold', highlight ? textColors[highlight] : 'text-surface-900')}>{value}</p>
      {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StepBox({
  step, color, title, children,
}: {
  step: number; color: string; title: string; children: React.ReactNode;
}) {
  const colors: Record<string, { bg: string; badge: string }> = {
    primary: { bg: 'bg-primary-50', badge: 'bg-primary-600' },
    amber: { bg: 'bg-amber-50', badge: 'bg-amber-500' },
    surface: { bg: 'bg-surface-50', badge: 'bg-surface-500' },
    success: { bg: 'bg-success-50', badge: 'bg-success-600' },
    error: { bg: 'bg-error-50', badge: 'bg-error-600' },
  };
  const c = colors[color] ?? colors.primary;
  return (
    <div className={cn('p-4 rounded-xl', c.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0', c.badge)}>{step}</span>
        <p className="text-sm font-semibold text-surface-900">{title}</p>
      </div>
      <div className="ml-8 space-y-1 text-sm text-surface-600">{children}</div>
    </div>
  );
}

export function CalcLayout({
  title, description, steps, result,
}: {
  title: string; description: string; steps: React.ReactNode; result: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-surface-900 mb-1">{title}</h3>
          <p className="text-sm text-surface-500">{description}</p>
        </div>
        {steps}
      </div>
      <div className="lg:sticky lg:top-4 self-start">
        <div className="p-5 rounded-2xl border-2 border-primary-200 bg-white space-y-3">
          <p className="text-xs font-semibold text-primary-600">ลองคำนวณเล่นได้เลย</p>
          {result}
        </div>
      </div>
    </div>
  );
}
