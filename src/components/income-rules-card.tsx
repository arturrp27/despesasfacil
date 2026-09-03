import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseAmount } from "@/lib/format";
import { friendlyError } from "@/lib/errors";

type Kind = "vale" | "salario";

const LABELS: Record<Kind, { title: string; hint: string }> = {
  vale: { title: "Vale", hint: "Recebido no dia 20 do mês anterior, com referência no mês seguinte." },
  salario: { title: "Salário", hint: "Recebido no 5º dia útil do próprio mês de referência." },
};

type RuleState = { active: boolean; amount: string; applyFuture: boolean };

export function IncomeRulesCard() {
  const qc = useQueryClient();
  const [state, setState] = useState<Record<Kind, RuleState>>({
    vale: { active: false, amount: "", applyFuture: false },
    salario: { active: false, amount: "", applyFuture: false },
  });
  const [saving, setSaving] = useState<Kind | null>(null);

  const rulesQ = useQuery({
    queryKey: ["income_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("income_rules").select("id,kind,default_amount,active");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!rulesQ.data) return;
    setState((prev) => {
      const next = { ...prev };
      for (const r of rulesQ.data) {
        const k = r.kind as Kind;
        next[k] = {
          active: r.active,
          amount: String(r.default_amount).replace(".", ","),
          applyFuture: prev[k].applyFuture,
        };
      }
      return next;
    });
  }, [rulesQ.data]);

  const save = async (kind: Kind) => {
    const s = state[kind];
    const value = parseAmount(s.amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(kind);
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        toast.error("Sua sessão expirou. Entre novamente para continuar.");
        return;
      }
      const { error } = await supabase.rpc("upsert_income_rule", {
        p_kind: kind,
        p_default_amount: value,
        p_active: s.active,
        p_apply_future: s.applyFuture,
      });
      if (error) throw error;

      if (s.active) {
        const { error: genError } = await supabase.rpc("ensure_income_transactions", { p_months: 12 });
        if (genError) throw genError;
      }
      toast.success(`${LABELS[kind].title} atualizado.`);
      qc.invalidateQueries();
    } catch (e: unknown) {
      toast.error(friendlyError(e, "Não foi possível salvar a regra."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Receitas automáticas</CardTitle>
        <CardDescription>
          Configure uma vez e os lançamentos dos próximos 12 meses de referência são gerados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {(Object.keys(LABELS) as Kind[]).map((kind) => (
          <div key={kind} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{LABELS[kind].title}</Label>
                <p className="text-xs text-muted-foreground">{LABELS[kind].hint}</p>
              </div>
              <Switch
                checked={state[kind].active}
                onCheckedChange={(v) => setState((p) => ({ ...p, [kind]: { ...p[kind], active: v } }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Valor padrão</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={state[kind].amount}
                onChange={(e) => setState((p) => ({ ...p, [kind]: { ...p[kind], amount: e.target.value } }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Aplicar este valor aos meses futuros ainda pendentes (não altera meses já ajustados no passado).
              </p>
              <Switch
                checked={state[kind].applyFuture}
                onCheckedChange={(v) => setState((p) => ({ ...p, [kind]: { ...p[kind], applyFuture: v } }))}
              />
            </div>
            <Button size="sm" onClick={() => save(kind)} disabled={saving === kind}>
              {saving === kind ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
