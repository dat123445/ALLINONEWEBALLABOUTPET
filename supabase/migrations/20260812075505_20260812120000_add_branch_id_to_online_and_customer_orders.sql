/*
# Add branch_id to online_orders and customer_orders

## Purpose
The dashboard's branch filter queries `online_orders.branch_id` and `customer_orders.branch_id`, but neither table has the column. This adds the nullable foreign-key column to both so branch-scoped queries work without errors.

## Changes

### 1. online_orders.branch_id
- New nullable column `branch_id uuid`.
- Foreign key → `branches(id)` with `ON DELETE SET NULL`.
- Indexed for filter performance.

### 2. customer_orders.branch_id
- New nullable column `branch_id uuid`.
- Foreign key → `branches(id)` with `ON DELETE SET NULL`.
- Indexed for filter performance.

## Data Safety
- Both columns are nullable, so existing rows remain valid and show under "ทุกสาขา" until a branch is assigned.
- No rows, tables, or existing columns are removed or changed.

## Security
- Existing RLS policies remain unchanged. The new column does not widen access — it only enables branch-aware filtering of already-authorized data.
*/

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_online_orders_branch_id
  ON public.online_orders(branch_id);

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_branch_id
  ON public.customer_orders(branch_id);