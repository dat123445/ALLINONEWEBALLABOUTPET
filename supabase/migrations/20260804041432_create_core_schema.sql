/*
# All About Pet — Core Schema (Part 1: tables without forward references)
Fix: removed FK from attendance->shifts (shifts created after attendance).
*/
-- ============ BRANCHES ============
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  phone text,
  gps_lat numeric,
  gps_lng numeric,
  geofence_radius_m integer DEFAULT 200,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_branches" ON branches;
CREATE POLICY "insert_branches" ON branches FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_branches" ON branches;
CREATE POLICY "update_branches" ON branches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_branches" ON branches;
CREATE POLICY "delete_branches" ON branches FOR DELETE TO authenticated USING (true);

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  avatar_url text,
  roles text[] NOT NULL DEFAULT '{}',
  employment_type text DEFAULT 'daily' CHECK (employment_type IN ('daily','monthly')),
  is_active boolean DEFAULT true,
  profile_completed boolean DEFAULT false,
  start_date date,
  position text,
  bank_name text,
  bank_account text,
  bank_account_name text,
  qr_code_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager','finance']));
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_profiles_admin" ON profiles;
CREATE POLICY "update_profiles_admin" ON profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin']))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin']));
DROP POLICY IF EXISTS "insert_profiles" ON profiles;
CREATE POLICY "insert_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

-- ============ BRANCH MEMBERS ============
CREATE TABLE IF NOT EXISTS branch_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, branch_id)
);
ALTER TABLE branch_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_branch_members" ON branch_members;
CREATE POLICY "select_branch_members" ON branch_members FOR SELECT TO authenticated
USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager']));
DROP POLICY IF EXISTS "insert_branch_members" ON branch_members;
CREATE POLICY "insert_branch_members" ON branch_members FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_branch_members" ON branch_members;
CREATE POLICY "update_branch_members" ON branch_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_branch_members" ON branch_members;
CREATE POLICY "delete_branch_members" ON branch_members FOR DELETE TO authenticated USING (true);

-- ============ SHIFTS (before attendance) ============
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_shifts" ON shifts;
CREATE POLICY "select_shifts" ON shifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_shifts" ON shifts;
CREATE POLICY "insert_shifts" ON shifts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_shifts" ON shifts;
CREATE POLICY "update_shifts" ON shifts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_shifts" ON shifts;
CREATE POLICY "delete_shifts" ON shifts FOR DELETE TO authenticated USING (true);

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo' CHECK (status IN ('todo','doing','done','overdue')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  due_date timestamptz,
  completed_at timestamptz,
  submission_note text,
  attachment_urls text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_tasks" ON tasks;
CREATE POLICY "select_tasks" ON tasks FOR SELECT TO authenticated
USING (assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR assigned_by = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager']));
DROP POLICY IF EXISTS "insert_tasks" ON tasks;
CREATE POLICY "insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_tasks" ON tasks;
CREATE POLICY "update_tasks" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_tasks" ON tasks;
CREATE POLICY "delete_tasks" ON tasks FOR DELETE TO authenticated USING (true);

-- ============ TASK COMMENTS ============
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_task_comments" ON task_comments;
CREATE POLICY "select_task_comments" ON task_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_task_comments" ON task_comments;
CREATE POLICY "insert_task_comments" ON task_comments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_task_comments" ON task_comments;
CREATE POLICY "delete_task_comments" ON task_comments FOR DELETE TO authenticated USING (true);

-- ============ ATTENDANCE ============
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_gps_lat numeric,
  check_in_gps_lng numeric,
  check_out_gps_lat numeric,
  check_out_gps_lng numeric,
  selfie_url text,
  check_out_selfie_url text,
  shift_id uuid,
  work_hours numeric,
  late_minutes integer DEFAULT 0,
  late_deduction numeric DEFAULT 0,
  status text DEFAULT 'present' CHECK (status IN ('present','late','absent','leave','half_day')),
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_attendance" ON attendance;
CREATE POLICY "select_attendance" ON attendance FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager','finance']));
DROP POLICY IF EXISTS "insert_attendance" ON attendance;
CREATE POLICY "insert_attendance" ON attendance FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_attendance" ON attendance;
CREATE POLICY "update_attendance" ON attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ SHIFT ASSIGNMENTS ============
CREATE TABLE IF NOT EXISTS shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  assignment_date date NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','swapped','cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, assignment_date)
);
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_shift_assignments" ON shift_assignments;
CREATE POLICY "select_shift_assignments" ON shift_assignments FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager']));
DROP POLICY IF EXISTS "insert_shift_assignments" ON shift_assignments;
CREATE POLICY "insert_shift_assignments" ON shift_assignments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_shift_assignments" ON shift_assignments;
CREATE POLICY "update_shift_assignments" ON shift_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_shift_assignments" ON shift_assignments;
CREATE POLICY "delete_shift_assignments" ON shift_assignments FOR DELETE TO authenticated USING (true);

