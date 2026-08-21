/*
# Add audit log for bill status changes

1. New Tables
- `cs_bill_audit_logs`
  - `id` (uuid, primary key)
  - `bill_id` (uuid, references cs_pending_bills, not null) — which bill
  - `action` (text) — e.g. 'billed', 'unbilled', 'paid', 'deleted'
  - `previous_status` (text, nullable)
  - `new_status` (text, nullable)
  - `actor_profile_id` (uuid, nullable) — who performed the action
  - `actor_name` (text, nullable) — denormalized name for easy display
  - `note` (text, nullable)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `cs_bill_audit_logs`.
- Allow authenticated users to read and insert audit logs.
*/

CREATE TABLE IF NOT EXISTS cs_bill_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES cs_pending_bills(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status text,
  new_status text,
  actor_profile_id uuid,
  actor_name text,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cs_bill_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_audit_logs" ON cs_bill_audit_logs;
CREATE POLICY "read_audit_logs" ON cs_bill_audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_logs" ON cs_bill_audit_logs;
CREATE POLICY "insert_audit_logs" ON cs_bill_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bill_audit_bill_id ON cs_bill_audit_logs(bill_id);
