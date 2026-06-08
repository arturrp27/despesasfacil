
-- User settings (notification preferences)
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  days_before_due INTEGER NOT NULL DEFAULT 3 CHECK (days_before_due >= 0 AND days_before_due <= 60),
  notify_due BOOLEAN NOT NULL DEFAULT true,
  notify_new_transactions BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notifications inbox
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('due_soon','overdue','new_transaction')),
  title TEXT NOT NULL,
  body TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notifications_user_dedupe ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user_created ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Backfill settings for existing users
INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_settings(user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- Function to generate due-soon notifications for all users (called by cron)
CREATE OR REPLACE FUNCTION public.generate_due_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.notifications(user_id, kind, title, body, transaction_id, dedupe_key)
    SELECT
      t.user_id,
      CASE WHEN t.due_date < CURRENT_DATE THEN 'overdue' ELSE 'due_soon' END,
      CASE WHEN t.due_date < CURRENT_DATE
           THEN 'Vencida: ' || t.description
           ELSE 'Vence em breve: ' || t.description END,
      'R$ ' || to_char(t.amount, 'FM999G999G990D00') ||
      ' • ' || to_char(t.due_date, 'DD/MM/YYYY'),
      t.id,
      'due:' || t.id::text || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
    FROM public.transactions t
    JOIN public.user_settings s ON s.user_id = t.user_id AND s.notify_due = true
    WHERE t.status = 'pendente'
      AND t.type = 'despesa'
      AND t.due_date <= CURRENT_DATE + s.days_before_due
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END; $$;
