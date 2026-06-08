
REVOKE EXECUTE ON FUNCTION public.generate_due_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_settings() TO service_role;