-- ============ LEAVE REQUESTS ============
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('sick','personal','vacation')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  medical_cert_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_leave_requests" ON leave_requests;
CREATE POLICY "select_leave_requests" ON leave_requests FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager','finance']));
DROP POLICY IF EXISTS "insert_leave_requests" ON leave_requests;
CREATE POLICY "insert_leave_requests" ON leave_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_leave_requests" ON leave_requests;
CREATE POLICY "update_leave_requests" ON leave_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ OT REQUESTS ============
CREATE TABLE IF NOT EXISTS ot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  ot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  ot_hours numeric,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ot_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_ot_requests" ON ot_requests;
CREATE POLICY "select_ot_requests" ON ot_requests FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','manager','finance']));
DROP POLICY IF EXISTS "insert_ot_requests" ON ot_requests;
CREATE POLICY "insert_ot_requests" ON ot_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ot_requests" ON ot_requests;
CREATE POLICY "update_ot_requests" ON ot_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ SALES RECORDS ============
CREATE TABLE IF NOT EXISTS sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  bill_count integer NOT NULL DEFAULT 0,
  channel_front numeric DEFAULT 0,
  channel_line_branch numeric DEFAULT 0,
  channel_line_oa numeric DEFAULT 0,
  pay_cash numeric DEFAULT 0,
  pay_transfer numeric DEFAULT 0,
  pay_card numeric DEFAULT 0,
  pay_qr numeric DEFAULT 0,
  category_food numeric DEFAULT 0,
  category_supplies numeric DEFAULT 0,
  category_service numeric DEFAULT 0,
  target_amount numeric DEFAULT 0,
  is_closed boolean DEFAULT false,
  closed_at timestamptz,
  cash_actual numeric,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_sales_records" ON sales_records;
CREATE POLICY "select_sales_records" ON sales_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_sales_records" ON sales_records;
CREATE POLICY "insert_sales_records" ON sales_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_sales_records" ON sales_records;
CREATE POLICY "update_sales_records" ON sales_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_sales_records" ON sales_records;
CREATE POLICY "delete_sales_records" ON sales_records FOR DELETE TO authenticated USING (true);

-- ============ SALES RETURNS ============
CREATE TABLE IF NOT EXISTS sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_name text,
  quantity numeric DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_sales_returns" ON sales_returns;
CREATE POLICY "select_sales_returns" ON sales_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_sales_returns" ON sales_returns;
CREATE POLICY "insert_sales_returns" ON sales_returns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_sales_returns" ON sales_returns;
CREATE POLICY "update_sales_returns" ON sales_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_sales_returns" ON sales_returns;
CREATE POLICY "delete_sales_returns" ON sales_returns FOR DELETE TO authenticated USING (true);

-- ============ SALES ISSUES ============
CREATE TABLE IF NOT EXISTS sales_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issue_type text,
  description text NOT NULL,
  is_escalated boolean DEFAULT false,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved','escalated')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_sales_issues" ON sales_issues;
