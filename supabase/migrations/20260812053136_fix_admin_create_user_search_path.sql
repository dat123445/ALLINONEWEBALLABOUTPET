/*
# Fix admin_create_user to include pgcrypto in search_path

1. Modified Functions
- `admin_create_user` — added `pgcrypto` to search_path so gen_salt() and crypt() resolve correctly
*/
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth, pgcrypto
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

  -- Generate bcrypt password hash
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

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated, anon;
