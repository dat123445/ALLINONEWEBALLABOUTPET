/*
# Seed stock type catalogs and online platform settings

1. Purpose
- Populate `stock_withdrawal_types` with the 18 withdrawal categories used by the business
  (Tiktok, Shopee, Lazada, express shipping, front-store sales, buddy/Nike credit sales,
  branch transfers, LINE ads, hospital supply, Burmese channel, doctor channels,
  stock adjustments, claims, booth, freebies, etc.)
- Populate `stock_receiving_types` with the 10 receiving categories
  (supplier purchase, buddy purchase, KU purchase, audit adjustment, front-store transfer,
  other-branch transfer, returns, customer exchange/return, booth return, customer cancel, freebies)
- Populate `online_platform_settings` with default margin/fee percentages for
  TikTok, Shopee, Lazada, LINE so the price calculator and withdrawal pricing stay in sync.

2. Tables affected
- `stock_withdrawal_types` — INSERT seed rows (idempotent via ON CONFLICT)
- `stock_receiving_types` — INSERT seed rows (idempotent via ON CONFLICT)
- `online_platform_settings` — INSERT seed rows (idempotent via ON CONFLICT)

3. Security
- No DDL changes. RLS already enabled on all three tables with authenticated CRUD.
- No policy changes needed.

4. Notes
- All inserts use ON CONFLICT (name) DO NOTHING so re-running is safe.
- `sort_order` is set to match the business's preferred display order.
- `pricing_rule` on withdrawal types maps to how the unit price is chosen:
  'retail' = front-store price, 'cost' = cost price, 'online' = pull from online_platform_settings, 'zero' = 0 (freebie).
*/

-- ============ WITHDRAWAL TYPES ============
INSERT INTO stock_withdrawal_types (name, pricing_rule, sort_order) VALUES
  ('Tiktok',            'online',  1),
  ('Shopee',            'online',  2),
  ('Lazada',            'online',  3),
  ('ส่งด่วน_SPX',       'retail',  4),
  ('ส่งด่วน_FOOD',      'retail',  5),
  ('ขายหน้าร้าน',       'retail',  6),
  ('ขายบัดดี้รอวางบิล',  'cost',    7),
  ('ขายNikeรอวางบิล',   'cost',    8),
  ('โอนไปสาขาอื่น',     'cost',    9),
  ('ขายไลน์แอด',        'retail', 10),
  ('รพส.ลาดพร้าว',      'retail', 11),
  ('ขายพม่า',           'retail', 12),
  ('หมอปรมะ',          'retail', 13),
  ('รพส.ศรีวรา',        'retail', 14),
  ('ปรับสต๊อก',         'zero',   15),
  ('ส่งเคลม',           'zero',   16),
  ('เติมหน้าร้าน',      'cost',   17),
  ('ออกบู๊ธ',           'retail', 18),
  ('ของแถม',            'zero',   19)
ON CONFLICT (name) DO NOTHING;

-- ============ RECEIVING TYPES ============
INSERT INTO stock_receiving_types (name, pricing_rule, sort_order) VALUES
  ('ซื้อเข้าจากซัพ',                    'cost',  1),
  ('ซื้อเข้าจากบัดดี้',                  'cost',  2),
  ('ซื้อเข้าจากเคยู',                   'cost',  3),
  ('ออดิตปรับสต็อก',                    'cost',  4),
  ('โอนย้ายจากหน้าร้าน',                'cost',  5),
  ('โอนย้ายจากสาขาอื่น',                'cost',  6),
  ('ของตีกลับ',                         'cost',  7),
  ('ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า',    'cost',  8),
  ('กลับจากบูธ',                        'cost',  9),
  ('ลูกค้ายกเลิก',                      'cost', 10),
  ('ของแถม',                            'zero', 11)
ON CONFLICT (name) DO NOTHING;

-- ============ ONLINE PLATFORM SETTINGS ============
INSERT INTO online_platform_settings (platform, margin_percent, platform_fee_percent, low_cost_margin_percent, is_connected) VALUES
  ('tiktok',  20,  5, 30, true),
  ('shopee',  20,  8, 30, true),
  ('lazada',  20,  7, 30, true),
  ('line',    20,  0, 30, true)
ON CONFLICT (platform) DO NOTHING;
