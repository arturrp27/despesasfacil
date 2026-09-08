-- 1) Drop functions that reference credit cards / payment_method type
DROP FUNCTION IF EXISTS public.create_installment_plan(text, numeric, integer, date, uuid, payment_method, uuid, text);
DROP FUNCTION IF EXISTS public.resize_installment_plan(uuid, text, numeric, integer, uuid, payment_method, uuid, text);
DROP FUNCTION IF EXISTS public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date, date);
DROP FUNCTION IF EXISTS public.create_recurring_expense(text, numeric, recurrence_frequency, date, uuid, payment_method, text, integer);

-- 2) Drop credit card columns and table
ALTER TABLE public.transactions DROP COLUMN IF EXISTS credit_card_id;
ALTER TABLE public.installment_groups DROP COLUMN IF EXISTS credit_card_id;
DROP TABLE IF EXISTS public.credit_cards CASCADE;

-- 3) Remove 'credito' from payment_method enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'credito'
  ) THEN
    ALTER TYPE public.payment_method RENAME TO payment_method_old;
    CREATE TYPE public.payment_method AS ENUM ('pix','dinheiro','debito','boleto','transferencia','outro');
    ALTER TABLE public.transactions ALTER COLUMN payment_method TYPE public.payment_method USING payment_method::text::public.payment_method;
    ALTER TABLE public.installment_groups ALTER COLUMN payment_method TYPE public.payment_method USING payment_method::text::public.payment_method;
    ALTER TABLE public.recurring_rules ALTER COLUMN payment_method TYPE public.payment_method USING payment_method::text::public.payment_method;
    DROP TYPE public.payment_method_old;
  END IF;
END $$;

-- 4) Ownership trigger without credit card checks
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

