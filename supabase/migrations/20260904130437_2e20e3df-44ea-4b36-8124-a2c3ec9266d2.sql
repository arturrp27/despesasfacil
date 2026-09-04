REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.income_rules FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.income_rules FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.income_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_rules TO authenticated;
GRANT ALL ON public.income_rules TO service_role;