/*
# Enhance shift_assignments for calendar scheduling

1. Changes to `shift_assignments`
- Make `shift_id` nullable: when an admin schedules a day-off/leave via the calendar (not a working shift), there is no shift to link. The row still records the date, status, branch, and an optional note.
- Add `note` column (text, nullable): free-text note for the scheduled day (e.g. "ลาป่วย", "เปลี่ยนกะ").
- Add `updated_at` column (timestamptz, nullable): track last modification.

2. Security
- No new tables; existing RLS policies on `shift_assignments` remain in effect.
- No policy changes needed.
*/

ALTER TABLE shift_assignments ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS updated_at timestamptz;