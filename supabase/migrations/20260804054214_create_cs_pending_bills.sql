/*
# Create cs_pending_bills table

1. Purpose
- Track credit sales that are pending billing (ขายบัดดี้รอวางบิล, ขายNikeรอวางบิล)
- When stock is withdrawn with these types, a pending bill record is created
- CS team can then track and mark them as billed

2. Tables affected
- CREATE TABLE `cs_pending_bills` (new)
- ENABLE RLS + 4 CRUD policies for authenticated

3. Security
- RLS enabled, authenticated-only CRUD
- No sensitive columns beyond normal business data

4. Notes
- Links to stock_movements via movement_id (nullable, SET NULL on delete)
- Links to products and branches
- status: 'pending' -> 'billed' -> 'paid'
*/

CREATE TABLE IF NOT EXISTS cs_pending_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid REFERENCES stock_movements(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  bill_type text NOT NULL DEFAULT 'buddy',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  customer_name text,
  status text NOT NULL DEFAULT 'pending',
  billed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cs_pending_bills_status_check CHECK (status IN ('pending', 'billed', 'paid')),
  CONSTRAINT cs_pending_bills_bill_type_check CHECK (bill_type IN ('buddy', 'nike'))
);

ALTER TABLE cs_pending_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cs_pending_bills" ON cs_pending_bills FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_cs_pending_bills" ON cs_pending_bills FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_cs_pending_bills" ON cs_pending_bills FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cs_pending_bills" ON cs_pending_bills FOR DELETE
  TO authenticated USING (true);
