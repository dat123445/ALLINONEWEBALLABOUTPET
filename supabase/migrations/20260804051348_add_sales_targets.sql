-- Sales targets table for daily/monthly target tracking
CREATE TABLE IF NOT EXISTS sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'daily' CHECK (target_type IN ('daily', 'monthly')),
  target_amount numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sales_targets" ON sales_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sales_targets" ON sales_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sales_targets" ON sales_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sales_targets" ON sales_targets FOR DELETE TO authenticated USING (true);