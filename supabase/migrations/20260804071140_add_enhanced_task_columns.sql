-- Add new columns to tasks table for enhanced MyDay features
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_color text DEFAULT '#6366f1';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_ids uuid[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_frequency text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_end_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS skip_holidays boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminders text[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_status text;
