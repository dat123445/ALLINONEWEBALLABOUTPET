import { LayoutDashboard, CheckSquare, Clock, ShoppingCart, Package, Truck, Globe, Megaphone, Headphones, Users, Building2, Wallet, Table2, Settings as SettingsIcon, Calculator, type LucideIcon } from 'lucide-react';
import type { ModuleKey } from '@/types/permissions';

export type ModuleConfig = {
  key: ModuleKey;
  label: string;
  labelEn: string;
  icon: LucideIcon;
  description: string;
};

export const MODULES: ModuleConfig[] = [
  { key: 'dashboard', label: 'แดชบอร์ด', labelEn: 'Dashboard', icon: LayoutDashboard, description: 'ภาพรวมธุรกิจและ KPI' },
  { key: 'myday', label: 'งานของฉัน', labelEn: 'My Day', icon: CheckSquare, description: 'งานที่ได้รับมอบหมาย' },
  { key: 'attendance', label: 'เวลาทำงาน', labelEn: 'Attendance', icon: Clock, description: 'เช็คอิน ตารางกะ ลา' },
  { key: 'salary', label: 'เงินเดือน', labelEn: 'Salary', icon: Wallet, description: 'คำนวณเงินเดือน เบิกล่วงหน้า เงินกู้' },
  { key: 'sales', label: 'ยอดขาย', labelEn: 'Sales', icon: ShoppingCart, description: 'บันทึกและปิดยอดขาย' },
  { key: 'stock', label: 'สต๊อกสินค้า', labelEn: 'Stock', icon: Package, description: 'รับ เบิก โอน ตรวจนับ' },
  { key: 'purchasing', label: 'จัดซื้อ', labelEn: 'Purchasing', icon: Truck, description: 'ขอซื้อ อนุมัติ PO' },
  { key: 'online', label: 'ออนไลน์', labelEn: 'Online', icon: Globe, description: 'TikTok Shopee Lazada LINE' },
  { key: 'marketing', label: 'การตลาด', labelEn: 'Marketing', icon: Megaphone, description: 'โปรโมชั่น แคมเปญ ROI' },
  { key: 'cs', label: 'บริการลูกค้า', labelEn: 'Customer Service', icon: Headphones, description: 'คืนสินค้า เคลม รีวิว' },
  { key: 'users', label: 'จัดการผู้ใช้', labelEn: 'User Management', icon: Users, description: 'สร้างและจัดการบัญชีผู้ใช้' },
  { key: 'branches', label: 'จัดการสาขา', labelEn: 'Branches', icon: Building2, description: 'เพิ่ม แก้ไข สลับสาขา' },
  { key: 'datatables', label: 'ตารางข้อมูล', labelEn: 'Data Tables', icon: Table2, description: 'สร้างและแก้ไขตารางข้อมูลร่วมกัน' },
  { key: 'calculator', label: 'เครื่องคิดเลข', labelEn: 'Calculator', icon: Calculator, description: 'คำนวณราคาขาย มาร์จิ้น ค่าธรรมเนียม' },
  { key: 'settings', label: 'ตั้งค่าระบบ', labelEn: 'System Settings', icon: SettingsIcon, description: 'ตั้งค่าแพลตฟอร์ม ส่งออกข้อมูล สำรองข้อมูล ล้างสต๊อก' },
];
