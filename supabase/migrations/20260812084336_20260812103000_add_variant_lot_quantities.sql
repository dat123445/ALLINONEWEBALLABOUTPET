/*
# Add quantity to the shared Parent–Variant lot fields

1. Purpose
- Store the exact stock quantity for the old and new lot beside the matching cost and retail values.
- Keep the importer, preview, and stock table on the same five stock fields: quantity, cost_old, cost_new, retail_old, retail_new.

2. Modified tables
- `variant_lot_prices`
  - `quantity` (numeric, non-negative, default 0): quantity remaining in this lot for the variant.
  - Existing `cost_price` and `retail_price` continue to store the matching lot values.

3. Security
- No RLS policy is changed. The table already has separate anon/authenticated CRUD policies.

4. Data safety
- Existing lot rows remain intact and receive quantity 0 until updated by an import or stock operation.
- No rows or columns are deleted.
*/

ALTER TABLE public.variant_lot_prices
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variant_lot_prices_quantity_non_negative'
  ) THEN
    ALTER TABLE public.variant_lot_prices
      ADD CONSTRAINT variant_lot_prices_quantity_non_negative CHECK (quantity >= 0);
  END IF;
END $$;
