-- 1) Remove credit card invoices
DROP TABLE IF EXISTS public.credit_card_invoices;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS invoice_month;
DROP TYPE IF EXISTS public.invoice_status;

-- 2) competence_month
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS competence_month date;
UPDATE public.transactions SET competence_month = date_trunc('month', due_date)::date WHERE competence_month IS NULL;

CREATE OR REPLACE FUNCTION public.set_competence_month()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'despesa' THEN
    NEW.competence_month := date_trunc('month', NEW.due_date)::date;
  ELSE
    NEW.competence_month := date_trunc('month', coalesce(NEW.competence_month, NEW.due_date))::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tx_competence ON public.transactions;
CREATE TRIGGER trg_tx_competence
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_competence_month();

ALTER TABLE public.transactions ALTER COLUMN competence_month SET NOT NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS tx_competence_first_day;
ALTER TABLE public.transactions
  ADD CONSTRAINT tx_competence_first_day
  CHECK (competence_month = date_trunc('month', competence_month)::date);

CREATE INDEX IF NOT EXISTS idx_tx_competence ON public.transactions (user_id, competence_month);

-- 3) update_transaction_scope: accepts competence month for receitas
CREATE OR REPLACE FUNCTION public.update_transaction_scope(p_transaction_id uuid, p_scope text, p_type transaction_type, p_description text, p_amount numeric, p_due_date date, p_status transaction_status, p_category_id uuid DEFAULT NULL::uuid, p_payment_method payment_method DEFAULT NULL::payment_method, p_notes text DEFAULT NULL::text, p_credit_card_id uuid DEFAULT NULL::uuid, p_payment_date date DEFAULT NULL::date, p_competence_month date DEFAULT NULL::date)
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

REVOKE ALL ON FUNCTION public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date, date) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.update_transaction_scope(uuid, text, transaction_type, text, numeric, date, transaction_status, uuid, payment_method, text, uuid, date);