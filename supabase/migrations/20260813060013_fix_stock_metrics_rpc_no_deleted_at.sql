/*
# Fix stock metrics RPC — remove non-existent deleted_at column

The products table has no `deleted_at` column. Product count should be
based on `is_active = true` and the parent/variant model (products that
are NOT child variants, i.e. `parent_product_id IS NULL`).
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
      (SELECT count(*) FROM products WHERE is_active = true AND parent_product_id IS NULL),
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