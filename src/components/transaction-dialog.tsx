import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addMonths, parseAmount, toISO } from "@/lib/format";
import { AlertTriangle, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId?: string;
};

type CategoryRow = { id: string; name: string; kind: string };
type CardRow = { id: string; name: string };
type EditScope = "one" | "future";


export function TransactionDialog({ open, onOpenChange, transactionId }: Props) {
  const qc = useQueryClient();
  const isEdit = !!transactionId;

  const [type, setType] = useState<"despesa" | "receita">("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(toISO(new Date()));
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<"pendente" | "pago">("pendente");
  const [paymentDate, setPaymentDate] = useState<string>(toISO(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [notes, setNotes] = useState("");

  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState(2);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"mensal" | "semanal" | "anual">("mensal");

  const [creditCardId, setCreditCardId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ installment_group_id: string | null; recurring_rule_id: string | null; due_date: string } | null>(null);
  const [editScope, setEditScope] = useState<EditScope>("one");
  const [originalInstallments, setOriginalInstallments] = useState<number>(0);
  const [loadedIsRecurring, setLoadedIsRecurring] = useState(false);
  const [loadedIsInstallment, setLoadedIsInstallment] = useState(false);



  const categoriesQ = useQuery({
    queryKey: ["categories"],

    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,kind").eq("active", true).order("name");
      if (error) throw error;
      return data as CategoryRow[];
    },
    enabled: open,
  });

  const cardsQ = useQuery({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_cards").select("id,name").eq("active", true).order("name");
      if (error) throw error;
      return data as CardRow[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setType("despesa"); setDescription(""); setAmount(""); setDueDate(toISO(new Date()));
      setCategoryId(""); setStatus("pendente"); setPaymentDate(toISO(new Date())); setPaymentMethod("pix"); setNotes("");
      setIsInstallment(false); setInstallments(2);
      setIsRecurring(false); setFrequency("mensal"); setCreditCardId("");
      setGroupInfo(null); setEditScope("one");
      setLoadedIsRecurring(false); setLoadedIsInstallment(false);
      return;
    }
    let ignore = false;
    (async () => {
      const { data } = await supabase.from("transactions").select("*").eq("id", transactionId!).maybeSingle();
      if (!data || ignore) return;
      setType(data.type);
      // Strip "(i/n)" suffix from installment description for editing
      const baseDesc = data.is_installment
        ? String(data.description).replace(/\s*\(\d+\/\d+\)\s*$/, "")
        : data.description;
      setDescription(baseDesc);
      setAmount(String(data.amount).replace(".", ","));
      setDueDate(data.due_date);
      setCategoryId(data.category_id ?? "");
      setStatus(data.status); setPaymentMethod(data.payment_method ?? "pix");
      setPaymentDate(data.payment_date ?? toISO(new Date()));
      setNotes(data.notes ?? "");
      setCreditCardId(data.credit_card_id ?? "");
      setGroupInfo({
        installment_group_id: data.installment_group_id ?? null,
        recurring_rule_id: data.recurring_rule_id ?? null,
        due_date: data.due_date,
      });
      setEditScope("one");
      setLoadedIsRecurring(data.is_recurring ?? false);
      setLoadedIsInstallment(data.is_installment ?? false);
      if (data.is_installment && data.installment_total) {
        setIsInstallment(true);
        setInstallments(data.installment_total);
        setOriginalInstallments(data.installment_total);
      } else {
        setIsInstallment(false);
        setOriginalInstallments(0);
      }
    })();
    return () => { ignore = true; };
  }, [open, isEdit, transactionId]);



  const filteredCats = (categoriesQ.data ?? []).filter(c => c.kind === type || c.kind === "ambos");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const valueNum = parseAmount(amount);
    if (!description.trim()) return toast.error("Informe uma descrição.");
    if (!valueNum || valueNum <= 0) return toast.error("Valor deve ser maior que zero.");
    if (!dueDate) return toast.error("Informe a data de vencimento.");

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user_id = u.user!.id;

      if (isEdit) {
        const igId = groupInfo?.installment_group_id ?? null;
        const rrId = groupInfo?.recurring_rule_id ?? null;
        const groupId = igId ?? rrId;

        // Reshape do grupo de parcelas (mudou a quantidade)
        if (igId && isInstallment && installments !== originalInstallments) {
          const newN = Math.max(1, Math.min(120, installments));
          const per = valueNum;
          const total = Math.round(per * newN * 100) / 100;

          // Busca data da primeira parcela
          const { data: grp } = await supabase.from("installment_groups")
            .select("first_due_date").eq("id", igId).maybeSingle();
          const firstDate = grp?.first_due_date ?? dueDate;

          // Atualiza todas as parcelas existentes (até newN)
          const { data: existing } = await supabase.from("transactions")
            .select("id, installment_number")
            .eq("installment_group_id", igId)
            .order("installment_number", { ascending: true });

          for (const row of existing ?? []) {
            if ((row.installment_number ?? 0) > newN) continue;
            await supabase.from("transactions").update({
              description: `${description} (${row.installment_number}/${newN})`,
              amount: per,
              category_id: categoryId || null,
              payment_method: paymentMethod as never,
              notes: notes || null,
              credit_card_id: creditCardId || null,
              installment_total: newN,
            }).eq("id", row.id);
          }

          // Excluir parcelas excedentes
          if (newN < originalInstallments) {
            await supabase.from("transactions").delete()
              .eq("installment_group_id", igId)
              .gt("installment_number", newN);
          }

          // Criar novas parcelas
          if (newN > originalInstallments) {
            const rows = [];
            for (let i = originalInstallments + 1; i <= newN; i++) {
              const d = addMonths(new Date(firstDate), i - 1);
              rows.push({
                user_id, type: "despesa" as const,
                description: `${description} (${i}/${newN})`,
                amount: per, due_date: toISO(d),
                category_id: categoryId || null,
                status: "pendente" as const,
                payment_method: paymentMethod as never,
                notes: notes || null,
                is_installment: true, installment_group_id: igId,
                installment_number: i, installment_total: newN,
                credit_card_id: creditCardId || null,
              });
            }
            if (rows.length) {
              const { error: insErr } = await supabase.from("transactions").insert(rows);
              if (insErr) throw insErr;
            }
          }

          await supabase.from("installment_groups").update({
            description, total_amount: total, installments_count: newN,
            category_id: categoryId || null,
            payment_method: paymentMethod as never,
            credit_card_id: creditCardId || null,
          }).eq("id", igId);

          toast.success(`Parcelamento atualizado para ${newN} parcelas.`);
        } else {
          const patch = {
            type, description, amount: valueNum, due_date: dueDate,
            category_id: categoryId || null, status, payment_method: paymentMethod as never,
            notes: notes || null, credit_card_id: creditCardId || null,
            payment_date: status === "pago" ? (paymentDate || toISO(new Date())) : null,
          };
          if (groupId && editScope === "future") {
            const col = igId ? "installment_group_id" : "recurring_rule_id";
            const { due_date: _omit, ...futurePatch } = patch;
            const { error } = await supabase.from("transactions")
              .update(futurePatch).eq(col, groupId)
              .gte("due_date", groupInfo!.due_date);
            if (error) throw error;
            toast.success("Esta e as transações futuras atualizadas.");
          } else {
            const { error } = await supabase.from("transactions").update(patch).eq("id", transactionId!);
            if (error) throw error;
            toast.success("Transação atualizada.");
          }
        }
      } else if (isRecurring && type === "despesa") {


        const { data: rule, error: ruleErr } = await supabase.from("recurring_rules").insert({
          user_id, description, amount: valueNum, frequency,
          day_of_month: Number(dueDate.slice(8, 10)),
          start_date: dueDate, category_id: categoryId || null,
          payment_method: paymentMethod as never,
        }).select().single();
        if (ruleErr) throw ruleErr;

        const rows = [];
        for (let i = 0; i < 12; i++) {
          const d = frequency === "mensal" ? addMonths(new Date(dueDate), i)
            : frequency === "anual" ? addMonths(new Date(dueDate), i * 12)
            : new Date(new Date(dueDate).getTime() + i * 7 * 86400000);
          rows.push({
            user_id, type, description, amount: valueNum, due_date: toISO(d),
            category_id: categoryId || null, status: "pendente" as const,
            payment_method: paymentMethod as never, notes: notes || null,
            is_recurring: true, recurring_rule_id: rule.id,
          });
        }
        const { error: txErr } = await supabase.from("transactions").insert(rows);
        if (txErr) throw txErr;
        await supabase.from("notifications").insert({
          user_id, kind: "new_transaction",
          title: "Recorrência criada",
          body: `${description} • 12 lançamentos gerados`,
          dedupe_key: `rec:${rule.id}`,
        });
        toast.success("Despesa recorrente criada (12 lançamentos).");
      } else if (isInstallment && type === "despesa") {
        const n = Math.max(2, Math.min(120, installments));
        const per = valueNum; // valor é por parcela
        const total = Math.round(per * n * 100) / 100;
        const { data: grp, error: grpErr } = await supabase.from("installment_groups").insert({
          user_id, description, total_amount: total, installments_count: n,
          first_due_date: dueDate, category_id: categoryId || null,
          payment_method: paymentMethod as never,
          credit_card_id: creditCardId || null,
        }).select().single();
        if (grpErr) throw grpErr;

        const rows = [];
        for (let i = 0; i < n; i++) {
          const d = addMonths(new Date(dueDate), i);
          rows.push({
            user_id, type: "despesa" as const,
            description: `${description} (${i + 1}/${n})`,
            amount: per, due_date: toISO(d), category_id: categoryId || null,
            status: "pendente" as const, payment_method: paymentMethod as never,
            notes: notes || null,
            is_installment: true, installment_group_id: grp.id,
            installment_number: i + 1, installment_total: n,
            credit_card_id: creditCardId || null,
          });
        }
        const { error: txErr } = await supabase.from("transactions").insert(rows);
        if (txErr) throw txErr;
        await supabase.from("notifications").insert({
          user_id, kind: "new_transaction",
          title: "Parcelamento criado",
          body: `${description} • ${n}x de R$ ${per.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,
          dedupe_key: `inst:${grp.id}`,
        });
        toast.success(`${n} parcelas criadas (total ${total.toLocaleString("pt-BR",{minimumFractionDigits:2})}).`);

      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id, type, description, amount: valueNum, due_date: dueDate,
          category_id: categoryId || null, status, payment_method: paymentMethod as never,
          notes: notes || null, credit_card_id: creditCardId || null,
          payment_date: status === "pago" ? (paymentDate || toISO(new Date())) : null,
        });
        if (error) throw error;
        toast.success("Transação criada.");
      }

      qc.invalidateQueries();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar transação" : "Nova transação"}</DialogTitle>
          <DialogDescription>Preencha os dados abaixo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Tabs value={type} onValueChange={(v) => setType(v as never)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="despesa" className="data-[state=active]:text-expense">Despesa</TabsTrigger>
              <TabsTrigger value="receita" className="data-[state=active]:text-income">Receita</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{isInstallment && !isEdit ? "Valor da parcela *" : "Valor *"}</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>

            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (cardsQ.data?.length ?? 0) > 0 && type === "despesa" && (
            <div className="space-y-2">
              <Label>Cartão (opcional)</Label>
              <Select value={creditCardId || "none"} onValueChange={(v) => setCreditCardId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cardsQ.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as never)} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="pendente" /> Pendente
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="pago" /> Pago
              </label>
            </RadioGroup>
          </div>

          {isEdit && (
            groupInfo?.installment_group_id ||
            groupInfo?.recurring_rule_id ||
            loadedIsRecurring ||
            loadedIsInstallment
          ) && (
            <div className="rounded-lg border border-pending p-3 space-y-2 bg-pending/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-pending" />
                <Label className="text-foreground">Aplicar alterações a</Label>
              </div>
              <RadioGroup value={editScope} onValueChange={(v) => setEditScope(v as EditScope)} className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="one" /> Somente esta transação
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="future" /> Esta e todas as futuras
                </label>
              </RadioGroup>
            </div>
          )}

          {status === "pago" && (
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Pode ser uma data passada ou futura.</p>
            </div>
          )}

          {isEdit && isInstallment && groupInfo?.installment_group_id && (
            <div className="rounded-lg border p-3 space-y-3">
              <Label>Parcelamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nº de parcelas</Label>
                  <Input type="number" min={1} max={120} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Total da compra</Label>
                  <Input disabled value={(parseAmount(amount) * Math.max(1, installments)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} />
                </div>
              </div>
              {installments !== originalInstallments && (
                <p className="text-xs text-muted-foreground">
                  Alterar o número irá {installments > originalInstallments ? `criar ${installments - originalInstallments} novas parcelas` : `excluir ${originalInstallments - installments} parcelas excedentes`} e reaplicar valor e descrição em todo o grupo.
                </p>
              )}
            </div>
          )}

          {!isEdit && type === "despesa" && (

            <>
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inst">Compra parcelada</Label>
                  <Switch id="inst" checked={isInstallment} onCheckedChange={(v) => { setIsInstallment(v); if (v) setIsRecurring(false); }} />
                </div>
                {isInstallment && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nº de parcelas</Label>
                      <Input type="number" min={2} max={120} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total da compra</Label>
                      <Input disabled value={(parseAmount(amount) * Math.max(1, installments)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} />
                    </div>
                  </div>
                )}

              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rec">Despesa recorrente</Label>
                  <Switch id="rec" checked={isRecurring} onCheckedChange={(v) => { setIsRecurring(v); if (v) setIsInstallment(false); }} />
                </div>
                {isRecurring && (
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as never)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Serão criados os próximos 12 lançamentos automaticamente.</p>
                  </div>
                )}
              </div>
            </>
          )}



          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
