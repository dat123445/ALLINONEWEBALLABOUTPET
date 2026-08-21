-- variant_branch_stock also has RLS enabled but ZERO policies — deny-by-default.
-- This would block branch stock updates during import.

CREATE POLICY "select_variant_branch_stock"
  ON variant_branch_stock FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_variant_branch_stock"
  ON variant_branch_stock FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_variant_branch_stock"
  ON variant_branch_stock FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_variant_branch_stock"
  ON variant_branch_stock FOR DELETE
  TO anon, authenticated USING (true);