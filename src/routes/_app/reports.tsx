import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Controle Financeiro" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const now = new Date();
  const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  const monthQ = useQuery({
    queryKey: ["reports-month", startMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("amount,type,status,description, categories(name,color)")
        .gte("due_date", startMonth).lte("due_date", endMonth);
      return data ?? [];
    },
  });

  const yearQ = useQuery({
    queryKey: ["reports-year", now.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("amount,type,due_date")
        .gte("due_date", `${now.getFullYear()}-01-01`)
        .lte("due_date", `${now.getFullYear()}-12-31`);
      return data ?? [];
    },
  });

  const byCategory = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    for (const t of monthQ.data ?? []) {
      if (t.type !== "despesa") continue;
      const name = t.categories?.name ?? "Sem categoria";
      const color = t.categories?.color ?? "#94a3b8";
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(t.amount);
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [monthQ.data]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(now.getFullYear(), i, 1).toLocaleDateString("pt-BR", { month: "short" }),
      receitas: 0, despesas: 0,
    }));
    for (const t of yearQ.data ?? []) {
      const m = Number(t.due_date.slice(5, 7)) - 1;
      if (t.type === "receita") months[m].receitas += Number(t.amount);
      else months[m].despesas += Number(t.amount);
    }
    return months;
  }, [yearQ.data]);

  const topExpenses = useMemo(() => {
    return (monthQ.data ?? [])
      .filter((t) => t.type === "despesa")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
  }, [monthQ.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução mensal ({now.getFullYear()})</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="receitas" fill="oklch(0.62 0.16 150)" name="Receitas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="oklch(0.6 0.22 25)" name="Despesas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria (mês)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byCategory.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                    {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Maiores despesas do mês</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topExpenses.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {topExpenses.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium">{t.description}</div>
                  <div className="text-xs text-muted-foreground">{t.categories?.name ?? "Sem categoria"}</div>
                </div>
                <span className="font-semibold text-expense">{formatBRL(t.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
