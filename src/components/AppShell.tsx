import { useState, useRef, type ReactNode, useEffect } from 'react';
import { LogOut, Menu, X, ChevronDown, User, Building2, LayoutDashboard, Wallet, Package, Globe, Users, Settings as SettingsIcon, Sparkles, MessageSquare, Download, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@/config/modules';
import { getModulePermission, hasModuleAccess, ROLE_LABELS, type Role } from '@/types/permissions';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/format';
import { MyProfileModal } from '@/components/MyProfileModal';
import { NotificationBell } from '@/components/NotificationBell';
import { supabase } from '@/lib/supabase';

type NavCategory = { id: string; label: string; icon: LucideIcon; moduleKeys: string[] };

const NAV_CATEGORIES: NavCategory[] = [
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard, moduleKeys: ['dashboard', 'myday'] },
  { id: 'finance', label: 'การเงิน', icon: Wallet, moduleKeys: ['salary', 'sales'] },
  { id: 'stock', label: 'สินค้าและสต๊อก', icon: Package, moduleKeys: ['stock', 'purchasing'] },
  { id: 'channels', label: 'ช่องทางขาย', icon: Globe, moduleKeys: ['online', 'marketing', 'cs'] },
  { id: 'team', label: 'ลูกค้าและทีม', icon: Users, moduleKeys: ['attendance', 'cs', 'users', 'branches'] },
  { id: 'tools', label: 'เครื่องมือ', icon: SettingsIcon, moduleKeys: ['datatables', 'calculator', 'settings'] },
];

