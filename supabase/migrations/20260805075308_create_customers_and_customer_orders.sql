/*
# Create customers and customer_orders tables

1. New Tables
- `customers`
  - `id` (uuid, primary key)
  - `name` (text, not null) — ชื่อลูกค้า
  - `phone` (text, not null) — เบอร์โทร
  - `note` (text, nullable) — หมายเหตุ
  - `total_spent` (numeric, default 0) — ยอดซื้อสะสม (maintained by trigger)
  - `order_count` (integer, default 0) — จำนวนครั้งสั่งซื้อ (maintained by trigger)
  - `last_order_at` (timestamptz, nullable) — วันที่สั่งซื้อล่าสุด
  - `created_at` (timestamptz, default now())
- `customer_orders`
  - `id` (uuid, primary key)
  - `customer_id` (uuid, FK to customers, not null)
  - `online_order_id` (uuid, FK to online_orders, nullable) — link to online_orders row if created via ยิงออก
  - `channel` (text, default 'line') — ช่องทาง เช่น 'line' (ไลน์แอด)
  - `items` (jsonb, not null) — array of {product_id, product_name, sku, quantity, unit, unit_price, discount_amount, discount_percent}
  - `subtotal` (numeric, not null) — ยอดก่อนส่วนลด
  - `discount_amount` (numeric, default 0) — ส่วนลดทั้งบิล (บาท)
  - `discount_percent` (numeric, default 0) — ส่วนลดทั้งบิล (%)
  - `total` (numeric, not null) — ยอดรวมสุทธิหลังหักส่วนลด
  - `note` (text, nullable)
  - `created_at` (timestamptz, default now())

2. Indexes
- `customers_phone_idx` on customers(phone)
- `customers_name_idx` on customers(name)
- `customer_orders_customer_id_idx` on customer_orders(customer_id)
- `customer_orders_online_order_id_idx` on customer_orders(online_order_id)

3. Triggers
- `update_customer_stats_trigger` — AFTER INSERT on customer_orders: increments total_spent, order_count, sets last_order_at

4. Security
- Enable RLS on both tables
- Allow anon + authenticated CRUD (single-tenant app, no sign-in screen required for this data)
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  note text,
  total_spent numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);

CREATE TABLE IF NOT EXISTS customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  online_order_id uuid REFERENCES online_orders(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'line',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_orders_customer_id_idx ON customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS customer_orders_online_order_id_idx ON customer_orders(online_order_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_customer_orders" ON customer_orders;
CREATE POLICY "anon_select_customer_orders" ON customer_orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customer_orders" ON customer_orders;
CREATE POLICY "anon_insert_customer_orders" ON customer_orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customer_orders" ON customer_orders;
CREATE POLICY "anon_update_customer_orders" ON customer_orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customer_orders" ON customer_orders;
CREATE POLICY "anon_delete_customer_orders" ON customer_orders FOR DELETE
  TO anon, authenticated USING (true);

-- Trigger to update customer stats after each customer_orders insert
CREATE OR REPLACE FUNCTION update_customer_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET
    total_spent = total_spent + NEW.total,
    order_count = order_count + 1,
    last_order_at = NEW.created_at
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_stats_trigger ON customer_orders;
CREATE TRIGGER update_customer_stats_trigger
  AFTER INSERT ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();
