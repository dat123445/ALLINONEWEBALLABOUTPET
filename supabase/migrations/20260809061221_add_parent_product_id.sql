/*
# Add parent_product_id to products table

1. Changes to existing tables
   - `products`: add `parent_product_id uuid` column (nullable, self-referencing FK to products.id ON DELETE SET NULL)
     - A product with parent_product_id = NULL is a top-level product (standalone or parent)
     - A product with parent_product_id = X is a child/variant of product X
     - This enables the "merge simple products into one parent" feature without moving data between tables

2. Indexes
   - `idx_products_parent_product_id` on products(parent_product_id) for fast child lookups

3. Security
   - No RLS policy changes needed — products already has full CRUD policies for anon + authenticated
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_parent_product_id ON products(parent_product_id) WHERE parent_product_id IS NOT NULL;
