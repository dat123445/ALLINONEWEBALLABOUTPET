/*
# Add audit log for sales record edits and deletes

1. New Tables
- `sales_audit_logs`
  - `id` (uuid, primary key)
  - `record_id` (uuid, nullable) — the sales record id (nullable because on delete the record is gone)
  - `action` (text) — 'edit' or 'delete'
  - `actor_profile_id` (uuid, nullable) — who performed the action
  - `actor_name` (text, nullable) — denormalized name
  - `snapshot` (jsonb, nullable) — snapshot of the record before edit/delete
  - `note` (text, nullable)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `sales_audit_logs`.
- Allow authenticated users to read and insert audit logs.
*/

CREATE TABLE IF NOT EXISTS sales_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid,
  action text NOT NULL,
  actor_profile_id uuid,
  actor_name text,
  snapshot jsonb,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_sales_audit_logs" ON sales_audit_logs;
CREATE POLICY "read_sales_audit_logs" ON sales_audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_sales_audit_logs" ON sales_audit_logs;
CREATE POLICY "insert_sales_audit_logs" ON sales_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sales_audit_record_id ON sales_audit_logs(record_id);
