/*
# Create Store Recommendation Evaluation System

## Purpose
Track whether each online store (across Shopee, Lazada, TikTok) meets the
platform's KPI criteria for "Recommended Shop" status. Users record actual
measured values per evaluation round, and the system auto-calculates pass/fail
against fixed criteria.

## New Tables

1. `store_eval_criteria` — Fixed KPI criteria per platform (seeded, not user-editable)
   - `id` (uuid PK)
   - `code` (text, unique) — e.g. SP-H01, LZ01, TT01
   - `platform` (text) — shopee / lazada / tiktok
   - `category` (text) — e.g. สถิติการจัดส่ง, บริการลูกค้า
   - `name` (text) — indicator name
   - `condition` (text) — <, <=, >, >=, =
   - `target_value` (numeric) — target threshold
   - `unit` (text) — %, วัน, รายการ, ครั้ง, คะแนน
   - `sort_order` (int) — display order
   - `created_at` (timestamptz)

2. `store_eval_stores` — Stores (a store can sell on multiple platforms)
   - `id` (uuid PK)
   - `name` (text) — store name
   - `brand` (text) — buddy / allabout
   - `created_at` (timestamptz)

3. `store_eval_store_platforms` — Junction: which platforms each store sells on
   - `id` (uuid PK)
   - `store_id` (uuid FK → store_eval_stores, CASCADE)
   - `platform` (text) — shopee / lazada / tiktok
   - UNIQUE(store_id, platform)

4. `store_eval_records` — Actual measured values per evaluation round
   - `id` (uuid PK)
   - `store_id` (uuid FK → store_eval_stores, CASCADE)
   - `platform` (text) — which platform this evaluation is for
   - `evaluation_date` (date) — round date
   - `criteria_code` (text) — references criteria code
   - `actual_value` (numeric) — user-entered measured value
   - `passed` (boolean) — auto-calculated pass/fail
   - `created_at` (timestamptz)

## Security
- RLS enabled on all tables, authenticated-only CRUD (shared business data)
- Same pattern as existing cs_pending_bills table

## Seed Data
- Shopee criteria (SP-H01 through SP-H07)
- Lazada criteria (LZ01 through LZ07)
- TikTok criteria (TT01 through TT06)
- Criteria are fixed reference data; users cannot add/edit/delete them
*/

-- ============ CRITERIA TABLE ============
CREATE TABLE IF NOT EXISTS store_eval_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  platform text NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  condition text NOT NULL,
  target_value numeric NOT NULL,
  unit text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_eval_criteria_platform_check CHECK (platform IN ('shopee', 'lazada', 'tiktok')),
  CONSTRAINT store_eval_criteria_condition_check CHECK (condition IN ('<', '<=', '>', '>=', '='))
);

ALTER TABLE store_eval_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_eval_criteria" ON store_eval_criteria;
CREATE POLICY "select_store_eval_criteria" ON store_eval_criteria FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_store_eval_criteria" ON store_eval_criteria;
CREATE POLICY "insert_store_eval_criteria" ON store_eval_criteria FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_store_eval_criteria" ON store_eval_criteria;
CREATE POLICY "update_store_eval_criteria" ON store_eval_criteria FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_store_eval_criteria" ON store_eval_criteria;
CREATE POLICY "delete_store_eval_criteria" ON store_eval_criteria FOR DELETE
  TO authenticated USING (true);

-- ============ STORES TABLE ============
CREATE TABLE IF NOT EXISTS store_eval_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_eval_stores_brand_check CHECK (brand IN ('buddy', 'allabout'))
);

ALTER TABLE store_eval_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_eval_stores" ON store_eval_stores;
CREATE POLICY "select_store_eval_stores" ON store_eval_stores FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_store_eval_stores" ON store_eval_stores;
CREATE POLICY "insert_store_eval_stores" ON store_eval_stores FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_store_eval_stores" ON store_eval_stores;
CREATE POLICY "update_store_eval_stores" ON store_eval_stores FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_store_eval_stores" ON store_eval_stores;
CREATE POLICY "delete_store_eval_stores" ON store_eval_stores FOR DELETE
  TO authenticated USING (true);

-- ============ STORE-PLATFORM JUNCTION TABLE ============
CREATE TABLE IF NOT EXISTS store_eval_store_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store_eval_stores(id) ON DELETE CASCADE,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, platform),
  CONSTRAINT store_eval_store_platforms_platform_check CHECK (platform IN ('shopee', 'lazada', 'tiktok'))
);

ALTER TABLE store_eval_store_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_eval_store_platforms" ON store_eval_store_platforms;
CREATE POLICY "select_store_eval_store_platforms" ON store_eval_store_platforms FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_store_eval_store_platforms" ON store_eval_store_platforms;
CREATE POLICY "insert_store_eval_store_platforms" ON store_eval_store_platforms FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_store_eval_store_platforms" ON store_eval_store_platforms;
CREATE POLICY "update_store_eval_store_platforms" ON store_eval_store_platforms FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_store_eval_store_platforms" ON store_eval_store_platforms;
CREATE POLICY "delete_store_eval_store_platforms" ON store_eval_store_platforms FOR DELETE
  TO authenticated USING (true);