CREATE POLICY "select_sales_issues" ON sales_issues FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_sales_issues" ON sales_issues;
CREATE POLICY "insert_sales_issues" ON sales_issues FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_sales_issues" ON sales_issues;
CREATE POLICY "update_sales_issues" ON sales_issues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_sales_issues" ON sales_issues;
CREATE POLICY "delete_sales_issues" ON sales_issues FOR DELETE TO authenticated USING (true);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  brand text,
  description text,
  cost_price numeric DEFAULT 0,
  retail_price numeric DEFAULT 0,
  image_url text,
  note text,
  min_stock integer DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

-- ============ PRODUCT BARCODES ============
CREATE TABLE IF NOT EXISTS product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  unit text DEFAULT 'piece' CHECK (unit IN ('piece','dozen','carton')),
  unit_multiplier numeric DEFAULT 1,
  UNIQUE (barcode)
);
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_product_barcodes" ON product_barcodes;
CREATE POLICY "select_product_barcodes" ON product_barcodes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_product_barcodes" ON product_barcodes;
CREATE POLICY "insert_product_barcodes" ON product_barcodes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_product_barcodes" ON product_barcodes;
CREATE POLICY "update_product_barcodes" ON product_barcodes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_product_barcodes" ON product_barcodes;
CREATE POLICY "delete_product_barcodes" ON product_barcodes FOR DELETE TO authenticated USING (true);

-- ============ STOCK LOTS ============
CREATE TABLE IF NOT EXISTS stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  lot_number text,
  lot_label text DEFAULT 'new' CHECK (lot_label IN ('old','new')),
  quantity numeric NOT NULL DEFAULT 0,
  cost_price numeric DEFAULT 0,
  received_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_stock_lots" ON stock_lots;
CREATE POLICY "select_stock_lots" ON stock_lots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_lots" ON stock_lots;
CREATE POLICY "insert_stock_lots" ON stock_lots FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_lots" ON stock_lots;
CREATE POLICY "update_stock_lots" ON stock_lots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_stock_lots" ON stock_lots;
CREATE POLICY "delete_stock_lots" ON stock_lots FOR DELETE TO authenticated USING (true);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('receive','withdraw','transfer_in','transfer_out','adjust')),
  type_config text,
  quantity numeric NOT NULL,
  lot_id uuid REFERENCES stock_lots(id) ON DELETE SET NULL,
  reference_note text,
  unit_price numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_stock_movements" ON stock_movements;
CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_movements" ON stock_movements;
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_movements" ON stock_movements;
CREATE POLICY "update_stock_movements" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_stock_movements" ON stock_movements;
CREATE POLICY "delete_stock_movements" ON stock_movements FOR DELETE TO authenticated USING (true);

-- ============ STOCK WITHDRAWAL TYPES ============
CREATE TABLE IF NOT EXISTS stock_withdrawal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  pricing_rule text DEFAULT 'retail' CHECK (pricing_rule IN ('retail','cost','online','zero')),
  platform_link text,
  allow_lot_select boolean DEFAULT true,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0
);
ALTER TABLE stock_withdrawal_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_stock_withdrawal_types" ON stock_withdrawal_types;
CREATE POLICY "select_stock_withdrawal_types" ON stock_withdrawal_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_withdrawal_types" ON stock_withdrawal_types;
CREATE POLICY "insert_stock_withdrawal_types" ON stock_withdrawal_types FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_withdrawal_types" ON stock_withdrawal_types;
CREATE POLICY "update_stock_withdrawal_types" ON stock_withdrawal_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ STOCK RECEIVING TYPES ============
CREATE TABLE IF NOT EXISTS stock_receiving_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  pricing_rule text DEFAULT 'cost' CHECK (pricing_rule IN ('cost','zero')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0
);
ALTER TABLE stock_receiving_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_stock_receiving_types" ON stock_receiving_types;
CREATE POLICY "select_stock_receiving_types" ON stock_receiving_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_receiving_types" ON stock_receiving_types;
CREATE POLICY "insert_stock_receiving_types" ON stock_receiving_types FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_receiving_types" ON stock_receiving_types;
CREATE POLICY "update_stock_receiving_types" ON stock_receiving_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ STOCK COUNT SESSIONS ============
CREATE TABLE IF NOT EXISTS stock_count_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  count_type text DEFAULT 'spot' CHECK (count_type IN ('spot','full')),
  status text DEFAULT 'open' CHECK (status IN ('open','completed')),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_count_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_stock_count_sessions" ON stock_count_sessions;
