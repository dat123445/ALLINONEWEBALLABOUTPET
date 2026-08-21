/*
# Add personal day-off table and lot_label to cs_pending_bills

1. New Tables
- `personal_day_offs`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles, not null) — which employee
  - `day_of_week` (int, 0=Sun..6=Sat) — default recurring day off
  - `effective_from` (date) — when this day-off starts
  - `effective_to` (date, nullable) — when it ends (null = ongoing)
  - `note` (text, nullable)
  - `created_at` (timestamptz)
  - Allows each employee to set their own weekly day off, flexible per period.

2. Modified Tables
- `cs_pending_bills` — add `lot_label` (text, nullable) to track old/new stock capital.
- `cs_pending_bills` — add `withdrawn_at` (timestamptz, nullable) to record when stock was pulled.

3. Security
- Enable RLS on `personal_day_offs`.
- 4 CRUD policies scoped to authenticated users owning their own rows.
- Owner column `profile_id` defaults to the profile's own id (set from frontend).
*/

CREATE TABLE IF NOT EXISTS personal_day_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE personal_day_offs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_day_offs" ON personal_day_offs;
CREATE POLICY "select_own_day_offs" ON personal_day_offs FOR SELECT
  TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

DROP POLICY IF EXISTS "insert_own_day_offs" ON personal_day_offs;
CREATE POLICY "insert_own_day_offs" ON personal_day_offs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

DROP POLICY IF EXISTS "update_own_day_offs" ON personal_day_offs;
CREATE POLICY "update_own_day_offs" ON personal_day_offs FOR UPDATE
  TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

DROP POLICY IF EXISTS "delete_own_day_offs" ON personal_day_offs;
CREATE POLICY "delete_own_day_offs" ON personal_day_offs FOR DELETE
  TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Add lot_label and withdrawn_at to cs_pending_bills
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cs_pending_bills' AND column_name = 'lot_label') THEN
    ALTER TABLE cs_pending_bills ADD COLUMN lot_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cs_pending_bills' AND column_name = 'withdrawn_at') THEN
    ALTER TABLE cs_pending_bills ADD COLUMN withdrawn_at timestamptz;
  END IF;
END $$;

-- Add index for faster calendar queries
CREATE INDEX IF NOT EXISTS idx_personal_day_offs_profile ON personal_day_offs(profile_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_profile_dates ON leave_requests(profile_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_profile_date ON shift_assignments(profile_id, assignment_date);
