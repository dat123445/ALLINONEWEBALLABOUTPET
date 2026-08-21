import { useState } from 'react';
import { TrendingUp, BarChart3, Target, DollarSign, PieChart, Scale } from 'lucide-react';
import { CalcInput, ResultRow, StepBox, CalcLayout, fmt, usePersistentState } from './CalcShared';
import { cn } from '@/lib/format';

export function CalcBusiness() {
  const [mode, setMode] = useState('roi');
  const modes = [
    { key: 'roi', label: 'ROI', icon: TrendingUp },
    { key: 'roas', label: 'ROAS', icon: BarChart3 },
    { key: 'cac', label: 'CAC', icon: Target },
    { key: 'gp', label: 'Gross Profit', icon: DollarSign },
    { key: 'net-profit', label: 'Net Profit', icon: PieChart },
    { key: 'break-even', label: 'Break Even', icon: Scale },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              mode === m.key ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200')}>
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>
      {mode === 'roi' && <ROI />}
      {mode === 'roas' && <ROAS />}
      {mode === 'cac' && <CAC />}
      {mode === 'gp' && <GrossProfit />}
      {mode === 'net-profit' && <NetProfit />}
      {mode === 'break-even' && <BreakEven />}
    </div>
  );
}

function ROI() {
  const [invest, setInvest] = usePersistentState('biz-roi-invest', '10000');
  const [profit, setProfit] = usePersistentState('biz-roi-profit', '3000');
  const i = parseFloat(invest) || 0, p = parseFloat(profit) || 0;
  const roi = i > 0 ? (p / i) * 100 : 0;
  return (
    <CalcLayout title="ROI (Return on Investment)" description="คำนวณผลตอบแทนจากการลงทุนเป็นเปอร์เซ็นต์"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>(กำไร ÷ ลงทุน) × 100 = ROI %</p>
          <p>({fmt(p)} ÷ {fmt(i)}) × 100 = <span className="font-bold">{roi.toFixed(1)}%</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ลงทุน (บาท)" value={invest} onChange={setInvest} unit="฿" />
          <CalcInput label="กำไร (บาท)" value={profit} onChange={setProfit} unit="฿" />
        </div>
        <ResultRow label="ROI" value={`${roi.toFixed(1)}%`} highlight={roi >= 0 ? 'success' : 'error'} />
      </>} />
  );
}

function ROAS() {
  const [sales, setSales] = usePersistentState('biz-roas-sales', '50000');
  const [ads, setAds] = usePersistentState('biz-roas-ads', '10000');
  const s = parseFloat(sales) || 0, a = parseFloat(ads) || 0;
  const roas = a > 0 ? s / a : 0;
  return (
    <CalcLayout title="ROAS (Return on Ad Spend)" description="คำนวณผลตอบแทนต่อยอดค่าโฆษณา ยิ่งสูงยิ่งดี"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ยอดขาย ÷ ค่าโฆษณา = ROAS</p>
          <p>{fmt(s)} ÷ {fmt(a)} = <span className="font-bold">{roas.toFixed(2)}x</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ยอดขาย (บาท)" value={sales} onChange={setSales} unit="฿" />
          <CalcInput label="ค่าโฆษณา (บาท)" value={ads} onChange={setAds} unit="฿" />
        </div>
        <ResultRow label="ROAS" value={`${roas.toFixed(2)}x`} highlight={roas >= 1 ? 'success' : 'error'} />
      </>} />
  );
}

function CAC() {
  const [ads, setAds] = usePersistentState('biz-cac-ads', '5000');
  const [customers, setCustomers] = usePersistentState('biz-cac-customers', '50');
  const a = parseFloat(ads) || 0, c = parseFloat(customers) || 0;
  const cac = c > 0 ? a / c : 0;
  return (
    <CalcLayout title="CAC (Customer Acquisition Cost)" description="คำนวณต้นทุนการหาลูกค้าใหม่ 1 คน"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ค่าโฆษณา ÷ จำนวนลูกค้าใหม่ = CAC</p>
          <p>{fmt(a)} ÷ {c} = <span className="font-bold">฿{fmt(cac)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ค่าโฆษณา (บาท)" value={ads} onChange={setAds} unit="฿" />
          <CalcInput label="ลูกค้าใหม่ (คน)" value={customers} onChange={setCustomers} unit="คน" />
        </div>
        <ResultRow label="CAC" value={`฿${fmt(cac)}`} highlight="primary" />
      </>} />
  );
}

