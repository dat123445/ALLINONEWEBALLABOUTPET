/*
# Create salary_records table for persisting computed salary results

1. New Tables
- `salary_records`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles) — which employee
  - `period_month` (text, e.g. '2026-08') — which month this salary was computed for
  - `computed_payload` (jsonb) — full computed salary breakdown (line items, base, OT, deductions, total)
  - `total_pay` (numeric) — final amount to pay (denormalized for quick sum queries)
  - `computed_at` (timestamptz) — when the calculation was run
  - `computed_by` (uuid, references profiles) — who ran the calculation
  - `created_at` (timestamptz, default now())
  - Unique constraint on (profile_id, period_month) so re-calculating upserts the same row

2. Security
- Enable RLS on `salary_records`.
- Authenticated users can read all salary records (admin/owner need visibility).
- Authenticated users can insert/update/delete (the app manages writes from the salary page).
*/

CREATE TABLE IF NOT EXISTS salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month text NOT NULL,
  computed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_pay numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS salary_records_profile_period_unique
  ON salary_records (profile_id, period_month);

ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_salary_records" ON salary_records;
CREATE POLICY "select_salary_records"
  ON salary_records FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_salary_records" ON salary_records;
CREATE POLICY "insert_salary_records"
  ON salary_records FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_salary_records" ON salary_records;
CREATE POLICY "update_salary_records"
  ON salary_records FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_salary_records" ON salary_records;
CREATE POLICY "delete_salary_records"
  ON salary_records FOR DELETE
  TO authenticated USING (true);
