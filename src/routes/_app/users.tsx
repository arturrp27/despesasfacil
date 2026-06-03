import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createAppUser, listAppUsers } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Usuários — Controle Financeiro" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);

  const usersQ = useQuery({ queryKey: ["app-users"], queryFn: () => listFn({}) });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Senha mínima de 6 caracteres.");
    setBusy(true);
    try {
      await createFn({ data: { email, password, display_name: name || email.split("@")[0] } });
      toast.success("Usuário criado.");
      setEmail(""); setName(""); setPassword("");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Novo usuário</CardTitle>
          <CardDescription>O cadastro público está desativado. Crie novos acessos por aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar usuário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {usersQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {(usersQ.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <div className="text-sm font-medium">{u.display_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="text-xs text-muted-foreground">{formatDateBR(u.created_at)}</div>
            </div>
          ))}
          {usersQ.data && usersQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
