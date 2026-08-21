import { useState, Component, type ReactNode } from 'react';
import { Calculator, DollarSign, Tag, ShoppingCart, BarChart3, Package, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/format';
import { CalcPricing } from '@/components/calc/CalcPricing';
import { CalcPromo } from '@/components/calc/CalcPromo';
import { CalcMarketplace } from '@/components/calc/CalcMarketplace';
import { CalcBusiness } from '@/components/calc/CalcBusiness';
import { CalcCost } from '@/components/calc/CalcCost';

type Category = 'pricing' | 'promo' | 'marketplace' | 'business' | 'cost';

const CATEGORIES: { key: Category; label: string; icon: any; description: string }[] = [
  { key: 'pricing', label: 'การตั้งราคา', icon: DollarSign, description: 'หาราคาขาย กำไร Margin Markup' },
  { key: 'promo', label: 'โปรโมชั่น & ส่วนลด', icon: Tag, description: 'ส่วนลด Bundle Flash Sale VAT ผ่อน 0%' },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingCart, description: 'Shopee Lazada ค่าธรรมเนียม Commission' },
  { key: 'business', label: 'วิเคราะห์ธุรกิจ', icon: BarChart3, description: 'ROI ROAS CAC Break-even GP Net Profit' },
  { key: 'cost', label: 'ต้นทุนสินค้า', icon: Package, description: 'ต้นทุนเฉลี่ย รวมต้นทุน เปรียบเทียบกำไร' },
];

class CalcBoundary extends Component<{ name: string; children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  handleRetry = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
          <div className="mb-4 p-4 rounded-2xl bg-error-100 text-error-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900">เครื่องคิดเลข "{this.props.name}" มีปัญหา</h3>
          <p className="mt-1.5 text-sm text-surface-500">ไม่สามารถแสดงส่วนนี้ได้ในขณะนี้ ส่วนอื่นยังใช้งานได้ปกติ</p>
          {this.state.error && (
            <p className="mt-2 text-xs text-surface-400 bg-surface-100 rounded-lg px-3 py-2 font-mono break-all">{this.state.error.message}</p>
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

export function CalculatorPage() {
  const [category, setCategory] = useState<Category>('pricing');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">เครื่องคิดเลขออนไลน์</h2>
            <p className="text-sm text-white/80">คำนวณราคาขาย กำไร ส่วนลด ค่าธรรมเนียม และวิเคราะห์ธุรกิจ</p>
          </div>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = category === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={cn(
                'p-4 rounded-2xl text-left transition-all border-2',
                active
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-surface-200 bg-white hover:border-primary-300'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors',
                active ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className={cn('text-sm font-semibold mb-0.5', active ? 'text-primary-700' : 'text-surface-900')}>
                {cat.label}
              </h3>
              <p className="text-[11px] text-surface-400 leading-tight">{cat.description}</p>
            </button>
          );
        })}
      </div>

      {/* Active category content */}
      <div className="animate-fade-in">
        {category === 'pricing' && <CalcBoundary name="การตั้งราคา"><CalcPricing /></CalcBoundary>}
        {category === 'promo' && <CalcBoundary name="โปรโมชั่น & ส่วนลด"><CalcPromo /></CalcBoundary>}
        {category === 'marketplace' && <CalcBoundary name="Marketplace"><CalcMarketplace /></CalcBoundary>}
        {category === 'business' && <CalcBoundary name="วิเคราะห์ธุรกิจ"><CalcBusiness /></CalcBoundary>}
        {category === 'cost' && <CalcBoundary name="ต้นทุนสินค้า"><CalcCost /></CalcBoundary>}
      </div>
    </div>
  );
}
