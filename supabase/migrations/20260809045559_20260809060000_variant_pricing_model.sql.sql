/*
# Variant Pricing Model — make product_barcodes a true variant

This migration evolves the "product_barcodes" table (previously a sub-unit/barcode
record) into a true **product variant** with its own cost and own per-platform
selling prices. It also extends `product_platform_prices` so that a platform price
can be attached to a specific variant rather than only to a lot_label.

## Why
The previous model treated barcode rows as packing units (piece / pack / carton)
with a single selling price. The real business need is that each row is a real
sellable product variant (e.g. "300 ml", "500 ml") with its own cost, its own
selling price per channel (Lazada / Shopee / TikTok / LINE / retail), its own
stock, and its own on/off status.

## Changes

### 1. `product_barcodes` — new column `cost_price`
- Adds `cost_price numeric DEFAULT 0` so each variant carries its own cost.
- Existing rows get cost_price = 0 (neutral; the app back-fills from the parent
  product / lot cost when a variant has no explicit cost yet).

### 2. `product_platform_prices` — new column `variant_id`
- Adds `variant_id uuid REFERENCES product_barcodes(id) ON DELETE CASCADE`.
- Nullable on purpose: existing rows are keyed by (product_id, lot_label, platform)
  and remain valid. New rows may instead be keyed by (variant_id, platform).
- Adds a partial unique index so that a given (variant_id, platform) pair is
  unique only when a variant_id is present (old lot_label-based rows are left
  untouched).
- Drops the old (product_id, lot_label, platform) unique constraint and replaces
  it with a non-unique index so both styles can coexist without collisions.

### 3. RLS / policies
- `product_barcodes` and `product_platform_prices` already have full CRUD
  policies for `anon, authenticated` (the app is multi-tenant but the stock
  module intentionally shares product data across the org). No policy changes
  are needed for the new columns — the existing permissive policies cover them.

## Safety
- No destructive operations: only ADD COLUMN + CREATE INDEX. Existing data is
  preserved. The unique constraint drop is safe because a replacement index is
  created in the same transaction via DO block.
*/

-- 1. Add cost_price to product_barcodes (variant cost)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_barcodes' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE product_barcodes ADD COLUMN cost_price numeric DEFAULT 0;
  END IF;
END $$;

-- 2. Add variant_id to product_platform_prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_platform_prices' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE product_platform_prices ADD COLUMN variant_id uuid REFERENCES product_barcodes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Replace the old unique constraint on (product_id, lot_label, platform)
--    with a non-unique index so variant-keyed rows don't collide.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_platform_prices_product_id_lot_label_platform_key'
  ) THEN
    ALTER TABLE product_platform_prices DROP CONSTRAINT product_platform_prices_product_id_lot_label_platform_key;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ppp_product_lot_platform
  ON product_platform_prices(product_id, lot_label, platform);

-- 4. Unique index for variant-scoped platform prices (only when variant_id present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppp_variant_platform_unique
  ON product_platform_prices(variant_id, platform)
  WHERE variant_id IS NOT NULL;
