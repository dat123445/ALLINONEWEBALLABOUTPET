import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthScreen, PendingApprovalScreen } from '@/components/AuthScreen';
import { AppShell } from '@/components/AppShell';
import { LoadingScreen, ErrorBoundary } from '@/components/ui';
import { hasModuleAccess, getModulePermission, type ModuleKey } from '@/types/permissions';
import { DashboardPage } from '@/pages/DashboardPage';
import { MyDayPage } from '@/pages/MyDayPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { SalaryPage } from '@/pages/SalaryPage';
import { SalesPage } from '@/pages/SalesPage';
import { StockPage } from '@/pages/StockPage';
import { PurchasingPage } from '@/pages/PurchasingPage';
import { OnlinePage } from '@/pages/OnlinePage';
import { MarketingPage } from '@/pages/MarketingPage';
import { CSPage } from '@/pages/CSPage';
import { UsersPage } from '@/pages/UsersPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { DataTablesPage } from '@/pages/DataTablesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CalculatorPage } from '@/pages/CalculatorPage';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');

  const roles = (profile?.roles ?? []) as any;
  const hasRoles = roles.length > 0;

  // Auto-redirect to first accessible module. Only depends on the roles
  // string and activeModule — NOT the profile object reference — so that a
  // token-refresh-induced profile refetch (which creates a new object but
  // identical roles) does not re-trigger this effect and potentially change
  // activeModule, which would remount the page via the ErrorBoundary key.
  const rolesKey = JSON.stringify(roles);
  useEffect(() => {
    if (!rolesKey || rolesKey === '[]') return;
    const r = JSON.parse(rolesKey) as any;
    if (!hasModuleAccess(r, activeModule)) {
      const firstAccessible: ModuleKey[] = ['dashboard', 'myday', 'attendance', 'salary', 'sales', 'stock', 'purchasing', 'online', 'marketing', 'cs', 'users', 'branches', 'datatables', 'calculator', 'settings'];
      const found = firstAccessible.find((m) => hasModuleAccess(r, m));
      if (found) setActiveModule(found);
    }
  }, [rolesKey, activeModule]);

  if (loading) return <LoadingScreen />;
  if (!session || !profile) return <AuthScreen />;

  // User is logged in but has no roles → pending approval
  if (!hasRoles) return <PendingApprovalScreen />;

  const permission = getModulePermission(roles, activeModule);

  const renderModule = () => {
    if (permission === 'none') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-surface-700">คุณไม่มีสิทธิ์เข้าถึงโมดูลนี้</p>
          <p className="text-sm text-surface-400 mt-2">ติดต่อผู้ดูแลระบบหากต้องการเข้าถึง</p>
        </div>
      );
    }
    switch (activeModule) {
      case 'dashboard': return <DashboardPage />;
      case 'myday': return <MyDayPage />;
      case 'attendance': return <AttendancePage />;
      case 'salary': return <SalaryPage />;
      case 'sales': return <SalesPage />;
      case 'stock': return <StockPage />;
      case 'purchasing': return <PurchasingPage />;
      case 'online': return <OnlinePage />;
      case 'marketing': return <MarketingPage />;
      case 'cs': return <CSPage />;
      case 'users': return <UsersPage />;
      case 'branches': return <BranchesPage />;
      case 'datatables': return <DataTablesPage />;
      case 'calculator': return <CalculatorPage />;
      case 'settings': return <SettingsPage onNavigate={(key) => setActiveModule(key as ModuleKey)} />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AppShell activeModule={activeModule} onModuleChange={(key) => setActiveModule(key as ModuleKey)}>
      <ErrorBoundary key={activeModule}>
        {renderModule()}
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
