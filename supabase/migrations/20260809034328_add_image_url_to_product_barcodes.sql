/*
# Add image_url column to product_barcodes (variant images)

1. Modified Tables
- `product_barcodes`: add `image_url` (text, nullable) to store a per-variant product image URL.
  This lets each sub-unit (e.g. "Shampoo Cat 300ml", "Shampoo Dog 500ml") have its own photo,
  independent of the main product image.

2. Security
- No policy changes. Existing anon+authenticated CRUD policies on `product_barcodes`
  already cover the new column (column-level privileges are not restricted).

3. Notes
- Column is nullable so existing variant rows are unaffected.
- The frontend will upload images to the existing `product-images` storage bucket and
  store the public URL in this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'image_url') THEN
    ALTER TABLE product_barcodes ADD COLUMN image_url text;
  END IF;
END $$;