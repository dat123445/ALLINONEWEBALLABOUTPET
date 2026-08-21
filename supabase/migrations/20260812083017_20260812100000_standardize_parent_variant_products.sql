/*
# Standardize the product catalog as Parent–Variant

1. Purpose
- Establish one shared catalog contract for imports, previews, stock lists, and product editing.
- A `products` row represents the Parent product group. A `product_barcodes` row represents one sellable Variant.
- Parent rows do not need a SKU, price, or stock of their own. Variant rows keep their own SKU, name, price, stock, and selling status.

2. Modified tables
- `products`
  - `sku` becomes nullable so a Parent group can exist without a sellable SKU.
  - `parent_ref` stores the stable import reference used to connect a file's Variant rows to its Parent row.
  - `product_role` identifies the row as a catalog Parent. Existing rows remain usable and are treated as Parent groups by the application.
- `product_barcodes`
  - `variant_name` stores the customer-facing Variant name.
  - `parent_ref` stores the import reference copied from the Parent for traceability.
  - Existing `barcode` remains the required sellable Variant SKU.
  - Existing `price`, `cost_price`, `stock_qty`, and `is_available` remain the Variant's own values.

3. Integrity and indexes
- Adds a check that `product_role` is `parent` for catalog Parent rows.
- Adds indexes for Parent references and product/Variant lookups.
- No existing rows, columns, or values are deleted.

4. Security
- No new table is created. Existing RLS policies remain in effect for both modified tables.
- No policy is widened or removed.

5. Important notes
- Legacy products are preserved. The application will display their existing sellable data without inventing random child rows.
- New standard imports create one Parent `products` row and one `product_barcodes` row per Variant.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN sku DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS parent_ref text,
  ADD COLUMN IF NOT EXISTS product_role text NOT NULL DEFAULT 'parent';

ALTER TABLE public.product_barcodes
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS parent_ref text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_product_role_parent_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_role_parent_check CHECK (product_role = 'parent');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_parent_ref ON public.products(parent_ref);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_parent_ref ON public.product_barcodes(parent_ref);
