import { useState } from 'react';
import { ShoppingCart, Receipt, Coins } from 'lucide-react';
import { CalcInput, ResultRow, StepBox, CalcLayout, fmt, usePersistentState } from './CalcShared';
import { cn } from '@/lib/format';

export function CalcMarketplace() {
  const [mode, setMode] = useState('marketplace');
  const modes = [
    { key: 'marketplace', label: 'Shopee / Lazada', icon: ShoppingCart },
    { key: 'fee-baht', label: 'ค่าธรรมเนียมเป็นบาท', icon: Receipt },
    { key: 'commission', label: 'Commission', icon: Coins },
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
      {mode === 'marketplace' && <MarketplaceCalc />}
      {mode === 'fee-baht' && <FeeBaht />}
      {mode === 'commission' && <Commission />}
    </div>
  );
}

function MarketplaceCalc() {
  const [sell, setSell] = usePersistentState('mkt-sell', '250');
  const [fee, setFee] = usePersistentState('mkt-fee', '7');
  const [voucher, setVoucher] = usePersistentState('mkt-voucher', '0');
  const [coin, setCoin] = usePersistentState('mkt-coin', '0');
  const [affiliate, setAffiliate] = usePersistentState('mkt-affiliate', '0');
  const [ads, setAds] = usePersistentState('mkt-ads', '0');
  const [cost, setCost] = usePersistentState('mkt-cost', '100');
  const s = parseFloat(sell) || 0, f = parseFloat(fee) || 0, v = parseFloat(voucher) || 0;
  const co = parseFloat(coin) || 0, af = parseFloat(affiliate) || 0, a = parseFloat(ads) || 0, c = parseFloat(cost) || 0;
  const feeBaht = s * (f / 100);
  const affiliateBaht = s * (af / 100);
  const adsBaht = s * (a / 100);
  const totalDeductions = feeBaht + v + co + affiliateBaht + adsBaht;
  const netRevenue = s - totalDeductions;
  const profit = netRevenue - c;
  const margin = s > 0 ? (profit / s) * 100 : 0;
  return (
    <CalcLayout
      title="Shopee / Lazada Calculator"
      description="ใส่ราคาขาย ค่าธรรมเนียม Voucher Coin Affiliate Ads และต้นทุน เพื่อดูกำไรสุทธิ"
      steps={<>
        <StepBox step={1} color="primary" title="รวมค่าใช้จ่ายทั้งหมด">
          <p>ค่าธรรมเนียม + Voucher + Coin + Affiliate + Ads</p>
          <p>รวม: <span className="font-bold">฿{fmt(totalDeductions)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="กำไรสุทธิ">
          <p>ราคาขาย - ค่าใช้จ่ายรวม - ต้นทุน = <span className="font-bold text-success-600">฿{fmt(profit)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาขาย (บาท)" value={sell} onChange={setSell} unit="฿" />
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ค่าธรรมเนียม (%)" value={fee} onChange={setFee} unit="%" />
          <CalcInput label="Voucher (บาท)" value={voucher} onChange={setVoucher} unit="฿" />
          <CalcInput label="Coin (บาท)" value={coin} onChange={setCoin} unit="฿" />
          <CalcInput label="Affiliate (%)" value={affiliate} onChange={setAffiliate} unit="%" />
          <CalcInput label="Ads (%)" value={ads} onChange={setAds} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ค่าธรรมเนียม (บาท)" value={`฿${fmt(feeBaht)}`} />
          <ResultRow label="Affiliate (บาท)" value={`฿${fmt(affiliateBaht)}`} />
          <ResultRow label="Ads (บาท)" value={`฿${fmt(adsBaht)}`} />
          <ResultRow label="ค่าใช้จ่ายรวม" value={`฿${fmt(totalDeductions)}`} highlight="warning" />
          <ResultRow label="เงินเข้ากระเป๋า" value={`฿${fmt(netRevenue)}`} />
          <ResultRow label="กำไรสุทธิ" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>}
    />
  );
}

function FeeBaht() {
  const [amount, setAmount] = usePersistentState('mkt-fb-amount', '250');
  const [pct, setPct] = usePersistentState('mkt-fb-pct', '7');
  const a = parseFloat(amount) || 0, p = parseFloat(pct) || 0;
  const fee = a * (p / 100);
  return (
    <CalcLayout
      title="คำนวณค่าธรรมเนียมเป็นเงินบาท"
      description="กรอกยอดขายและเปอร์เซ็นต์ค่าธรรมเนียม ระบบจะแปลงเป็นจำนวนเงินบาท"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ยอดขาย × (เปอร์เซ็นต์ ÷ 100) = ค่าธรรมเนียม (บาท)</p>
          <p>{fmt(a)} × {p}% = <span className="font-bold">฿{fmt(fee)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ยอดขาย (บาท)" value={amount} onChange={setAmount} unit="฿" />
          <CalcInput label="เปอร์เซ็นต์ (%)" value={pct} onChange={setPct} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ค่าธรรมเนียม (บาท)" value={`฿${fmt(fee)}`} highlight="primary" />
        </div>
      </>}
    />
  );
}

function Commission() {
  const [sale, setSale] = usePersistentState('mkt-comm-sale', '5000');
  const [rate, setRate] = usePersistentState('mkt-comm-rate', '5');
  const s = parseFloat(sale) || 0, r = parseFloat(rate) || 0;
  const commission = s * (r / 100);
  return (
    <CalcLayout
      title="Commission Calculator"
      description="คำนวณค่าคอมมิชชั่น เช่น เซลล์ได้ 5% ของยอดขาย"
      steps={<>
        <StepBox step={1} color="primary" title="สูตร">
          <p>ยอดขาย × (อัตราคอมมิชชั่น% ÷ 100) = คอมมิชชั่น</p>
          <p>{fmt(s)} × {r}% = <span className="font-bold">฿{fmt(commission)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ยอดขาย (บาท)" value={sale} onChange={setSale} unit="฿" />
          <CalcInput label="อัตราคอมมิชชั่น (%)" value={rate} onChange={setRate} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="คอมมิชชั่น" value={`฿${fmt(commission)}`} highlight="success" />
        </div>
      </>}
    />
  );
}
