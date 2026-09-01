-- ============================================================
-- 1) LEAST PRIVILEGE
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','credit_cards','credit_card_invoices','installment_groups','recurring_rules','transactions','notifications','user_settings','profiles','user_roles']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- ============================================================
-- 2) VALIDATION CONSTRAINTS (NOT VALID: existing rows untouched)
-- ============================================================
ALTER TABLE public.transactions
  ADD CONSTRAINT tx_amount_positive CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT tx_installment_range CHECK (installment_total IS NULL OR (installment_total BETWEEN 1 AND 120)) NOT VALID,
  ADD CONSTRAINT tx_installment_number_valid CHECK (
    installment_number IS NULL OR (installment_number >= 1 AND installment_total IS NOT NULL AND installment_number <= installment_total)
  ) NOT VALID,
  ADD CONSTRAINT tx_installment_coherence CHECK (
    (is_installment = false AND installment_group_id IS NULL AND installment_number IS NULL AND installment_total IS NULL)
    OR (is_installment = true AND installment_group_id IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT tx_recurring_coherence CHECK (
    (is_recurring = false AND recurring_rule_id IS NULL) OR (is_recurring = true AND recurring_rule_id IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT tx_payment_date_coherence CHECK (
    (status = 'pago' AND payment_date IS NOT NULL) OR (status = 'pendente' AND payment_date IS NULL)
  ) NOT VALID;

ALTER TABLE public.installment_groups
  ADD CONSTRAINT ig_total_positive CHECK (total_amount > 0) NOT VALID,
  ADD CONSTRAINT ig_count_range CHECK (installments_count BETWEEN 2 AND 120) NOT VALID;

ALTER TABLE public.recurring_rules
  ADD CONSTRAINT rr_amount_positive CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT rr_day_range CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31) NOT VALID,
  ADD CONSTRAINT rr_end_after_start CHECK (end_date IS NULL OR end_date >= start_date) NOT VALID;

ALTER TABLE public.credit_cards
  ADD CONSTRAINT cc_closing_day_range CHECK (closing_day BETWEEN 1 AND 31) NOT VALID,
  ADD CONSTRAINT cc_due_day_range CHECK (due_day BETWEEN 1 AND 31) NOT VALID,
  ADD CONSTRAINT cc_limit_positive CHECK (credit_limit IS NULL OR credit_limit > 0) NOT VALID;

ALTER TABLE public.user_settings
  ADD CONSTRAINT us_days_before_due_range CHECK (days_before_due BETWEEN 0 AND 60) NOT VALID;

-- ============================================================
-- 3) CROSS-TABLE OWNERSHIP ENFORCEMENT
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_same_owner_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF to_jsonb(NEW) ? 'transaction_id' AND (to_jsonb(NEW)->>'transaction_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = (to_jsonb(NEW)->>'transaction_id')::uuid AND x.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'invalid_transaction_owner';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_same_owner_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tx_owner_refs ON public.transactions;
CREATE TRIGGER trg_tx_owner_refs BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

DROP TRIGGER IF EXISTS trg_ig_owner_refs ON public.installment_groups;
CREATE TRIGGER trg_ig_owner_refs BEFORE INSERT OR UPDATE ON public.installment_groups
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

DROP TRIGGER IF EXISTS trg_rr_owner_refs ON public.recurring_rules;
CREATE TRIGGER trg_rr_owner_refs BEFORE INSERT OR UPDATE ON public.recurring_rules
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

DROP TRIGGER IF EXISTS trg_notif_owner_refs ON public.notifications;
CREATE TRIGGER trg_notif_owner_refs BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

DROP TRIGGER IF EXISTS trg_cci_owner_refs ON public.credit_card_invoices;
CREATE TRIGGER trg_cci_owner_refs BEFORE INSERT OR UPDATE ON public.credit_card_invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_owner_refs();

-- ============================================================
-- 4) TRANSACTIONAL RPCs (SECURITY INVOKER, RLS applies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_installment_plan(
  p_description text,
  p_amount numeric,
  p_installments integer,
  p_first_due_date date,
  p_category_id uuid DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_credit_card_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_group uuid; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF coalesce(btrim(p_description), '') = '' THEN RAISE EXCEPTION 'invalid_description'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_installments IS NULL OR p_installments < 2 OR p_installments > 120 THEN RAISE EXCEPTION 'invalid_installments'; END IF;
  IF p_first_due_date IS NULL THEN RAISE EXCEPTION 'invalid_due_date'; END IF;

  v_total := round(p_amount * p_installments, 2);

  INSERT INTO public.installment_groups (user_id, description, total_amount, installments_count, first_due_date, category_id, payment_method, credit_card_id)
  VALUES (v_uid, p_description, v_total, p_installments, p_first_due_date, p_category_id, p_payment_method, p_credit_card_id)
  RETURNING id INTO v_group;

  INSERT INTO public.transactions (user_id, type, description, amount, due_date, category_id, status, payment_method, notes,
    is_installment, installment_group_id, installment_number, installment_total, credit_card_id)
  SELECT v_uid, 'despesa', p_description || ' (' || i || '/' || p_installments || ')', p_amount,
    (p_first_due_date + ((i - 1) || ' month')::interval)::date, p_category_id, 'pendente', p_payment_method, p_notes,
    true, v_group, i, p_installments, p_credit_card_id
  FROM generate_series(1, p_installments) AS i;

  INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key)
  VALUES (v_uid, 'new_transaction', 'Parcelamento criado',
          p_description || ' • ' || p_installments || 'x de R$ ' || to_char(p_amount, 'FM999G999G990D00'),
          'inst:' || v_group::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_group;
END $$;

CREATE OR REPLACE FUNCTION public.create_recurring_expense(
  p_description text,
  p_amount numeric,
  p_frequency recurrence_frequency,
  p_start_date date,
  p_category_id uuid DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_occurrences integer DEFAULT 12
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.resize_installment_plan(
  p_group_id uuid,
  p_description text,
  p_amount numeric,
  p_installments integer,
  p_category_id uuid DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_credit_card_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
    credit_card_id = p_credit_card_id,
    installment_total = p_installments
  WHERE installment_group_id = p_group_id AND installment_number <= p_installments;

  INSERT INTO public.transactions (user_id, type, description, amount, due_date, category_id, status, payment_method, notes,
    is_installment, installment_group_id, installment_number, installment_total, credit_card_id)
  SELECT v_uid, 'despesa', p_description || ' (' || i || '/' || p_installments || ')', p_amount,
    (v_first + ((i - 1) || ' month')::interval)::date, p_category_id, 'pendente', p_payment_method, p_notes,
    true, p_group_id, i, p_installments, p_credit_card_id
  FROM generate_series(1, p_installments) AS i
  WHERE NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.installment_group_id = p_group_id AND t.installment_number = i
  );

  UPDATE public.installment_groups SET
    description = p_description,
    total_amount = v_total,
    installments_count = p_installments,
    category_id = p_category_id,
    payment_method = p_payment_method,
    credit_card_id = p_credit_card_id
  WHERE id = p_group_id;

  RETURN p_installments;
END $$;

CREATE OR REPLACE FUNCTION public.update_transaction_scope(
  p_transaction_id uuid,
  p_scope text,
  p_type transaction_type,
  p_description text,
  p_amount numeric,
  p_due_date date,
  p_status transaction_status,
  p_category_id uuid DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_credit_card_id uuid DEFAULT NULL,
  p_payment_date date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
      credit_card_id = p_credit_card_id,
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
      credit_card_id = p_credit_card_id,
      payment_date = v_pay
    WHERE id = p_transaction_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  IF v_count = 0 THEN RAISE EXCEPTION 'nothing_updated'; END IF;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.delete_transaction_scope(
  p_transaction_id uuid,
  p_scope text
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.transactions%ROWTYPE;
  v_count integer := 0;
  v_group uuid;
  v_rule uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_scope NOT IN ('one', 'future') THEN RAISE EXCEPTION 'invalid_scope'; END IF;

  SELECT * INTO v_row FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  v_group := v_row.installment_group_id;
  v_rule := v_row.recurring_rule_id;

  IF p_scope = 'future' AND coalesce(v_group, v_rule) IS NOT NULL THEN
    DELETE FROM public.notifications n
    USING public.transactions t
    WHERE n.transaction_id = t.id
      AND t.due_date >= v_row.due_date
      AND ((v_group IS NOT NULL AND t.installment_group_id = v_group) OR (v_group IS NULL AND t.recurring_rule_id = v_rule));

    DELETE FROM public.transactions t
    WHERE t.due_date >= v_row.due_date
      AND ((v_group IS NOT NULL AND t.installment_group_id = v_group) OR (v_group IS NULL AND t.recurring_rule_id = v_rule));
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    DELETE FROM public.notifications WHERE transaction_id = p_transaction_id;
    DELETE FROM public.transactions WHERE id = p_transaction_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- limpeza de grupos órfãos
  IF v_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE installment_group_id = v_group) THEN
    DELETE FROM public.installment_groups WHERE id = v_group;
  END IF;
  IF v_rule IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE recurring_rule_id = v_rule) THEN
    DELETE FROM public.recurring_rules WHERE id = v_rule;
  END IF;

  IF v_count = 0 THEN RAISE EXCEPTION 'nothing_deleted'; END IF;
  RETURN v_count;
END $$;

-- ============================================================
-- 5) FUNCTION PRIVILEGES
-- ============================================================
REVOKE ALL ON FUNCTION public.create_installment_plan(text, numeric, integer, date, uuid, payment_method, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_recurring_expense(text, numeric, recurrence_frequency, date, uuid, payment_method, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resize_installment_plan(uuid, text, numeric, integer, uuid, payment_method, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_transaction_scope(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_installment_plan(text, numeric, integer, date, uuid, payment_method, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_recurring_expense(text, numeric, recurrence_frequency, date, uuid, payment_method, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resize_installment_plan(uuid, text, numeric, integer, uuid, payment_method, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_transaction_scope(uuid, text) TO authenticated, service_role;