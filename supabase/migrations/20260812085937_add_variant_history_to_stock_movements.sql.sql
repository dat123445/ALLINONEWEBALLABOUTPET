/*
# Add variant-level history to stock movements + FIFO support

## What this does
1. Adds `product_barcode_id` to `stock_movements` so each movement row
   records exactly which variant (product barcode) it affected — enabling
   SKU-level history at the variant level.
2. Adds a `received_date` column to `variant_lot_prices` with a default of
   `now()` so we can order lots by arrival time for FIFO picking. Existing
   rows are backfilled to their `created_at`.
3. Indexes the new columns for efficient filtering.

## Tables / columns
- `stock_movements`
  - NEW `product_barcode_id uuid` (nullable, FK -> product_barcodes ON DELETE SET NULL)
- `variant_lot_prices`
  - NEW `received_date timestamptz NOT NULL DEFAULT now()`
- Indexes
  - `stock_movements_product_barcode_id_idx` on `stock_movements(product_barcode_id)`
  - `variant_lot_prices_received_date_idx` on `variant_lot_prices(product_barcode_id, received_date)`

## Security
- No RLS policy changes. Existing policies on `stock_movements` already
  cover the table; the new nullable column inherits those policies.
  `variant_lot_prices` has no direct RLS (it is read via joins from
  product_barcodes which are already protected).

## Notes
1. `product_barcode_id` is nullable on `stock_movements` so legacy rows
   and product-level (non-variant) movements remain valid.
2. `received_date` is backfilled from `created_at` for existing lot rows
   so FIFO ordering works immediately for current stock.
3. The migration is idempotent: each statement guards with IF NOT EXISTS.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'product_barcode_id'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD COLUMN product_barcode_id uuid REFERENCES public.product_barcodes(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'variant_lot_prices' AND column_name = 'received_date'
  ) THEN
    ALTER TABLE public.variant_lot_prices
      ADD COLUMN received_date timestamptz NOT NULL DEFAULT now();

    UPDATE public.variant_lot_prices
      SET received_date = created_at
      WHERE received_date IS DISTINCT FROM created_at;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stock_movements_product_barcode_id_idx
  ON public.stock_movements(product_barcode_id);

CREATE INDEX IF NOT EXISTS variant_lot_prices_received_date_idx
  ON public.variant_lot_prices(product_barcode_id, received_date);
