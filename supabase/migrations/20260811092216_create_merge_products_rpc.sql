/*
# Merge products into parent (variant merge) RPC

## Purpose
Fixes the "รวมเป็นตัวเลือกย่อย" (merge into variants) feature.
Previously the frontend only set `products.parent_product_id` on the
non-selected product, which created a product hierarchy instead of
moving the variants (`product_barcodes`) into the parent. The parent
the user selected was sometimes the one that disappeared.

## New function: `merge_products_into_parent(uuid, uuid[])`
- **Parameters:** `p_parent_id` (the product the user chose to keep),
  `p_child_ids` (array of product ids to fold into the parent).
- **What it does, per child id (atomically):**
  1. Re-assigns all `product_barcodes` rows from the child to the parent
     (this automatically carries their `variant_lot_prices` and
     `variant_branch_stock` rows, which are keyed on `product_barcode_id`).
  2. Re-assigns `product_platform_prices` rows that still point at the
     child `product_id` (both product-level and variant-level rows).
  3. Re-assigns `product_images` from the child to the parent.
  4. Re-assigns `stock_lots` that reference the child `product_id`
     directly (non-barcode lots) to the parent.
  5. Deletes the now-empty child `products` row.
- The parent is NEVER deleted.
- Works in both directions: whoever is passed as `p_parent_id` is kept.
- SECURITY DEFINER so an `authenticated` client can perform the
  cross-product move + delete in one atomic call.
- No transaction control statements (per project rules); the function
  body runs in an implicit transaction.

## Security
- `SECURITY DEFINER` with a fixed `search_path`.
- `EXECUTE` granted to `authenticated` only.
*/

CREATE OR REPLACE FUNCTION public.merge_products_into_parent(
  p_parent_id uuid,
  p_child_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_id uuid;
  moved_barcodes bigint;
  moved_images bigint;
  moved_lots bigint;
  moved_prices bigint;
  total_barcodes bigint := 0;
  deleted_count int := 0;
BEGIN
  -- Validate parent exists
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_parent_id) THEN
    RAISE EXCEPTION 'Parent product % does not exist', p_parent_id;
  END IF;

  -- Parent must not be one of the child ids
  IF p_parent_id = ANY(p_child_ids) THEN
    RAISE EXCEPTION 'Parent id cannot be in child ids';
  END IF;

  FOREACH child_id IN ARRAY p_child_ids LOOP
    -- Skip if child doesn't exist
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = child_id) THEN
      CONTINUE;
    END IF;

    -- 1. Move product_barcodes (variants) into the parent.
    --    variant_lot_prices + variant_branch_stock follow automatically
    --    (keyed on product_barcode_id which is unchanged).
    UPDATE product_barcodes
       SET product_id = p_parent_id
     WHERE product_id = child_id;
    GET DIAGNOSTICS moved_barcodes = ROW_COUNT;
    total_barcodes := total_barcodes + moved_barcodes;

    -- 2. Move product_platform_prices (both product-level and variant-level)
    UPDATE product_platform_prices
       SET product_id = p_parent_id
     WHERE product_id = child_id;
    GET DIAGNOSTICS moved_prices = ROW_COUNT;

    -- 3. Move product_images
    UPDATE product_images
       SET product_id = p_parent_id
     WHERE product_id = child_id;
    GET DIAGNOSTICS moved_images = ROW_COUNT;

    -- 4. Move stock_lots that reference the child product directly
    --    (non-barcode lots). Barcode-linked lots already follow their barcode.
    UPDATE stock_lots
       SET product_id = p_parent_id
     WHERE product_id = child_id AND product_barcode_id IS NULL;
    GET DIAGNOSTICS moved_lots = ROW_COUNT;

    -- 5. Delete the now-empty child product.
    --    Any remaining FK references cascade (stock_movements, audit logs, etc.)
    DELETE FROM products WHERE id = child_id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'deleted_children', deleted_count,
    'moved_barcodes', total_barcodes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_products_into_parent(uuid, uuid[]) TO authenticated;
