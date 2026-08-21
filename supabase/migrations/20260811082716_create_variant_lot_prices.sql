/*
# Create variant_lot_prices table

## Purpose
Each product variant (product_barcodes row) currently stores a single cost_price and price.
This table adds per-lot pricing for each variant, so a variant can have
different cost_price/retail_price for the "old" lot vs the "new" lot.

## New Tables
- `variant_lot_prices`
  - `id` (uuid, primary key)
  - `product_barcode_id` (uuid, FK to product_barcodes.id, ON DELETE CASCADE)
  - `lot_label` (text, 'old' or 'new')
  - `cost_price` (numeric, default 0)
  - `retail_price` (numeric, default 0)
  - `created_at` (timestamptz, default now())
  - Unique constraint on (product_barcode_id, lot_label)

## Security
- RLS enabled.
- CRUD policies for anon + authenticated (matching existing product_barcodes policies).
*/

CREATE TABLE IF NOT EXISTS variant_lot_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_barcode_id uuid NOT NULL REFERENCES product_barcodes(id) ON DELETE CASCADE,
  lot_label text NOT NULL CHECK (lot_label IN ('old', 'new')),
  cost_price numeric DEFAULT 0,
  retail_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (product_barcode_id, lot_label)
);

ALTER TABLE variant_lot_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_variant_lot_prices" ON variant_lot_prices;
CREATE POLICY "select_variant_lot_prices" ON variant_lot_prices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_variant_lot_prices" ON variant_lot_prices;
CREATE POLICY "insert_variant_lot_prices" ON variant_lot_prices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_variant_lot_prices" ON variant_lot_prices;
CREATE POLICY "update_variant_lot_prices" ON variant_lot_prices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_variant_lot_prices" ON variant_lot_prices;
CREATE POLICY "delete_variant_lot_prices" ON variant_lot_prices FOR DELETE
  TO anon, authenticated USING (true);
