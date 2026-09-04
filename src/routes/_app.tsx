import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  // Mantém sempre uma janela de 12 competências futuras de Vale/Salário (idempotente)
  useEffect(() => {
    if (!user) return;
    let ignore = false;
    (async () => {
      const { data, error } = await supabase.rpc("ensure_income_transactions", { p_months: 12 });
      if (ignore) return;
      if (error) {
        console.error("[income-rules]", error);
        return;
      }
      if ((data ?? 0) > 0) {
        for (const key of ["transactions", "dashboard-tx", "dashboard-upcoming", "dashboard-recent", "reports-month", "reports-year"]) {
          qc.invalidateQueries({ queryKey: [key] });
        }
      }
    })();
    return () => { ignore = true; };
  }, [user, qc]);


  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Wallet className="h-6 w-6 animate-pulse text-success" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
