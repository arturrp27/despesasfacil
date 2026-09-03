-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.income_rule_kind AS ENUM ('vale', 'salario');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela de regras
CREATE TABLE IF NOT EXISTS public.income_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.income_rule_kind NOT NULL,
  default_amount numeric NOT NULL CHECK (default_amount > 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_rules TO authenticated;
GRANT ALL ON public.income_rules TO service_role;

ALTER TABLE public.income_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own income rules" ON public.income_rules;
CREATE POLICY "own income rules" ON public.income_rules
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_income_rules_updated ON public.income_rules;
CREATE TRIGGER trg_income_rules_updated BEFORE UPDATE ON public.income_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_income_rules_owner_refs ON public.income_rules;
CREATE TRIGGER trg_income_rules_owner_refs BEFORE INSERT OR UPDATE ON public.income_rules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

-- 3) Vínculo nas transações
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS income_rule_id uuid REFERENCES public.income_rules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_income_rule_competence_uidx
  ON public.transactions (income_rule_id, competence_month)
  WHERE income_rule_id IS NOT NULL;

-- ownership do income_rule_id
CREATE OR REPLACE FUNCTION public.enforce_same_owner_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'owner_required';
  END IF;

  IF to_jsonb(NEW) ? 'category_id' AND (to_jsonb(NEW)->>'category_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = (to_jsonb(NEW)->>'category_id')::uuid AND c.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_category_owner';
    END IF;
  END IF;

  IF to_jsonb(NEW) ? 'credit_card_id' AND (to_jsonb(NEW)->>'credit_card_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.credit_cards k WHERE k.id = (to_jsonb(NEW)->>'credit_card_id')::uuid AND k.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_card_owner';
    END IF;
  END IF;

  IF to_jsonb(NEW) ? 'installment_group_id' AND (to_jsonb(NEW)->>'installment_group_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.installment_groups g WHERE g.id = (to_jsonb(NEW)->>'installment_group_id')::uuid AND g.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_group_owner';
    END IF;
  END IF;

  IF to_jsonb(NEW) ? 'recurring_rule_id' AND (to_jsonb(NEW)->>'recurring_rule_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = (to_jsonb(NEW)->>'recurring_rule_id')::uuid AND r.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_rule_owner';
    END IF;
  END IF;

  IF to_jsonb(NEW) ? 'income_rule_id' AND (to_jsonb(NEW)->>'income_rule_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.income_rules ir WHERE ir.id = (to_jsonb(NEW)->>'income_rule_id')::uuid AND ir.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_income_rule_owner';
    END IF;
  END IF;

  IF to_jsonb(NEW) ? 'transaction_id' AND (to_jsonb(NEW)->>'transaction_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = (to_jsonb(NEW)->>'transaction_id')::uuid AND x.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_transaction_owner';
    END IF;
  END IF;

  RETURN NEW;
END $function$;

-- 4) Datas: 5º dia útil (seg-sex)
CREATE OR REPLACE FUNCTION public.nth_business_day(p_month date, p_n integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE d date := date_trunc('month', p_month)::date; c integer := 0;
BEGIN
  WHILE c < p_n LOOP
    IF EXTRACT(ISODOW FROM d) < 6 THEN c := c + 1; END IF;
    IF c < p_n THEN d := d + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.income_rule_due_date(p_kind public.income_rule_kind, p_competence date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_kind
    WHEN 'vale' THEN (date_trunc('month', p_competence)::date - interval '1 month')::date + 19
    ELSE public.nth_business_day(p_competence, 5)
  END
$$;

-- 5) Geração idempotente
CREATE OR REPLACE FUNCTION public.ensure_income_transactions(p_months integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_rule record;
  v_i integer;
  v_comp date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_months IS NULL OR p_months < 1 OR p_months > 24 THEN RAISE EXCEPTION 'invalid_occurrences'; END IF;

  FOR v_rule IN SELECT * FROM public.income_rules WHERE user_id = v_uid AND active LOOP
    FOR v_i IN 0..(p_months - 1) LOOP
      v_comp := (date_trunc('month', CURRENT_DATE) + (v_i || ' month')::interval)::date;

      INSERT INTO public.transactions (
        user_id, type, description, amount, due_date, competence_month,
        category_id, status, payment_method, income_rule_id
      )
      SELECT v_uid, 'receita',
        CASE v_rule.kind WHEN 'vale' THEN 'Vale' ELSE 'Salário' END,
        v_rule.default_amount,
        public.income_rule_due_date(v_rule.kind, v_comp),
        v_comp,
        v_rule.category_id, 'pendente', 'transferencia', v_rule.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.income_rule_id = v_rule.id AND t.competence_month = v_comp
      );

      v_inserted := v_inserted + coalesce((SELECT 1 WHERE FOUND), 0);
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END $$;

-- 6) Configuração da regra
CREATE OR REPLACE FUNCTION public.upsert_income_rule(
  p_kind public.income_rule_kind,
  p_default_amount numeric,
  p_active boolean DEFAULT true,
  p_category_id uuid DEFAULT NULL,
  p_apply_future boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_default_amount IS NULL OR p_default_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  INSERT INTO public.income_rules (user_id, kind, default_amount, category_id, active)
  VALUES (v_uid, p_kind, p_default_amount, p_category_id, coalesce(p_active, true))
  ON CONFLICT (user_id, kind) DO UPDATE
    SET default_amount = EXCLUDED.default_amount,
        category_id = EXCLUDED.category_id,
        active = EXCLUDED.active
  RETURNING id INTO v_id;

  IF p_apply_future THEN
    UPDATE public.transactions
    SET amount = p_default_amount, category_id = p_category_id
    WHERE income_rule_id = v_id
      AND status = 'pendente'
      AND competence_month > date_trunc('month', CURRENT_DATE)::date;
  END IF;

  IF NOT coalesce(p_active, true) THEN
    DELETE FROM public.notifications n USING public.transactions t
      WHERE n.transaction_id = t.id
        AND t.income_rule_id = v_id
        AND t.status = 'pendente'
        AND t.competence_month > date_trunc('month', CURRENT_DATE)::date;
    DELETE FROM public.transactions
      WHERE income_rule_id = v_id
        AND status = 'pendente'
        AND competence_month > date_trunc('month', CURRENT_DATE)::date;
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.ensure_income_transactions(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_income_rule(public.income_rule_kind, numeric, boolean, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.income_rule_due_date(public.income_rule_kind, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nth_business_day(date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_income_transactions(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_income_rule(public.income_rule_kind, numeric, boolean, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.income_rule_due_date(public.income_rule_kind, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nth_business_day(date, integer) TO authenticated, service_role;