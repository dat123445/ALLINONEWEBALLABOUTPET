/*
# Update stock type pricing rules to match business spec

1. Changes
- Update withdrawal types: รพส.ลาดพร้าว, ขายพม่า, หมอปรมะ, รพส.ศรีวรา → 'cost' (were 'retail')
- Update withdrawal types: เติมหน้าร้าน, ออกบู๊ธ → 'zero' (were 'cost'/'retail')
- Update ส่งด่วน_SPX → 'online' with platform_link='shopee' (was 'retail')
- Update ส่งด่วน_FOOD → 'online' with platform_link='lazada' (was 'retail')
- Update ออกบู๊ธ name to ออกบู๊ท to match spec
- Update receiving types: ออดิตปรับสต็อก, โอนย้ายจากหน้าร้าน, โอนย้ายจากสาขาอื่น, ของตีกลับ, ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า, กลับจากบูธ, ลูกค้ายกเลิก → 'zero' (were 'cost')
- Remove ซื้อเข้าจากเคยู and ขายหน้าร้าน (not in spec) by deactivating them

2. Security
- No DDL changes, no policy changes. Only UPDATE statements on existing tables.

3. Notes
- All updates are idempotent — re-running is safe.
- The `platform_link` column already exists on stock_withdrawal_types.
*/

-- ============ WITHDRAWAL TYPES ============
UPDATE stock_withdrawal_types SET pricing_rule = 'cost' WHERE name = 'รพส.ลาดพร้าว';
UPDATE stock_withdrawal_types SET pricing_rule = 'cost' WHERE name = 'ขายพม่า';
UPDATE stock_withdrawal_types SET pricing_rule = 'cost' WHERE name = 'หมอปรมะ';
UPDATE stock_withdrawal_types SET pricing_rule = 'cost' WHERE name = 'รพส.ศรีวรา';

UPDATE stock_withdrawal_types SET pricing_rule = 'zero' WHERE name = 'เติมหน้าร้าน';
UPDATE stock_withdrawal_types SET pricing_rule = 'zero' WHERE name = 'ออกบู๊ธ';

UPDATE stock_withdrawal_types SET pricing_rule = 'online', platform_link = 'shopee' WHERE name = 'ส่งด่วน_SPX';
UPDATE stock_withdrawal_types SET pricing_rule = 'online', platform_link = 'lazada' WHERE name = 'ส่งด่วน_FOOD';

-- Rename ออกบู๊ธ → ออกบู๊ท to match spec
UPDATE stock_withdrawal_types SET name = 'ออกบู๊ท' WHERE name = 'ออกบู๊ธ';

-- Deactivate types not in spec
UPDATE stock_withdrawal_types SET is_active = false WHERE name = 'ขายหน้าร้าน';

-- ============ RECEIVING TYPES ============
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'ออดิตปรับสต็อก';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'โอนย้ายจากหน้าร้าน';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'โอนย้ายจากสาขาอื่น';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'ของตีกลับ';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'ลูกค้าหน้าร้านเปลี่ยน/คืนสินค้า';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'กลับจากบูธ';
UPDATE stock_receiving_types SET pricing_rule = 'zero' WHERE name = 'ลูกค้ายกเลิก';

-- Rename กลับจากบูธ → กลับจากบู๊ท to match spec
UPDATE stock_receiving_types SET name = 'กลับจากบู๊ท' WHERE name = 'กลับจากบูธ';

-- Deactivate types not in spec
UPDATE stock_receiving_types SET is_active = false WHERE name = 'ซื้อเข้าจากเคยู';
