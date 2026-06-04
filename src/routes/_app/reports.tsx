import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Controle Financeiro" }] }),
  component: ReportsPage,
});

const monthsPT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type PeriodMode = "month" | "year";

function ReportsPage() {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [monthFrom, setMonthFrom] = useState(now.getMonth());
  const [monthTo, setMonthTo] = useState(now.getMonth());

  const pad = (n: number) => String(n).padStart(2, "0");
  const mFrom = Math.min(monthFrom, monthTo);
  const mTo = Math.max(monthFrom, monthTo);
  const lastDay = new Date(year, mTo + 1, 0).getDate();
  const startMonth = `${year}-${pad(mFrom + 1)}-01`;
  const endMonth = `${year}-${pad(mTo + 1)}-${pad(lastDay)}`;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const selectCols = "amount,type,status,description,due_date,categories(name,color)";

  const monthQ = useQuery({
    queryKey: ["reports-month", startMonth, endMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select(selectCols)
        .gte("due_date", startMonth).lte("due_date", endMonth);
      return data ?? [];
    },
  });

  const yearQ = useQuery({
    queryKey: ["reports-year", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select(selectCols)
        .gte("due_date", yearStart)
        .lte("due_date", yearEnd);
      return data ?? [];
    },
  });


  const periodData = mode === "month" ? (monthQ.data ?? []) : (yearQ.data ?? []);

  const byCategory = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    for (const t of periodData) {
      if (t.type !== "despesa") continue;
      const name = (t as any).categories?.name ?? "Sem categoria";
      const color = (t as any).categories?.color ?? "#94a3b8";
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(t.amount);
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [periodData]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleDateString("pt-BR", { month: "short" }),
      receitas: 0, despesas: 0,
    }));
    for (const t of yearQ.data ?? []) {
      const m = Number(t.due_date.slice(5, 7)) - 1;
      if (t.type === "receita") months[m].receitas += Number(t.amount);
      else months[m].despesas += Number(t.amount);
    }
    return months;
  }, [yearQ.data, year]);

  const topExpenses = useMemo(() => {
    return (periodData)
      .filter((t) => t.type === "despesa")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
  }, [periodData]);

  const summary = useMemo(() => {
    const receitas = periodData.filter((t) => t.type === "receita").reduce((a, b) => a + Number(b.amount), 0);
    const despesas = periodData.filter((t) => t.type === "despesa").reduce((a, b) => a + Number(b.amount), 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [periodData]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <Button variant={mode === "month" ? "default" : "outline"} size="sm" onClick={() => setMode("month")}>Mensal</Button>
              <Button variant={mode === "year" ? "default" : "outline"} size="sm" onClick={() => setMode("year")}>Anual</Button>
            </div>
            {mode === "month" && (
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthsPT.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do período */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Receitas</div>
            <div className="mt-1 text-base sm:text-xl font-semibold text-income">{formatBRL(summary.receitas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Despesas</div>
            <div className="mt-1 text-base sm:text-xl font-semibold text-expense">{formatBRL(summary.despesas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Saldo</div>
            <div className={`mt-1 text-base sm:text-xl font-semibold ${summary.saldo >= 0 ? "text-income" : "text-expense"}`}>{formatBRL(summary.saldo)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução mensal ({year})</CardTitle></CardHeader>
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
          <CardHeader>
            <CardTitle className="text-base">
              Despesas por categoria {mode === "month" ? `(${monthsPT[month]} ${year})` : `(${year})`}
            </CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle className="text-base">
              Maiores despesas {mode === "month" ? `(${monthsPT[month]} ${year})` : `(${year})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topExpenses.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {topExpenses.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium">{(t as any).description}</div>
                  <div className="text-xs text-muted-foreground">{(t as any).categories?.name ?? "Sem categoria"}</div>
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
