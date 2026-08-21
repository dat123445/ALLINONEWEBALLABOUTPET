/*
# Fix admin user creation for generated confirmation timestamp

1. Modified Functions
- `admin_create_user` — lets Supabase generate `confirmed_at` automatically instead of writing to its generated column
*/
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth, extensions
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_password_hash text;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = now(),
        raw_user_meta_data = jsonb_build_object('display_name', p_display_name),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  v_password_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous, created_at, updated_at
  )
  VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', lower(p_email), v_password_hash,
    now(), '{}'::jsonb, jsonb_build_object('display_name', p_display_name),
    false, false, now(), now()
  );

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated, anon;
