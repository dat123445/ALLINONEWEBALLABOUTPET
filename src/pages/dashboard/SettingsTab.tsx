import { Settings, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/format';

export type DashboardSettings = {
  visibleCards: Record<string, boolean>;
  defaultTab: string;
  showForecast: boolean;
  showRanking: boolean;
  showGauges: boolean;
};

const DEFAULT_SETTINGS: DashboardSettings = {
  visibleCards: {
    sales: true,
    bills: true,
    users: true,
    products: true,
    ranking: true,
    gauges: true,
    lowStock: true,
    forecast: true,
  },
  defaultTab: 'overview',
  showForecast: true,
  showRanking: true,
  showGauges: true,
};

const CARD_OPTIONS: { key: string; label: string }[] = [
  { key: 'sales', label: 'ยอดขายรวม' },
  { key: 'bills', label: 'จำนวนบิล' },
  { key: 'users', label: 'ผู้ใช้งาน' },
  { key: 'products', label: 'สินค้าใช้งาน' },
  { key: 'ranking', label: 'อันดับยอดขาย' },
  { key: 'gauges', label: 'ภาพรวมเป้าหมาย' },
  { key: 'lowStock', label: 'สินค้าใกล้หมด' },
  { key: 'forecast', label: 'แนวโน้ม + พยากรณ์' },
];

const TAB_OPTIONS: { key: string; label: string }[] = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'sales', label: 'ยอดขาย' },
  { key: 'stock', label: 'สต๊อก' },
  { key: 'workforce', label: 'พนักงาน' },
  { key: 'customers', label: 'ลูกค้า' },
  { key: 'marketing', label: 'การตลาด' },
  { key: 'finance', label: 'การเงิน' },
];

const STORAGE_KEY = 'dashboard-settings';

export function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed, visibleCards: { ...DEFAULT_SETTINGS.visibleCards, ...parsed.visibleCards } };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: DashboardSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function SettingsTab({ settings, onChange }: { settings: DashboardSettings; onChange: (s: DashboardSettings) => void }) {
  function toggleCard(key: string) {
    const next = { ...settings, visibleCards: { ...settings.visibleCards, [key]: !settings.visibleCards[key] } };
    onChange(next);
    saveSettings(next);
  }

  function setDefaultTab(key: string) {
    const next = { ...settings, defaultTab: key };
    onChange(next);
    saveSettings(next);
  }

  function toggleFlag(key: 'showForecast' | 'showRanking' | 'showGauges') {
    const next = { ...settings, [key]: !settings[key] };
    onChange(next);
    saveSettings(next);
  }

  function reset() {
    onChange(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-500" />
            <div>
              <h2 className="font-semibold text-surface-900">ปรับแต่งแดชบอร์ด</h2>
              <p className="text-xs text-surface-400">เลือกการ์ดและส่วนที่ต้องการแสดง การตั้งค่าจะบันทึกอัตโนมัติ</p>
            </div>
          </div>
          <button onClick={reset} className="flex items-center gap-2 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-200">
            <RotateCcw className="h-4 w-4" /> คืนค่าเริ่มต้น
          </button>
        </div>

        <div className="mb-6">
          <p className="mb-3 text-sm font-medium text-surface-700">แท็บเริ่มต้นเมื่อเปิดแดชบอร์ด</p>
          <div className="flex flex-wrap gap-2">
            {TAB_OPTIONS.map((tab) => (
              <button key={tab.key} onClick={() => setDefaultTab(tab.key)} className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-all', settings.defaultTab === tab.key ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200')}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-surface-700">การ์ดสรุปยอด</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CARD_OPTIONS.map((card) => {
              const active = settings.visibleCards[card.key] !== false;
              return (
                <button key={card.key} onClick={() => toggleCard(card.key)} className={cn('flex items-center justify-between rounded-xl border p-3 text-sm font-medium transition-all', active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-surface-200 bg-surface-50 text-surface-400')}>
                  <span>{card.label}</span>
                  {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 font-semibold text-surface-900">ตัวเลือกการแสดงผล</h2>
        <p className="mb-4 text-xs text-surface-400">เปิด/ปิดส่วนเสริมในแท็บภาพรวมธุรกิจ</p>
        <div className="space-y-3">
          {[
            { key: 'showRanking' as const, label: 'แสดงอันดับยอดขายสาขา' },
            { key: 'showGauges' as const, label: 'แสดงเกจวัดเป้าหมายและมูลค่าสต๊อก' },
            { key: 'showForecast' as const, label: 'แสดงเส้นพยากรณ์ในกราฟแนวโน้ม' },
          ].map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center justify-between rounded-xl bg-surface-50 p-4 transition-colors hover:bg-surface-100">
              <span className="text-sm font-medium text-surface-700">{item.label}</span>
              <button type="button" onClick={() => toggleFlag(item.key)} className={cn('relative h-6 w-11 rounded-full transition-colors', settings[item.key] ? 'bg-primary-600' : 'bg-surface-300')}>
                <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', settings[item.key] ? 'left-6' : 'left-1')} />
              </button>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
