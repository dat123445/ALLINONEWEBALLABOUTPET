/*
# Product Edit Modal — schema additions

1. Purpose
Support the "แก้ไขสินค้า" modal on the product detail page:
- Multiple product images (up to 9) instead of a single image_url
- English name field for auto-translate
- Per-unit pricing, barcode/SKU, stock quantity, and "available" toggle per unit row

2. New Tables
- `product_images` — stores multiple image URLs per product with a sort order.
  Columns: id, product_id (FK products CASCADE), image_url, sort_order, created_at.

3. Modified Tables
- `products` — add `name_en` (text, nullable) for the optional English/auto-translated name.
- `product_barcodes` — add `price` (numeric, default 0) for per-unit selling price,
  `stock_qty` (numeric, default 0) for per-unit stock quantity, and
  `is_available` (boolean, default true) for the "มีจำหน่ย" toggle.

4. Security
- `product_images`: RLS enabled, full CRUD for anon + authenticated (internal tool data, shared).
- `product_barcodes`: existing anon+authenticated CRUD policies already cover the new columns.
- `products`: existing policies already cover the new `name_en` column.

5. Notes
- All additions are additive (IF NOT EXISTS) — safe to re-run.
- No data is lost; existing image_url on products remains as the primary thumbnail.
*/

-- ============ product_images ============
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_images" ON product_images;
CREATE POLICY "select_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_product_images" ON product_images;
CREATE POLICY "insert_product_images" ON product_images FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_product_images" ON product_images;
CREATE POLICY "update_product_images" ON product_images FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_product_images" ON product_images;
CREATE POLICY "delete_product_images" ON product_images FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

-- ============ products: add name_en ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name_en') THEN
    ALTER TABLE products ADD COLUMN name_en text;
  END IF;
END $$;

-- ============ product_barcodes: add price, stock_qty, is_available ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'price') THEN
    ALTER TABLE product_barcodes ADD COLUMN price numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'stock_qty') THEN
    ALTER TABLE product_barcodes ADD COLUMN stock_qty numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'is_available') THEN
    ALTER TABLE product_barcodes ADD COLUMN is_available boolean DEFAULT true;
  END IF;
END $$;