function GrossProfit() {
  const [sell, setSell] = usePersistentState('biz-gp-sell', '200');
  const [cost, setCost] = usePersistentState('biz-gp-cost', '120');
  const s = parseFloat(sell) || 0, c = parseFloat(cost) || 0;
  const gp = s - c;
  const margin = s > 0 ? (gp / s) * 100 : 0;
  return (
    <CalcLayout title="Gross Profit (กำไรขั้นต้น)" description="คำนวณกำไรขั้นต้นจากราคาขายและต้นทุนสินค้า"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ราคาขาย - ต้นทุน = Gross Profit</p>
          <p>{fmt(s)} - {fmt(c)} = <span className="font-bold text-success-600">฿{fmt(gp)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาขาย (บาท)" value={sell} onChange={setSell} unit="฿" />
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
        </div>
        <div className="space-y-2">
          <ResultRow label="Gross Profit" value={`฿${fmt(gp)}`} highlight={gp >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>} />
  );
}

function NetProfit() {
  const [sell, setSell] = usePersistentState('biz-np-sell', '200');
  const [cost, setCost] = usePersistentState('biz-np-cost', '100');
  const [shipping, setShipping] = usePersistentState('biz-np-shipping', '20');
  const [box, setBox] = usePersistentState('biz-np-box', '5');
  const [fee, setFee] = usePersistentState('biz-np-fee', '15');
  const [ads, setAds] = usePersistentState('biz-np-ads', '10');
  const s = parseFloat(sell) || 0, c = parseFloat(cost) || 0, sh = parseFloat(shipping) || 0;
  const b = parseFloat(box) || 0, f = parseFloat(fee) || 0, a = parseFloat(ads) || 0;
  const feeBaht = s * (f / 100);
  const adsBaht = s * (a / 100);
  const totalCost = c + sh + b + feeBaht + adsBaht;
  const np = s - totalCost;
  const margin = s > 0 ? (np / s) * 100 : 0;
  return (
    <CalcLayout title="Net Profit (กำไรสุทธิ)" description="หลังหักทุกค่าใช้จ่าย: ต้นทุน ขนส่ง กล่อง ค่าธรรมเนียม โฆษณา"
      steps={<>
        <StepBox step={1} color="primary" title="รวมต้นทุนทั้งหมด">
          <p>ต้นทุน + ขนส่ง + กล่อง + ค่าธรรมเนียม + โฆษณา</p>
          <p>รวม: <span className="font-bold">฿{fmt(totalCost)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="กำไรสุทธิ">
          <p>ราคาขาย - ต้นทุนรวม = <span className="font-bold text-success-600">฿{fmt(np)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาขาย (บาท)" value={sell} onChange={setSell} unit="฿" />
          <CalcInput label="ต้นทุนสินค้า (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ค่าขนส่ง (บาท)" value={shipping} onChange={setShipping} unit="฿" />
          <CalcInput label="ค่ากล่อง (บาท)" value={box} onChange={setBox} unit="฿" />
          <CalcInput label="ค่าธรรมเนียม (%)" value={fee} onChange={setFee} unit="%" />
          <CalcInput label="Ads (%)" value={ads} onChange={setAds} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ค่าธรรมเนียม (บาท)" value={`฿${fmt(feeBaht)}`} />
          <ResultRow label="Ads (บาท)" value={`฿${fmt(adsBaht)}`} />
          <ResultRow label="ต้นทุนรวม" value={`฿${fmt(totalCost)}`} highlight="warning" />
          <ResultRow label="Net Profit" value={`฿${fmt(np)}`} highlight={np >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>} />
  );
}

function BreakEven() {
  const [fixedCost, setFixedCost] = usePersistentState('biz-be-fixed', '30000');
  const [profitPerUnit, setProfitPerUnit] = usePersistentState('biz-be-profit', '35');
  const fc = parseFloat(fixedCost) || 0, pp = parseFloat(profitPerUnit) || 0;
  const units = pp > 0 ? fc / pp : 0;
  return (
    <CalcLayout title="จุดคุ้มทุน (Break Even)" description="คำนวณจำนวนชิ้นที่ต้องขายเพื่อให้คุ้มต้นทุนคงที่"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ต้นทุนคงที่ ÷ กำไรต่อชิ้น = จำนวนชิ้นที่ต้องขาย</p>
          <p>{fmt(fc)} ÷ {fmt(pp)} = <span className="font-bold">{fmt(units)} ชิ้น</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุนคงที่ (บาท)" value={fixedCost} onChange={setFixedCost} unit="฿" />
          <CalcInput label="กำไรต่อชิ้น (บาท)" value={profitPerUnit} onChange={setProfitPerUnit} unit="฿" />
        </div>
        <ResultRow label="ต้องขายกี่ชิ้น" value={`${fmt(units)} ชิ้น`} highlight="primary" />
      </>} />
  );
}
