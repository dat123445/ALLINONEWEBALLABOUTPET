import { useState } from 'react';
import { Tag, RotateCcw, TrendingUp, Percent, Target } from 'lucide-react';
import { CalcInput, ResultRow, StepBox, CalcLayout, fmt, usePersistentState } from './CalcShared';
import { cn } from '@/lib/format';

export function CalcPricing() {
  const [mode, setMode] = useState('sell-from-profit');
  const modes = [
    { key: 'sell-from-profit', label: 'หาราคาขายจากกำไร', icon: Target },
    { key: 'after-discount', label: 'หาราคาหลังลด', icon: Tag },
    { key: 'reverse-discount', label: 'ถอยหาราคาก่อนลด', icon: RotateCcw },
    { key: 'margin', label: 'คิด Margin', icon: TrendingUp },
    { key: 'markup', label: 'คิด Markup', icon: Percent },
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
      {mode === 'sell-from-profit' && <SellFromProfit />}
      {mode === 'after-discount' && <AfterDiscount />}
      {mode === 'reverse-discount' && <ReverseDiscount />}
      {mode === 'margin' && <MarginCalc />}
      {mode === 'markup' && <MarkupCalc />}
    </div>
  );
}

function SellFromProfit() {
  const [cost, setCost] = usePersistentState('pricing-sfp-cost', '120');
  const [profit, setProfit] = usePersistentState('pricing-sfp-profit', '28');
  const [fee, setFee] = usePersistentState('pricing-sfp-fee', '25');
  const [discount, setDiscount] = usePersistentState('pricing-sfp-discount', '0');
  const c = parseFloat(cost) || 0, p = parseFloat(profit) || 0, f = parseFloat(fee) || 0, d = parseFloat(discount) || 0;
  const denom = 1 - p / 100 - f / 100;
  const sellPrice = denom > 0 ? c / denom : 0;
  const priceAfterDiscount = sellPrice * (1 - d / 100);
  const feeBaht = priceAfterDiscount * (f / 100);
  const remaining = priceAfterDiscount - feeBaht;
  const netProfit = remaining - c;
  const margin = priceAfterDiscount > 0 ? (netProfit / priceAfterDiscount) * 100 : 0;
  const markup = c > 0 ? (netProfit / c) * 100 : 0;
  const invalid = denom <= 0;
  return (
    <CalcLayout
      title="หาราคาขายจากกำไรที่ต้องการ"
      description="กรอกต้นทุนและกำไรที่อยากได้ ระบบจะคำนวณราคาขายที่ควรตั้ง พร้อมค่าธรรมเนียมและส่วนลด"
      steps={<>
        <StepBox step={1} color="primary" title="หาราคาขายจากทุนและกำไร">
          <p>วิธีคิด: ทุน ÷ (1 - กำไร% - ค่าธรรมเนียม%)</p>
          <p>ตัวอย่าง: 120 ÷ (1 - 0.28 - 0.25) = <span className="font-bold">฿{fmt(sellPrice)}</span></p>
        </StepBox>
        <StepBox step={2} color="amber" title="หักส่วนลด (ถ้ามี)">
          <p>ราคาหลังลด = ราคาขาย × (1 - ส่วนลด%)</p>
        </StepBox>
        <StepBox step={3} color="success" title="หากำไรสุทธิ">
          <p>เงินที่เหลือ - ทุน = กำไรสุทธิ</p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="กำไรที่ต้องการ (%)" value={profit} onChange={setProfit} unit="%" />
          <CalcInput label="ค่าธรรมเนียม (%)" value={fee} onChange={setFee} unit="%" />
          <CalcInput label="ส่วนลด (%)" value={discount} onChange={setDiscount} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาขายที่ควรตั้ง" value={invalid ? '— กำไร+ค่าธรรมเนียมต้องน้อยกว่า 100%' : `฿${fmt(sellPrice)}`} highlight="primary" />
          {d > 0 && <ResultRow label="ราคาหลังลด" value={invalid ? '—' : `฿${fmt(priceAfterDiscount)}`} />}
          <ResultRow label="ค่าธรรมเนียม (บาท)" value={invalid ? '—' : `฿${fmt(feeBaht)}`} />
          <ResultRow label="กำไรสุทธิ" value={invalid ? '—' : `฿${fmt(netProfit)}`} highlight={netProfit >= 0 ? 'success' : 'error'} />
          <div className="grid grid-cols-2 gap-2">
            <ResultRow label="Margin" value={invalid ? '—' : `${margin.toFixed(1)}%`} />
            <ResultRow label="Markup" value={invalid ? '—' : `${markup.toFixed(1)}%`} />
          </div>
        </div>
      </>}
    />
  );
}

