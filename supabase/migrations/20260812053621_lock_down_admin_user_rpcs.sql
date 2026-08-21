/*
# Lock down privileged user-management RPCs

1. Security Changes
- Remove direct execution from anonymous and authenticated browser roles.
- Allow execution only to the service role used inside the protected edge function.
- The edge function continues to verify the caller is an active administrator before invoking these functions.
*/
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_user_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_check_email_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_check_email_exists(text) TO service_role;