-- 5) Recreate RPCs without credit card params
CREATE OR REPLACE FUNCTION public.create_installment_plan(
  p_description text, p_amount numeric, p_installments integer, p_first_due_date date,
  p_category_id uuid DEFAULT NULL, p_payment_method public.payment_method DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_group uuid; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF coalesce(btrim(p_description), '') = '' THEN RAISE EXCEPTION 'invalid_description'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_installments IS NULL OR p_installments < 2 OR p_installments > 120 THEN RAISE EXCEPTION 'invalid_installments'; END IF;
  IF p_first_due_date IS NULL THEN RAISE EXCEPTION 'invalid_due_date'; END IF;

  v_total := round(p_amount * p_installments, 2);

  INSERT INTO public.installment_groups (user_id, description, total_amount, installments_count, first_due_date, category_id, payment_method)
  VALUES (v_uid, p_description, v_total, p_installments, p_first_due_date, p_category_id, p_payment_method)
  RETURNING id INTO v_group;

  INSERT INTO public.transactions (user_id, type, description, amount, due_date, category_id, status, payment_method, notes,
    is_installment, installment_group_id, installment_number, installment_total)
  SELECT v_uid, 'despesa', p_description || ' (' || i || '/' || p_installments || ')', p_amount,
    (p_first_due_date + ((i - 1) || ' month')::interval)::date, p_category_id, 'pendente', p_payment_method, p_notes,
    true, v_group, i, p_installments
  FROM generate_series(1, p_installments) AS i;

  INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key)
  VALUES (v_uid, 'new_transaction', 'Parcelamento criado',
          p_description || ' • ' || p_installments || 'x de R$ ' || to_char(p_amount, 'FM999G999G990D00'),
          'inst:' || v_group::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_group;
END $function$;

CREATE OR REPLACE FUNCTION public.resize_installment_plan(
  p_group_id uuid, p_description text, p_amount numeric, p_installments integer,
  p_category_id uuid DEFAULT NULL, p_payment_method public.payment_method DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_first date; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_installments IS NULL OR p_installments < 2 OR p_installments > 120 THEN RAISE EXCEPTION 'invalid_installments'; END IF;

  SELECT first_due_date INTO v_first FROM public.installment_groups WHERE id = p_group_id;
  IF v_first IS NULL THEN RAISE EXCEPTION 'group_not_found'; END IF;

  v_total := round(p_amount * p_installments, 2);

  DELETE FROM public.transactions WHERE installment_group_id = p_group_id AND installment_number > p_installments;

  UPDATE public.transactions SET
    description = p_description || ' (' || installment_number || '/' || p_installments || ')',
    amount = p_amount,
    category_id = p_category_id,
    payment_method = p_payment_method,
    notes = p_notes,
    installment_total = p_installments
  WHERE installment_group_id = p_group_id AND installment_number <= p_installments;

  INSERT INTO public.transactions (user_id, type, description, amount, due_date, category_id, status, payment_method, notes,
    is_installment, installment_group_id, installment_number, installment_total)
  SELECT v_uid, 'despesa', p_description || ' (' || i || '/' || p_installments || ')', p_amount,
    (v_first + ((i - 1) || ' month')::interval)::date, p_category_id, 'pendente', p_payment_method, p_notes,
    true, p_group_id, i, p_installments
  FROM generate_series(1, p_installments) AS i
  WHERE NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.installment_group_id = p_group_id AND t.installment_number = i
  );

  UPDATE public.installment_groups SET
    description = p_description,
    total_amount = v_total,
    installments_count = p_installments,
    category_id = p_category_id,
    payment_method = p_payment_method
  WHERE id = p_group_id;

  RETURN p_installments;
END $function$;

CREATE OR REPLACE FUNCTION public.update_transaction_scope(
  p_transaction_id uuid, p_scope text, p_type public.transaction_type, p_description text, p_amount numeric,
  p_due_date date, p_status public.transaction_status, p_category_id uuid DEFAULT NULL,
  p_payment_method public.payment_method DEFAULT NULL, p_notes text DEFAULT NULL,
  p_payment_date date DEFAULT NULL, p_competence_month date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.transactions%ROWTYPE;
  v_pay date;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF coalesce(btrim(p_description), '') = '' THEN RAISE EXCEPTION 'invalid_description'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_scope NOT IN ('one', 'future') THEN RAISE EXCEPTION 'invalid_scope'; END IF;

  SELECT * INTO v_row FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  v_pay := CASE WHEN p_status = 'pago' THEN coalesce(p_payment_date, CURRENT_DATE) ELSE NULL END;

  IF p_scope = 'future' AND coalesce(v_row.installment_group_id, v_row.recurring_rule_id) IS NOT NULL THEN
    UPDATE public.transactions SET
      type = p_type,
      description = CASE WHEN is_installment AND installment_number IS NOT NULL AND installment_total IS NOT NULL
                         THEN p_description || ' (' || installment_number || '/' || installment_total || ')'
                         ELSE p_description END,
      amount = p_amount,
      category_id = p_category_id,
      status = p_status,
      payment_method = p_payment_method,
      notes = p_notes,
      payment_date = CASE WHEN p_status = 'pago' THEN coalesce(payment_date, v_pay) ELSE NULL END
    WHERE due_date >= v_row.due_date
      AND (
        (v_row.installment_group_id IS NOT NULL AND installment_group_id = v_row.installment_group_id)
        OR (v_row.installment_group_id IS NULL AND recurring_rule_id = v_row.recurring_rule_id)
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE public.transactions SET
      type = p_type,
      description = CASE WHEN is_installment AND installment_number IS NOT NULL AND installment_total IS NOT NULL
                         THEN p_description || ' (' || installment_number || '/' || installment_total || ')'
                         ELSE p_description END,
      amount = p_amount,
      due_date = p_due_date,
      category_id = p_category_id,
      status = p_status,
      payment_method = p_payment_method,
      notes = p_notes,
      payment_date = v_pay,
      competence_month = CASE WHEN p_type = 'receita'
                              THEN date_trunc('month', coalesce(p_competence_month, p_due_date))::date
                              ELSE date_trunc('month', p_due_date)::date END
    WHERE id = p_transaction_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  IF v_count = 0 THEN RAISE EXCEPTION 'nothing_updated'; END IF;
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.create_recurring_expense(
  p_description text, p_amount numeric, p_frequency public.recurrence_frequency, p_start_date date,
  p_category_id uuid DEFAULT NULL, p_payment_method public.payment_method DEFAULT NULL,
  p_notes text DEFAULT NULL, p_occurrences integer DEFAULT 12)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_rule uuid; v_step interval;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF coalesce(btrim(p_description), '') = '' THEN RAISE EXCEPTION 'invalid_description'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_start_date IS NULL THEN RAISE EXCEPTION 'invalid_due_date'; END IF;
  IF p_occurrences IS NULL OR p_occurrences < 1 OR p_occurrences > 120 THEN RAISE EXCEPTION 'invalid_occurrences'; END IF;

  v_step := CASE p_frequency WHEN 'mensal' THEN '1 month'::interval WHEN 'anual' THEN '1 year'::interval ELSE '7 days'::interval END;

  INSERT INTO public.recurring_rules (user_id, description, amount, frequency, day_of_month, start_date, category_id, payment_method)
  VALUES (v_uid, p_description, p_amount, p_frequency, EXTRACT(DAY FROM p_start_date)::int, p_start_date, p_category_id, p_payment_method)
  RETURNING id INTO v_rule;

  INSERT INTO public.transactions (user_id, type, description, amount, due_date, category_id, status, payment_method, notes, is_recurring, recurring_rule_id)
  SELECT v_uid, 'despesa', p_description, p_amount, (p_start_date + (i * v_step))::date, p_category_id, 'pendente', p_payment_method, p_notes, true, v_rule
  FROM generate_series(0, p_occurrences - 1) AS i;

  INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key)
  VALUES (v_uid, 'new_transaction', 'Recorrência criada', p_description || ' • ' || p_occurrences || ' lançamentos gerados', 'rec:' || v_rule::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_rule;
END $function$;

-- 6) Least privilege on the new function signatures
REVOKE ALL ON FUNCTION public.create_installment_plan(text, numeric, integer, date, uuid, public.payment_method, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resize_installment_plan(uuid, text, numeric, integer, uuid, public.payment_method, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_transaction_scope(uuid, text, public.transaction_type, text, numeric, date, public.transaction_status, uuid, public.payment_method, text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_recurring_expense(text, numeric, public.recurrence_frequency, date, uuid, public.payment_method, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_installment_plan(text, numeric, integer, date, uuid, public.payment_method, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resize_installment_plan(uuid, text, numeric, integer, uuid, public.payment_method, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_transaction_scope(uuid, text, public.transaction_type, text, numeric, date, public.transaction_status, uuid, public.payment_method, text, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_recurring_expense(text, numeric, public.recurrence_frequency, date, uuid, public.payment_method, text, integer) TO authenticated, service_role;

-- 7) New-user seed without the credit card category
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.categories (user_id, name, kind, color, icon) VALUES
    (NEW.id, 'Casa', 'despesa', '#ef4444', 'home'),
    (NEW.id, 'Alimentação', 'despesa', '#f97316', 'utensils'),
    (NEW.id, 'Transporte', 'despesa', '#eab308', 'car'),
    (NEW.id, 'Saúde', 'despesa', '#10b981', 'heart-pulse'),
    (NEW.id, 'Educação', 'despesa', '#3b82f6', 'graduation-cap'),
    (NEW.id, 'Lazer', 'despesa', '#a855f7', 'gamepad-2'),
    (NEW.id, 'Assinaturas', 'despesa', '#ec4899', 'repeat'),
    (NEW.id, 'Impostos', 'despesa', '#64748b', 'landmark'),
    (NEW.id, 'Outros', 'despesa', '#94a3b8', 'more-horizontal'),
    (NEW.id, 'Salário', 'receita', '#22c55e', 'wallet'),
    (NEW.id, 'Freelance', 'receita', '#14b8a6', 'briefcase'),
    (NEW.id, 'Reembolso', 'receita', '#06b6d4', 'undo-2'),
    (NEW.id, 'Investimentos', 'receita', '#0ea5e9', 'trending-up'),
    (NEW.id, 'Outros', 'receita', '#84cc16', 'more-horizontal');
  RETURN NEW;
END; $function$;