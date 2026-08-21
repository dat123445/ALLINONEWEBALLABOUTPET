/*
# Multi-shift support + OT auto-generation columns

1. Purpose
- Drop the unique constraint on (profile_id, assignment_date) to allow multiple shifts per day
- Add ot_hours column to attendance for auto-OT tracking
- Add auto_generated column to ot_requests to distinguish manual vs auto OT requests
- Add late_deduction column to attendance for late penalty tracking

2. Security
- No RLS changes. Existing policies remain in effect.
*/

-- Drop unique constraint allowing multiple shifts per employee per day
ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS shift_assignments_profile_id_assignment_date_key;

-- Add OT hours to attendance (for auto-generated OT when checkout > 60min after shift end)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_hours numeric DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_deduction numeric DEFAULT 0;

-- Mark auto-generated OT requests vs manual ones
ALTER TABLE ot_requests ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;
ALTER TABLE ot_requests ADD COLUMN IF NOT EXISTS attendance_id uuid;

-- Add index for faster lookup of assignments by date (non-unique now)
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments(assignment_date);
