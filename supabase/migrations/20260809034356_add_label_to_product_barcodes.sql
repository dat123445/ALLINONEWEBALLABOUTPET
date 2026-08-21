/*
# Add label column to product_barcodes (variant display name)

1. Modified Tables
- `product_barcodes`: add `label` (text, nullable) — a free-text display name for each
  sub-unit/variant, e.g. "Shampoo Cat 300ml", "Shampoo Dog 500ml".
  This is distinct from `unit` (piece/dozen/carton) which is the unit-of-measure type.

2. Security
- No policy changes. Existing anon+authenticated CRUD policies cover the new column.

3. Notes
- Nullable so existing rows are unaffected.
- The frontend variant editor will use this as the primary identifier for each row.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_barcodes' AND column_name = 'label') THEN
    ALTER TABLE product_barcodes ADD COLUMN label text;
  END IF;
END $$;