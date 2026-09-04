-- 1) Menor privilégio em public.income_rules
REVOKE ALL PRIVILEGES ON TABLE public.income_rules FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.income_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_rules TO authenticated;
GRANT ALL ON public.income_rules TO service_role;
ALTER TABLE public.income_rules ENABLE ROW LEVEL SECURITY;

-- 2) ensure_income_transactions como SECURITY INVOKER, idempotente
CREATE OR REPLACE FUNCTION public.ensure_income_transactions(p_months integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_rows integer := 0;
  v_rule record;
  v_i integer;
  v_comp date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_months IS NULL OR p_months < 1 OR p_months > 24 THEN
    RAISE EXCEPTION 'invalid_occurrences';
  END IF;

  FOR v_rule IN
    SELECT * FROM public.income_rules WHERE user_id = v_uid AND active
  LOOP
    FOR v_i IN 0..(p_months - 1) LOOP
      v_comp := (date_trunc('month', CURRENT_DATE) + make_interval(months => v_i))::date;

      INSERT INTO public.transactions (
        user_id, type, description, amount, due_date, competence_month,
        category_id, status, payment_method, income_rule_id
      )
      VALUES (
        v_uid, 'receita',
        CASE v_rule.kind WHEN 'vale' THEN 'Vale' ELSE 'Salário' END,
        v_rule.default_amount,
        public.income_rule_due_date(v_rule.kind, v_comp),
        v_comp,
        v_rule.category_id, 'pendente', 'transferencia', v_rule.id
      )
      ON CONFLICT (income_rule_id, competence_month)
        WHERE income_rule_id IS NOT NULL
      DO NOTHING;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_inserted := v_inserted + v_rows;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END
$function$;

REVOKE ALL ON FUNCTION public.ensure_income_transactions(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_income_transactions(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_income_transactions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_income_transactions(integer) TO service_role;