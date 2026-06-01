
-- ENUMs
CREATE TYPE public.transaction_type AS ENUM ('receita', 'despesa');
CREATE TYPE public.transaction_status AS ENUM ('pago', 'pendente');
CREATE TYPE public.payment_method AS ENUM ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'outro');
CREATE TYPE public.category_kind AS ENUM ('receita', 'despesa', 'ambos');
CREATE TYPE public.recurrence_frequency AS ENUM ('mensal', 'semanal', 'anual');
CREATE TYPE public.invoice_status AS ENUM ('aberta', 'fechada', 'paga');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL DEFAULT 'despesa',
  color TEXT NOT NULL DEFAULT '#64748b',
  icon TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories all" ON public.categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INSTALLMENT GROUPS
CREATE TABLE public.installment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  installments_count INT NOT NULL,
  first_due_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method public.payment_method,
  credit_card_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.installment_groups(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_groups TO authenticated;
GRANT ALL ON public.installment_groups TO service_role;
ALTER TABLE public.installment_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ig all" ON public.installment_groups FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RECURRING RULES
CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  frequency public.recurrence_frequency NOT NULL DEFAULT 'mensal',
  day_of_month INT,
  start_date DATE NOT NULL,
  end_date DATE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method public.payment_method,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.recurring_rules(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_rules TO authenticated;
GRANT ALL ON public.recurring_rules TO service_role;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rr all" ON public.recurring_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CREDIT CARDS
CREATE TABLE public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  closing_day INT NOT NULL,
  due_day INT NOT NULL,
  credit_limit NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_cards(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cc all" ON public.credit_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.installment_groups ADD CONSTRAINT installment_groups_card_fk
  FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE SET NULL;

-- CREDIT CARD INVOICES
CREATE TABLE public.credit_card_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  invoice_month DATE NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'aberta',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, invoice_month)
);
CREATE INDEX ON public.credit_card_invoices(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_invoices TO authenticated;
GRANT ALL ON public.credit_card_invoices TO service_role;
ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cci all" ON public.credit_card_invoices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status public.transaction_status NOT NULL DEFAULT 'pendente',
  payment_method public.payment_method,
  notes TEXT,
  is_installment BOOLEAN NOT NULL DEFAULT false,
  installment_group_id UUID REFERENCES public.installment_groups(id) ON DELETE CASCADE,
  installment_number INT,
  installment_total INT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  invoice_month DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions(user_id);
CREATE INDEX ON public.transactions(user_id, due_date);
CREATE INDEX ON public.transactions(installment_group_id);
CREATE INDEX ON public.transactions(recurring_rule_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx all" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto profile + default categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (NEW.id, 'Cartão de crédito', 'despesa', '#6366f1', 'credit-card'),
    (NEW.id, 'Impostos', 'despesa', '#64748b', 'landmark'),
    (NEW.id, 'Outros', 'despesa', '#94a3b8', 'more-horizontal'),
    (NEW.id, 'Salário', 'receita', '#22c55e', 'wallet'),
    (NEW.id, 'Freelance', 'receita', '#14b8a6', 'briefcase'),
    (NEW.id, 'Reembolso', 'receita', '#06b6d4', 'undo-2'),
    (NEW.id, 'Investimentos', 'receita', '#0ea5e9', 'trending-up'),
    (NEW.id, 'Outros', 'receita', '#84cc16', 'more-horizontal');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
