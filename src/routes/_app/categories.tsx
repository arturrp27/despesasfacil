import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/categories")({
  head: () => ({ meta: [{ title: "Categorias — Controle Financeiro" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("despesa");
  const [color, setColor] = useState("#64748b");

  const catsQ = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const reset = () => {
    setEditId(null);
    setName("");
    setKind("despesa");
    setColor("#64748b");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe um nome.");
    const { data: u } = await supabase.auth.getUser();
    const payload = { user_id: u.user!.id, name, kind: kind as never, color };
    const { error } = editId
      ? await supabase
          .from("categories")
          .update({ name, kind: kind as never, color })
          .eq("id", editId)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Categoria salva.");
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["categories-all"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída.");
    qc.invalidateQueries({ queryKey: ["categories-all"] });
  };

  const edit = (c: { id: string; name: string; kind: string; color: string }) => {
    setEditId(c.id);
    setName(c.name);
    setKind(c.kind);
    setColor(c.color);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Suas categorias</h2>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Nova"} categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20"
                />
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(catsQ.data ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: c.color }} />
              <div className="flex-1">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{c.kind}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => edit(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
