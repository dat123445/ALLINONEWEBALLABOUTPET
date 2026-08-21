/*
# Create attendance audit logs table

1. New Tables
- `attendance_audit_logs`
  - `id` (uuid, primary key)
  - `attendance_id` (uuid, references attendance, ON DELETE CASCADE)
  - `profile_id` (uuid, the employee whose attendance was edited)
  - `actor_profile_id` (uuid, the admin who made the edit)
  - `actor_name` (text, display name of the admin)
  - `action` (text: 'edit_checkin' | 'edit_checkout' | 'edit_both')
  - `previous_check_in` (timestamptz, original check-in time)
  - `previous_check_out` (timestamptz, original check-out time)
  - `new_check_in` (timestamptz, new check-in time)
  - `new_check_out` (timestamptz, new check-out time)
  - `previous_work_hours` (numeric, original work hours)
  - `new_work_hours` (numeric, recalculated work hours)
  - `note` (text, optional reason for edit)
  - `created_at` (timestamptz, when the edit was made)

2. Security
- Enable RLS on `attendance_audit_logs`.
- SELECT: authenticated users can read audit logs (admins for review).
- INSERT: authenticated users can insert audit log entries.
- No UPDATE or DELETE — audit logs are immutable once written.
*/

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid REFERENCES attendance(id) ON DELETE CASCADE,
  profile_id uuid,
  actor_profile_id uuid,
  actor_name text,
  action text NOT NULL DEFAULT 'edit',
  previous_check_in timestamptz,
  previous_check_out timestamptz,
  new_check_in timestamptz,
  new_check_out timestamptz,
  previous_work_hours numeric,
  new_work_hours numeric,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_attendance_audit_logs" ON attendance_audit_logs;
CREATE POLICY "select_attendance_audit_logs"
ON attendance_audit_logs FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_attendance_audit_logs" ON attendance_audit_logs;
CREATE POLICY "insert_attendance_audit_logs"
ON attendance_audit_logs FOR INSERT
TO authenticated WITH CHECK (true);
