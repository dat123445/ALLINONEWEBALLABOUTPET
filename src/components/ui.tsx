import { type ReactNode, type ButtonHTMLAttributes, useState, useMemo, Component } from 'react';
import { cn, formatNumber } from '@/lib/format';
import { X, AlertCircle, RefreshCw } from 'lucide-react';

// ============ Card ============
export function Card({ children, className, hover, style, draggable, onDragStart, onClick }: { children: ReactNode; className?: string; hover?: boolean; style?: React.CSSProperties; draggable?: boolean; onDragStart?: React.DragEventHandler; onClick?: React.MouseEventHandler }) {
  return <div className={cn('card', hover && 'card-hover', className)} style={style} draggable={draggable} onDragStart={onDragStart} onClick={onClick}>{children}</div>;
}

// ============ Button ============
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  const base = {
    sm: 'px-3.5 py-2 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-error-600 text-white font-medium text-sm transition-all duration-200 hover:bg-error-700 active:scale-[0.98] disabled:opacity-50',
  };
  return (
    <button
      className={cn(variants[variant], base[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ============ Badge ============
export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'; className?: string }) {
  const variants = {
    default: 'bg-surface-100 text-surface-600',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    info: 'bg-primary-100 text-primary-700',
    primary: 'bg-primary-600 text-white',
  };
  return <span className={cn('badge', variants[variant], className)}>{children}</span>;
}

// ============ Input ============
export function Input({ label, error, className, ...props }: { label?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-700">{label}</label>}
      <input className={cn('input-base', error && 'border-error-500 focus:ring-error-500/30 focus:border-error-500', className)} {...props} />
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

// ============ Textarea ============
export function Textarea({ label, error, className, ...props }: { label?: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-700">{label}</label>}
      <textarea className={cn('input-base resize-none', className)} {...props} />
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

// ============ Select ============
export function Select({ label, error, children, className, ...props }: { label?: string; error?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-700">{label}</label>}
      <select className={cn('input-base cursor-pointer', className)} {...props}>{children}</select>
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

// ============ Modal ============
export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-surface-950/50" onClick={onClose} />
      <div className={cn('relative w-full bg-white rounded-2xl shadow-2xl border border-surface-200 max-h-[calc(100vh-8rem)] overflow-y-auto', sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 sticky top-0 bg-white z-10 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
              <X className="w-5 h-5 text-surface-500" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ============ Stat Card ============
export function StatCard({ label, value, icon, trend, color = 'primary', delay }: { label: string; value: string | number; icon?: ReactNode; trend?: { value: string; up: boolean }; color?: 'primary' | 'success' | 'warning' | 'error' | 'accent'; delay?: string }) {
  const colors = {
    primary: 'from-primary-500/10 to-primary-500/5 text-primary-600',
    success: 'from-success-500/10 to-success-500/5 text-success-600',
    warning: 'from-warning-500/10 to-warning-500/5 text-warning-600',
    error: 'from-error-500/10 to-error-500/5 text-error-600',
    accent: 'from-accent-500/10 to-accent-500/5 text-accent-600',
  };
  return (
    <Card hover className={cn('p-5 animate-slide-up', delay)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-surface-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-surface-900">{value}</p>
          {trend && (
            <p className={cn('text-xs font-medium', trend.up ? 'text-success-600' : 'text-error-600')}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('p-3 rounded-xl bg-gradient-to-br', colors[color])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============ Empty State ============
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 p-4 rounded-2xl bg-surface-100 text-surface-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-surface-700">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-surface-500 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ============ Spinner ============
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <span className={cn(sizes[size], 'border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin')} />;
}

// ============ Loading Screen ============
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-50">
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="All About Pet"
          className="w-12 h-12 object-contain rounded-xl bg-white"
        />
        <span className="text-xl font-bold text-surface-900">All About Pet</span>
      </div>
      <Spinner size="md" />
    </div>
  );
}

// ============ Tabs ============
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-100 rounded-xl overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
            active === tab.key
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className={cn('ml-2 px-1.5 py-0.5 rounded-md text-xs', active === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-surface-200 text-surface-500')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============ Progress Bar ============
export function ProgressBar({ value, max, color = 'primary', label }: { value: number; max: number; color?: 'primary' | 'success' | 'warning' | 'error'; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colors = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-surface-500">
          <span>{label}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500 ease-out', colors[color])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ============ Pagination ============
export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const [jumpInput, setJumpInput] = useState('');

  const pageButtons = useMemo(() => {
    const buttons: (number | '...')[] = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (page > 3) buttons.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) buttons.push(i);
      if (page < totalPages - 2) buttons.push('...');
      buttons.push(totalPages);
    }
    return buttons;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-surface-50 rounded-xl">
      <div className="flex items-center gap-3 text-sm text-surface-500">
        <span>แสดง {start}-{end} จาก {formatNumber(totalItems)} รายการ</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="input-base !w-auto !py-1 text-sm cursor-pointer"
        >
          <option value={10}>10 / หน้า</option>
          <option value={25}>25 / หน้า</option>
          <option value={50}>50 / หน้า</option>
          <option value={100}>100 / หน้า</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        {pageButtons.map((btn, i) =>
          btn === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-surface-400 text-sm">…</span>
          ) : (
            <button
              key={btn}
              onClick={() => onPageChange(btn)}
              className={cn(
                'min-w-[32px] px-2 py-1.5 rounded-lg text-sm font-medium transition-colors',
                btn === page
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              {btn}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-surface-400">ไปหน้า</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const p = Number(jumpInput);
                if (p >= 1 && p <= totalPages) onPageChange(p);
                setJumpInput('');
              }
            }}
            className="input-base !w-16 !py-1 text-sm text-center"
            placeholder="..."
          />
        </div>
      </div>
    </div>
  );
}

// ============ Confirm Dialog ============
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'ยืนยัน', confirmVariant = 'danger', loading, confirmDisabled }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  confirmDisabled?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-surface-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-surface-200">
        <div className="px-6 py-4 border-b border-surface-200">
          <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-surface-600 space-y-3">
          {children}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-surface-200">
          <Button variant="ghost" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} disabled={confirmDisabled} className="flex-1">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ============ Avatar ============
export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (src) return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size])} />;
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold', sizes[size])}>
      {initials || '?'}
    </div>
  );
}

// ============ Help Tooltip ============
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
      <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help transition-colors', open ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-500 hover:bg-primary-100 hover:text-primary-600')}>?</span>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 rounded-xl bg-surface-900 text-white text-xs font-normal leading-relaxed shadow-xl z-50 animate-fade-in pointer-events-none">
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-surface-900 rotate-45 -mt-1" />
        </span>
      )}
    </span>
  );
}

// ============ Error Boundary ============
type ErrorBoundaryState = { hasError: boolean; error: Error | null };
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  handleRetry = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <div className="mb-4 p-4 rounded-2xl bg-error-100 text-error-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900">เกิดข้อผิดพลาด</h3>
          <p className="mt-1.5 text-sm text-surface-500">
            หน้านี้ไม่สามารถแสดงผลได้ในขณะนี้
          </p>
          {this.state.error && (
            <p className="mt-2 text-xs text-surface-400 bg-surface-100 rounded-lg px-3 py-2 font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <button onClick={this.handleRetry} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> ลองอีกครั้ง
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
