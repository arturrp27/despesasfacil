import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CheckCircle2,
  Clock,
  CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Controle Financeiro" }] }),
  component: DashboardPage,
});

const monthsPT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Mês de referência (competência) — primeiro dia do mês
  const competence = useMemo(
    () => `${year}-${String(month + 1).padStart(2, "0")}-01`,
    [year, month],
  );

  const txQ = useQuery({
    queryKey: ["dashboard-tx", "competence", competence],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,type,description,amount,due_date,competence_month,payment_date,status")
        .eq("competence_month", competence)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const upcomingQ = useQuery({
    queryKey: ["dashboard-upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions")
        .select("id,description,amount,due_date,type,status")
        .eq("status", "pendente")
        .gte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const recentQ = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,description,amount,due_date,type,status")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const tx = txQ.data ?? [];
  const totalReceitas = tx
    .filter((t) => t.type === "receita")
    .reduce((a, b) => a + Number(b.amount), 0);
  const totalDespesas = tx
    .filter((t) => t.type === "despesa")
    .reduce((a, b) => a + Number(b.amount), 0);
  const totalPagas = tx
    .filter((t) => t.type === "despesa" && t.status === "pago")
    .reduce((a, b) => a + Number(b.amount), 0);
  const totalPendentes = tx
    .filter((t) => t.type === "despesa" && t.status === "pendente")
    .reduce((a, b) => a + Number(b.amount), 0);
  const saldo = totalReceitas - totalDespesas;

  const cards = [
    {
      label: "Saldo do mês",
      value: saldo,
      icon: Wallet,
      tone: saldo >= 0 ? "text-income" : "text-expense",
    },
    { label: "Receitas", value: totalReceitas, icon: ArrowUpRight, tone: "text-income" },
    {
      label: "Despesas",
      value: totalDespesas,
      icon: ArrowDownRight,
      tone: "text-expense",
      to: "/transactions",
      search: { month: now.getMonth(), year: now.getFullYear() },
    },
    { label: "Pagas", value: totalPagas, icon: CheckCircle2, tone: "text-success" },
    { label: "Pendentes", value: totalPendentes, icon: Clock, tone: "text-pending" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Olá! 👋</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthsPT.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => {
          const cardBody = (
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className={cn("h-4 w-4", c.tone)} />
              </div>
              <div className={cn("mt-2 text-lg md:text-xl font-semibold", c.tone)}>
                {formatBRL(c.value)}
              </div>
            </CardContent>
          );

          if (c.to) {
            return (
              <Link
                key={c.label}
                to={c.to}
                search={c.search}
                className="block rounded-xl transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-md"
                aria-label={
                  c.search
                    ? `Ver transações de ${monthsPT[c.search.month]} de ${c.search.year}`
                    : `Ir para ${c.label}`
                }
              >
                <Card className="cursor-pointer hover:border-expense/40 transition-colors">
                  {cardBody}
                </Card>
              </Link>
            );
          }

          return <Card key={c.label}>{cardBody}</Card>;
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Próximos vencimentos
            </CardTitle>
            <CardDescription>Pendentes a partir de hoje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(upcomingQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nada por aqui 🎉</p>
            )}
            {(upcomingQ.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <div className="text-sm font-medium">{t.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Vence em {formatDateBR(t.due_date)}
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${t.type === "receita" ? "text-income" : "text-expense"}`}
                >
                  {t.type === "despesa" ? "-" : "+"}
                  {formatBRL(t.amount)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transações recentes</CardTitle>
            <CardDescription>Últimas adicionadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            )}
            {(recentQ.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <div className="text-sm font-medium">{t.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {formatDateBR(t.due_date)}
                    <Badge
                      variant={t.status === "pago" ? "secondary" : "outline"}
                      className="h-5 text-[10px]"
                    >
                      {t.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${t.type === "receita" ? "text-income" : "text-expense"}`}
                >
                  {t.type === "despesa" ? "-" : "+"}
                  {formatBRL(t.amount)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
