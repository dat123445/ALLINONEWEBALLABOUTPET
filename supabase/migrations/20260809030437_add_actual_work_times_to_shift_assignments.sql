/*
# Add actual work times to shift_assignments

1. Purpose
   Allows admins/owners to record the actual check-in and check-out times
   for an employee on a given day, separate from the scheduled shift times.
   This data feeds into salary calculations. Only admin-level roles can
   write these fields; regular employees can view but not edit.

2. New Columns on `shift_assignments`
   - `actual_check_in_time` (timestamptz, nullable) — real time the employee started work
   - `actual_check_out_time` (timestamptz, nullable) — real time the employee finished work
   - `actual_work_hours` (numeric(5,2), nullable) — computed hours from actual times
   - `actual_note` (text, nullable) — admin note about the actual times (e.g. "มาสาย", "ออกก่อน")

3. Security
   - No RLS policy changes needed — shift_assignments already has RLS enabled
   and existing policies control access. The new columns inherit the same
   row-level access as the rest of the row.
*/

ALTER TABLE shift_assignments
  ADD COLUMN IF NOT EXISTS actual_check_in_time timestamptz,
  ADD COLUMN IF NOT EXISTS actual_check_out_time timestamptz,
  ADD COLUMN IF NOT EXISTS actual_work_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS actual_note text;
