/*
# Add product_barcode_id to stock_lots for per-variant lot costs

## Problem
The stock_lots table stored cost_price at the product level only.
Products with multiple variants (e.g. piece and 300ml) shared the same
old/new lot cost, so switching the lot dropdown showed costs from different
variants instead of the selected variant's own old/new lot costs.

## Changes
1. Add nullable `product_barcode_id uuid` column to `stock_lots`
   - Foreign key to `product_barcodes(id)` with ON DELETE CASCADE
   - Nullable so existing product-level lots remain valid
2. Backfill: for products with exactly one product_barcode, set
   product_barcode_id on their stock_lots to that variant's id
3. Add index on `product_barcode_id` for faster variant-scoped queries

## Security
- No RLS policy changes. Existing policies on stock_lots remain
  (anon + authenticated full CRUD, single-tenant app).

## Notes
1. Existing stock_lots rows for multi-variant products keep
   product_barcode_id = NULL (product-level). New variant-specific
   lots will be created with the correct product_barcode_id.
2. The frontend will query stock_lots filtered by product_barcode_id
   when a variant is selected, falling back to product-level lots
   (product_barcode_id IS NULL) when no variant is selected.
*/

ALTER TABLE stock_lots
  ADD COLUMN IF NOT EXISTS product_barcode_id uuid
  REFERENCES product_barcodes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stock_lots_product_barcode_id
  ON stock_lots(product_barcode_id)
  WHERE product_barcode_id IS NOT NULL;

-- Backfill: for products with exactly one variant, link their lots to it
UPDATE stock_lots sl
SET product_barcode_id = sub.barcode_id
FROM (
  SELECT pb.product_id, pb.id AS barcode_id
  FROM product_barcodes pb
  JOIN (
    SELECT product_id
    FROM product_barcodes
    GROUP BY product_id
    HAVING COUNT(*) = 1
  ) solo ON solo.product_id = pb.product_id
) sub
WHERE sl.product_id = sub.product_id
  AND sl.product_barcode_id IS NULL;
