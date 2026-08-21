import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatDate } from '@/lib/format';
import { Bell, CheckCheck, Package, AlertTriangle, ClipboardCheck, ShoppingCart, DollarSign, AlertOctagon, Bell as BellIcon } from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

const TYPE_ICONS: Record<string, { icon: typeof Package; color: string }> = {
  low_stock: { icon: Package, color: 'text-warning-600 bg-warning-100' },
  out_of_stock: { icon: AlertTriangle, color: 'text-error-600 bg-error-100' },
  overdue_task: { icon: AlertOctagon, color: 'text-error-600 bg-error-100' },
  due_soon: { icon: Clock, color: 'text-warning-600 bg-warning-100' },
  approval_request: { icon: ClipboardCheck, color: 'text-primary-600 bg-primary-100' },
  new_order: { icon: ShoppingCart, color: 'text-success-600 bg-success-100' },
  cash_mismatch: { icon: DollarSign, color: 'text-error-600 bg-error-100' },
  escalate: { icon: AlertOctagon, color: 'text-error-600 bg-error-100' },
  default: { icon: BellIcon, color: 'text-surface-500 bg-surface-100' },
};

import { Clock } from 'lucide-react';

export function NotificationBell({ onNavigate }: { onNavigate: (link: string) => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`profile_id.eq.${profile.id},profile_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(30);
    const notifs = (data ?? []) as Notification[];
    setNotifications(notifs);
    setUnreadCount(notifs.filter((n) => !n.is_read).length);
  }, [profile]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, loadNotifications]);

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
  }

  async function markAllAsRead() {
    if (!profile) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    loadNotifications();
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) {
      onNavigate(n.link);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        className="p-2.5 rounded-xl hover:bg-surface-100 transition-colors relative"
      >
        <Bell className="w-5 h-5 text-surface-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-error-500 rounded-full ring-2 ring-white flex items-center justify-center">
            <span className="text-[10px] font-bold text-white leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-surface-200 z-40 animate-slide-down overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-surface-900">การแจ้งเตือน</h3>
                {unreadCount > 0 && <span className="text-xs text-surface-400">({unreadCount} ใหม่)</span>}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1.5"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> อ่านทั้งหมด
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">ไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const typeKey = n.type ?? 'default';
                  const { icon: Icon, color } = TYPE_ICONS[typeKey] ?? TYPE_ICONS.default;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50 border-b border-surface-100 last:border-0',
                        !n.is_read && 'bg-primary-50/50'
                      )}
                    >
                      <div className={cn('p-2 rounded-lg shrink-0', color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-surface-900 truncate">{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />}
                        </div>
                        {n.body && <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-surface-400 mt-1">{formatDate(n.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
