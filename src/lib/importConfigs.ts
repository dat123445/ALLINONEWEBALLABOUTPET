import type { ImportConfig, PreValidateContext } from '@/components/GenericImportModal';
import { supabase } from '@/lib/supabase';

export type ImportableModule = 'products' | 'stock' | 'stockReceive' | 'stockWithdraw' | 'users' | 'branches' | 'customers' | 'marketing' | 'sales' | 'purchasing' | 'attendance' | 'salary' | 'movementHistory';

export const IMPORTABLE_MODULES: ImportableModule[] = ['products', 'stock', 'stockReceive', 'stockWithdraw', 'users', 'branches', 'customers', 'marketing', 'sales', 'purchasing', 'attendance', 'salary', 'movementHistory'];

/** Extra runtime context passed to movement-type imports (receive/withdraw). */
export interface MovementImportContext {
  branchId?: string;
  profileId?: string;
}

let _movementCtx: MovementImportContext = {};
export function setMovementImportContext(ctx: MovementImportContext) { _movementCtx = ctx; }

/** Normalize a SKU/barcode for comparison: trim, lowercase, and strip leading zeros from purely-numeric strings.
 *  e.g. "0850477018037" and "850477018037" both become "850477018037". */
function normalizeCode(raw: string): string {
  const trimmed = (raw || '').trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return trimmed.replace(/^0+/, '') || '0';
  return trimmed;
}

/** Find a product by SKU (case-insensitive, trimmed, leading-zero-insensitive) with barcode fallback. Returns product id or null. */
function matchProductBySkuOrBarcode(skuRaw: string, ctx: PreValidateContext): string | null {
  const sku = normalizeCode(skuRaw);
  if (!sku) return null;
  const bySku = ctx.products.find((p) => normalizeCode(p.sku) === sku);
  if (bySku) return bySku.id;
  const byBarcode = ctx.barcodeMap.get(sku);
  return byBarcode ?? null;
}

/** Find a branch by name or short_code (case-insensitive, trimmed, partial match).
 *  Tries exact match first, then falls back to contains/startsWith so "กม.9" matches "สาขากม.9". */
function matchBranch(nameOrCode: string, ctx: PreValidateContext): string | null {
  const val = (nameOrCode || '').trim().toLowerCase();
  if (!val) return null;
  // Exact match
  const byName = ctx.branches.find((b) => (b.name || '').trim().toLowerCase() === val);
  if (byName) return byName.id;
  const byCode = ctx.branches.find((b) => (b.short_code || '').trim().toLowerCase() === val);
  if (byCode) return byCode.id;
  // Partial: DB name contains the input (e.g. "สาขากม.9" contains "กม.9")
  const contained = ctx.branches.find((b) => {
    const n = (b.name || '').trim().toLowerCase();
    return n.includes(val) || val.includes(n);
  });
  if (contained) return contained.id;
  // Partial against short_code
  const containedCode = ctx.branches.find((b) => {
    const c = (b.short_code || '').trim().toLowerCase();
    return c && (c.includes(val) || val.includes(c));
  });
  return containedCode?.id ?? null;
}

/** Async product lookup for upsertRow: try SKU (case-insensitive exact, with/without leading zeros), then barcode.
 *  Returns product id or null. */
async function findProductBySkuOrBarcode(skuRaw: string): Promise<string | null> {
  const sku = (skuRaw || '').trim();
  if (!sku) return null;
  // Try exact match first
  const { data: prod } = await supabase.from('products').select('id').ilike('sku', sku).maybeSingle();
  if (prod) return prod.id;
  // If purely numeric, also try with leading zeros stripped
  const normalized = sku.replace(/^0+/, '') || '0';
  if (normalized !== sku) {
    const { data: prodNorm } = await supabase.from('products').select('id').ilike('sku', normalized).maybeSingle();
    if (prodNorm) return prodNorm.id;
    const { data: barNorm } = await supabase.from('product_barcodes').select('product_id').ilike('barcode', normalized).maybeSingle();
    if (barNorm) return barNorm.product_id;
  }
  const { data: bar } = await supabase.from('product_barcodes').select('product_id').ilike('barcode', sku).maybeSingle();
  return bar?.product_id ?? null;
}

const VALID_MOVEMENT_TYPES = ['รับเข้า', 'receive', 'เบิกออก', 'withdraw', 'รับโอน', 'transfer_in', 'โอนออก', 'transfer_out', 'ปรับปรุง', 'adjust'];

