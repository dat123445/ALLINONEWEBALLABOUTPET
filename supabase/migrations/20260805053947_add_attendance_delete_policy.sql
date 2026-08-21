/*
# Add DELETE policy to attendance table

1. Security changes
- The `attendance` table has RLS enabled but was missing a DELETE policy.
- This caused hard-delete attempts from the "ประวัติ" (history) tab to silently
  fail (0 rows affected, no error returned), so deleted records reappeared on refresh.
- Add a DELETE policy scoped to authenticated admin/owner/manager roles (matching
  the existing SELECT policy's admin predicate) so authorized users can permanently
  delete attendance records.
*/

DROP POLICY IF EXISTS "delete_attendance" ON attendance;
CREATE POLICY "delete_attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.roles && ARRAY['owner','admin','super_admin','manager']
    )
  );
