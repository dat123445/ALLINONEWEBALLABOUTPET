/*
# Add stats RPC functions + audit log DELETE policy

1. Purpose
- Server-side pagination needs a way to get total counts without loading all rows.
- get_stock_stats() returns total product count, stock value, low stock count, and movement count.
- get_low_stock_product_ids() returns product IDs that are at or below min_stock.
- product_audit_logs needs DELETE policy so we can hard-delete products with audit trail.

2. Security
- All functions are SECURITY DEFINER, run as owner, search_path fixed to public.
- They only read data, no mutations.
- audit log DELETE policy allows anon+authenticated (internal tool, shared data).
*/

-- ============ get_stock_stats() ============
CREATE OR REPLACE FUNCTION public.get_stock_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_products', (SELECT count(*) FROM products WHERE is_active = true),
    'stock_value', COALESCE((
      SELECT sum(sl.quantity * COALESCE(sl.cost_price, p.cost_price, 0))
      FROM stock_lots sl
      JOIN products p ON p.id = sl.product_id
      WHERE p.is_active = true
    ), 0),
    'low_stock_count', (
      SELECT count(*) FROM (
        SELECT p.id
        FROM products p
        WHERE p.is_active = true
        AND COALESCE((
          SELECT sum(sl.quantity) FROM stock_lots sl WHERE sl.product_id = p.id
        ), 0) <= p.min_stock
      ) sub
    ),
    'movement_count', (SELECT count(*) FROM stock_movements)
  ) INTO result;
  RETURN result;
END;
$$;

-- ============ get_low_stock_product_ids() ============
CREATE OR REPLACE FUNCTION public.get_low_stock_product_ids()
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id
    FROM products p
    WHERE p.is_active = true
      AND COALESCE((
        SELECT sum(sl.quantity) FROM stock_lots sl WHERE sl.product_id = p.id
      ), 0) <= p.min_stock;
END;
$$;

-- ============ product_audit_logs DELETE policy ============
DROP POLICY IF EXISTS "insert_product_audit_logs" ON product_audit_logs;
DROP POLICY IF EXISTS "select_product_audit_logs" ON product_audit_logs;
DROP POLICY IF EXISTS "delete_product_audit_logs" ON product_audit_logs;

CREATE POLICY "insert_product_audit_logs" ON product_audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "select_product_audit_logs" ON product_audit_logs FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "delete_product_audit_logs" ON product_audit_logs FOR DELETE
  TO anon, authenticated USING (true);

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_stock_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_product_ids() TO anon, authenticated;
