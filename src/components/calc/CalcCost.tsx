import { useState } from 'react';
import { Package, Truck, BarChart3 } from 'lucide-react';
import { CalcInput, ResultRow, StepBox, CalcLayout, fmt, usePersistentState } from './CalcShared';
import { cn } from '@/lib/format';

export function CalcCost() {
  const [mode, setMode] = useState('total-cost');
  const modes = [
    { key: 'total-cost', label: 'รวมต้นทุนทั้งหมด', icon: Package },
    { key: 'avg-cost', label: 'ต้นทุนเฉลี่ย', icon: BarChart3 },
    { key: 'compare-profit', label: 'เปรียบเทียบกำไร 2 ราคา', icon: Truck },
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
      {mode === 'total-cost' && <TotalCost />}
      {mode === 'avg-cost' && <AvgCost />}
      {mode === 'compare-profit' && <CompareProfit />}
    </div>
  );
}

function TotalCost() {
  const [product, setProduct] = usePersistentState('cost-tc-product', '80');
  const [shipping, setShipping] = usePersistentState('cost-tc-shipping', '20');
  const [box, setBox] = usePersistentState('cost-tc-box', '5');
  const [labor, setLabor] = usePersistentState('cost-tc-labor', '10');
  const [fee, setFee] = usePersistentState('cost-tc-fee', '0');
  const [other, setOther] = usePersistentState('cost-tc-other', '0');
  const [qty, setQty] = usePersistentState('cost-tc-qty', '1');
  const p = parseFloat(product) || 0, sh = parseFloat(shipping) || 0, b = parseFloat(box) || 0;
  const l = parseFloat(labor) || 0, f = parseFloat(fee) || 0, o = parseFloat(other) || 0, q = parseFloat(qty) || 1;
  const total = p + sh + b + l + f + o;
  const perUnit = q > 0 ? total / q : 0;
  return (
    <CalcLayout title="รวมต้นทุนทั้งหมด" description="รวมทุกค่าใช้จ่าย: ราคาสินค้า ขนส่ง กล่อง ค่าแรง ค่าธรรมเนียม อื่นๆ"
      steps={<>
        <StepBox step={1} color="primary" title="รวมทุกค่าใช้จ่าย">
          <p>สินค้า + ขนส่ง + กล่อง + ค่าแรง + ค่าธรรมเนียม + อื่นๆ</p>
          <p>รวม: <span className="font-bold">฿{fmt(total)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="หาต้นทุนต่อชิ้น">
          <p>ต้นทุนรวม ÷ จำนวนชิ้น = <span className="font-bold">฿{fmt(perUnit)}/ชิ้น</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ราคาสินค้า (บาท)" value={product} onChange={setProduct} unit="฿" />
          <CalcInput label="ค่าขนส่ง (บาท)" value={shipping} onChange={setShipping} unit="฿" />
          <CalcInput label="ค่ากล่อง (บาท)" value={box} onChange={setBox} unit="฿" />
          <CalcInput label="ค่าแรง (บาท)" value={labor} onChange={setLabor} unit="฿" />
          <CalcInput label="ค่าธรรมเนียม (บาท)" value={fee} onChange={setFee} unit="฿" />
          <CalcInput label="อื่นๆ (บาท)" value={other} onChange={setOther} unit="฿" />
          <CalcInput label="จำนวนชิ้น" value={qty} onChange={setQty} unit="ชิ้น" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ต้นทุนรวม" value={`฿${fmt(total)}`} highlight="warning" />
          <ResultRow label="ต้นทุนจริงต่อชิ้น" value={`฿${fmt(perUnit)}`} highlight="primary" />
        </div>
      </>} />
  );
}

function AvgCost() {
  const [lot1Qty, setLot1Qty] = usePersistentState('cost-ac-q1', '100');
  const [lot1Price, setLot1Price] = usePersistentState('cost-ac-p1', '50');
  const [lot2Qty, setLot2Qty] = usePersistentState('cost-ac-q2', '50');
  const [lot2Price, setLot2Price] = usePersistentState('cost-ac-p2', '60');
  const q1 = parseFloat(lot1Qty) || 0, p1 = parseFloat(lot1Price) || 0;
  const q2 = parseFloat(lot2Qty) || 0, p2 = parseFloat(lot2Price) || 0;
  const totalQty = q1 + q2;
  const totalCost = q1 * p1 + q2 * p2;
  const avg = totalQty > 0 ? totalCost / totalQty : 0;
  return (
    <CalcLayout title="ต้นทุนเฉลี่ย" description="คำนวณต้นทุนเฉลี่ยเมื่อรับสินค้าเข้าหลายล็อตในราคาต่างกัน"
      steps={<>
        <StepBox step={1} color="primary" title="หาต้นทุนรวมและจำนวนรวม">
          <p>ล็อต 1: {q1} × ฿{fmt(p1)} = ฿{fmt(q1 * p1)}</p>
          <p>ล็อต 2: {q2} × ฿{fmt(p2)} = ฿{fmt(q2 * p2)}</p>
          <p>รวม: {totalQty} ชิ้น, ฿{fmt(totalCost)}</p>
        </StepBox>
        <StepBox step={2} color="success" title="หาต้นทุนเฉลี่ย">
          <p>ต้นทุนรวม ÷ จำนวนรวม = <span className="font-bold">฿{fmt(avg)}/ชิ้น</span></p>
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CalcInput label="ล็อต 1: จำนวน" value={lot1Qty} onChange={setLot1Qty} unit="ชิ้น" />
          <CalcInput label="ล็อต 1: ราคา/ชิ้น" value={lot1Price} onChange={setLot1Price} unit="฿" />
          <CalcInput label="ล็อต 2: จำนวน" value={lot2Qty} onChange={setLot2Qty} unit="ชิ้น" />
          <CalcInput label="ล็อต 2: ราคา/ชิ้น" value={lot2Price} onChange={setLot2Price} unit="฿" />
        </div>
        <div className="space-y-2">
          <ResultRow label="ต้นทุนรวม" value={`฿${fmt(totalCost)}`} />
          <ResultRow label="จำนวนรวม" value={`${fmt(totalQty)} ชิ้น`} />
          <ResultRow label="ต้นทุนเฉลี่ย/ชิ้น" value={`฿${fmt(avg)}`} highlight="primary" />
        </div>
      </>} />
  );
}

function CompareProfit() {
  const [cost, setCost] = usePersistentState('cost-cp-cost', '100');
  const [priceA, setPriceA] = usePersistentState('cost-cp-a', '199');
  const [priceB, setPriceB] = usePersistentState('cost-cp-b', '229');
  const c = parseFloat(cost) || 0, pa = parseFloat(priceA) || 0, pb = parseFloat(priceB) || 0;
  const profitA = pa - c, profitB = pb - c;
  const marginA = pa > 0 ? (profitA / pa) * 100 : 0;
  const marginB = pb > 0 ? (profitB / pb) * 100 : 0;
  const diff = profitB - profitA;
  const diffMargin = marginB - marginA;
  return (
    <CalcLayout title="เปรียบเทียบกำไร 2 ราคา" description="เปรียบเทียบว่าขายราคาไหนกำไรมากกว่า พร้อมบอกส่วนต่างเป็นบาทและเปอร์เซ็นต์"
      steps={<>
        <StepBox step={1} color="primary" title="คำนวณกำไรแต่ละราคา">
          <p>ราคา A: {fmt(pa)} - {fmt(c)} = <span className="font-bold">฿{fmt(profitA)}</span></p>
          <p>ราคา B: {fmt(pb)} - {fmt(c)} = <span className="font-bold">฿{fmt(profitB)}</span></p>
        </StepBox>
        <StepBox step={2} color="success" title="เปรียบเทียบส่วนต่าง">
          <p>กำไรต่างกัน: <span className="font-bold">฿{fmt(Math.abs(diff))}</span></p>
          <p>Margin ต่างกัน: <span className="font-bold">{Math.abs(diffMargin).toFixed(1)}%</span></p>
          {diff > 0 && <p className="text-success-600">ขายราคา B ได้กำไรมากกว่า</p>}
          {diff < 0 && <p className="text-success-600">ขายราคา A ได้กำไรมากกว่า</p>}
        </StepBox>
      </>}
      result={<>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <CalcInput label="ต้นทุน (บาท)" value={cost} onChange={setCost} unit="฿" />
          <CalcInput label="ราคา A (บาท)" value={priceA} onChange={setPriceA} unit="฿" />
          <CalcInput label="ราคา B (บาท)" value={priceB} onChange={setPriceB} unit="฿" />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultRow label="กำไร A" value={`฿${fmt(profitA)}`} highlight={profitA >= 0 ? 'success' : 'error'} />
            <ResultRow label="กำไร B" value={`฿${fmt(profitB)}`} highlight={profitB >= 0 ? 'success' : 'error'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ResultRow label="Margin A" value={`${marginA.toFixed(1)}%`} />
            <ResultRow label="Margin B" value={`${marginB.toFixed(1)}%`} />
          </div>
          <ResultRow label="ส่วนต่างกำไร" value={`฿${fmt(Math.abs(diff))} (${diff > 0 ? 'B มากกว่า' : 'A มากกว่า'})`} highlight="primary" />
          <ResultRow label="ส่วนต่าง Margin" value={`${Math.abs(diffMargin).toFixed(1)}%`} />
        </div>
      </>} />
  );
}