export function AppShell({ activeModule, onModuleChange, children }: { activeModule: string; onModuleChange: (key: string) => void; children: ReactNode }) {
  const { profile, signOut, setActiveBranch } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; short_code: string | null }[]>([]);

  function openCategoryFlyout(id: string) {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setHoveredCategory(id);
  }

  function scheduleCloseCategoryFlyout() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHoveredCategory(null), 150);
  }

  const roles = (profile?.roles ?? []) as Role[];
  const visibleModules = MODULES.filter((m) => Boolean(m.key && m.label && m.icon) && hasModuleAccess(roles, m.key));
  const activeConfig = MODULES.find((m) => m.key === activeModule);
  const activeBranch = branches.find((b) => b.id === profile?.active_branch_id);

  const visibleCategories = NAV_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.moduleKeys
      .map((key) => MODULES.find((m) => m.key === key))
      .filter((m): m is NonNullable<typeof m> => Boolean(m) && hasModuleAccess(roles, m.key)),
  })).filter((cat) => cat.items.length > 0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('branches').select('id, name, short_code').eq('is_active', true).order('name');
      if (data) setBranches(data as any);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-surface-950/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Mobile sidebar — full menu with hamburger */}
      <aside className={cn(
        'fixed lg:hidden top-0 left-0 z-40 h-screen w-72 bg-white border-r border-surface-200 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-200 shrink-0">
          <img src="/logo.png" alt="All About Pet" className="w-10 h-10 object-contain shrink-0 rounded-lg bg-white" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-surface-900 leading-tight block">All About Pet</span>
            <p className="text-[10px] text-surface-400">Management System</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-100 shrink-0">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 scrollbar-hide">
          <p className="px-3.5 py-2 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">เมนูหลัก</p>
          {visibleModules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.key;
            const level = getModulePermission(roles, module.key);
            return (
              <button
                key={module.key}
                onClick={() => { onModuleChange(module.key); setSidebarOpen(false); }}
                className={cn('nav-item w-full text-left', isActive && 'nav-item-active')}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1">{module.label}</span>
                {level === 'view' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-200 text-surface-500">ดู</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-surface-200 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50">
            <Avatar name={profile?.display_name ?? profile?.email ?? 'User'} src={profile?.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">{profile?.display_name ?? 'User'}</p>
              <p className="text-xs text-surface-400 truncate">{roles.map((r) => ROLE_LABELS[r]).join(', ')}</p>
            </div>
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-surface-200 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4 text-surface-500" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop left rail — icon-only with flyout */}
      <aside className="hidden lg:flex sticky top-0 z-30 h-screen w-[60px] bg-white border-r border-surface-200 flex-col shrink-0">
        <div className="flex items-center justify-center h-16 border-b border-surface-200 shrink-0">
          <img src="/logo.png" alt="All About Pet" className="w-8 h-8 object-contain rounded-lg bg-white" />
        </div>
        <nav className="flex-1 py-3 flex flex-col items-center gap-1.5">
          {visibleCategories.map((cat) => {
            const isCatActive = cat.items.some((m) => m.key === activeModule);
            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => openCategoryFlyout(cat.id)}
                onMouseLeave={scheduleCloseCategoryFlyout}
              >
                <button
                  onClick={() => { const first = cat.items[0]; if (first) onModuleChange(first.key); }}
                  title={cat.label}
                  className={cn('rail-icon', isCatActive && 'rail-icon-active')}
                >
                  <cat.icon className="w-5 h-5" />
                </button>
                {hoveredCategory === cat.id && (
                  <div className="absolute left-full top-0 pl-2 w-56 z-50 animate-flyout-in">
                  <div className="bg-white rounded-xl shadow-xl border border-surface-200 py-2">
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">{cat.label}</p>
                    {cat.items.map((m) => {
                      const Icon = m.icon;
                      const isActive = activeModule === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => onModuleChange(m.key)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                            isActive
                              ? 'text-primary-600 bg-primary-50 font-medium'
                              : 'text-surface-700 hover:bg-surface-100'
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 glass border-b border-surface-200 flex items-center gap-4 px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-surface-100">
            <Menu className="w-5 h-5 text-surface-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-surface-900 truncate">{activeConfig?.label}</h1>
            <p className="text-xs text-surface-400 truncate hidden sm:block">{activeConfig?.description}</p>
          </div>
          {branches.length > 0 && (
            <div className="relative">
              <button onClick={() => setBranchMenuOpen(!branchMenuOpen)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors text-sm">
                <Building2 className="w-4 h-4 text-primary-500" />
                <span className="font-medium text-surface-700 hidden sm:block">{activeBranch?.name ?? 'ทุกสาขา'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
              </button>
              {branchMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBranchMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 py-2 z-40 animate-slide-down">
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">เลือกสาขา</p>
                    <button onClick={() => { setActiveBranch(null); setBranchMenuOpen(false); }} className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-100 transition-colors', !profile?.active_branch_id && 'text-primary-600 font-medium')}>
                      <Building2 className="w-4 h-4" /> ทุกสาขา
                    </button>
                    {branches.map((b) => (
                      <button key={b.id} onClick={() => { setActiveBranch(b.id); setBranchMenuOpen(false); }} className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-100 transition-colors', profile?.active_branch_id === b.id && 'text-primary-600 font-medium')}>
                        <Building2 className="w-4 h-4" /> {b.name}
                        {b.short_code && <span className="text-xs text-surface-400 ml-auto">{b.short_code}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="lg:hidden"><NotificationBell onNavigate={(link) => onModuleChange(link)} /></div>
          <div className="relative lg:hidden">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-surface-100 transition-colors">
              <Avatar name={profile?.display_name ?? 'User'} src={profile?.avatar_url} size="sm" />
              <ChevronDown className="w-4 h-4 text-surface-400" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 py-2 z-40 animate-slide-down">
                  <div className="px-4 py-2 border-b border-surface-200">
                    <p className="text-sm font-medium text-surface-900 truncate">{profile?.display_name ?? 'User'}</p>
                    <p className="text-xs text-surface-400 truncate">{profile?.email}</p>
                  </div>
                  <button onClick={() => { setShowProfile(true); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-100 transition-colors">
                    <User className="w-4 h-4" /> โปรไฟล์ของฉัน
                  </button>
                  <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors">
                    <LogOut className="w-4 h-4" /> ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8" style={{ overflowX: 'clip' }}>
          <div className="animate-fade-in max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Desktop right rail */}
      <aside className="hidden lg:flex sticky top-0 z-30 h-screen w-[60px] bg-white border-l border-surface-200 flex-col shrink-0">
        <div className="flex flex-col items-center gap-1.5 py-3 flex-1">
          <button title="ผู้ช่วย" className="rail-icon"><Sparkles className="w-5 h-5" /></button>
          <NotificationBell onNavigate={(link) => onModuleChange(link)} />
          <button title="แชท" className="rail-icon"><MessageSquare className="w-5 h-5" /></button>
          <button title="ดาวน์โหลด" onClick={() => onModuleChange('settings')} className="rail-icon"><Download className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col items-center gap-1.5 py-3 border-t border-surface-200">
          <button title="โปรไฟล์" onClick={() => setShowProfile(true)} className="rail-icon"><User className="w-5 h-5" /></button>
          <button title="ออกจากระบบ" onClick={signOut} className="flex items-center justify-center w-10 h-10 rounded-xl text-surface-500 hover:bg-error-50 hover:text-error-600 transition-all duration-200">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      <MyProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
