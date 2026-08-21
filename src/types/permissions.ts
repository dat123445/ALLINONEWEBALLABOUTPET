export type Role =
  | 'owner'
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'stock'
  | 'purchasing'
  | 'online'
  | 'marketing'
  | 'cs'
  | 'finance'
  | 'employee';

export type ModuleKey =
  | 'dashboard'
  | 'myday'
  | 'attendance'
  | 'salary'
  | 'sales'
  | 'stock'
  | 'purchasing'
  | 'online'
  | 'marketing'
  | 'cs'
  | 'users'
  | 'branches'
  | 'backup'
  | 'clearstock'
  | 'datatables'
  | 'settings'
  | 'calculator';

export type PermissionLevel = 'full' | 'view' | 'none';

export type ModulePermission = {
  module: ModuleKey;
  level: PermissionLevel;
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'เจ้าของกิจการ',
  super_admin: 'ผู้ดูแลระบบ',
  admin: 'แอดมิน',
  manager: 'ผู้จัดการสาขา',
  stock: 'ฝ่ายสต๊อก',
  purchasing: 'ฝ่ายจัดซื้อ',
  online: 'ทีมออนไลน์',
  marketing: 'การตลาด',
  cs: 'ฝ่ายบริการลูกค้า',
  finance: 'ฝ่ายการเงิน',
  employee: 'พนักงาน',
};

export const ROLE_PERMISSIONS: Record<Role, Record<ModuleKey, PermissionLevel>> = {
  owner: {
    dashboard: 'full', myday: 'full', attendance: 'full', salary: 'full', sales: 'full',
    stock: 'full', purchasing: 'full', online: 'full', marketing: 'full', cs: 'full', users: 'full',
    branches: 'full', backup: 'full', clearstock: 'full', datatables: 'full',
    settings: 'full', calculator: 'full',
  },
  super_admin: {
    dashboard: 'full', myday: 'full', attendance: 'full', salary: 'none', sales: 'full',
    stock: 'full', purchasing: 'full', online: 'full', marketing: 'full', cs: 'full', users: 'full',
    branches: 'full', backup: 'full', clearstock: 'full', datatables: 'full',
    settings: 'full', calculator: 'full',
  },
  admin: {
    dashboard: 'full', myday: 'full', attendance: 'full', salary: 'full', sales: 'full',
    stock: 'full', purchasing: 'full', online: 'full', marketing: 'full', cs: 'full', users: 'full',
    branches: 'full', backup: 'full', clearstock: 'full', datatables: 'full',
    settings: 'full', calculator: 'full',
  },
  manager: {
    dashboard: 'full', myday: 'full', attendance: 'full', salary: 'view', sales: 'full',
    stock: 'full', purchasing: 'view', online: 'view', marketing: 'view', cs: 'view', users: 'none',
    branches: 'view', backup: 'view', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  stock: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'none', sales: 'none',
    stock: 'full', purchasing: 'none', online: 'none', marketing: 'none', cs: 'none', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  purchasing: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'none', sales: 'none',
    stock: 'view', purchasing: 'full', online: 'none', marketing: 'none', cs: 'none', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  online: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'none', sales: 'none',
    stock: 'view', purchasing: 'none', online: 'full', marketing: 'none', cs: 'none', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  marketing: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'none', sales: 'none',
    stock: 'none', purchasing: 'none', online: 'view', marketing: 'full', cs: 'none', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  cs: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'none', sales: 'none',
    stock: 'none', purchasing: 'none', online: 'none', marketing: 'none', cs: 'full', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
  finance: {
    dashboard: 'full', myday: 'full', attendance: 'full', salary: 'full', sales: 'full',
    stock: 'view', purchasing: 'view', online: 'view', marketing: 'view', cs: 'view', users: 'view',
    branches: 'view', backup: 'full', clearstock: 'none', datatables: 'full',
    settings: 'view', calculator: 'full',
  },
  employee: {
    dashboard: 'view', myday: 'full', attendance: 'full', salary: 'full', sales: 'none',
    stock: 'none', purchasing: 'none', online: 'none', marketing: 'none', cs: 'none', users: 'none',
    branches: 'none', backup: 'none', clearstock: 'none', datatables: 'full',
    settings: 'none', calculator: 'full',
  },
};

export function getModulePermission(roles: Role[], module: ModuleKey): PermissionLevel {
  let max: PermissionLevel = 'none';
  for (const role of roles) {
    const level = ROLE_PERMISSIONS[role]?.[module] ?? 'none';
    if (level === 'full') return 'full';
    if (level === 'view' && max === 'none') max = 'view';
  }
  return max;
}

export function hasModuleAccess(roles: Role[], module: ModuleKey): boolean {
  return getModulePermission(roles, module) !== 'none';
}

export function hasFullAccess(roles: Role[], module: ModuleKey): boolean {
  return getModulePermission(roles, module) === 'full';
}

export function isAdmin(roles: Role[]): boolean {
  return roles.some((r) => r === 'owner' || r === 'super_admin' || r === 'admin');
}

export function canManageSalary(roles: Role[]): boolean {
  return roles.some((r) => r === 'owner' || r === 'admin');
}