export const IMPORT_CONFIGS: Record<ImportableModule, ImportConfig> = {
  products: {
    moduleLabel: 'สินค้า',
    sheetName: 'สินค้า',
    templateFilename: 'template-import-products.xlsx',
    fields: [
      { key: 'name', label: 'ชื่อสินค้า', required: true, type: 'text', aliases: ['ชื่อสินค้า', 'name', 'Name', 'สินค้า'], example: 'อาหารสัตว์แมว 1กก.' },
      { key: 'sku', label: 'SKU (รหัส)', required: true, type: 'text', aliases: ['SKU', 'sku', 'รหัสสินค้า', 'รหัส'], example: 'CAT-001' },
      { key: 'category', label: 'หมวดหมู่', required: false, type: 'text', aliases: ['หมวดหมู่', 'category', 'Category', 'ประเภท'], example: 'อาหารแมว' },
      { key: 'brand', label: 'แบรนด์', required: false, type: 'text', aliases: ['แบรนด์', 'brand', 'Brand', 'ยี่ห้อ'], example: 'Whiskas' },
      { key: 'unit', label: 'หน่วย', required: false, type: 'text', aliases: ['หน่วย', 'unit', 'Unit', 'หน่วยนับ'], example: 'ถุง' },
      { key: 'cost_price', label: 'ทุน (ต้นทุน)', required: false, type: 'number', aliases: ['ต้นทุน', 'cost_price', 'Cost', 'ราคาทุน', 'ทุน'], example: '50' },
      { key: 'retail_price', label: 'ราคาหน้าร้าน', required: false, type: 'number', aliases: ['ราคาขาย', 'retail_price', 'Retail', 'ราคาหน้าร้าน'], example: '120' },
      { key: 'quantity', label: 'คงเหลือ', required: false, type: 'number', aliases: ['คงเหลือ', 'quantity', 'qty', 'จำนวน', 'จำนวนคงเหลือ', 'สต๊อก'], example: '100' },
      { key: 'lot_label', label: 'ล็อต (เก่า/ใหม่)', required: false, type: 'text', aliases: ['ล็อต', 'lot_label', 'lot', 'เลขล็อต'], example: 'new' },
      { key: 'expiry_date', label: 'วันหมดอายุ', required: false, type: 'date', aliases: ['วันหมดอายุ', 'expiry_date', 'exp', 'หมดอายุ', 'expire'], example: '2027-01-31' },
      { key: 'barcode', label: 'บาร์โค้ด', required: false, type: 'text', aliases: ['บาร์โค้ด', 'barcode', 'Barcode'], example: '8851234567890' },
      { key: 'piece_old_cost', label: 'ทุนล็อตเก่า (ชิ้น)', required: false, type: 'number', aliases: ['piece old cost', 'ทุนเก่าชิ้น', 'ราคาทุนล็อตเก่า ชิ้น'] },
      { key: 'piece_old_retail', label: 'ขายล็อตเก่า (ชิ้น)', required: false, type: 'number', aliases: ['piece old retail', 'ขายเก่าชิ้น', 'ราคาขายล็อตเก่า ชิ้น'] },
      { key: 'piece_new_cost', label: 'ทุนล็อตใหม่ (ชิ้น)', required: false, type: 'number', aliases: ['piece new cost', 'ทุนใหม่ชิ้น', 'ราคาทุนล็อตใหม่ ชิ้น'] },
      { key: 'piece_new_retail', label: 'ขายล็อตใหม่ (ชิ้น)', required: false, type: 'number', aliases: ['piece new retail', 'ขายใหม่ชิ้น', 'ราคาขายล็อตใหม่ ชิ้น'] },
      { key: 'pack_old_cost', label: 'ทุนล็อตเก่า (แพ็ก)', required: false, type: 'number', aliases: ['pack old cost', 'ทุนเก่าแพ็ก'] },
      { key: 'pack_old_retail', label: 'ขายล็อตเก่า (แพ็ก)', required: false, type: 'number', aliases: ['pack old retail', 'ขายเก่าแพ็ก'] },
      { key: 'pack_new_cost', label: 'ทุนล็อตใหม่ (แพ็ก)', required: false, type: 'number', aliases: ['pack new cost', 'ทุนใหม่แพ็ก'] },
      { key: 'pack_new_retail', label: 'ขายล็อตใหม่ (แพ็ก)', required: false, type: 'number', aliases: ['pack new retail', 'ขายใหม่แพ็ก'] },
      { key: 'carton_old_cost', label: 'ทุนล็อตเก่า (ลัง)', required: false, type: 'number', aliases: ['carton old cost', 'ทุนเก่าลัง'] },
      { key: 'carton_old_retail', label: 'ขายล็อตเก่า (ลัง)', required: false, type: 'number', aliases: ['carton old retail', 'ขายเก่าลัง'] },
      { key: 'carton_new_cost', label: 'ทุนล็อตใหม่ (ลัง)', required: false, type: 'number', aliases: ['carton new cost', 'ทุนใหม่ลัง'] },
      { key: 'carton_new_retail', label: 'ขายล็อตใหม่ (ลัง)', required: false, type: 'number', aliases: ['carton new retail', 'ขายใหม่ลัง'] },
    ],
    duplicateCheck: { table: 'products', column: 'sku' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const payload = {
        name: mapped.name,
        sku: mapped.sku,
        category: mapped.category || null,
        brand: mapped.brand || null,
        unit: mapped.unit || null,
        cost_price: Number(mapped.cost_price) || 0,
        retail_price: Number(mapped.retail_price) || 0,
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', existingId);
        if (error) return { success: false, error: error.message };
        if (mapped.quantity) {
          const lotLabel = (mapped.lot_label?.toLowerCase().includes('new') || mapped.lot_label === 'ใหม่') ? 'new' : 'old';
          const { data: firstBranch } = await supabase.from('branches').select('id').eq('is_active', true).order('created_at').limit(1).maybeSingle();
          if (firstBranch) {
            const { data: existingLot } = await supabase.from('stock_lots').select('id, quantity').eq('product_id', existingId).eq('branch_id', firstBranch.id).eq('lot_label', lotLabel).maybeSingle();
            if (existingLot) {
              await supabase.from('stock_lots').update({ quantity: Number(existingLot.quantity) + (Number(mapped.quantity) || 0), expiry_date: mapped.expiry_date || null }).eq('id', existingLot.id);
            } else {
              await supabase.from('stock_lots').insert({ product_id: existingId, branch_id: firstBranch.id, lot_label: lotLabel, quantity: Number(mapped.quantity) || 0, cost_price: Number(mapped.cost_price) || 0, expiry_date: mapped.expiry_date || null });
            }
          }
        }
        return { success: true };
      }
      const { data: newProduct, error: insErr } = await supabase.from('products').insert({ ...payload, min_stock: 5, is_active: true }).select('id').single();
      if (insErr) return { success: false, error: insErr.message };
      if (mapped.quantity) {
        const lotLabel = (mapped.lot_label?.toLowerCase().includes('new') || mapped.lot_label === 'ใหม่') ? 'new' : 'old';
        const { data: firstBranch } = await supabase.from('branches').select('id').eq('is_active', true).order('created_at').limit(1).maybeSingle();
        if (firstBranch) {
          await supabase.from('stock_lots').insert({ product_id: newProduct.id, branch_id: firstBranch.id, lot_label: lotLabel, quantity: Number(mapped.quantity) || 0, cost_price: Number(mapped.cost_price) || 0, expiry_date: mapped.expiry_date || null });
        }
      }
      if (mapped.barcode) {
        await supabase.from('product_barcodes').insert({ product_id: newProduct.id, barcode: mapped.barcode, unit: 'piece', unit_multiplier: 1 });
      }
      return { success: true };
    },
  },

  stock: {
    moduleLabel: 'สต๊อก',
    sheetName: 'สต๊อก',
    templateFilename: 'template-import-stock.xlsx',
    fields: [
      { key: 'product_sku', label: 'SKU สินค้า', required: true, type: 'text', aliases: ['SKU', 'sku', 'SKU สินค้า', 'รหัสสินค้า'], example: 'CAT-001' },
      { key: 'branch_code', label: 'รหัสสาขา', required: false, type: 'text', aliases: ['รหัสสาขา', 'branch_code', 'สาขา', 'branch'], example: 'MAIN' },
      { key: 'quantity', label: 'จำนวน', required: true, type: 'number', aliases: ['จำนวน', 'quantity', 'qty', 'จำนวนคงเหลือ'], example: '100' },
      { key: 'cost_price', label: 'ราคา/หน่วย', required: false, type: 'number', aliases: ['ราคา/หน่วย', 'cost_price', 'unit_price', 'ต้นทุน'], example: '50' },
      { key: 'lot_label', label: 'เลขล็อต', required: false, type: 'text', aliases: ['เลขล็อต', 'lot_label', 'lot', 'ล็อต'], example: 'LOT-2026-001' },
      { key: 'expiry_date', label: 'วันหมดอายุ', required: false, type: 'date', aliases: ['วันหมดอายุ', 'expiry_date', 'exp'], example: '2027-01-31' },
    ],
    preValidate: (mapped, ctx) => {
      const errors: string[] = [];
      if (!matchProductBySkuOrBarcode(mapped.product_sku, ctx)) errors.push(`ไม่พบสินค้า SKU: ${mapped.product_sku}`);
      return errors;
    },
    upsertRow: async (mapped) => {
      const productId = await findProductBySkuOrBarcode(mapped.product_sku);
      if (!productId) return { success: false, error: `ไม่พบสินค้า SKU: ${mapped.product_sku}` };

      let branchId: string | null = null;
      if (mapped.branch_code) {
        const { data: branch } = await supabase.from('branches').select('id').ilike('short_code', mapped.branch_code).maybeSingle();
        if (branch) branchId = branch.id;
      }
      if (!branchId) {
        const { data: firstBranch } = await supabase.from('branches').select('id').eq('is_active', true).order('created_at').limit(1).maybeSingle();
        branchId = firstBranch?.id ?? null;
      }
      if (!branchId) return { success: false, error: 'ไม่พบสาขาในระบบ' };

      const { error } = await supabase.from('stock_lots').insert({
        product_id: productId,
        branch_id: branchId,
        quantity: Number(mapped.quantity) || 0,
        cost_price: Number(mapped.cost_price) || 0,
        lot_label: mapped.lot_label || null,
        expiry_date: mapped.expiry_date || null,
      });
      return { success: !error, error: error?.message };
    },
  },

  users: {
    moduleLabel: 'ผู้ใช้',
    sheetName: 'ผู้ใช้',
    templateFilename: 'template-import-users.xlsx',
    fields: [
      { key: 'display_name', label: 'ชื่อ', required: true, type: 'text', aliases: ['ชื่อ', 'display_name', 'name', 'Name'], example: 'สมชาย ใจดี' },
      { key: 'email', label: 'อีเมล', required: true, type: 'text', aliases: ['อีเมล', 'email', 'Email', 'E-mail'], example: 'somchai@example.com' },
      { key: 'password', label: 'รหัสผ่าน', required: true, type: 'text', aliases: ['รหัสผ่าน', 'password', 'Password', 'pwd'], example: '123456' },
      { key: 'position', label: 'ตำแหน่ง', required: false, type: 'text', aliases: ['ตำแหน่ง', 'position', 'Position'], example: 'พนักงานขาย' },
      { key: 'phone', label: 'เบอร์โทร', required: false, type: 'text', aliases: ['เบอร์โทร', 'phone', 'Tel', 'เบอร์'], example: '0812345678' },
      { key: 'employment_type', label: 'ประเภทจ้าง', required: false, type: 'text', aliases: ['ประเภทจ้าง', 'employment_type', 'Type'], example: 'เต็มเวลา' },
    ],
    duplicateCheck: { table: 'profiles', column: 'email' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      if (isUpdate && existingId) {
        const { error } = await supabase.from('profiles').update({
          display_name: mapped.display_name,
          position: mapped.position || null,
          phone: mapped.phone || null,
          employment_type: mapped.employment_type || null,
        }).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' };
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-users`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            users: [{
              email: mapped.email,
              password: mapped.password,
              display_name: mapped.display_name,
              roles: ['employee'],
              employment_type: (() => {
                const raw = (mapped.employment_type || '').trim();
                if (raw === 'monthly' || raw === 'เดือน' || raw === 'รายเดือน' || raw === 'เต็มเวลา') return 'monthly';
                return 'daily';
              })(),
              position: mapped.position || null,
              phone: mapped.phone || null,
            }],
          }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? 'สร้างบัญชีไม่สำเร็จ' };
        const r = data.results?.[0];
        return { success: !!r?.success, error: r?.error };
      } catch (err: any) {
        return { success: false, error: err.message ?? 'เชื่อมต่อไม่ได้' };
      }
    },
  },

  branches: {
    moduleLabel: 'สาขา',
    sheetName: 'สาขา',
    templateFilename: 'template-import-branches.xlsx',
    fields: [
      { key: 'name', label: 'ชื่อสาขา', required: true, type: 'text', aliases: ['ชื่อสาขา', 'name', 'Name'], example: 'สาขากรุงเทพ' },
      { key: 'short_code', label: 'รหัสย่อ', required: true, type: 'text', aliases: ['รหัสย่อ', 'short_code', 'Code'], example: 'BKK' },
      { key: 'address', label: 'ที่อยู่', required: false, type: 'text', aliases: ['ที่อยู่', 'address', 'Address'], example: '123 ถ.สุขุมวิท กรุงเทพฯ' },
      { key: 'phone', label: 'เบอร์โทร', required: false, type: 'text', aliases: ['เบอร์โทร', 'phone', 'Tel'], example: '021234567' },
    ],
    duplicateCheck: { table: 'branches', column: 'short_code' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const payload = {
        name: mapped.name,
        short_code: mapped.short_code,
        address: mapped.address || null,
        phone: mapped.phone || null,
        is_active: true,
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('branches').update(payload).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { error } = await supabase.from('branches').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  customers: {
    moduleLabel: 'ลูกค้า',
    sheetName: 'ลูกค้า',
    templateFilename: 'template-import-customers.xlsx',
    fields: [
      { key: 'name', label: 'ชื่อลูกค้า', required: true, type: 'text', aliases: ['ชื่อลูกค้า', 'name', 'Name', 'ชื่อ'], example: 'คุณสมหญิง' },
      { key: 'phone', label: 'เบอร์โทร', required: false, type: 'text', aliases: ['เบอร์โทร', 'phone', 'Tel', 'เบอร์'], example: '0812345678' },
      { key: 'platform', label: 'แพลตฟอร์ม', required: false, type: 'text', aliases: ['แพลตฟอร์ม', 'platform', 'Platform'], example: 'LINE' },
    ],
    duplicateCheck: { table: 'customers', column: 'phone' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const payload = {
        name: mapped.name,
        phone: mapped.phone || null,
        platform: mapped.platform || null,
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { error } = await supabase.from('customers').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  stockReceive: {
    moduleLabel: 'รับสินค้า',
    sheetName: 'รับสินค้า',
    templateFilename: 'template-import-receive.xlsx',
    templateExtraSheets: [{ name: 'ตัวเลือกประเภท', rows: [
      { 'ประเภทการรับ': 'ซื้อเข้าจากซัพ', 'หมายเหตุ': 'รับเข้าปกติ' },
      { 'ประเภทการรับ': 'รับโอนจากสาขา', 'หมายเหตุ': 'รับโอนจากสาขาอื่น' },
      { 'ประเภทการรับ': 'ของตีกลับ', 'หมายเหตุ': 'ลูกค้าตีกลับ/คืนสินค้า (นับเป็นคืนสินค้า)' },
      { 'ประเภทการรับ': 'ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า', 'หมายเหตุ': 'ลูกค้าคืนสินค้า (นับเป็นคืนสินค้า)' },
    ] }],
    fields: [
      { key: 'sku', label: 'SKU', required: true, type: 'text', aliases: ['SKU', 'sku', 'รหัสสินค้า', 'รหัส'], example: 'CAT-001' },
      { key: 'quantity', label: 'จำนวนที่รับ', required: true, type: 'number', aliases: ['จำนวนที่รับ', 'จำนวน', 'quantity', 'qty'], example: '50' },
      { key: 'receive_date', label: 'วันที่รับ', required: true, type: 'date', aliases: ['วันที่รับ', 'receive_date', 'วันที่', 'date'], example: '2026-08-07' },
      { key: 'lot_label', label: 'ล็อต (เก่า/ใหม่)', required: false, type: 'text', aliases: ['ล็อต', 'lot_label', 'lot', 'เลขล็อต'], example: 'new' },
      { key: 'cost_price', label: 'ราคาทุน/หน่วย', required: false, type: 'number', aliases: ['ราคาทุน', 'cost_price', 'ทุน', 'unit_price'], example: '80' },
      { key: 'type_config', label: 'ประเภทการรับ', required: false, type: 'text', aliases: ['ประเภทการรับ', 'type_config', 'ประเภท'], example: 'ซื้อเข้าจากซัพ', hint: 'ตัวเลือก: ซื้อเข้าจากซัพ, รับโอนจากสาขา, ของตีกลับ, ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า' },
      { key: 'note', label: 'หมายเหตุ', required: false, type: 'text', aliases: ['หมายเหตุ', 'note', 'remark', 'รายละเอียด'], example: 'ใบสั่งซื้อ PO-001' },
    ],
    preValidate: (mapped, ctx) => {
      const errors: string[] = [];
      if (!matchProductBySkuOrBarcode(mapped.sku, ctx)) errors.push(`ไม่พบสินค้า SKU: ${mapped.sku}`);
      return errors;
    },
    upsertRow: async (mapped, { fileName }) => {
      const productId = await findProductBySkuOrBarcode(mapped.sku);
      if (!productId) return { success: false, error: `ไม่พบสินค้า SKU: ${mapped.sku}` };

      const branchId = _movementCtx.branchId;
      if (!branchId) return { success: false, error: 'ไม่ได้ระบุสาขา' };

      const qty = Number(mapped.quantity) || 0;
      const cost = Number(mapped.cost_price) || 0;
      const lotLabel = (mapped.lot_label?.toLowerCase().includes('new') || mapped.lot_label === 'ใหม่') ? 'new' : 'old';
      const typeConfig = mapped.type_config || 'ซื้อเข้าจากซัพ';

      const { data: existingLot } = await supabase.from('stock_lots')
        .select('id, quantity').eq('product_id', productId).eq('branch_id', branchId).eq('lot_label', lotLabel).maybeSingle();

      if (existingLot) {
        const newQty = Number(existingLot.quantity) + qty;
        const lotUpdate: { quantity: number; cost_price?: number } = { quantity: newQty };
        if (cost > 0) lotUpdate.cost_price = cost;
        await supabase.from('stock_lots').update(lotUpdate).eq('id', existingLot.id);
      } else {
        await supabase.from('stock_lots').insert({
          product_id: productId, branch_id: branchId, lot_label: lotLabel,
          quantity: qty, cost_price: cost,
        });
      }

      const receivePayload: Record<string, any> = {
        product_id: productId, branch_id: branchId, movement_type: 'receive',
        type_config: typeConfig, quantity: qty, unit_price: cost,
        discount_amount: 0, discount_percent: 0,
        reference_note: mapped.note || `นำเข้าจาก Excel: ${fileName}`,
        profile_id: _movementCtx.profileId ?? null,
      };
      if (mapped.receive_date) {
        receivePayload.created_at = mapped.receive_date;
      }
      const { error: moveErr } = await supabase.from('stock_movements').insert(receivePayload);
      return { success: !moveErr, error: moveErr?.message };
    },
  },

  stockWithdraw: {
    moduleLabel: 'เบิกสินค้า',
    sheetName: 'เบิกสินค้า',
    templateFilename: 'template-import-withdraw.xlsx',
    templateExtraSheets: [{ name: 'ตัวเลือกประเภท', rows: [
      { 'ประเภทการเบิกออก': 'ขายไลน์แอด', 'กลุ่ม': 'ขายราคาปกติ' },
      { 'ประเภทการเบิกออก': 'Tiktok', 'กลุ่ม': 'ขายออนไลน์' },
      { 'ประเภทการเบิกออก': 'Lazada', 'กลุ่ม': 'ขายออนไลน์' },
      { 'ประเภทการเบิกออก': 'Shopee', 'กลุ่ม': 'ขายออนไลน์' },
      { 'ประเภทการเบิกออก': 'ส่งด่วน_SPX', 'กลุ่ม': 'ขายออนไลน์' },
      { 'ประเภทการเบิกออก': 'ส่งด่วน_FOOD', 'กลุ่ม': 'ขายออนไลน์' },
      { 'ประเภทการเบิกออก': 'ขายบัดดี้รอวางบิล', 'กลุ่ม': 'ขายรอวางบิล' },
      { 'ประเภทการเบิกออก': 'ขายNikeรอวางบิล', 'กลุ่ม': 'ขายรอวางบิล' },
      { 'ประเภทการเบิกออก': 'โอนไปสาขาอื่น', 'กลุ่ม': 'ขายราคาทุน' },
      { 'ประเภทการเบิกออก': 'รพส.ลาดพร้าว', 'กลุ่ม': 'ขายราคาทุน' },
      { 'ประเภทการเบิกออก': 'ขายพม่า', 'กลุ่ม': 'ขายราคาทุน' },
      { 'ประเภทการเบิกออก': 'หมอปรมะ', 'กลุ่ม': 'ขายราคาทุน' },
      { 'ประเภทการเบิกออก': 'รพส.ศรีวรา', 'กลุ่ม': 'ขายราคาทุน' },
      { 'ประเภทการเบิกออก': 'ปรับสต๊อก', 'กลุ่ม': 'ไม่มีมูลค่า (ไม่นับยอดขาย)' },
      { 'ประเภทการเบิกออก': 'ส่งเคลม', 'กลุ่ม': 'ไม่มีมูลค่า (ไม่นับยอดขาย)' },
      { 'ประเภทการเบิกออก': 'เติมหน้าร้าน', 'กลุ่ม': 'ไม่มีมูลค่า (ไม่นับยอดขาย)' },
      { 'ประเภทการเบิกออก': 'ออกบู๊ท', 'กลุ่ม': 'ไม่มีมูลค่า (ไม่นับยอดขาย)' },
      { 'ประเภทการเบิกออก': 'ของแถม', 'กลุ่ม': 'ไม่มีมูลค่า (ไม่นับยอดขาย)' },
    ] }],
    fields: [
      { key: 'sku', label: 'SKU', required: true, type: 'text', aliases: ['SKU', 'sku', 'รหัสสินค้า', 'รหัส'], example: 'CAT-001' },
      { key: 'quantity', label: 'จำนวนที่เบิก', required: true, type: 'number', aliases: ['จำนวนที่เบิก', 'จำนวน', 'quantity', 'qty'], example: '10' },
      { key: 'withdraw_date', label: 'วันที่เบิก', required: true, type: 'date', aliases: ['วันที่เบิก', 'วันที่', 'withdraw_date', 'date'], example: '2026-08-07' },
      { key: 'type_config', label: 'ประเภท/ช่องทาง', required: false, type: 'text', aliases: ['เหตุผล', 'ปลายทาง', 'type_config', 'ประเภท', 'ช่องทาง'], example: 'ขายไลน์แอด', hint: 'ตัวเลือก: ขายไลน์แอด, Tiktok, Lazada, Shopee, ส่งด่วน_SPX, ส่งด่วน_FOOD, ขายบัดดี้รอวางบิล, ขายNikeรอวางบิล, โอนไปสาขาอื่น, รพส.ลาดพร้าว, ขายพม่า, หมอปรมะ, รพส.ศรีวรา, ปรับสต๊อก, ส่งเคลม, เติมหน้าร้าน, ออกบู๊ท, ของแถม' },
      { key: 'unit_price', label: 'ราคา/หน่วย', required: false, type: 'number', aliases: ['ราคา', 'ราคา/หน่วย', 'unit_price', 'ราคาขาย'], example: '120' },
      { key: 'discount', label: 'ส่วนลด', required: false, type: 'number', aliases: ['ส่วนลด', 'discount', 'ส่วนลดลูกค้า'], example: '0' },
      { key: 'note', label: 'หมายเหตุ', required: false, type: 'text', aliases: ['หมายเหตุ', 'note', 'remark', 'รายละเอียด'], example: 'ออเดอร์ #1234' },
    ],
    preValidate: (mapped, ctx) => {
      const errors: string[] = [];
      if (!matchProductBySkuOrBarcode(mapped.sku, ctx)) errors.push(`ไม่พบสินค้า SKU: ${mapped.sku}`);
      return errors;
    },
    upsertRow: async (mapped, { fileName }) => {
      const productId = await findProductBySkuOrBarcode(mapped.sku);
      if (!productId) return { success: false, error: `ไม่พบสินค้า SKU: ${mapped.sku}` };

      const branchId = _movementCtx.branchId;
      if (!branchId) return { success: false, error: 'ไม่ได้ระบุสาขา' };

      const qty = Number(mapped.quantity) || 0;
      const unitPrice = Number(mapped.unit_price) || 0;
      const discount = Number(mapped.discount) || 0;
      const typeConfig = mapped.type_config || 'ขายไลน์แอด';

      const { data: lot } = await supabase.from('stock_lots')
        .select('id, quantity').eq('product_id', productId).eq('branch_id', branchId)
        .order('created_at').limit(1).maybeSingle();
      if (lot) {
        const newQty = Math.max(0, Number(lot.quantity) - qty);
        await supabase.from('stock_lots').update({ quantity: newQty }).eq('id', lot.id);
      }

      const insertPayload: Record<string, any> = {
        product_id: productId, branch_id: branchId, movement_type: 'withdraw',
        type_config: typeConfig, quantity: qty, unit_price: unitPrice,
        discount_amount: discount, discount_percent: 0,
        reference_note: mapped.note || `นำเข้าจาก Excel: ${fileName}`,
        profile_id: _movementCtx.profileId ?? null,
      };
      if (mapped.withdraw_date) {
        insertPayload.created_at = mapped.withdraw_date;
      }

      const { error: moveErr } = await supabase.from('stock_movements').insert(insertPayload);
      return { success: !moveErr, error: moveErr?.message };
    },
  },

  marketing: {
    moduleLabel: 'การตลาด',
    sheetName: 'การตลาด',
    templateFilename: 'template-import-marketing.xlsx',
    fields: [
      { key: 'name', label: 'ชื่อแคมเปญ', required: true, type: 'text', aliases: ['ชื่อแคมเปญ', 'name', 'Campaign'], example: 'แคมเปญปีใหม่' },
      { key: 'platform', label: 'แพลตฟอร์ม', required: false, type: 'text', aliases: ['แพลตฟอร์ม', 'platform', 'Platform'], example: 'TikTok' },
      { key: 'budget', label: 'งบประมาณ', required: false, type: 'number', aliases: ['งบประมาณ', 'budget', 'Budget'], example: '10000' },
      { key: 'actual_spend', label: 'ใช้จ่ายจริง', required: false, type: 'number', aliases: ['ใช้จ่ายจริง', 'actual_spend', 'Spend'], example: '8500' },
      { key: 'sales_generated', label: 'ยอดขายที่เกิดขึ้น', required: false, type: 'number', aliases: ['ยอดขายที่เกิดขึ้น', 'sales_generated', 'Sales'], example: '25000' },
      { key: 'start_date', label: 'วันเริ่ม', required: false, type: 'date', aliases: ['วันเริ่ม', 'start_date', 'Start'], example: '2026-01-01' },
      { key: 'end_date', label: 'วันจบ', required: false, type: 'date', aliases: ['วันจบ', 'end_date', 'End'], example: '2026-01-31' },
    ],
    duplicateCheck: { table: 'campaigns', column: 'name' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const payload = {
        name: mapped.name,
        platform: mapped.platform || null,
        budget: Number(mapped.budget) || 0,
        actual_spend: Number(mapped.actual_spend) || 0,
        sales_generated: Number(mapped.sales_generated) || 0,
        start_date: mapped.start_date || null,
        end_date: mapped.end_date || null,
        status: 'active',
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('campaigns').update(payload).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { error } = await supabase.from('campaigns').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  sales: {
    moduleLabel: 'ยอดขาย',
    sheetName: 'ยอดขาย',
    templateFilename: 'template-import-sales.xlsx',
    fields: [
      { key: 'branch_name', label: 'สาขา', required: true, type: 'text', aliases: ['สาขา', 'branch', 'Branch', 'ชื่อสาขา'], example: 'สาขากรุงเทพ' },
      { key: 'record_date', label: 'วันที่', required: true, type: 'date', aliases: ['วันที่', 'record_date', 'date', 'Date'], example: '2026-08-08' },
      { key: 'total_amount', label: 'ยอดรวม', required: true, type: 'number', aliases: ['ยอดรวม', 'total_amount', 'Total'], example: '15000' },
      { key: 'bill_count', label: 'จำนวนบิล', required: false, type: 'number', aliases: ['จำนวนบิล', 'bill_count', 'Bills'], example: '25' },
      { key: 'channel_front', label: 'หน้าร้าน', required: false, type: 'number', aliases: ['หน้าร้าน', 'channel_front', 'Front'], example: '8000' },
      { key: 'channel_line_branch', label: 'LINE สาขา', required: false, type: 'number', aliases: ['LINE สาขา', 'channel_line_branch'], example: '4000' },
      { key: 'channel_line_oa', label: 'LINE OA', required: false, type: 'number', aliases: ['LINE OA', 'channel_line_oa'], example: '3000' },
      { key: 'target_amount', label: 'เป้าหมาย', required: false, type: 'number', aliases: ['เป้าหมาย', 'target_amount', 'Target'], example: '20000' },
    ],
    duplicateCheck: { table: 'sales_records', column: 'record_date' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const { data: branch } = await supabase.from('branches').select('id').ilike('name', `%${mapped.branch_name.trim()}%`).maybeSingle();
      if (!branch) return { success: false, error: `ไม่พบสาขา: ${mapped.branch_name}` };
      const payload = {
        branch_id: branch.id,
        record_date: mapped.record_date,
        total_amount: Number(mapped.total_amount) || 0,
        bill_count: Number(mapped.bill_count) || 0,
        channel_front: Number(mapped.channel_front) || 0,
        channel_line_branch: Number(mapped.channel_line_branch) || 0,
        channel_line_oa: Number(mapped.channel_line_oa) || 0,
        target_amount: Number(mapped.target_amount) || 0,
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('sales_records').update(payload).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { error } = await supabase.from('sales_records').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  purchasing: {
    moduleLabel: 'จัดซื้อ',
    sheetName: 'จัดซื้อ',
    templateFilename: 'template-import-purchasing.xlsx',
    fields: [
      { key: 'supplier_name', label: 'ซัพพลายเออร์', required: true, type: 'text', aliases: ['ซัพพลายเออร์', 'supplier_name', 'Supplier'], example: 'บริษัท ABC' },
      { key: 'branch_name', label: 'สาขา', required: false, type: 'text', aliases: ['สาขา', 'branch', 'Branch'], example: 'สาขากรุงเทพ' },
      { key: 'total_amount', label: 'ยอดรวม', required: false, type: 'number', aliases: ['ยอดรวม', 'total_amount', 'Total'], example: '5000' },
      { key: 'status', label: 'สถานะ', required: false, type: 'text', aliases: ['สถานะ', 'status', 'Status'], example: 'pending' },
      { key: 'created_at', label: 'วันที่ขอ', required: false, type: 'date', aliases: ['วันที่ขอ', 'created_at', 'Date'], example: '2026-08-08' },
    ],
    upsertRow: async (mapped) => {
      let branchId: string | null = null;
      if (mapped.branch_name) {
        const { data: branch } = await supabase.from('branches').select('id').ilike('name', `%${mapped.branch_name.trim()}%`).maybeSingle();
        branchId = branch?.id ?? null;
      }
      const payload = {
        supplier_name: mapped.supplier_name,
        branch_id: branchId,
        total_amount: Number(mapped.total_amount) || 0,
        status: mapped.status || 'pending',
        items: [],
      };
      const { error } = await supabase.from('purchase_requests').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  attendance: {
    moduleLabel: 'เวลาเข้างาน',
    sheetName: 'เวลาเข้างาน',
    templateFilename: 'template-import-attendance.xlsx',
    fields: [
      { key: 'employee_name', label: 'พนักงาน', required: true, type: 'text', aliases: ['พนักงาน', 'employee', 'Employee', 'ชื่อ'], example: 'สมชาย ใจดี' },
      { key: 'date', label: 'วันที่', required: true, type: 'date', aliases: ['วันที่', 'date', 'Date'], example: '2026-08-08' },
      { key: 'check_in', label: 'เข้างาน', required: false, type: 'text', aliases: ['เข้างาน', 'check_in', 'Check In'], example: '09:00' },
      { key: 'check_out', label: 'ออกงาน', required: false, type: 'text', aliases: ['ออกงาน', 'check_out', 'Check Out'], example: '18:00' },
      { key: 'work_hours', label: 'ชั่วโมง', required: false, type: 'number', aliases: ['ชั่วโมง', 'work_hours', 'Hours'], example: '9' },
      { key: 'branch_name', label: 'สาขา', required: false, type: 'text', aliases: ['สาขา', 'branch', 'Branch'], example: 'สาขากรุงเทพ' },
      { key: 'status', label: 'สถานะ', required: false, type: 'text', aliases: ['สถานะ', 'status', 'Status'], example: 'present' },
    ],
    upsertRow: async (mapped) => {
      const { data: profile } = await supabase.from('profiles').select('id').ilike('display_name', mapped.employee_name).maybeSingle();
      if (!profile) return { success: false, error: `ไม่พบพนักงาน: ${mapped.employee_name}` };
      let branchId: string | null = null;
      if (mapped.branch_name) {
        const { data: branch } = await supabase.from('branches').select('id').ilike('name', `%${mapped.branch_name.trim()}%`).maybeSingle();
        branchId = branch?.id ?? null;
      }
      const statusMap: Record<string, string> = { 'มา': 'present', 'สาย': 'late', 'ขาด': 'absent', 'ลา': 'leave' };
      const payload = {
        profile_id: profile.id,
        branch_id: branchId,
        date: mapped.date,
        check_in_time: mapped.check_in || null,
        check_out_time: mapped.check_out || null,
        work_hours: Number(mapped.work_hours) || null,
        status: statusMap[mapped.status] || mapped.status || 'present',
      };
      const { error } = await supabase.from('attendance').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  salary: {
    moduleLabel: 'เงินเดือน',
    sheetName: 'เงินเดือน',
    templateFilename: 'template-import-salary.xlsx',
    fields: [
      { key: 'employee_name', label: 'พนักงาน', required: true, type: 'text', aliases: ['พนักงาน', 'employee', 'Employee', 'ชื่อ'], example: 'สมชาย ใจดี' },
      { key: 'period_month', label: 'งวด', required: true, type: 'text', aliases: ['งวด', 'period_month', 'Period', 'เดือน'], example: '2026-08' },
      { key: 'work_hours', label: 'ชั่วโมง', required: false, type: 'number', aliases: ['ชั่วโมง', 'work_hours', 'Hours'], example: '180' },
      { key: 'total_pay', label: 'ยอดจ่ายสุทธิ', required: true, type: 'number', aliases: ['ยอดจ่ายสุทธิ', 'total_pay', 'Total Pay'], example: '15000' },
    ],
    duplicateCheck: { table: 'salary_records', column: 'period_month' },
    upsertRow: async (mapped, { isUpdate, existingId }) => {
      const { data: profile } = await supabase.from('profiles').select('id').ilike('display_name', mapped.employee_name).maybeSingle();
      if (!profile) return { success: false, error: `ไม่พบพนักงาน: ${mapped.employee_name}` };
      const payload = {
        profile_id: profile.id,
        period_month: mapped.period_month,
        total_pay: Number(mapped.total_pay) || 0,
        computed_payload: { work_hours: Number(mapped.work_hours) || 0 },
      };
      if (isUpdate && existingId) {
        const { error } = await supabase.from('salary_records').update(payload).eq('id', existingId);
        return { success: !error, error: error?.message };
      }
      const { error } = await supabase.from('salary_records').insert(payload);
      return { success: !error, error: error?.message };
    },
  },

  movementHistory: {
    moduleLabel: 'ประวัติรายการ',
    sheetName: 'ประวัติรายการ',
    templateFilename: 'template-import-movement-history.xlsx',
    fields: [
      { key: 'movement_type', label: 'ประเภทรายการ', required: true, type: 'text', aliases: ['ประเภทรายการ', 'ประเภท', 'movement_type', 'type'], example: 'รับเข้า' },
      { key: 'branch_name', label: 'สาขา', required: true, type: 'text', aliases: ['สาขา', 'ชื่อสาขา', 'branch', 'Branch', 'branch_name'], example: 'กม.9' },
      { key: 'sku', label: 'รหัสสินค้า/SKU', required: true, type: 'text', aliases: ['รหัสสินค้า', 'SKU', 'sku', 'รหัส', 'บาร์โค้ด', 'barcode'], example: 'CAT-001' },
      { key: 'product_name', label: 'ชื่อสินค้า', required: false, type: 'text', aliases: ['ชื่อสินค้า', 'product_name', 'name', 'ชื่อ'], example: 'อาหารแมว 1กก.' },
      { key: 'quantity', label: 'จำนวน', required: true, type: 'number', aliases: ['จำนวน', 'quantity', 'qty', 'จำนวนสินค้า'], example: '50' },
      { key: 'movement_date', label: 'วันที่', required: true, type: 'date', aliases: ['วันที่', 'movement_date', 'date', 'วันที่ทำรายการ', 'created_at'], example: '2026-08-13' },
      { key: 'note', label: 'หมายเหตุ/เหตุผล', required: false, type: 'text', aliases: ['หมายเหตุ', 'เหตุผล', 'note', 'remark', 'รายละเอียด'], example: 'นำเข้าจาก Excel' },
    ],
    preValidate: (mapped, ctx) => {
      const errors: string[] = [];
      if (!matchProductBySkuOrBarcode(mapped.sku, ctx)) errors.push(`ไม่พบสินค้า SKU: ${mapped.sku}`);
      if (!matchBranch(mapped.branch_name, ctx)) errors.push(`ไม่พบสาขา: ${mapped.branch_name}`);
      const rawType = (mapped.movement_type || '').trim();
      if (!VALID_MOVEMENT_TYPES.includes(rawType) && !VALID_MOVEMENT_TYPES.includes(rawType.toLowerCase())) {
        errors.push(`ประเภทไม่ถูกต้อง: ${rawType} (ใช้: รับเข้า, เบิกออก, รับโอน, โอนออก, ปรับปรุง)`);
      }
      return errors;
    },
    upsertRow: async (mapped, { fileName }) => {
      const productId = await findProductBySkuOrBarcode(mapped.sku);
      if (!productId) return { success: false, error: `ไม่พบสินค้า SKU: ${mapped.sku}` };

      const { data: branch } = await supabase.from('branches').select('id').ilike('name', `%${mapped.branch_name.trim()}%`).maybeSingle();
      if (!branch) return { success: false, error: `ไม่พบสาขา: ${mapped.branch_name}` };

      const rawType = (mapped.movement_type || '').trim();
      const typeMap: Record<string, string> = {
        'รับเข้า': 'receive', 'receive': 'receive',
        'เบิกออก': 'withdraw', 'withdraw': 'withdraw',
        'รับโอน': 'transfer_in', 'transfer_in': 'transfer_in',
        'โอนออก': 'transfer_out', 'transfer_out': 'transfer_out',
        'ปรับปรุง': 'adjust', 'adjust': 'adjust',
      };
      const movementType = typeMap[rawType] ?? typeMap[rawType.toLowerCase()] ?? null;
      if (!movementType) {
        return { success: false, error: `ประเภทไม่ถูกต้อง: ${rawType} (ใช้: รับเข้า, เบิกออก, รับโอน, โอนออก, ปรับปรุง)` };
      }

      const insertPayload: Record<string, any> = {
        product_id: productId,
        branch_id: branch.id,
        movement_type: movementType,
        type_config: null,
        quantity: Number(mapped.quantity) || 0,
        unit_price: 0,
        discount_amount: 0,
        discount_percent: 0,
        reference_note: mapped.note || `นำเข้าจาก Excel: ${fileName}`,
        profile_id: _movementCtx.profileId ?? null,
      };
      if (mapped.movement_date) {
        insertPayload.created_at = mapped.movement_date;
      }

      const { error } = await supabase.from('stock_movements').insert(insertPayload);
      return { success: !error, error: error?.message };
    },
  },
};

export const IMPORT_LABELS: Record<ImportableModule, string> = {
  products: 'สินค้า',
  stock: 'สต๊อก',
  stockReceive: 'รับสินค้า',
  stockWithdraw: 'เบิกสินค้า',
  users: 'ผู้ใช้',
  branches: 'สาขา',
  customers: 'ลูกค้า',
  marketing: 'การตลาด',
  sales: 'ยอดขาย',
  purchasing: 'จัดซื้อ',
  attendance: 'เวลาเข้างาน',
  salary: 'เงินเดือน',
  movementHistory: 'ประวัติรายการ',
};
