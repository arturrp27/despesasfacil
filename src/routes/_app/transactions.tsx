import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateBR, toISO, competenceLabel } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Check, Pencil, Trash2, Search, Layers, Repeat } from "lucide-react";
import { TransactionDialog } from "@/components/transaction-dialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function parseIntStrict(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

function validateMonthYear(search: Record<string, unknown>): { month: number; year: number } {
  const now = new Date();
  const rawMonth = parseIntStrict(search.month);
  const rawYear = parseIntStrict(search.year);
  const month = rawMonth !== undefined && rawMonth >= 0 && rawMonth <= 11 ? rawMonth : now.getMonth();
  const year = rawYear !== undefined && rawYear >= 1900 && rawYear <= 9999 ? rawYear : now.getFullYear();
  return { month, year };
}

export const Route = createFileRoute("/_app/transactions")({
  validateSearch: validateMonthYear,
  head: () => ({ meta: [{ title: "Transações — Controle Financeiro" }] }),
  component: TransactionsPage,
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

function TransactionsPage() {
  const now = new Date();
  const searchParams = Route.useSearch();
  const qc = useQueryClient();
  const [year, setYear] = useState(searchParams.year ?? now.getFullYear());
  const [month, setMonth] = useState(
    searchParams.month !== undefined ? searchParams.month : now.getMonth(),
  );
  const [type, setType] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [category, setCategory] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTx, setDeleteTx] = useState<{
    id: string;
    installment_group_id: string | null;
    recurring_rule_id: string | null;
    due_date: string;
  } | null>(null);

  // Mês de referência (competência)
  const competence = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("name");
      return data ?? [];
    },
  });

  const txQ = useQuery({
    queryKey: ["transactions", "competence", competence],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name,color)")
        .eq("competence_month", competence)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (txQ.data ?? []).filter((t) => {
      if (type !== "todos" && t.type !== type) return false;
      if (status !== "todos" && t.status !== status) return false;
      if (category !== "todos" && t.category_id !== category) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txQ.data, type, status, category, search]);

  const monthSummary = useMemo(() => {
    const list = (txQ.data ?? []).filter((t) => t.type === "despesa");
    const total = list.reduce((a, b) => a + Number(b.amount), 0);
    const pago = list.filter((t) => t.status === "pago").reduce((a, b) => a + Number(b.amount), 0);
    return { total, pago, devedor: total - pago };
  }, [txQ.data]);

  const ensureSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      toast.error("Sua sessão expirou. Entre novamente para continuar.");
      return false;
    }
    return true;
  };

  const markPaid = async (id: string) => {
    try {
      if (!(await ensureSession())) return;
      // Atualização única e atômica, coerente com tx_payment_date_coherence
      const { data, error } = await supabase
        .from("transactions")
        .update({ status: "pago", payment_date: toISO(new Date()) })
        .eq("id", id)
        .eq("status", "pendente")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Nada foi atualizado.");
        return;
      }
      toast.success("Marcada como paga.");
      qc.invalidateQueries();
    } catch (e: unknown) {
      toast.error(friendlyError(e, "Não foi possível marcar como paga."));
    }
  };

  const removeTx = async (scope: "one" | "future") => {
    if (!deleteTx) return;
    const target = deleteTx;
    setDeleteTx(null);
    try {
      if (!(await ensureSession())) return;
      const { error } = await supabase.rpc("delete_transaction_scope", {
        p_transaction_id: target.id,
        p_scope: scope,
      });
      if (error) throw error;
      toast.success(scope === "future" ? "Transações excluídas." : "Transação excluída.");
      qc.invalidateQueries();
    } catch (e: unknown) {
      toast.error(friendlyError(e, "Não foi possível excluir a transação."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Despesas do mês</div>
            <div className="mt-1 text-base sm:text-xl font-semibold text-expense">
              {formatBRL(monthSummary.total)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/30 dark:bg-success/15 dark:border-success/40">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Já pago</div>
            <div className="mt-1 text-base sm:text-xl font-semibold text-success">
              {formatBRL(monthSummary.pago)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30 dark:bg-destructive/20 dark:border-destructive/50">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Ainda a pagar</div>
            <div className="mt-1 text-base sm:text-xl font-semibold text-destructive">
              {formatBRL(monthSummary.devedor)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
        <div className="relative col-span-2 md:flex-1 md:min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-full md:w-32">
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
          <SelectTrigger className="w-full md:w-24">
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
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="col-span-2 w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {(catsQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma transação encontrada.
            </CardContent>
          </Card>
        )}
        {filtered.map((t) => {
          const todayISO = toISO(new Date());
          const isOverdue =
            t.status === "pendente" && t.type === "despesa" && t.due_date < todayISO;
          const isPaid = t.status === "pago";
          const cardTone = isPaid
            ? "bg-success/15 border-success/40 dark:bg-success/20 dark:border-success/50"
            : isOverdue
              ? "bg-destructive/15 border-destructive/40 dark:bg-destructive/25 dark:border-destructive/60"
              : "";
          return (
            <Card key={t.id} className={cardTone}>
              <CardContent className="p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-xs font-medium shrink-0"
                  style={{
                    backgroundColor:
                      t.categories?.color ?? (t.type === "receita" ? "#22c55e" : "#ef4444"),
                  }}
                >
                  {(t.categories?.name ?? "•").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium truncate max-w-full">{t.description}</span>
                    {t.is_installment && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Layers className="h-3 w-3" />
                        Parcela
                      </Badge>
                    )}
                    {t.is_recurring && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Repeat className="h-3 w-3" />
                        Recorrente
                      </Badge>
                    )}
                    <Badge
                      variant={t.status === "pago" ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {t.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <div className="truncate">
                      {t.categories?.name ?? "Sem categoria"} •{" "}
                      {t.type === "receita" ? "Recebimento" : "Vence"} {formatDateBR(t.due_date)}
                    </div>
                    {t.type === "receita" &&
                      t.competence_month &&
                      t.competence_month.slice(0, 7) !== t.due_date.slice(0, 7) && (
                        <div className="italic">
                          Referência: {competenceLabel(t.competence_month)}
                        </div>
                      )}
                    {t.status === "pago" && t.payment_date && (
                      <div className="text-success font-medium">
                        Pago em {formatDateBR(t.payment_date)}
                      </div>
                    )}
                  </div>
                  <div
                    className={`sm:hidden mt-1 font-semibold text-sm ${t.type === "receita" ? "text-income" : "text-expense"}`}
                  >
                    {t.type === "despesa" ? "-" : "+"}
                    {formatBRL(t.amount)}
                  </div>
                </div>
                <div
                  className={`hidden sm:block text-right shrink-0 ${t.type === "receita" ? "text-income" : "text-expense"}`}
                >
                  <div className="font-semibold">
                    {t.type === "despesa" ? "-" : "+"}
                    {formatBRL(t.amount)}
                  </div>
                </div>
                <div className="flex gap-0.5 sm:gap-1 shrink-0">
                  {t.status === "pendente" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      onClick={() => markPaid(t.id)}
                      title="Marcar como pago"
                    >
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    onClick={() => {
                      setEditingId(t.id);
                      setDialogOpen(true);
                    }}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    onClick={() =>
                      setDeleteTx({
                        id: t.id,
                        installment_group_id: t.installment_group_id,
                        recurring_rule_id: t.recurring_rule_id,
                        due_date: t.due_date,
                      })
                    }
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingId(undefined);
        }}
        transactionId={editingId}
      />

      <AlertDialog open={!!deleteTx} onOpenChange={(v) => !v && setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTx && (deleteTx.installment_group_id || deleteTx.recurring_rule_id)
                ? "Esta transação faz parte de um grupo (parcelamento ou recorrência). Escolha o que excluir."
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteTx && (deleteTx.installment_group_id || deleteTx.recurring_rule_id) ? (
              <>
                <Button variant="outline" onClick={() => removeTx("one")}>
                  Somente esta
                </Button>
                <AlertDialogAction
                  onClick={() => removeTx("future")}
                  className="bg-destructive text-destructive-foreground"
                >
                  Esta e futuras
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => removeTx("one")}
                className="bg-destructive text-destructive-foreground"
              >
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
