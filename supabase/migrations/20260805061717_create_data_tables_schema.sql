/*
# Create data_tables schema for collaborative spreadsheet module

1. New Tables
- `data_tables`: Stores table metadata (name, who created/edited it, timestamps)
- `data_table_columns`: Column definitions per table (name, type, formula, width, order, frozen flag)
- `data_table_rows`: Row definitions per table (order, row color, height)
- `data_table_cells`: Cell values keyed by row + column, with optional cell color

2. Column Types
- text, number, date, select (tags), checkbox, formula, person

3. Security
- RLS enabled on all 4 tables
- All authenticated users get full CRUD (collaborative editing — everyone with module access can create/edit/delete tables)
- No ownership restriction — any authenticated user can edit any table

4. Important Notes
- Column type `formula` stores the formula expression in the `formula` column
- Column type `select` stores available options as a JSONB array in `options`
- Column type `person` stores a profile UUID in the cell value
- Cell values are always stored as text; the frontend parses them based on column type
- `order` columns use float8 to allow drag-reorder without reindexing
*/

CREATE TABLE IF NOT EXISTS data_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'ตารางใหม่',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  freeze_first_column boolean DEFAULT false,
  freeze_first_row boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE data_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_data_tables" ON data_tables;
CREATE POLICY "select_data_tables" ON data_tables FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_data_tables" ON data_tables;
CREATE POLICY "insert_data_tables" ON data_tables FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_data_tables" ON data_tables;
CREATE POLICY "update_data_tables" ON data_tables FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_data_tables" ON data_tables;
CREATE POLICY "delete_data_tables" ON data_tables FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS data_table_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'คอลัมน์',
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','number','date','select','checkbox','formula','person')),
  options jsonb DEFAULT '[]'::jsonb,
  formula text,
  width int DEFAULT 160,
  "order" float8 DEFAULT 0,
  frozen boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_table_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_data_table_columns" ON data_table_columns;
CREATE POLICY "select_data_table_columns" ON data_table_columns FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_data_table_columns" ON data_table_columns;
CREATE POLICY "insert_data_table_columns" ON data_table_columns FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_data_table_columns" ON data_table_columns;
CREATE POLICY "update_data_table_columns" ON data_table_columns FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_data_table_columns" ON data_table_columns;
CREATE POLICY "delete_data_table_columns" ON data_table_columns FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS data_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  "order" float8 DEFAULT 0,
  row_color text,
  height int DEFAULT 40,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_table_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_data_table_rows" ON data_table_rows;
CREATE POLICY "select_data_table_rows" ON data_table_rows FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_data_table_rows" ON data_table_rows;
CREATE POLICY "insert_data_table_rows" ON data_table_rows FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_data_table_rows" ON data_table_rows;
CREATE POLICY "update_data_table_rows" ON data_table_rows FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_data_table_rows" ON data_table_rows;
CREATE POLICY "delete_data_table_rows" ON data_table_rows FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS data_table_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES data_table_rows(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES data_table_columns(id) ON DELETE CASCADE,
  value text DEFAULT '',
  cell_color text,
  UNIQUE(row_id, column_id)
);

ALTER TABLE data_table_cells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_data_table_cells" ON data_table_cells;
CREATE POLICY "select_data_table_cells" ON data_table_cells FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_data_table_cells" ON data_table_cells;
CREATE POLICY "insert_data_table_cells" ON data_table_cells FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_data_table_cells" ON data_table_cells;
CREATE POLICY "update_data_table_cells" ON data_table_cells FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_data_table_cells" ON data_table_cells;
CREATE POLICY "delete_data_table_cells" ON data_table_cells FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_data_table_columns_table_id ON data_table_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_data_table_rows_table_id ON data_table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_data_table_cells_row_id ON data_table_cells(row_id);
CREATE INDEX IF NOT EXISTS idx_data_table_cells_column_id ON data_table_cells(column_id);