CREATE POLICY "select_stock_count_sessions" ON stock_count_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_count_sessions" ON stock_count_sessions;
CREATE POLICY "insert_stock_count_sessions" ON stock_count_sessions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_count_sessions" ON stock_count_sessions;
CREATE POLICY "update_stock_count_sessions" ON stock_count_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_stock_count_sessions" ON stock_count_sessions;
CREATE POLICY "delete_stock_count_sessions" ON stock_count_sessions FOR DELETE TO authenticated USING (true);

-- ============ PURCHASE REQUESTS ============
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]',
  total_amount numeric DEFAULT 0,
  supplier_name text,
  quotation_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','ordered')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  expected_delivery date,
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_requests" ON purchase_requests;
CREATE POLICY "select_purchase_requests" ON purchase_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_purchase_requests" ON purchase_requests;
CREATE POLICY "insert_purchase_requests" ON purchase_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_purchase_requests" ON purchase_requests;
CREATE POLICY "update_purchase_requests" ON purchase_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_purchase_requests" ON purchase_requests;
CREATE POLICY "delete_purchase_requests" ON purchase_requests FOR DELETE TO authenticated USING (true);

-- ============ PURCHASE ORDERS ============
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  purchase_request_id uuid REFERENCES purchase_requests(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','partial','received','cancelled')),
  ordered_date date,
  expected_date date,
  received_date date,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_orders" ON purchase_orders;
CREATE POLICY "select_purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_purchase_orders" ON purchase_orders;
CREATE POLICY "insert_purchase_orders" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_purchase_orders" ON purchase_orders;
CREATE POLICY "update_purchase_orders" ON purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_purchase_orders" ON purchase_orders;
CREATE POLICY "delete_purchase_orders" ON purchase_orders FOR DELETE TO authenticated USING (true);

-- ============ ONLINE ORDERS ============
CREATE TABLE IF NOT EXISTS online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('tiktok','shopee','lazada','line')),
  order_number text NOT NULL,
  customer_name text,
  customer_phone text,
  product_info text,
  amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric DEFAULT 0,
  shipping_fee numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','to_ship','shipped','completed','cancelled','returned')),
  shipping_provider text,
  tracking_number text,
  address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_online_orders" ON online_orders;
CREATE POLICY "select_online_orders" ON online_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_online_orders" ON online_orders;
CREATE POLICY "insert_online_orders" ON online_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_online_orders" ON online_orders;
CREATE POLICY "update_online_orders" ON online_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_online_orders" ON online_orders;
CREATE POLICY "delete_online_orders" ON online_orders FOR DELETE TO authenticated USING (true);

-- ============ ONLINE PLATFORM SETTINGS ============
CREATE TABLE IF NOT EXISTS online_platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE CHECK (platform IN ('tiktok','shopee','lazada','line')),
  margin_percent numeric DEFAULT 20,
  platform_fee_percent numeric DEFAULT 10,
  low_cost_margin_percent numeric DEFAULT 30,
  is_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE online_platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_online_platform_settings" ON online_platform_settings;
CREATE POLICY "select_online_platform_settings" ON online_platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_online_platform_settings" ON online_platform_settings;
CREATE POLICY "insert_online_platform_settings" ON online_platform_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_online_platform_settings" ON online_platform_settings;
CREATE POLICY "update_online_platform_settings" ON online_platform_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ PROMOTIONS ============
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric DEFAULT 0,
  start_date date,
  end_date date,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  total_sales numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_promotions" ON promotions;
