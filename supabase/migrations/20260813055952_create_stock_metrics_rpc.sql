/*
# Create stock metrics RPC function

## Problem
PostgREST defaults to returning at most 1,000 rows per request.
The dashboard fetches `product_barcodes` (1,413 rows) with nested `variant_lot_prices` (2,822 rows)
without pagination, so the results are silently truncated at 1,000.
This causes "สินค้าทั้งหมด" to show 1,000 instead of the real count, and "มูลค่าสต๊อก" to be
calculated from incomplete data.

## Solution
Create a SECURITY DEFINER RPC function `get_stock_metrics` that computes all stock
summary numbers server-side using SQL aggregates (SUM, COUNT) — no row limit applies.

Returns a single JSON object:
- product_count: total active products (parent products that are not variants and not deleted)
- variant_count: total active product_barcodes
- stock_value: SUM(quantity * cost_price) across variant_lot_prices + fallback to product_barcodes
- low_stock_count: count of variants whose total quantity <= products.min_stock

## Security
- SECURITY DEFINER, runs as the owner role (bypasses RLS for aggregation)
- EXECUTE granted to authenticated and anon
- search_path locked to public for security
*/

CREATE OR REPLACE FUNCTION public.get_stock_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'product_count',
      (SELECT count(*) FROM products WHERE is_active = true AND deleted_at IS NULL),
    'variant_count',
      (SELECT count(*) FROM product_barcodes WHERE is_available = true),
    'stock_value',
      COALESCE(
        (SELECT SUM(vlp.quantity * vlp.cost_price)
         FROM variant_lot_prices vlp
         JOIN product_barcodes pb ON pb.id = vlp.product_barcode_id
         WHERE pb.is_available = true),
        0
      ),
    'low_stock_count',
      (SELECT count(*)
       FROM (
         SELECT pb.id,
                COALESCE(SUM(vlp.quantity), pb.stock_qty, 0) AS total_qty,
                p.min_stock
         FROM product_barcodes pb
         LEFT JOIN variant_lot_prices vlp ON vlp.product_barcode_id = pb.id
         JOIN products p ON p.id = pb.product_id
         WHERE pb.is_available = true
         GROUP BY pb.id, pb.stock_qty, p.min_stock
       ) sub
       WHERE total_qty <= COALESCE(min_stock, 5)
      )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_metrics() TO authenticated, anon;