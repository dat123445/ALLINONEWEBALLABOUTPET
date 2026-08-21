/*
# Add price, stock, is_active columns to product_barcodes (variant-level data)

1. Modified Tables
- `product_barcodes`: add three columns to support per-variant pricing/stock/status:
  - `price` numeric DEFAULT 0 — retail price for this specific variant
  - `stock` numeric DEFAULT 0 — stock quantity for this specific variant
  - `is_active` boolean DEFAULT true — whether this variant is enabled for sale

2. Security
- No policy changes. Existing anon+authenticated CRUD policies cover the new columns.

3. Notes
- All columns have safe defaults so existing rows are unaffected.
- These columns let each sub-unit (e.g. "Shampoo Cat 300ml") have its own price,
  stock, and on/off toggle independently of the main product.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'price') THEN
    ALTER TABLE product_barcodes ADD COLUMN price numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'stock') THEN
    ALTER TABLE product_barcodes ADD COLUMN stock numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'is_active') THEN
    ALTER TABLE product_barcodes ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;