/*
# Add expiry date, backup history, and branch enhancements

1. New Tables
- `backup_history` — tracks when backups were downloaded
  - `id` (uuid, PK)
  - `profile_id` (uuid, FK to profiles)
  - `backup_type` (text: 'full' | 'archive')
  - `file_name` (text)
  - `record_count` (int, default 0)
  - `created_at` (timestamptz, default now())
- `archived_stock_movements` — archive table for old stock movements
  - Same structure as stock_movements
  - `archived_at` (timestamptz, default now())

2. Modified Tables
- `stock_lots` — add `expiry_date` (date, nullable) for manual expiry entry
- `branches` — add `short_code` (text, nullable) and `address` (text, nullable)
- `profiles` — add `active_branch_id` (uuid, nullable, FK to branches)

3. Security
- Enable RLS on backup_history and archived_stock_movements
- CRUD policies for authenticated users on backup_history
- CRUD policies for authenticated users on archived_stock_movements
- Allow authenticated users to read/update profiles with active_branch_id
*/

-- Add expiry_date to stock_lots
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_lots' AND column_name = 'expiry_date') THEN
    ALTER TABLE stock_lots ADD COLUMN expiry_date date;
  END IF;
END $$;

-- Add short_code and address to branches
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'short_code') THEN
    ALTER TABLE branches ADD COLUMN short_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'address') THEN
    ALTER TABLE branches ADD COLUMN address text;
  END IF;
END $$;

-- Add active_branch_id to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'active_branch_id') THEN
    ALTER TABLE profiles ADD COLUMN active_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create backup_history table
CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  backup_type text NOT NULL DEFAULT 'full',
  file_name text,
  record_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_backup_history" ON backup_history;
CREATE POLICY "select_backup_history" ON backup_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_backup_history" ON backup_history;
CREATE POLICY "insert_backup_history" ON backup_history FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_backup_history" ON backup_history;
CREATE POLICY "delete_backup_history" ON backup_history FOR DELETE TO authenticated USING (true);

-- Create archived_stock_movements table (same structure as stock_movements)
CREATE TABLE IF NOT EXISTS archived_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  type_config text NOT NULL DEFAULT 'default',
  quantity numeric NOT NULL DEFAULT 0,
  lot_id uuid,
  lot_label text,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  reference_note text,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE archived_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_archived_movements" ON archived_stock_movements;
CREATE POLICY "select_archived_movements" ON archived_stock_movements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_archived_movements" ON archived_stock_movements;
CREATE POLICY "insert_archived_movements" ON archived_stock_movements FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_archived_movements" ON archived_stock_movements;
CREATE POLICY "delete_archived_movements" ON archived_stock_movements FOR DELETE TO authenticated USING (true);

-- Add index on stock_lots expiry_date for filtering
CREATE INDEX IF NOT EXISTS idx_stock_lots_expiry_date ON stock_lots(expiry_date);

-- Add index on backup_history created_at
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);

-- Add index on archived_stock_movements created_at
CREATE INDEX IF NOT EXISTS idx_archived_movements_created_at ON archived_stock_movements(created_at DESC);
