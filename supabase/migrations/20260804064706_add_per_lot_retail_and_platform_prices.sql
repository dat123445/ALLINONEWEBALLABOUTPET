/*
# Add per-lot retail price and per-platform price storage

1. Alter existing tables
- Add `retail_price` to `stock_lots` (nullable, per-lot retail price)
- Add `lot_label` to `stock_movements` (to track which lot label was sold)

2. New Table
- `product_platform_prices` — stores the latest calculated price per product per platform per lot

3. Security
- RLS enabled, authenticated users can read/insert/update/delete.
*/

ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS retail_price numeric;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_label text;

CREATE TABLE IF NOT EXISTS product_platform_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_label text NOT NULL DEFAULT 'old',
  platform text NOT NULL,
  price numeric NOT NULL,
  cost_price numeric,
  margin_percent numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, lot_label, platform)
);

ALTER TABLE product_platform_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_product_platform_prices" ON product_platform_prices;
CREATE POLICY "read_product_platform_prices" ON product_platform_prices FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_platform_prices" ON product_platform_prices;
CREATE POLICY "insert_product_platform_prices" ON product_platform_prices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_product_platform_prices" ON product_platform_prices;
CREATE POLICY "update_product_platform_prices" ON product_platform_prices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_product_platform_prices" ON product_platform_prices;
CREATE POLICY "delete_product_platform_prices" ON product_platform_prices FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ppp_product ON product_platform_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_ppp_platform ON product_platform_prices(platform);
