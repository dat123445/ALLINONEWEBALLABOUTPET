/*
# Link store evaluations to branches

1. Modified Tables
- `store_eval_stores.branch_id` (uuid, nullable): associates each evaluation store with an existing branch so dashboard reports can filter evaluation results consistently with the global branch selector.

2. Data Safety
- The column is nullable so existing stores and evaluation records remain intact and continue to display under “ทุกสาขา” until a branch is assigned.
- No rows, tables, or existing columns are removed or changed.

3. Security
- Existing row-level security policies remain in place.
- The new relationship does not widen access; it only enables branch-aware filtering of already-authorized store evaluation data.

4. Important Notes
- Existing evaluation records inherit their store's branch when queried through the store relationship.
- A foreign key protects the relationship from pointing at a missing branch.
*/

ALTER TABLE public.store_eval_stores
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_eval_stores_branch_id
  ON public.store_eval_stores(branch_id);