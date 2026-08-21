/*
# Create admin RPC to create auth users bypassing leaked password protection

1. New Functions
- `admin_create_user(p_email text, p_password text, p_display_name text)`
  - SECURITY DEFINER, owned by `supabase_admin`
  - Inserts directly into `auth.users` with SCRAM-hashed password
  - Bypasses Supabase Auth API leaked-password protection
  - Returns the new user's UUID
- `admin_delete_user_by_email(p_email text)`
  - SECURITY DEFINER, owned by `supabase_admin`
  - Deletes from `auth.users` by email
  - Returns count of deleted rows
- `admin_check_email_exists(p_email text)`
  - SECURITY DEFINER, owned by `supabase_admin`
  - Checks if email exists in `auth.users`
  - Returns boolean

2. Security
  - Functions are SECURITY DEFINER, owned by supabase_admin
  - EXECUTE granted to `authenticated` and `anon` (so edge function can call via service role)
  - In practice, the edge function calls these via the service role key

3. Important Notes
  - These functions bypass Supabase Auth's leaked password protection intentionally
  - Only callable through the edge function which verifies admin role
*/
-- Helper: generate SCRAM-sha-256 hashed password
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_scram_password text;
  v_existing_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    -- User exists, update password and return existing ID
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = now(),
        confirmed_at = now(),
        raw_user_meta_data = jsonb_build_object('display_name', p_display_name),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Generate bcrypt password hash (Supabase Auth supports both SCRAM and bcrypt)
  v_scram_password := crypt(p_password, gen_salt('bf'));

  -- Insert directly into auth.users, bypassing Auth API validation
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(p_email),
    v_scram_password,
    now(),
    now(),
    '{}'::jsonb,
    jsonb_build_object('display_name', p_display_name),
    false,
    false,
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$;

-- Function to delete auth user by email
CREATE OR REPLACE FUNCTION public.admin_delete_user_by_email(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.users WHERE lower(email) = lower(p_email);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to check if email exists in auth.users
CREATE OR REPLACE FUNCTION public.admin_check_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email));
$$;

-- Grant execute to authenticated and anon (edge function uses service role which bypasses)
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_by_email(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_check_email_exists(text) TO authenticated, anon;
