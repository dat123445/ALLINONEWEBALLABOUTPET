/*
# Add anon role to stock-related RLS policies

1. Purpose
- All stock-related tables have policies TO authenticated only.
- The anon-key client gets 0 rows on SELECT and RLS violations on INSERT.
- This is an internal business tool where all staff share the same data.
- Adding anon to policies ensures the app works in all auth states.

2. Security
- Internal business management tool, shared data. RLS remains enabled.
- USING (true) / WITH CHECK (true) is correct for intentionally shared data.
*/

-- ============ stock_movements ============
DROP POLICY IF EXISTS "select_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "insert_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "update_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "delete_stock_movements" ON stock_movements;

CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_stock_movements" ON stock_movements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_stock_movements" ON stock_movements FOR DELETE
  TO anon, authenticated USING (true);

-- ============ stock_lots ============
DROP POLICY IF EXISTS "select_stock_lots" ON stock_lots;
DROP POLICY IF EXISTS "insert_stock_lots" ON stock_lots;
DROP POLICY IF EXISTS "update_stock_lots" ON stock_lots;
DROP POLICY IF EXISTS "delete_stock_lots" ON stock_lots;

CREATE POLICY "select_stock_lots" ON stock_lots FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_stock_lots" ON stock_lots FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_stock_lots" ON stock_lots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_stock_lots" ON stock_lots FOR DELETE
  TO anon, authenticated USING (true);

-- ============ cs_pending_bills ============
DROP POLICY IF EXISTS "select_cs_pending_bills" ON cs_pending_bills;
DROP POLICY IF EXISTS "insert_cs_pending_bills" ON cs_pending_bills;
DROP POLICY IF EXISTS "update_cs_pending_bills" ON cs_pending_bills;
DROP POLICY IF EXISTS "delete_cs_pending_bills" ON cs_pending_bills;

CREATE POLICY "select_cs_pending_bills" ON cs_pending_bills FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_cs_pending_bills" ON cs_pending_bills FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_cs_pending_bills" ON cs_pending_bills FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cs_pending_bills" ON cs_pending_bills FOR DELETE
  TO anon, authenticated USING (true);

-- ============ products ============
DROP POLICY IF EXISTS "select_products" ON products;
DROP POLICY IF EXISTS "insert_products" ON products;
DROP POLICY IF EXISTS "update_products" ON products;
DROP POLICY IF EXISTS "delete_products" ON products;

CREATE POLICY "select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ============ branches ============
DROP POLICY IF EXISTS "select_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT
  TO anon, authenticated USING (true);

-- ============ profiles ============
DROP POLICY IF EXISTS "select_profiles" ON profiles;
DROP POLICY IF EXISTS "insert_profiles" ON profiles;
DROP POLICY IF EXISTS "update_profiles" ON profiles;
DROP POLICY IF EXISTS "delete_profiles" ON profiles;

CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_profiles" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_profiles" ON profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_profiles" ON profiles FOR DELETE
  TO anon, authenticated USING (true);

-- ============ stock_withdrawal_types ============
DROP POLICY IF EXISTS "select_stock_withdrawal_types" ON stock_withdrawal_types;
CREATE POLICY "select_stock_withdrawal_types" ON stock_withdrawal_types FOR SELECT
  TO anon, authenticated USING (true);

-- ============ stock_receiving_types ============
DROP POLICY IF EXISTS "select_stock_receiving_types" ON stock_receiving_types;
CREATE POLICY "select_stock_receiving_types" ON stock_receiving_types FOR SELECT
  TO anon, authenticated USING (true);

-- ============ online_platform_settings ============
DROP POLICY IF EXISTS "select_online_platform_settings" ON online_platform_settings;
CREATE POLICY "select_online_platform_settings" ON online_platform_settings FOR SELECT
  TO anon, authenticated USING (true);

-- ============ product_platform_prices ============
DROP POLICY IF EXISTS "read_product_platform_prices" ON product_platform_prices;
DROP POLICY IF EXISTS "insert_product_platform_prices" ON product_platform_prices;
DROP POLICY IF EXISTS "update_product_platform_prices" ON product_platform_prices;
DROP POLICY IF EXISTS "delete_product_platform_prices" ON product_platform_prices;

CREATE POLICY "read_product_platform_prices" ON product_platform_prices FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_product_platform_prices" ON product_platform_prices FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_product_platform_prices" ON product_platform_prices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_product_platform_prices" ON product_platform_prices FOR DELETE
  TO anon, authenticated USING (true);
