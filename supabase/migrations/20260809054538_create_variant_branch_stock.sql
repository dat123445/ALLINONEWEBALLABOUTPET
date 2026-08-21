/*
# Per-Branch Variant Stock

## Why
`product_barcodes.stock_qty` is a single number with no branch breakdown.
When a user switches the branch selector, variant stock numbers in the product
table and detail view can't change because there is no per-branch data.

This migration adds a `variant_branch_stock` table so each variant
(product_barcodes row) can have a separate quantity per branch. The existing
`product_barcodes.stock_qty` column remains as a denormalized total / fallback.

## New Tables
- `variant_branch_stock`
  - `id` (uuid, primary key)
  - `variant_id` (uuid, FK → product_barcodes(id) ON DELETE CASCADE)
  - `branch_id` (uuid, FK → branches(id) ON DELETE CASCADE)
  - `quantity` (numeric, default 0)
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on (variant_id, branch_id) so each pair has one row.

## Security
- RLS enabled.
- The app is multi-tenant but product/stock data is intentionally shared across
  the org (same pattern as product_barcodes and stock_lots). Policies use
  `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.

## Notes
1. Existing `product_barcodes.stock_qty` is preserved — it remains the
   aggregate/fallback when no branch rows exist for a variant.
2. The app will read `variant_branch_stock` joined by `variant_id` and filter
   by the selected branch. When no branch-specific row exists, it falls back
   to `product_barcodes.stock_qty`.
*/

CREATE TABLE IF NOT EXISTS variant_branch_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_barcodes(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT variant_branch_stock_variant_branch_unique UNIQUE (variant_id, branch_id)
);

ALTER TABLE variant_branch_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_variant_branch_stock" ON variant_branch_stock;
CREATE POLICY "anon_select_variant_branch_stock"
  ON variant_branch_stock FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_variant_branch_stock" ON variant_branch_stock;
CREATE POLICY "anon_insert_variant_branch_stock"
  ON variant_branch_stock FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_variant_branch_stock" ON variant_branch_stock;
CREATE POLICY "anon_update_variant_branch_stock"
  ON variant_branch_stock FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_variant_branch_stock" ON variant_branch_stock;
CREATE POLICY "anon_delete_variant_branch_stock"
  ON variant_branch_stock FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_variant_branch_stock_variant_id
  ON variant_branch_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_branch_stock_branch_id
  ON variant_branch_stock(branch_id);
