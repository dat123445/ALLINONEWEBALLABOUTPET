import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function DrillDownModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-3xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[85vh] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-2xl animate-slide-up`}>
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            {subtitle && <p className="text-sm text-surface-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-50 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(85vh-64px)] overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
