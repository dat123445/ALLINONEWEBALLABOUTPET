/*
# Fix shift_assignments status constraint

1. Purpose
The frontend calendar uses status values: 'work', 'day_off', 'sick', 'personal', 'vacation'.
The original CHECK constraint only allowed 'scheduled','confirmed','swapped','cancelled'.
This caused every calendar assignment insert/update to fail silently.

2. Changes
- Drop the old CHECK constraint on shift_assignments.status
- Add a new CHECK constraint that allows both the original values AND the frontend values

3. Security
- No RLS or policy changes. Existing policies remain in effect.
*/

ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS shift_assignments_status_check;

ALTER TABLE shift_assignments ADD CONSTRAINT shift_assignments_status_check
  CHECK (status IN ('scheduled','confirmed','swapped','cancelled','work','day_off','sick','personal','vacation'));