CREATE POLICY "select_promotions" ON promotions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_promotions" ON promotions;
CREATE POLICY "insert_promotions" ON promotions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_promotions" ON promotions;
CREATE POLICY "update_promotions" ON promotions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_promotions" ON promotions;
CREATE POLICY "delete_promotions" ON promotions FOR DELETE TO authenticated USING (true);

-- ============ CONTENT PLANS ============
CREATE TABLE IF NOT EXISTS content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  platform text,
  content_type text,
  publish_date date,
  status text DEFAULT 'planned' CHECK (status IN ('planned','in_progress','published','cancelled')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_content_plans" ON content_plans;
CREATE POLICY "select_content_plans" ON content_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_content_plans" ON content_plans;
CREATE POLICY "insert_content_plans" ON content_plans FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_content_plans" ON content_plans;
CREATE POLICY "update_content_plans" ON content_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_content_plans" ON content_plans;
CREATE POLICY "delete_content_plans" ON content_plans FOR DELETE TO authenticated USING (true);

-- ============ CAMPAIGNS ============
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text,
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  actual_spend numeric DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  sales_generated numeric DEFAULT 0,
  roi numeric,
  status text DEFAULT 'planned' CHECK (status IN ('planned','active','completed','cancelled')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_campaigns" ON campaigns;
CREATE POLICY "select_campaigns" ON campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_campaigns" ON campaigns;
CREATE POLICY "insert_campaigns" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_campaigns" ON campaigns;
CREATE POLICY "update_campaigns" ON campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_campaigns" ON campaigns;
CREATE POLICY "delete_campaigns" ON campaigns FOR DELETE TO authenticated USING (true);

-- ============ SOCIAL POSTS ============
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text,
  post_date date,
  post_time time,
  caption text,
  media_url text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','scheduled','posted','failed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_social_posts" ON social_posts;
CREATE POLICY "select_social_posts" ON social_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_social_posts" ON social_posts;
CREATE POLICY "insert_social_posts" ON social_posts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_social_posts" ON social_posts;
CREATE POLICY "update_social_posts" ON social_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_social_posts" ON social_posts;
CREATE POLICY "delete_social_posts" ON social_posts FOR DELETE TO authenticated USING (true);

-- ============ CS RETURNS ============
CREATE TABLE IF NOT EXISTS cs_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  platform text,
  order_number text,
  product_name text,
  quantity numeric DEFAULT 1,
  amount numeric DEFAULT 0,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','refunded','rejected')),
  photo_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cs_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cs_returns" ON cs_returns;
CREATE POLICY "select_cs_returns" ON cs_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cs_returns" ON cs_returns;
CREATE POLICY "insert_cs_returns" ON cs_returns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cs_returns" ON cs_returns;
CREATE POLICY "update_cs_returns" ON cs_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_cs_returns" ON cs_returns;
CREATE POLICY "delete_cs_returns" ON cs_returns FOR DELETE TO authenticated USING (true);

-- ============ CS CLAIMS ============
CREATE TABLE IF NOT EXISTS cs_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  platform text,
  product_name text,
  issue_description text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','rejected')),
  photo_url text,
  resolution_note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cs_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cs_claims" ON cs_claims;
CREATE POLICY "select_cs_claims" ON cs_claims FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cs_claims" ON cs_claims;
CREATE POLICY "insert_cs_claims" ON cs_claims FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cs_claims" ON cs_claims;
CREATE POLICY "update_cs_claims" ON cs_claims FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_cs_claims" ON cs_claims;
CREATE POLICY "delete_cs_claims" ON cs_claims FOR DELETE TO authenticated USING (true);

-- ============ CS COMPLAINTS ============
CREATE TABLE IF NOT EXISTS cs_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  channel text,
  severity text DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  description text NOT NULL,
  is_escalated boolean DEFAULT false,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved','escalated')),
  resolution_note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cs_complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cs_complaints" ON cs_complaints;
CREATE POLICY "select_cs_complaints" ON cs_complaints FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cs_complaints" ON cs_complaints;
CREATE POLICY "insert_cs_complaints" ON cs_complaints FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cs_complaints" ON cs_complaints;
CREATE POLICY "update_cs_complaints" ON cs_complaints FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_cs_complaints" ON cs_complaints;
CREATE POLICY "delete_cs_complaints" ON cs_complaints FOR DELETE TO authenticated USING (true);

-- ============ CS FOLLOWUPS ============
CREATE TABLE IF NOT EXISTS cs_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  order_number text,
  followup_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cs_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cs_followups" ON cs_followups;
CREATE POLICY "select_cs_followups" ON cs_followups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cs_followups" ON cs_followups;
CREATE POLICY "insert_cs_followups" ON cs_followups FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cs_followups" ON cs_followups;
CREATE POLICY "update_cs_followups" ON cs_followups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ CS REVIEWS ============
CREATE TABLE IF NOT EXISTS cs_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text,
  customer_name text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  sentiment text CHECK (sentiment IN ('positive','neutral','negative')),
  is_negative boolean DEFAULT false,
  status text DEFAULT 'new' CHECK (status IN ('new','responded','ignored')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cs_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cs_reviews" ON cs_reviews;
CREATE POLICY "select_cs_reviews" ON cs_reviews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cs_reviews" ON cs_reviews;
CREATE POLICY "insert_cs_reviews" ON cs_reviews FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cs_reviews" ON cs_reviews;
CREATE POLICY "update_cs_reviews" ON cs_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ APPROVALS ============
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  request_data jsonb DEFAULT '{}',
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_approvals" ON approvals;
CREATE POLICY "select_approvals" ON approvals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_approvals" ON approvals;
CREATE POLICY "insert_approvals" ON approvals FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_approvals" ON approvals;
CREATE POLICY "update_approvals" ON approvals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ SALARY SETTINGS ============
CREATE TABLE IF NOT EXISTS salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  employment_type text DEFAULT 'daily' CHECK (employment_type IN ('daily','monthly')),
  monthly_salary numeric DEFAULT 0,
  daily_wage numeric DEFAULT 0,
  hourly_rate numeric DEFAULT 0,
  ot_rate numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE salary_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_salary_settings" ON salary_settings;
CREATE POLICY "select_salary_settings" ON salary_settings FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','finance']));
DROP POLICY IF EXISTS "insert_salary_settings" ON salary_settings;
CREATE POLICY "insert_salary_settings" ON salary_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_salary_settings" ON salary_settings;
CREATE POLICY "update_salary_settings" ON salary_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ SALARY ADVANCES ============
CREATE TABLE IF NOT EXISTS salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  request_date date NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','deducted')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  is_deducted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_salary_advances" ON salary_advances;
CREATE POLICY "select_salary_advances" ON salary_advances FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','finance']));
DROP POLICY IF EXISTS "insert_salary_advances" ON salary_advances;
CREATE POLICY "insert_salary_advances" ON salary_advances FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_salary_advances" ON salary_advances;
CREATE POLICY "update_salary_advances" ON salary_advances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ EMPLOYEE LOANS ============
CREATE TABLE IF NOT EXISTS employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loan_amount numeric NOT NULL DEFAULT 0,
  installments integer NOT NULL DEFAULT 1,
  monthly_payment numeric DEFAULT 0,
  remaining_balance numeric DEFAULT 0,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','active','completed')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_employee_loans" ON employee_loans;
CREATE POLICY "select_employee_loans" ON employee_loans FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.roles && ARRAY['owner','admin','super_admin','finance']));
DROP POLICY IF EXISTS "insert_employee_loans" ON employee_loans;
CREATE POLICY "insert_employee_loans" ON employee_loans FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_employee_loans" ON employee_loans;
CREATE POLICY "update_employee_loans" ON employee_loans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  is_read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_notifications" ON notifications;
CREATE POLICY "select_notifications" ON notifications FOR SELECT TO authenticated
USING (profile_id IS NULL OR profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE TO authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_attendance_profile_date ON attendance(profile_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales_records(branch_id, record_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_product_branch ON stock_lots(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_platform ON online_orders(platform);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING gin(roles);