function AfterDiscount() {
  const [price, setPrice] = usePersistentState('pricing-ad-price', '120');
  const [disc, setDisc] = usePersistentState('pricing-ad-disc', '15');
  const p = parseFloat(price) || 0, d = parseFloat(disc) || 0;
  const saved = p * (d / 100);
  const final = p - saved;
  return (
    <CalcLayout
      title="หาราคาหลังลด"
      description="กรอกราคาปกติและส่วนลดเปอร์เซ็นต์ ระบบจะคำนวณราคาที่ลูกค้าจ่ายและเงินที่ลดไป"
      steps={<>
        <StepBox step={1} color="primary" title="หาเงินที่ลดไป">
          <p>วิธีคิด: ราคาปกติ × (ส่วนลด% ÷ 100)</p>
          <p>ตัวอย่าง: 120 × 15% = <span className="font-bold">฿{fmt(saved)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="หาราคาที่ลูกค้าจ่าย">
          <p>ราคาปกติ - เงินที่ลด = ราคาที่จ่าย</p>
          <p>120 - 18 = <span className="font-bold text-success-600">฿{fmt(final)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาปกติ (บาท)" value={price} onChange={setPrice} unit="฿" />
          <CalcInput label="ส่วนลด (%)" value={disc} onChange={setDisc} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาที่ลูกค้าจ่าย" value={`฿${fmt(final)}`} highlight="success" />
          <ResultRow label="เงินที่ลดไป" value={`฿${fmt(saved)}`} highlight="warning" />
        </div>
      </>}
    />
  );
}

function ReverseDiscount() {
  const [sold, setSold] = usePersistentState('pricing-rd-sold', '255');
  const [disc, setDisc] = usePersistentState('pricing-rd-disc', '15');
  const s = parseFloat(sold) || 0, d = parseFloat(disc) || 0;
  const original = d < 100 ? s / (1 - d / 100) : 0;
  return (
    <CalcLayout
      title="ถอยกลับหาราคาก่อนลด"
      description="รู้ราคาที่ขายจริงและส่วนลด อยากรู้ราคาป้ายเดิมก่อนลด"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ราคาก่อนลด = ราคาขายจริง ÷ (1 - ส่วนลด%)</p>
          <p>ตัวอย่าง: 255 ÷ (1 - 0.15) = <span className="font-bold">฿{fmt(original)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาที่ขายจริง (บาท)" value={sold} onChange={setSold} unit="฿" />
          <CalcInput label="ส่วนลด (%)" value={disc} onChange={setDisc} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาป้ายเดิม" value={d >= 100 ? '— ส่วนลดต้องน้อยกว่า 100%' : `฿${fmt(original)}`} highlight="primary" />
        </div>
      </>}
    />
  );
}

function MarginCalc() {
  const [cost, setCost] = usePersistentState('pricing-m-cost', '120');
  const [sell, setSell] = usePersistentState('pricing-m-sell', '200');
  const c = parseFloat(cost) || 0, s = parseFloat(sell) || 0;
  const profit = s - c;
  const margin = s > 0 ? (profit / s) * 100 : 0;
  const markup = c > 0 ? (profit / c) * 100 : 0;
  return (
    <CalcLayout
      title="คิด Margin"
      description="กรอกต้นทุนและราคาขาย ระบบจะคำนวณ Margin % Markup % และกำไร"
      steps={<>
        <StepBox step={1} color="primary" title="หากำไร (บาท)">
          <p>ราคาขาย - ต้นทุน = กำไร</p>
          <p>200 - 120 = <span className="font-bold">฿{fmt(profit)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="แปลงเป็น Margin %">
          <p>กำไร ÷ ราคาขาย × 100 = Margin</p>
          <p>{fmt(profit)} ÷ {fmt(s)} × 100 = <span className="font-bold">{margin.toFixed(1)}%</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ราคาขาย (บาท)" value={sell} onChange={setSell} unit="฿" />
        </div>
        <div className="space-y-2">
          <ResultRow label="กำไร" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <div className="grid grid-cols-2 gap-2">
            <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} highlight="primary" />
            <ResultRow label="Markup" value={`${markup.toFixed(1)}%`} />
          </div>
        </div>
      </>}
    />
  );
}

function MarkupCalc() {
  const [cost, setCost] = usePersistentState('pricing-mu-cost', '100');
  const [markup, setMarkup] = usePersistentState('pricing-mu-markup', '50');
  const c = parseFloat(cost) || 0, m = parseFloat(markup) || 0;
  const profit = c * (m / 100);
  const sell = c + profit;
  return (
    <CalcLayout
      title="คิด Markup"
      description="กรอกต้นทุนและ Markup % ระบบจะคำนวณราคาขายและกำไร"
      steps={<>
        <StepBox step={1} color="primary" title="หากำไรจาก Markup">
          <p>กำไร = ต้นทุน × (Markup% ÷ 100)</p>
          <p>100 × 50% = <span className="font-bold">฿{fmt(profit)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="หาราคาขาย">
          <p>ต้นทุน + กำไร = ราคาขาย</p>
          <p>100 + 50 = <span className="font-bold">฿{fmt(sell)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="Markup (%)" value={markup} onChange={setMarkup} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาขาย" value={`฿${fmt(sell)}`} highlight="primary" />
          <ResultRow label="กำไร" value={`฿${fmt(profit)}`} highlight="success" />
        </div>
      </>}
    />
  );
}
