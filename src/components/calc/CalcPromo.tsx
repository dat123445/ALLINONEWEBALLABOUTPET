import { useState } from 'react';
import { Layers, Zap, TrendingDown, Gift, Coins, Receipt } from 'lucide-react';
import { CalcInput, ResultRow, StepBox, CalcLayout, fmt, usePersistentState } from './CalcShared';
import { cn } from '@/lib/format';

export function CalcPromo() {
  const [mode, setMode] = useState('buy-x-get-y');
  const modes = [
    { key: 'buy-x-get-y', label: 'ซื้อ X แถม Y', icon: Gift },
    { key: 'bundle', label: 'Bundle Calculator', icon: Layers },
    { key: 'flash-sale', label: 'Flash Sale', icon: Zap },
    { key: 'discount-check', label: 'ลดแล้วยังกำไรไหม', icon: TrendingDown },
    { key: 'vat', label: 'VAT Calculator', icon: Receipt },
    { key: 'installment', label: 'ผ่อน 0%', icon: Coins },
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
      {mode === 'buy-x-get-y' && <BuyXGetY />}
      {mode === 'bundle' && <Bundle />}
      {mode === 'flash-sale' && <FlashSale />}
      {mode === 'discount-check' && <DiscountCheck />}
      {mode === 'vat' && <VATCalc />}
      {mode === 'installment' && <Installment />}
    </div>
  );
}

