/*
# Add unit column to products + RLS on product_barcodes

1. Purpose
- products.unit stores the base unit (e.g. "ชิ้น") for unit conversion
- product_barcodes needs RLS policies so the anon-key client can read/write barcodes

2. Security
- product_barcodes is internal tool data (shared), so anon+authenticated get full CRUD
*/

-- Add unit column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'ชิ้น';

-- ============ product_barcodes RLS ============
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_barcodes" ON product_barcodes;
DROP POLICY IF EXISTS "insert_product_barcodes" ON product_barcodes;
DROP POLICY IF EXISTS "update_product_barcodes" ON product_barcodes;
DROP POLICY IF EXISTS "delete_product_barcodes" ON product_barcodes;

CREATE POLICY "select_product_barcodes" ON product_barcodes FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_product_barcodes" ON product_barcodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_product_barcodes" ON product_barcodes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_product_barcodes" ON product_barcodes FOR DELETE
  TO anon, authenticated USING (true);
