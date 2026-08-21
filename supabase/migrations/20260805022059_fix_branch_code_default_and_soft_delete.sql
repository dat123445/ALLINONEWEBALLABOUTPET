/*
# Fix branches.code NOT NULL constraint + soft-delete support

## Problem 1: branches.code is NOT NULL with no default
The `branches.code` column is `text NOT NULL` with no default. The frontend
"Add branch" form does not require the user to fill in a short code, so inserts
fail with: "null value in column 'code' of relation 'branches' violates
not-null constraint".

## Problem 2: Deleted branches still appear in selectors
BranchesPage does a hard `DELETE`, but other pages load branches with
`.eq('is_active', true)` already — except BranchesPage itself which loads all.
The real issue: hard delete can fail silently when FK rows reference the branch,
leaving it visible. We switch to soft-delete (set is_active = false) so the
branch disappears from all selectors that filter on is_active = true.

## Changes
1. `branches.code`: add a default of empty string ('') so inserts without a
   code succeed. The column stays NOT NULL but now defaults to ''.
2. No schema change needed for soft-delete — `is_active` column already exists
   with default `true`. We just change the frontend delete behavior.

## Security
- No RLS policy changes. Existing policies remain intact.
*/

-- Make branches.code default to empty string so NOT NULL is satisfied
ALTER TABLE branches ALTER COLUMN code SET DEFAULT '';

-- Backfill any existing NULL-equivalent rows (code is NOT NULL so none should be NULL, but just in case)
UPDATE branches SET code = '' WHERE code IS NULL;
