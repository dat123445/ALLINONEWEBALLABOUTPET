/*
# Sync platform prices from current settings

1. Purpose
- Recalculate stored product platform prices whenever platform settings or lot costs change.
2. Modified behavior
- Prices use the same margin, fee, low-cost threshold, and connection rules as the calculator.
3. Security
- No new tables or policies. The trigger function uses a fixed public search path.
4. Important notes
- Prices are rounded to whole currency units and disconnected platforms are stored as zero.
*/

CREATE OR REPLACE FUNCTION public.sync_product_platform_prices_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.product_platform_prices (product_id, lot_label, platform, price, cost_price, margin_percent, updated_at)
  SELECT
    l.product_id,
    l.lot_label,
    s.platform,
    CASE WHEN s.is_connected = false OR COALESCE(l.cost_price, 0) <= 0 THEN 0
      ELSE ROUND(COALESCE(l.cost_price, 0) / NULLIF(1 - ((CASE WHEN COALESCE(l.cost_price, 0) < COALESCE(s.low_cost_threshold, 100) THEN COALESCE(s.low_cost_margin_percent, s.margin_percent, 0) ELSE COALESCE(s.margin_percent, 0) END + CASE WHEN COALESCE(l.cost_price, 0) < COALESCE(s.low_cost_threshold, 100) THEN COALESCE(s.low_cost_fee_percent, s.platform_fee_percent, 0) ELSE COALESCE(s.platform_fee_percent, 0) END) / 100), 0))
    END,
    COALESCE(l.cost_price, 0),
    CASE WHEN COALESCE(l.cost_price, 0) < COALESCE(s.low_cost_threshold, 100) THEN COALESCE(s.low_cost_margin_percent, s.margin_percent, 0) ELSE COALESCE(s.margin_percent, 0) END,
    now()
  FROM public.stock_lots AS l
  CROSS JOIN public.online_platform_settings AS s
  ON CONFLICT (product_id, lot_label, platform)
  DO UPDATE SET price = EXCLUDED.price, cost_price = EXCLUDED.cost_price, margin_percent = EXCLUDED.margin_percent, updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_prices_after_platform_setting_change ON public.online_platform_settings;
CREATE TRIGGER sync_prices_after_platform_setting_change
AFTER INSERT OR UPDATE OF margin_percent, platform_fee_percent, low_cost_margin_percent, low_cost_fee_percent, low_cost_threshold, is_connected
ON public.online_platform_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_product_platform_prices_trigger();

DROP TRIGGER IF EXISTS sync_prices_after_lot_cost_change ON public.stock_lots;
CREATE TRIGGER sync_prices_after_lot_cost_change
AFTER INSERT OR UPDATE OF cost_price, lot_label
ON public.stock_lots
FOR EACH ROW EXECUTE FUNCTION public.sync_product_platform_prices_trigger();