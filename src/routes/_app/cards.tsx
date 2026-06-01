import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CreditCard, Trash2, Pencil } from "lucide-react";
import { parseAmount, formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/cards")({
  head: () => ({ meta: [{ title: "Cartões — Controle Financeiro" }] }),
  component: CardsPage,
});

function CardsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState(5);
  const [dueDay, setDueDay] = useState(15);
  const [limit, setLimit] = useState("");

  const cardsQ = useQuery({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").order("name");
      return data ?? [];
    },
  });

  const reset = () => { setEditId(null); setName(""); setClosingDay(5); setDueDay(15); setLimit(""); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe um nome.");
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      user_id: u.user!.id, name,
      closing_day: closingDay, due_day: dueDay,
      credit_limit: limit ? parseAmount(limit) : null,
    };
    const { error } = editId
      ? await supabase.from("credit_cards").update(payload).eq("id", editId)
      : await supabase.from("credit_cards").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cartão salvo.");
    setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir cartão?")) return;
    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído.");
    qc.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const edit = (c: { id: string; name: string; closing_day: number; due_day: number; credit_limit: number | null }) => {
    setEditId(c.id); setName(c.name); setClosingDay(c.closing_day); setDueDay(c.due_day);
    setLimit(c.credit_limit ? String(c.credit_limit).replace(".", ",") : "");
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Seus cartões</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} cartão</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} /></div>
              </div>
              <div className="space-y-2"><Label>Limite (opcional)</Label><Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" /></div>
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(cardsQ.data ?? []).length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum cartão cadastrado.</CardContent></Card>
      )}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(cardsQ.data ?? []).map((c) => (
          <Card key={c.id} className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <CreditCard className="h-5 w-5" />
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-white/10" onClick={() => edit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-white/10" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="font-semibold text-lg">{c.name}</div>
              <div className="text-xs opacity-80 flex justify-between">
                <span>Fecha dia {c.closing_day}</span>
                <span>Vence dia {c.due_day}</span>
              </div>
              {c.credit_limit && <div className="text-xs opacity-90">Limite: {formatBRL(c.credit_limit)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