-- ============ EVALUATION RECORDS TABLE ============
CREATE TABLE IF NOT EXISTS store_eval_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store_eval_stores(id) ON DELETE CASCADE,
  platform text NOT NULL,
  evaluation_date date NOT NULL,
  criteria_code text NOT NULL,
  actual_value numeric NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_eval_records_platform_check CHECK (platform IN ('shopee', 'lazada', 'tiktok'))
);

ALTER TABLE store_eval_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_eval_records" ON store_eval_records;
CREATE POLICY "select_store_eval_records" ON store_eval_records FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_store_eval_records" ON store_eval_records;
CREATE POLICY "insert_store_eval_records" ON store_eval_records FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_store_eval_records" ON store_eval_records;
CREATE POLICY "update_store_eval_records" ON store_eval_records FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_store_eval_records" ON store_eval_records;
CREATE POLICY "delete_store_eval_records" ON store_eval_records FOR DELETE
  TO authenticated USING (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_store_eval_records_store_platform_date
  ON store_eval_records(store_id, platform, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_eval_records_criteria_code
  ON store_eval_records(criteria_code);

-- ============ SEED CRITERIA DATA ============
-- Shopee criteria
INSERT INTO store_eval_criteria (code, platform, category, name, condition, target_value, unit, sort_order) VALUES
  ('SP-H01', 'shopee', 'สถิติการจัดส่ง', 'อัตราการจัดส่งสำเร็จ (ไม่ส่งช้า)', '>=', 99, '%', 1),
  ('SP-H02', 'shopee', 'สถิติการจัดส่ง', 'อัตราส่งช้า (สูงสุดที่รับได้)', '<=', 1, '%', 2),
  ('SP-H03', 'shopee', 'สถิติการจัดส่ง', 'อัตราการเตรียมสินค้า (Preparation)', '>=', 98, '%', 3),
  ('SP-H04', 'shopee', 'บริการลูกค้า', 'อัตราการตอบแชท (Response Rate)', '>=', 95, '%', 4),
  ('SP-H05', 'shopee', 'บริการลูกค้า', 'เวลาตอบแชทเฉลี่ย (Response Time)', '<=', 5, 'ชม.', 5),
  ('SP-H06', 'shopee', 'คุณภาพร้านค้า', 'คะแนนรีวิวเฉลี่ย (Shop Rating)', '>=', 4.8, 'คะแนน', 6),
  ('SP-H07', 'shopee', 'คุณภาพร้านค้า', 'อัตราคำสั่งซื้อที่ไม่ถูกปฏิเสธ (Non-Prevalence Order)', '<=', 1, '%', 7)
ON CONFLICT (code) DO NOTHING;

-- Lazada criteria
INSERT INTO store_eval_criteria (code, platform, category, name, condition, target_value, unit, sort_order) VALUES
  ('LZ01', 'lazada', 'สถิติการจัดส่ง', 'อัตราการจัดส่งตรงเวลา (On-Time Delivery)', '>=', 95, '%', 1),
  ('LZ02', 'lazada', 'สถิติการจัดส่ง', 'อัตราการจัดส่งล่าช้า (Late Shipment)', '<=', 2, '%', 2),
  ('LZ03', 'lazada', 'บริการลูกค้า', 'อัตราการตอบคำถาม (Chat Response Rate)', '>=', 90, '%', 3),
  ('LZ04', 'lazada', 'บริการลูกค้า', 'เวลาตอบคำถามเฉลี่ย (Chat Response Time)', '<=', 12, 'ชม.', 4),
  ('LZ05', 'lazada', 'คุณภาพร้านค้า', 'คะแนนร้านค้าเฉลี่ย (Seller Rating)', '>=', 4.7, 'คะแนน', 5),
  ('LZ06', 'lazada', 'คุณภาพร้านค้า', 'อัตราการยกเลิกคำสั่งซื้อ (Cancellation Rate)', '<=', 2, '%', 6),
  ('LZ07', 'lazada', 'คุณภาพร้านค้า', 'อัตราส่งคืนสินค้า (Return Rate)', '<=', 1, '%', 7)
ON CONFLICT (code) DO NOTHING;

-- TikTok criteria
INSERT INTO store_eval_criteria (code, platform, category, name, condition, target_value, unit, sort_order) VALUES
  ('TT01', 'tiktok', 'สถิติการจัดส่ง', 'อัตราการจัดส่งตรงเวลา (Ship On-Time)', '>=', 97, '%', 1),
  ('TT02', 'tiktok', 'สถิติการจัดส่ง', 'อัตราส่งช้า (Late Dispatch)', '<=', 2, '%', 2),
  ('TT03', 'tiktok', 'บริการลูกค้า', 'อัตราการตอบภายใน 24 ชม. (24h Response)', '>=', 95, '%', 3),
  ('TT04', 'tiktok', 'คุณภาพร้านค้า', 'คะแนนร้านค้า (Shop Score)', '>=', 4.5, 'คะแนน', 4),
  ('TT05', 'tiktok', 'คุณภาพร้านค้า', 'อัตราคำสั่งซื้อที่มีปัญหา (Order Issue Rate)', '<=', 1, '%', 5),
  ('TT06', 'tiktok', 'คุณภาพร้านค้า', 'อัตราการรีวิวเป็นบวก (Positive Review Rate)', '>=', 98, '%', 6)
ON CONFLICT (code) DO NOTHING;