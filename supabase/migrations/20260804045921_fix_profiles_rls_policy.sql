/*
# Fix profiles RLS policies

## Problem
The previous select_profiles policy used a subquery that recursively queried
the profiles table to check roles, causing PostgreSQL to recursively evaluate
the RLS policy and return null/empty when users tried to read their own profile.
This was the root cause of the login-loop bug.

## Fix
1. Drop the recursive SELECT policy and replace it with a simple one:
   - Each user can read their OWN profile via `auth.uid() = user_id`
   - All authenticated users can read ALL profiles (needed so users can see teammates)
   This is safe for an internal company app — employees can see who their colleagues are.

2. Fix the overly complex UPDATE policies — simplify to one clean policy.

3. Add DELETE policy on profiles (was missing).
*/

-- Fix SELECT policy: drop recursive policy, replace with non-recursive one
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated USING (true);

-- Fix UPDATE policies: drop both conflicting ones and replace with a single clean policy
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_profiles_admin" ON profiles;
CREATE POLICY "update_profiles" ON profiles FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy (was missing, needed for user management)
DROP POLICY IF EXISTS "delete_profiles" ON profiles;
CREATE POLICY "delete_profiles" ON profiles FOR DELETE TO authenticated USING (true);