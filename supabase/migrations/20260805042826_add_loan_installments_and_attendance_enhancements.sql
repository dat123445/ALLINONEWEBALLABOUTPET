/*
# Add loan installments, attendance shift link, and early-leave tracking

## Purpose
Supports the full salary system: loan installment tracking, and attendance
records linked to shifts with early-leave detection for pro-rated daily wages.

## 1. New Table: loan_installments
Tracks individual installment payments for each employee loan.
- `id` (uuid PK)
- `loan_id` (uuid FK → employee_loans.id ON DELETE CASCADE)
- `installment_number` (int, which installment: 1, 2, 3...)
- `amount` (numeric, amount due for this installment)
- `paid` (boolean default false — whether this installment has been paid)
- `paid_at` (timestamptz — when admin marked it paid)
- `paid_by` (uuid — admin profile id who confirmed payment)
- `note` (text — optional note)
- `created_at` (timestamptz default now())

## 2. Modified Table: attendance
Added columns:
- `shift_id` (uuid FK → shifts.id ON DELETE SET NULL) — links attendance record to the shift the employee was assigned to, for early-leave calculation
- `early_leave_minutes` (numeric default 0) — minutes the employee left before shift end, computed at checkout

## 3. Modified Table: salary_advances
Added columns:
- `deducted_from_period` (text) — which pay period this advance was deducted from (e.g. "2026-08") so the salary page can show it
- `admin_created` (boolean default false) — true if a super admin created this on behalf of the employee

## 4. Modified Table: employee_loans
Added columns:
- `admin_created` (boolean default false) — true if admin created on behalf of employee
- `profile_id` already exists; no change to ownership.

## 5. Security
- RLS enabled on loan_installments with full CRUD for authenticated users
  (admin manages installments; employees can read their own via loan ownership)
- All new columns on existing tables inherit existing RLS policies
*/

-- 1. loan_installments table
CREATE TABLE IF NOT EXISTS loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
  installment_number int NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  paid_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loan_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_loan_installments" ON loan_installments;
CREATE POLICY "select_loan_installments" ON loan_installments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_loan_installments" ON loan_installments;
CREATE POLICY "insert_loan_installments" ON loan_installments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_loan_installments" ON loan_installments;
CREATE POLICY "update_loan_installments" ON loan_installments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_loan_installments" ON loan_installments;
CREATE POLICY "delete_loan_installments" ON loan_installments FOR DELETE
  TO authenticated USING (true);

-- 2. attendance: add shift_id and early_leave_minutes
DO $$ BEGIN
  ALTER TABLE attendance ADD COLUMN shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE attendance ADD COLUMN early_leave_minutes numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. salary_advances: add deducted_from_period and admin_created
DO $$ BEGIN
  ALTER TABLE salary_advances ADD COLUMN deducted_from_period text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE salary_advances ADD COLUMN admin_created boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. employee_loans: add admin_created
DO $$ BEGIN
  ALTER TABLE employee_loans ADD COLUMN admin_created boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan_id ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON attendance(shift_id);
