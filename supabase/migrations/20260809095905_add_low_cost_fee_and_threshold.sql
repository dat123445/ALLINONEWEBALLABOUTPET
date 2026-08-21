/*
# Add low-cost fee percent and low-cost threshold to platform settings

1. Changes
- Add `low_cost_fee_percent` (numeric, default 10) to `online_platform_settings`
  — the platform fee (%) applied to low-cost products.
- Add `low_cost_threshold` (numeric, default 100) to `online_platform_settings`
  — products with cost price below this threshold are considered "low cost"
  and use `low_cost_margin_percent` + `low_cost_fee_percent` instead of the
  regular `margin_percent` + `platform_fee_percent`.
2. Security
- No RLS policy changes — existing policies remain in effect.
3. Notes
- Both columns are nullable-safe with defaults so existing rows get sensible values.
- The threshold is per-platform because different platforms may have different
  definitions of "low cost" (e.g. a ฿50 item on Shopee vs Lazada).
*/

ALTER TABLE online_platform_settings
  ADD COLUMN IF NOT EXISTS low_cost_fee_percent numeric DEFAULT 10;

ALTER TABLE online_platform_settings
  ADD COLUMN IF NOT EXISTS low_cost_threshold numeric DEFAULT 100;