function BuyXGetY() {
  const [cost, setCost] = usePersistentState('promo-bxy-cost', '50');
  const [buy, setBuy] = usePersistentState('promo-bxy-buy', '2');
  const [free, setFree] = usePersistentState('promo-bxy-free', '1');
  const [sell, setSell] = usePersistentState('promo-bxy-sell', '120');
  const c = parseFloat(cost) || 0, b = parseFloat(buy) || 0, f = parseFloat(free) || 0, s = parseFloat(sell) || 0;
  const totalCost = c * (b + f);
  const revenue = s * b;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <CalcLayout
      title="ซื้อ X แถม Y"
      description="คำนวณกำไรเมื่อลูกค้าซื้อ X ชิ้นแล้วแถม Y ชิ้นฟรี"
      steps={<>
        <StepBox step={1} color="primary" title="หาต้นทุนรวม (รวขของแถม)">
          <p>ต้นทุน × (ซื้อ + แถม) = ต้นทุนรวม</p>
          <p>{fmt(c)} × {b + f} = <span className="font-bold">฿{fmt(totalCost)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="หากำไร">
          <p>รายได้ (ราคาขาย × ซื้อ) - ต้นทุนรวม = กำไร</p>
          <p>{fmt(revenue)} - {fmt(totalCost)} = <span className="font-bold text-success-600">฿{fmt(profit)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน/ชิ้น (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ราคาขาย/ชิ้น (บาท)" value={sell} onChange={setSell} unit="฿" />
          <CalcInput label="ซื้อกี่ชิ้น" value={buy} onChange={setBuy} unit="ชิ้น" />
          <CalcInput label="แถมกี่ชิ้น" value={free} onChange={setFree} unit="ชิ้น" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ต้นทุนรวม (รวมของแถม)" value={`฿${fmt(totalCost)}`} highlight="warning" />
          <ResultRow label="รายได้" value={`฿${fmt(revenue)}`} />
          <ResultRow label="กำไรจริง" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>}
    />
  );
}

function Bundle() {
  const [cost, setCost] = usePersistentState('promo-bundle-cost', '80');
  const [qty, setQty] = usePersistentState('promo-bundle-qty', '3');
  const [disc, setDisc] = usePersistentState('promo-bundle-disc', '10');
  const [sellEach, setSellEach] = usePersistentState('promo-bundle-sell', '150');
  const c = parseFloat(cost) || 0, q = parseFloat(qty) || 0, d = parseFloat(disc) || 0, s = parseFloat(sellEach) || 0;
  const fullPrice = s * q;
  const bundlePrice = fullPrice * (1 - d / 100);
  const totalCost = c * q;
  const profit = bundlePrice - totalCost;
  const margin = bundlePrice > 0 ? (profit / bundlePrice) * 100 : 0;
  return (
    <CalcLayout
      title="Bundle Calculator"
      description="คำนวณกำไรเมื่อขายเป็นชุด เช่น 3 ชิ้นลด 10%"
      steps={<>
        <StepBox step={1} color="primary" title="หาราคาชุด">
          <p>ราคาเต็ม × (1 - ส่วนลด%) = ราคาชุด</p>
          <p>{fmt(fullPrice)} × {100 - d}% = <span className="font-bold">฿{fmt(bundlePrice)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="หากำไร">
          <p>ราคาชุด - ต้นทุนรวม = กำไร</p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน/ชิ้น (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ราคาขาย/ชิ้น (บาท)" value={sellEach} onChange={setSellEach} unit="฿" />
          <CalcInput label="จำนวนชิ้นในชุด" value={qty} onChange={setQty} unit="ชิ้น" />
          <CalcInput label="ส่วนลดชุด (%)" value={disc} onChange={setDisc} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาเต็ม (ก่อนลด)" value={`฿${fmt(fullPrice)}`} />
          <ResultRow label="ราคาชุด (หลังลด)" value={`฿${fmt(bundlePrice)}`} highlight="primary" />
          <ResultRow label="ต้นทุนรวม" value={`฿${fmt(totalCost)}`} highlight="warning" />
          <ResultRow label="กำไร" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>}
    />
  );
}

function FlashSale() {
  const [sell, setSell] = usePersistentState('promo-flash-sell', '200');
  const [disc, setDisc] = usePersistentState('promo-flash-disc', '20');
  const [voucher, setVoucher] = usePersistentState('promo-flash-voucher', '20');
  const [coin, setCoin] = usePersistentState('promo-flash-coin', '10');
  const [fee, setFee] = usePersistentState('promo-flash-fee', '25');
  const [ads, setAds] = usePersistentState('promo-flash-ads', '15');
  const [cost, setCost] = usePersistentState('promo-flash-cost', '80');
  const s = parseFloat(sell) || 0, d = parseFloat(disc) || 0, v = parseFloat(voucher) || 0;
  const co = parseFloat(coin) || 0, f = parseFloat(fee) || 0, a = parseFloat(ads) || 0, c = parseFloat(cost) || 0;
  const priceAfterDisc = s * (1 - d / 100);
  const afterVoucher = priceAfterDisc - v;
  const afterCoin = afterVoucher - co;
  const feeBaht = afterCoin * (f / 100);
  const adsBaht = afterCoin * (a / 100);
  const netRevenue = afterCoin - feeBaht - adsBaht;
  const profit = netRevenue - c;
  const margin = afterCoin > 0 ? (profit / afterCoin) * 100 : 0;
  return (
    <CalcLayout
      title="Flash Sale Calculator"
      description="ใส่ทุกปัจจัย: ส่วนลด Voucher Coin Platform Fee Ads แล้วดูว่าคุ้มไหม"
      steps={<>
        <StepBox step={1} color="primary" title="ลดราคาตามลำดับ">
          <p>ราคาขาย → หักส่วนลด% → หัก Voucher → หัก Coin</p>
          <p>เหลือ: <span className="font-bold">฿{fmt(afterCoin)}</span></p>
        </StepBox>
        <StepBox step={2} color="amber" title="หักค่าธรรมเนียมและโฆษณา">
          <p>ค่าธรรมเนียม: ฿{fmt(feeBaht)} | โฆษณา: ฿{fmt(adsBaht)}</p>
        </StepBox>
        <StepBox step={3} color="success" title="กำไรสุทธิ">
          <p>เงินเข้ากระเป๋า - ต้นทุน = <span className="font-bold text-success-600">฿{fmt(profit)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาขาย (บาท)" value={sell} onChange={setSell} unit="฿" />
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ส่วนลด Flash Sale (%)" value={disc} onChange={setDisc} unit="%" />
          <CalcInput label="Voucher (บาท)" value={voucher} onChange={setVoucher} unit="฿" />
          <CalcInput label="Coin (บาท)" value={coin} onChange={setCoin} unit="฿" />
          <CalcInput label="Platform Fee (%)" value={fee} onChange={setFee} unit="%" />
          <CalcInput label="Ads (%)" value={ads} onChange={setAds} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาหลังลดทั้งหมด" value={`฿${fmt(afterCoin)}`} highlight="warning" />
          <ResultRow label="ค่าธรรมเนียม + โฆษณา" value={`฿${fmt(feeBaht + adsBaht)}`} />
          <ResultRow label="เงินเข้ากระเป๋า" value={`฿${fmt(netRevenue)}`} />
          <ResultRow label="กำไรสุทธิ" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
          {profit < 0 && <div className="p-3 rounded-xl bg-error-50 text-xs text-error-600">ขาดทุน! Flash Sale นี้ไม่คุ้ม</div>}
        </div>
      </>}
    />
  );
}

function DiscountCheck() {
  const [cost, setCost] = usePersistentState('promo-dc-cost', '100');
  const [price, setPrice] = usePersistentState('promo-dc-price', '200');
  const [disc, setDisc] = usePersistentState('promo-dc-disc', '20');
  const [fee, setFee] = usePersistentState('promo-dc-fee', '15');
  const c = parseFloat(cost) || 0, p = parseFloat(price) || 0, d = parseFloat(disc) || 0, f = parseFloat(fee) || 0;
  const afterDisc = p * (1 - d / 100);
  const feeBaht = afterDisc * (f / 100);
  const remaining = afterDisc - feeBaht;
  const profit = remaining - c;
  const margin = afterDisc > 0 ? (profit / afterDisc) * 100 : 0;
  return (
    <CalcLayout
      title="ลดราคาแล้วยังกำไรไหม"
      description="กรอกต้นทุน ราคาปกติ ส่วนลด และค่าธรรมเนียม เพื่อดูว่าหลังลดแล้วยังกำไรอยู่ไหม"
      steps={<>
        <StepBox step={1} color="primary" title="ราคาหลังลด">
          <p>ราคาปกติ × (1 - ส่วนลด%) = <span className="font-bold">฿{fmt(afterDisc)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="กำไรที่เหลือ">
          <p>ราคาหลังลด - ค่าธรรมเนียม - ต้นทุน = <span className="font-bold text-success-600">฿{fmt(profit)}</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ราคาปกติ (บาท)" value={price} onChange={setPrice} unit="฿" />
          <CalcInput label="ส่วนลด (%)" value={disc} onChange={setDisc} unit="%" />
          <CalcInput label="ค่าธรรมเนียม (%)" value={fee} onChange={setFee} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ราคาหลังลด" value={`฿${fmt(afterDisc)}`} highlight="warning" />
          <ResultRow label="ค่าธรรมเนียม (บาท)" value={`฿${fmt(feeBaht)}`} />
          <ResultRow label="กำไรที่เหลือ" value={`฿${fmt(profit)}`} highlight={profit >= 0 ? 'success' : 'error'} />
          <ResultRow label="Margin" value={`${margin.toFixed(1)}%`} />
        </div>
      </>}
    />
  );
}

function VATCalc() {
  const [vatMode, setVatMode] = useState<'add' | 'remove' | 'find'>('add');
  const [amount, setAmount] = usePersistentState('promo-vat-amount', '1000');
  const [vatRate, setVatRate] = usePersistentState('promo-vat-rate', '7');
  const a = parseFloat(amount) || 0, r = parseFloat(vatRate) || 0;
  let vat = 0, total = 0, base = 0;
  if (vatMode === 'add') { base = a; vat = a * (r / 100); total = a + vat; }
  else if (vatMode === 'remove') { total = a; base = a / (1 + r / 100); vat = a - base; }
  else { vat = a; base = (a / r) * 100; total = base + vat; }
  return (
    <CalcLayout
      title="VAT Calculator"
      description="คำนวณภาษีมูลค่าเพิ่ม 3 โหมด: รวม VAT ถอด VAT หา VAT"
      steps={<>
        <StepBox step={1} color="primary" title="เลือกโหมดแล้วกรอกตัวเลข">
          <p><b>รวม VAT:</b> ยอดเดิม + VAT = ยอดรวม</p>
          <p><b>ถอด VAT:</b> ยอดรวม ÷ (1 + VAT%) = ยอดก่อน VAT</p>
          <p><b>หา VAT:</b> ถ้ารู้แค่ยอด VAT หารด้วย VAT% จะได้ยอดเต็ม</p>
        </StepBox>
      </>}
      result={<>
        <div className="flex gap-2 mb-3">
          {(['add', 'remove', 'find'] as const).map((m) => (
            <button key={m} onClick={() => setVatMode(m)}
              className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                vatMode === m ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500')}>
              {m === 'add' ? 'รวม VAT' : m === 'remove' ? 'ถอด VAT' : 'หา VAT'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label={vatMode === 'add' ? 'ยอดก่อน VAT' : vatMode === 'remove' ? 'ยอดรวม VAT' : 'ยอด VAT'} value={amount} onChange={setAmount} unit="฿" />
          <CalcInput label="อัตรา VAT (%)" value={vatRate} onChange={setVatRate} unit="%" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ยอดก่อน VAT" value={`฿${fmt(base)}`} />
          <ResultRow label="ภาษี VAT" value={`฿${fmt(vat)}`} highlight="warning" />
          <ResultRow label="ยอดรวม" value={`฿${fmt(total)}`} highlight="primary" />
        </div>
      </>}
    />
  );
}

function Installment() {
  const [price, setPrice] = usePersistentState('promo-install-price', '12000');
  const [months, setMonths] = usePersistentState('promo-install-months', '10');
  const p = parseFloat(price) || 0, m = parseFloat(months) || 0;
  const perMonth = m > 0 ? p / m : 0;
  return (
    <CalcLayout
      title="ผ่อน 0%"
      description="คำนวณยอดผ่อนต่อเดือน สำหรับผ่อน 0% ดอกเบี้ย"
      steps={<>
        <StepBox step={1} color="primary" title="หายอดผ่อนต่อเดือน">
          <p>ราคาสินค้า ÷ จำนวนเดือน = ผ่อนเดือนละ</p>
          <p>{fmt(p)} ÷ {m} = <span className="font-bold text-success-600">฿{fmt(perMonth)}/เดือน</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาสินค้า (บาท)" value={price} onChange={setPrice} unit="฿" />
          <CalcInput label="จำนวนเดือน" value={months} onChange={setMonths} unit="เดือน" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ผ่อนเดือนละ" value={`฿${fmt(perMonth)}`} highlight="success" />
        </div>
      </>}
    />
  );
}
