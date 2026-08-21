/*
# Add audit logs for product price/cost edits and online order edits/deletes

1. New Tables
- `product_audit_logs` — logs edits to product cost/price/stock
- `online_order_audit_logs` — logs edits/deletes to online orders

2. Security
- Enable RLS on both tables.
- Allow authenticated users to read and insert audit logs.
*/

CREATE TABLE IF NOT EXISTS product_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id uuid,
  action text NOT NULL,
  field text,
  previous_value jsonb,
  new_value jsonb,
  actor_profile_id uuid,
  actor_name text,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_product_audit_logs" ON product_audit_logs;
CREATE POLICY "read_product_audit_logs" ON product_audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_audit_logs" ON product_audit_logs;
CREATE POLICY "insert_product_audit_logs" ON product_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_product_audit_product_id ON product_audit_logs(product_id);

CREATE TABLE IF NOT EXISTS online_order_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  actor_profile_id uuid,
  actor_name text,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE online_order_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_online_order_audit_logs" ON online_order_audit_logs;
CREATE POLICY "read_online_order_audit_logs" ON online_order_audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_online_order_audit_logs" ON online_order_audit_logs;
CREATE POLICY "insert_online_order_audit_logs" ON online_order_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_online_order_audit_order_id ON online_order_audit_logs(order_id);
